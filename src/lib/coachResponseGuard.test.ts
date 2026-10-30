import { describe, expect, it } from "vitest";
import { guardCoachResponse } from "./coachResponseGuard";

const check = (candidate: string, recentMayaLines: string[], lastPatientUtterance = "um") =>
  guardCoachResponse({ candidate, recentMayaLines, lastPatientUtterance });

describe("Conversation Coach anti-loop response guard", () => {
  it("keeps a new one-question response unchanged", () => {
    expect(check("What did you eat?", ["How is your day?"], "I ate lunch")).toEqual({
      text: "What did you eat?", changed: false, reason: "none",
    });
  });

  it("blocks exact repeats and gives a shorter non-looping way forward", () => {
    const result = check("Tell me about your family?", ["Tell me about your family?"]);
    expect(result).toMatchObject({ changed: true, reason: "repeated_question" });
    expect(result.text).not.toMatch(/tell me about your family/i);
    expect((result.text.match(/\?/g) ?? []).length).toBeLessThanOrEqual(1);
  });

  it("blocks near-identical questions but allows distinct questions", () => {
    const repeated = check(
      "Could you tell me a little more about your family?",
      ["Can you tell me more about your family?"],
    );
    expect(repeated.reason).toBe("repeated_question");

    const newTopic = check("How was your coffee?", ["How was your breakfast?"], "good");
    expect(newTopic.changed).toBe(false);
  });

  it("honors a patient's explicit request to hear a question again", () => {
    const result = check(
      "Tell me about your family?", ["Tell me about your family?"], "Please repeat that",
    );
    expect(result.changed).toBe(false);
  });

  it("prevents a chain of generic questions after minimal patient replies", () => {
    const result = check("What else?", [
      "What else about that?", "Tell me more.", "Anything else?",
    ], "I don't know");
    expect(result.changed).toBe(true);
    expect(["repeated_question", "generic_loop"]).toContain(result.reason);
  });

  it("rejects multi-part prompts that overwhelm the patient", () => {
    const result = check("What is your name? Where do you live?", []);
    expect(result.reason).toBe("multiple_questions");
    expect((result.text.match(/\?/g) ?? []).length).toBe(1);
  });

  it("does not repeat the same recovery line when the model keeps looping", () => {
    const first = check("What else?", ["What else?"]);
    const second = check("What else?", ["What else?", first.text]);
    const third = check("What else?", ["What else?", first.text, second.text]);
    expect(new Set([first.text, second.text, third.text]).size).toBe(3);
    expect(third.text).toMatch(/End Chat/i);
  });

  it("does not invent a target, patient history, or measurement in fallback text", () => {
    const result = check("What about your father?", ["What about your father?"]);
    expect(result.text).not.toMatch(/you did well|you improved|your father said|\d+%/i);
  });

  it("leaves an empty response for the existing error fallback instead of fabricating speech", () => {
    expect(check("", ["What else?"]).changed).toBe(false);
  });
});
