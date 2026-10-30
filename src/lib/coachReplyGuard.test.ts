import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { guardCoachReply } from "./coachReplyGuard";
import { sanitizeMayaLine } from "./mayaSpeechGate";

describe("active Conversation Coach: final patient-facing reply guard", () => {
  beforeEach(() => vi.spyOn(Math, "random").mockReturnValue(0));
  afterEach(() => vi.restoreAllMocks());

  it("replaces an identical question that Maya already asked", () => {
    const output = guardCoachReply({
      proposed: "What do you like to eat for breakfast?",
      recentMaya: ["What do you like to eat for breakfast?"],
    });
    expect(output.reason).toBe("duplicate_reply");
    expect(output.text).not.toContain("breakfast?");
    expect(output.text).not.toBe("What do you like to eat for breakfast?");
  });

  it("catches a nearly identical question despite small wording changes", () => {
    const output = guardCoachReply({
      proposed: "What did you do at grocery store?",
      recentMaya: ["What did you do at the grocery store?"],
    });
    expect(output.reason).toBe("repeated_question");
    expect(output.text).toMatch(/another way|need to repeat|move on|keep this simple/i);
  });

  it("preserves legitimate, different questions about the same topic", () => {
    const output = guardCoachReply({
      proposed: "Where did you eat breakfast?",
      recentMaya: ["What did you eat for breakfast?"],
    });
    expect(output.reason).toBeNull();
    expect(output.text).toBe("Where did you eat breakfast?");
  });

  it("allows an easier yes/no question in place of an open-ended one", () => {
    const output = guardCoachReply({
      proposed: "Did you visit the grocery store?",
      recentMaya: ["What did you do at the grocery store?"],
    });
    expect(output.reason).toBeNull();
  });

  it("honors a patient's explicit request to repeat the question", () => {
    const output = guardCoachReply({
      proposed: "Where did you visit last weekend?",
      recentMaya: ["Where did you visit last weekend?"],
      patientReply: "Please repeat that",
    });
    expect(output.reason).toBeNull();
    expect(output.text).toBe("Where did you visit last weekend?");
  });

  it("allows a useful topic change instead of suppressing all questions", () => {
    const output = guardCoachReply({
      proposed: "Do you like music?",
      recentMaya: ["Do you like coffee?"],
    });
    expect(output.reason).toBeNull();
    expect(output.text).toBe("Do you like music?");
  });

  it("keeps at most one question without removing its brief context", () => {
    const output = guardCoachReply({
      proposed: "We practiced that today. Do you like tea? What else do you drink?",
      recentMaya: [],
    });
    expect(output.reason).toBe("multiple_questions");
    expect(output.text).toBe("We practiced that today. Do you like tea?");
  });

  it("avoids reusing the same safe repair line two turns in a row", () => {
    const output = guardCoachReply({
      proposed: "Can you say the word apple?",
      recentMaya: [
        "Let's try another way. You can answer with one word.",
        "Can you say the word apple?",
      ],
    });
    expect(output.reason).toBe("duplicate_reply");
    expect(output.text).toBe("We don't need to repeat that. Would a hint help?");
  });

  it("catches a loop introduced by the Maya Speech Gate's own fallback", () => {
    const speechGate = sanitizeMayaLine({
      text: "Tell me more.",
      activeTopic: "food",
      establishedFacts: [],
      userCorrectionActive: false,
      pendingVisualAction: false,
      source: "test",
    });
    expect(speechGate.approvedText).toBe("Tell me more about food.");
    const reply = guardCoachReply({
      proposed: speechGate.approvedText,
      recentMaya: ["Tell me more about food."],
    });
    expect(reply.reason).toBe("duplicate_reply");
    expect(reply.text).not.toBe(speechGate.approvedText);
  });

  it("interrupts a loop of different generic questions after minimal answers", () => {
    const output = guardCoachReply({
      proposed: "What do you think about work?",
      recentMaya: ["Tell me more about your day?", "Anything else?"],
      patientReply: "I don't know",
    });
    expect(output.reason).toBe("generic_loop");
    expect(output.text).not.toBe("What do you think about work?");
  });

  it("keeps a new generic question after a meaningful patient answer", () => {
    const output = guardCoachReply({
      proposed: "What do you think about work?",
      recentMaya: ["Tell me more about your day?", "Anything else?"],
      patientReply: "I went to the park yesterday",
    });
    expect(output.reason).toBeNull();
    expect(output.text).toBe("What do you think about work?");
  });

  it("preserves a safe, concise prompt unchanged", () => {
    const output = guardCoachReply({
      proposed: "  Tell me about your family. ",
      recentMaya: ["Let's talk about your day."],
    });
    expect(output).toEqual({ text: "Tell me about your family.", reason: null });
  });
});
