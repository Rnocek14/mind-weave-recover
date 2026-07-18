/**
 * Extensive quality suite for the review conversation.
 *
 * Two layers:
 *  1. FUZZ — hundreds of randomized sessions (random personas mixing speech,
 *     gibberish, silence, repair answers, skips) with INVARIANTS checked
 *     after every single turn. If any sequence of user behavior can make the
 *     conversation loop, flog a word, or credit without production, this
 *     finds it.
 *  2. PERSONAS — realistic user types played end-to-end, with "stupidity
 *     detectors" over the full transcript: the specific behaviors that make
 *     people say "this chatbot is dumb."
 */
import { describe, it, expect } from "vitest";
import {
  startReview,
  onUserUtterance,
  onRepairAnswer,
  onSkipTopic,
  onFinishRequest,
  onSilence,
  MAX_MAYA_TURNS,
  MAX_ATTEMPTS_PER_ITEM,
  type ReviewState,
  type ReviewEvent,
  type EngineTurn,
} from "@/lib/reviewConversation";

// ─── Deterministic PRNG so failures are reproducible by seed ───────────────
function mulberry32(seed: number) {
  return () => {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const WORDS = [
  { word: "garden", category: "nature", struggled: true },
  { word: "spoon", category: "household", struggled: false },
  { word: "jacket", category: "clothing", struggled: true },
  { word: "apple", category: "food", struggled: false },
];

const GIBBERISH = ["um", "uh well", "the the the", "i went to the place", "what", "she said no", "over there maybe", "tuesday i think"];

interface SessionLog {
  turns: EngineTurn[];
  userActions: string[];
}

/** Drive one full session with a random policy; assert invariants per turn. */
function runFuzzSession(seed: number): SessionLog {
  const rand = mulberry32(seed);
  const pick = <T,>(arr: T[]): T => arr[Math.floor(rand() * arr.length)];

  let turn = startReview(WORDS);
  const log: SessionLog = { turns: [turn], userActions: ["<start>"] };
  const completedAtSomePoint = new Set<string>();

  let steps = 0;
  while (turn.state.phase !== "done" && steps < 60) {
    steps++;
    const roll = rand();
    let action: string;

    if (turn.state.phase === "repair" && roll < 0.5) {
      const yes = rand() < 0.5;
      action = `repairButton:${yes}`;
      turn = onRepairAnswer(turn.state, yes);
    } else if (roll < 0.45) {
      // Speech: gibberish, a pending word, an already-done word, or empty noise
      const r2 = rand();
      let text: string;
      if (r2 < 0.35) text = `${pick(GIBBERISH)} ${steps}`;
      else if (r2 < 0.6) text = `i like the ${pick(WORDS).word}`;
      else if (r2 < 0.7) text = "";
      else if (r2 < 0.8) text = "yes";
      else text = pick(WORDS).word;
      const confidence = rand() < 0.3 ? 0.3 : 0.9;
      const alternatives = rand() < 0.2 ? [{ transcript: pick(WORDS).word, confidence: 0.4 }] : [];
      action = `speech:"${text}"@${confidence}`;
      turn = onUserUtterance(turn.state, text, alternatives, confidence);
    } else if (roll < 0.6) {
      action = "silence";
      turn = onSilence(turn.state);
    } else if (roll < 0.75) {
      action = "skipTopic";
      turn = onSkipTopic(turn.state);
    } else if (roll < 0.8) {
      action = "finish";
      turn = onFinishRequest(turn.state);
    } else {
      // spam: repeat the previous action's transcript verbatim
      action = 'speech:"the the the"@0.9 (dup)';
      turn = onUserUtterance(turn.state, "the the the", [], 0.9);
    }
    log.turns.push(turn);
    log.userActions.push(action);

    // ── INVARIANTS (checked EVERY turn) ────────────────────────────────────
    const s = turn.state;
    const ctx = `seed=${seed} step=${steps} action=${action}`;

    // 1. Turn budget is never exceeded
    expect(s.mayaTurns, `${ctx}: turn budget blown`).toBeLessThanOrEqual(MAX_MAYA_TURNS + 1);

    // 2. Completed items never regress to pending
    for (const item of s.items) {
      if (item.status !== "pending") completedAtSomePoint.add(item.word);
    }
    for (const w of completedAtSomePoint) {
      const item = s.items.find((i) => i.word === w)!;
      expect(item.status, `${ctx}: "${w}" regressed to pending`).not.toBe("pending");
    }

    // 3. Attempts per item never exceed the cap (first frame + one cue).
    //    Re-frames after spontaneous detours are attempt-free by design.
    for (const item of s.items) {
      expect(item.attempts, `${ctx}: "${item.word}" flogged`).toBeLessThanOrEqual(MAX_ATTEMPTS_PER_ITEM);
    }

    // 4. Production events only for words that actually hold that status
    for (const e of turn.events) {
      if (e.type === "spontaneous_use" || e.type === "elicited_use" || e.type === "cued_use") {
        const item = s.items.find((i) => i.word === e.word);
        expect(item, `${ctx}: event for unknown word`).toBeTruthy();
        expect(
          ["spontaneous", "elicited", "cued"].includes(item!.status),
          `${ctx}: praise without production for "${e.word}"`,
        ).toBe(true);
      }
    }

    // 5. Repair state always knows what it is repairing
    if (s.phase === "repair") {
      expect(s.repairWord, `${ctx}: repair without a word`).toBeTruthy();
    }
  }

  // 6. Every session terminates
  expect(turn.state.phase, `seed=${seed}: session never terminated`).toBe("done");

  // 7. Summary accounting is exact
  const complete = log.turns.flatMap((t) => t.events).find((e) => e.type === "review_complete");
  expect(complete, `seed=${seed}: no completion event`).toBeTruthy();
  if (complete && complete.type === "review_complete") {
    const sum =
      complete.summary.spontaneous + complete.summary.elicited + complete.summary.cued + complete.summary.released;
    expect(sum, `seed=${seed}: summary doesn't add up`).toBe(complete.summary.total);
  }

  return log;
}

describe("FUZZ: 1000 randomized sessions hold every invariant", () => {
  it("no sequence of user behavior can break the conversation", () => {
    for (let seed = 1; seed <= 1000; seed++) {
      runFuzzSession(seed);
    }
  });
});

// ─── Persona simulations with stupidity detectors ──────────────────────────

type Persona = (state: ReviewState, lastMayaLine: string, step: number) => EngineTurn;

function playPersona(persona: Persona, maxSteps = 40): SessionLog {
  let turn = startReview(WORDS);
  const log: SessionLog = { turns: [turn], userActions: [] };
  let steps = 0;
  while (turn.state.phase !== "done" && steps < maxSteps) {
    turn = persona(turn.state, turn.mayaLine, steps);
    log.turns.push(turn);
    steps++;
  }
  return log;
}

/** The behaviors that make people call a chatbot stupid. */
function assertNotStupid(log: SessionLog) {
  const mayaLines = log.turns.map((t) => t.mayaLine).filter(Boolean);

  // A. Never two identical consecutive Maya lines
  for (let i = 1; i < mayaLines.length; i++) {
    expect(mayaLines[i], `identical consecutive line: "${mayaLines[i]}"`).not.toBe(mayaLines[i - 1]);
  }

  // B. The conversation ended (no abandonment)
  expect(log.turns[log.turns.length - 1].state.phase).toBe("done");

  // C. Maya never spoke more than the budget
  const final = log.turns[log.turns.length - 1].state;
  expect(final.mayaTurns).toBeLessThanOrEqual(MAX_MAYA_TURNS + 1);

  // D. Every completed word was mentioned by Maya at most 4 times total
  //    (frame + cue + praise + possible repair — beyond that is nagging)
  for (const item of final.items) {
    const mentions = mayaLines.filter((l) => l.toLowerCase().includes(item.word)).length;
    expect(mentions, `"${item.word}" nagged ${mentions} times`).toBeLessThanOrEqual(4);
  }

  // E. A released word is never mentioned again after its release
  const releaseTurn = new Map<string, number>();
  log.turns.forEach((t, idx) => {
    for (const e of t.events) {
      if (e.type === "item_released") releaseTurn.set(e.word, idx);
    }
  });
  releaseTurn.forEach((idx, word) => {
    for (let i = idx + 1; i < log.turns.length; i++) {
      const line = log.turns[i].mayaLine.toLowerCase();
      // wrapup lines are word-free by construction, but check anyway
      expect(line.includes(word), `released word "${word}" brought back up`).toBe(false);
    }
  });
}

describe("PERSONAS: realistic users get a non-stupid conversation", () => {
  it("cooperative user: answers every frame naturally — all words credited, short warm chat", () => {
    const log = playPersona((state) => {
      const active = state.items[state.activeItem];
      if (state.phase === "repair") return onRepairAnswer(state, true);
      return onUserUtterance(state, `oh yes i really like my ${active?.word ?? "day"}`, [], 0.9);
    });
    assertNotStupid(log);
    const final = log.turns[log.turns.length - 1].state;
    expect(final.items.every((i) => i.status === "elicited" || i.status === "spontaneous")).toBe(true);
    // A fully successful review is SHORT: greeting + 4 frames + praise + wrapup
    expect(final.mayaTurns).toBeLessThanOrEqual(7);
  });

  it("silent user: only timeouts — reaches a kind ending quickly, nothing credited falsely", () => {
    const log = playPersona((state) => onSilence(state));
    assertNotStupid(log);
    const final = log.turns[log.turns.length - 1].state;
    expect(final.items.every((i) => i.status === "released")).toBe(true);
    // Silence must not drag: ≤ 2 interactions per item plus greeting/wrapup
    expect(log.turns.length).toBeLessThanOrEqual(12);
  });

  it("one-word user: needs the cue every time — words credited as cued", () => {
    const log = playPersona((state, lastLine) => {
      const active = state.items[state.activeItem];
      if (state.phase === "repair") return onRepairAnswer(state, true);
      if (!active) return onSilence(state);
      // Says the word only when Maya models it (cue lines contain "say")
      if (/can you say/i.test(lastLine)) {
        return onUserUtterance(state, active.word, [], 0.9);
      }
      return onUserUtterance(state, "um", [], 0.9);
    });
    assertNotStupid(log);
    const final = log.turns[log.turns.length - 1].state;
    expect(final.items.filter((i) => i.status === "cued").length).toBeGreaterThanOrEqual(3);
  });

  it("rambler: long off-topic sentences that OCCASIONALLY contain pending words — spontaneous credit lands", () => {
    const RAMBLES = [
      "well my daughter came over on sunday and we had a lovely time",
      "i keep the spoon in the kitchen drawer with all the others you know",
      "the weather has been terrible lately just terrible",
      "my jacket is the blue one my wife bought me years ago",
      "we watched television most of the evening",
    ];
    const log = playPersona((state, _line, step) => {
      if (state.phase === "repair") return onRepairAnswer(state, true);
      return onUserUtterance(state, RAMBLES[step % RAMBLES.length] + ` ${step}`, [], 0.9);
    });
    assertNotStupid(log);
    const final = log.turns[log.turns.length - 1].state;
    const spontaneous = final.items.filter((i) => i.status === "spontaneous").length;
    const creditedFromRamble = final.items.filter(
      (i) => (i.word === "spoon" || i.word === "jacket") && i.status !== "released",
    ).length;
    expect(spontaneous + creditedFromRamble).toBeGreaterThanOrEqual(2);
  });

  it("mumbler: everything comes back low-confidence — repair asks, never assumes, never loops", () => {
    let repairsSeen = 0;
    const log = playPersona((state) => {
      const active = state.items[state.activeItem];
      if (state.phase === "repair") {
        repairsSeen++;
        return onRepairAnswer(state, true);
      }
      if (!active) return onSilence(state);
      return onUserUtterance(state, active.word, [], 0.3); // always mumbled
    });
    assertNotStupid(log);
    expect(repairsSeen).toBeGreaterThanOrEqual(3); // repair engaged, not bypassed
    const final = log.turns[log.turns.length - 1].state;
    expect(final.items.filter((i) => i.status !== "released").length).toBeGreaterThanOrEqual(3);
  });

  it("aphasic repetition: answers the repair question by SAYING THE WORD AGAIN — counts as confirmation", () => {
    const t1 = startReview(WORDS);
    const t2 = onUserUtterance(t1.state, WORDS[0].word, [], 0.3); // mumbled → repair
    expect(t2.state.phase).toBe("repair");
    const t3 = onUserUtterance(t2.state, WORDS[0].word, [], 0.9); // repeats the word
    expect(t3.state.items.find((i) => i.word === WORDS[0].word)?.status).not.toBe("pending");
  });

  it("impatient user: taps All Done after one exchange — honored instantly with a fair summary", () => {
    const t1 = startReview(WORDS);
    const t2 = onUserUtterance(t1.state, "i love my garden", [], 0.9);
    const t3 = onFinishRequest(t2.state);
    expect(t3.state.phase).toBe("done");
    const complete = t3.events.find((e) => e.type === "review_complete");
    expect(complete && complete.type === "review_complete" && complete.summary.elicited).toBe(1);
  });

  it("ASR hiccup user: same final transcript delivered twice — second one is inert", () => {
    const t1 = startReview(WORDS);
    const before = t1.state.items[t1.state.activeItem].attempts;
    const t2 = onUserUtterance(t1.state, "not sure what to say", [], 0.9); // burns the cue
    const afterFirst = t2.state.items.map((i) => ({ ...i }));
    const t3 = onUserUtterance(t2.state, "not sure what to say", [], 0.9); // duplicate
    expect(t3.mayaLine).toBe(""); // said nothing
    expect(t3.state.items).toEqual(afterFirst.map((i) => expect.objectContaining({ status: i.status })));
    void before;
  });

  it("noise: empty and non-verbal transcripts change nothing", () => {
    const t1 = startReview(WORDS);
    for (const noise of ["", "   ", "..."]) {
      const t = onUserUtterance(t1.state, noise, [], 0.9);
      expect(t.mayaLine).toBe("");
      expect(t.events).toEqual([]);
    }
  });

  it("empty practice queue: review with zero items ends gracefully, no crash", () => {
    const turn = startReview([]);
    expect(turn.state.phase).toBe("done");
    const complete = turn.events.find((e) => e.type === "review_complete");
    expect(complete && complete.type === "review_complete" && complete.summary.total).toBe(0);
  });
});

describe("GUARDED USER: short, untrusting replies get a winnable conversation", () => {
  it("a bare 'yes' to a frame gets a forced-choice bridge, NEVER a letter cue", () => {
    const t1 = startReview(WORDS);
    const t2 = onUserUtterance(t1.state, "yes", [], 0.9);
    const line = t2.mayaLine.toLowerCase();
    expect(line).not.toMatch(/it starts with/); // the test-like cue is banned here
    expect(line).toContain(" or "); // a choice was offered
    expect(line).toContain(t1.state.items[t1.state.activeItem].word); // containing the target
  });

  it("the guarded user's one-word choice answer credits the word (as cued — honest accounting)", () => {
    const t1 = startReview(WORDS);
    const active = t1.state.items[t1.state.activeItem];
    const t2 = onUserUtterance(t1.state, "no", [], 0.9); // guarded reply → bridge
    const t3 = onUserUtterance(t2.state, active.word, [], 0.9); // minimal answer = the word
    expect(t3.state.items.find((i) => i.word === active.word)?.status).toBe("cued");
  });

  it("two bare acknowledgments switch the WHOLE session to low-demand forced choices", () => {
    const t1 = startReview(WORDS);
    const t2 = onUserUtterance(t1.state, "yes", [], 0.9); // ack 1 → bridge
    const t3 = onUserUtterance(t2.state, "fine", [], 0.9); // ack 2 → low-demand mode
    expect(t3.state.lowDemandMode).toBe(true);
    // Every subsequent frame opens as a forced choice
    let turn = t3;
    let guard = 0;
    while (turn.state.phase !== "done" && guard < 15) {
      const active = turn.state.items[turn.state.activeItem];
      if (turn.state.phase === "frame" && active && turn.mayaLine) {
        // low-demand frames contain the choice word " or "
        if (turn.mayaLine.toLowerCase().includes(active.word)) {
          expect(turn.mayaLine.toLowerCase()).toContain(" or ");
        }
      }
      turn = onUserUtterance(turn.state, active ? active.word : `mm ${guard}`, [], 0.9);
      guard++;
    }
    expect(turn.state.phase).toBe("done");
  });

  it("full guarded persona: answers only 'yes'/'fine'/choice-words — every word still credited, chat stays short", () => {
    const log = playPersona((state, lastLine) => {
      const active = state.items[state.activeItem];
      if (state.phase === "repair") return onRepairAnswer(state, true);
      // Answers a forced choice with the minimal word; everything else gets "yes"/"fine"
      if (active && lastLine.toLowerCase().includes(" or ") && lastLine.toLowerCase().includes(active.word)) {
        return onUserUtterance(state, active.word, [], 0.9);
      }
      return onUserUtterance(state, Math.random() < 0.5 ? "yes" : "fine", [], 0.9);
    });
    assertNotStupid(log);
    const final = log.turns[log.turns.length - 1].state;
    // The guarded user still produced every word (as cued) — nothing released
    expect(final.items.every((i) => i.status === "cued")).toBe(true);
    // And nobody lectured them: the whole thing stayed inside the budget comfortably
    expect(final.mayaTurns).toBeLessThanOrEqual(11);
  });

  it("acknowledgments never count as productions and never trigger repair", () => {
    const t1 = startReview(WORDS);
    const t2 = onUserUtterance(t1.state, "yes", [], 0.3); // low-confidence ack
    expect(t2.state.phase).not.toBe("repair");
    expect(t2.state.items.every((i) => i.status === "pending")).toBe(true);
  });
});

describe("TRANSCRIPT READABILITY: a full cooperative session reads like a real conversation", () => {
  it("produces a coherent transcript (printed for human review on failure)", () => {
    let turn = startReview(WORDS.slice(0, 3));
    const transcript: string[] = [`MAYA: ${turn.mayaLine}`];
    let steps = 0;
    while (turn.state.phase !== "done" && steps < 20) {
      const active = turn.state.items[turn.state.activeItem];
      const reply =
        turn.state.phase === "repair"
          ? "yes"
          : `yes i do like my ${active?.word ?? "home"}`;
      transcript.push(`USER: ${reply}`);
      turn =
        turn.state.phase === "repair"
          ? onRepairAnswer(turn.state, true)
          : onUserUtterance(turn.state, reply, [], 0.9);
      if (turn.mayaLine) transcript.push(`MAYA: ${turn.mayaLine}`);
      steps++;
    }
    const text = transcript.join("\n");
    // Structural sanity of the whole conversation
    expect(text).toMatch(/garden/i);
    expect(text).toMatch(/spoon/i);
    expect(text).toMatch(/jacket/i);
    expect(transcript.length, `transcript:\n${text}`).toBeLessThanOrEqual(15);
    expect(transcript[transcript.length - 1]).toMatch(/MAYA/);
  });
});
