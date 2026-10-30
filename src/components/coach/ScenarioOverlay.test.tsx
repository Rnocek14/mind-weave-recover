import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SCENARIOS } from "@/lib/scenarioEngine";
import { ScenarioOverlay } from "./ScenarioOverlay";

const coffee = SCENARIOS.find((s) => s.id === "coffee_order")!;

function props(overrides: Partial<React.ComponentProps<typeof ScenarioOverlay>> = {}) {
  return {
    scenario: coffee,
    onClose: vi.fn(),
    onComplete: vi.fn(),
    isListening: false,
    liveTranscript: "",
    onStartListening: vi.fn(),
    onStopListening: vi.fn(),
    onSpeak: vi.fn(async (_text: string) => {}),
    isSpeaking: false,
    ...overrides,
  };
}

afterEach(() => vi.restoreAllMocks());

describe("roleplay: one microphone turn = one conversation exchange", () => {
  it("does not replay a single final transcript as four completed scenario beats", async () => {
    const settings = props();
    const { rerender, unmount } = render(<ScenarioOverlay {...settings} />);
    fireEvent.click(screen.getByRole("button", { name: /i'm ready/i }));
    await waitFor(() => expect(settings.onSpeak).toHaveBeenCalledTimes(1));

    // The recognition engine listens and then finalizes ONE spoken answer.
    rerender(<ScenarioOverlay {...settings} isListening liveTranscript="coffee please" />);
    rerender(<ScenarioOverlay {...settings} isListening={false} liveTranscript="coffee please" />);

    // A partner reply on the second beat proves the answer was processed.
    await waitFor(() => expect(settings.onSpeak).toHaveBeenCalledTimes(2), {
      timeout: 2500,
    });
    // Re-rendering the component with an unchanged stale transcript must not
    // count another exchange or show an imaginary completed conversation.
    rerender(<ScenarioOverlay {...settings} isListening={false} liveTranscript="coffee please" />);
    expect(screen.queryByText(/roleplay practice complete/i)).toBeNull();
    unmount();
  });

  it("does not count an empty mic stop as a patient response", async () => {
    const settings = props();
    const { rerender, unmount } = render(<ScenarioOverlay {...settings} />);
    fireEvent.click(screen.getByRole("button", { name: /i'm ready/i }));
    await waitFor(() => expect(settings.onSpeak).toHaveBeenCalledTimes(1));
    rerender(<ScenarioOverlay {...settings} isListening liveTranscript="" />);
    rerender(<ScenarioOverlay {...settings} isListening={false} liveTranscript="" />);
    expect(settings.onSpeak).toHaveBeenCalledTimes(1);
    expect(screen.queryByText(/roleplay practice complete/i)).toBeNull();
    unmount();
  });

  it("does not restart the microphone after the patient closes during TTS", async () => {
    vi.useFakeTimers();
    try {
      let resolveSpeech!: () => void;
      const settings = props({
        onSpeak: vi.fn(() => new Promise<void>((resolve) => { resolveSpeech = resolve; })),
      });
      const { unmount } = render(<ScenarioOverlay {...settings} />);
      fireEvent.click(screen.getByRole("button", { name: /i'm ready/i }));
      expect(settings.onSpeak).toHaveBeenCalledTimes(1);
      unmount();

      await act(async () => { resolveSpeech(); await Promise.resolve(); });
      act(() => vi.runOnlyPendingTimers());
      expect(settings.onStartListening).not.toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });
});
