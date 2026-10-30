import { describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { ScenarioOverlay } from "./ScenarioOverlay";
import { SCENARIOS } from "@/lib/scenarioEngine";

describe("roleplay uses one real listening turn per scenario exchange", () => {
  it("never carries one ASR final across later beats, but accepts the same answer on another listening cycle", async () => {
    const scenario = SCENARIOS.find((s) => s.id === "coffee_order");
    if (!scenario) throw new Error("Expected the existing coffee roleplay fixture");
    const onSpeak = vi.fn(async (_line: string) => {});
    const onComplete = vi.fn();
    const onStartListening = vi.fn();
    const onStopListening = vi.fn();

    const ui = (isListening: boolean, liveTranscript: string) =>
      <ScenarioOverlay
        scenario={scenario}
        onClose={vi.fn()}
        onComplete={onComplete}
        isListening={isListening}
        liveTranscript={liveTranscript}
        onStartListening={onStartListening}
        onStopListening={onStopListening}
        onSpeak={onSpeak}
        isSpeaking={false}
      />;

    const { rerender } = render(ui(false, ""));
    fireEvent.click(screen.getByRole("button", { name: /I'm ready/i }));
    await screen.findByText(scenario.openingLine);
    expect(onSpeak).toHaveBeenCalledTimes(1);

    // Genuine patient reply #1, one fresh on->off microphone cycle.
    rerender(ui(true, "Coffee please"));
    rerender(ui(false, "Coffee please"));
    await waitFor(() => expect(onSpeak).toHaveBeenCalledTimes(2), { timeout: 3000 });

    // An unrelated re-render after the next partner question must NOT turn
    // the previous "Coffee please" into a second response and skip a beat.
    rerender(ui(false, "Coffee please"));
    expect(screen.queryByText(/roleplay practice complete/i)).toBeNull();
    expect(onSpeak).toHaveBeenCalledTimes(2);

    // User #2 answers with a valid short utterance, not a verbose sentence.
    rerender(ui(true, "Large"));
    rerender(ui(false, "Large"));
    await waitFor(() => expect(onSpeak).toHaveBeenCalledTimes(3), { timeout: 3000 });

    // User #3 can legitimately use the SAME one-word response on a
    // separate microphone turn. Dedup must be by beat, not by transcript.
    rerender(ui(true, "Large"));
    rerender(ui(false, "Large"));
    await waitFor(() => expect(onSpeak).toHaveBeenCalledTimes(4), { timeout: 3000 });
    expect(screen.queryByText(/roleplay practice complete/i)).toBeNull();

    rerender(ui(true, "Thank you"));
    rerender(ui(false, "Thank you"));
    expect(await screen.findByText(/4 conversation exchanges practiced/i)).toBeTruthy();
    expect(screen.queryByText(/real-world readiness/i)).toBeNull();
    expect(onComplete).not.toHaveBeenCalled(); // Only explicit exit returns to chat
    fireEvent.click(screen.getByRole("button", { name: /Back to Maya/i }));
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});
