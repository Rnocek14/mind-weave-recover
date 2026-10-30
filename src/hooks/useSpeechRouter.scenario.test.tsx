import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { useSpeechRouter } from "./useSpeechRouter";
import type { InputMode } from "./useInputMode";

/** The real router must isolate final AND interim speech by microphone owner. */
describe("Maya scenario speech ownership", () => {
  it("routes roleplay utterances only to roleplay and never to the regular coach", () => {
    const modeRef = { current: "scenario_listening" as InputMode };
    const handlers = {
      onChatTranscript: vi.fn(),
      onCardTranscript: vi.fn(),
      onPopupTranscript: vi.fn(),
      onScenarioTranscript: vi.fn(),
    };
    const { result } = renderHook(() => useSpeechRouter({ modeRef, ...handlers }));

    act(() => {
      result.current.route("cof", false);
      result.current.routeFinal("coffee please");
    });
    expect(handlers.onScenarioTranscript).toHaveBeenNthCalledWith(1, "cof", false);
    expect(handlers.onScenarioTranscript).toHaveBeenNthCalledWith(2, "coffee please", true);
    expect(handlers.onChatTranscript).not.toHaveBeenCalled();
    expect(handlers.onCardTranscript).not.toHaveBeenCalled();
    expect(handlers.onPopupTranscript).not.toHaveBeenCalled();
  });

  it("drops late finals after exit and Maya TTS instead of leaking to chat", () => {
    const modeRef = { current: "scenario_listening" as InputMode };
    const handlers = {
      onChatTranscript: vi.fn(),
      onCardTranscript: vi.fn(),
      onPopupTranscript: vi.fn(),
      onScenarioTranscript: vi.fn(),
    };
    const { result } = renderHook(() => useSpeechRouter({ modeRef, ...handlers }));

    act(() => result.current.routeFinal("large coffee"));
    modeRef.current = "tts_playing";
    act(() => result.current.routeFinal("maya echo"));
    modeRef.current = "idle";
    act(() => result.current.routeFinal("late result after close"));

    expect(handlers.onScenarioTranscript).toHaveBeenCalledTimes(1);
    expect(handlers.onChatTranscript).not.toHaveBeenCalled();
    expect(handlers.onCardTranscript).not.toHaveBeenCalled();

    modeRef.current = "chat_listening";
    act(() => result.current.routeFinal("fresh conversation"));
    expect(handlers.onChatTranscript).toHaveBeenCalledTimes(1);
    expect(handlers.onChatTranscript).toHaveBeenCalledWith("fresh conversation", true);
    expect(handlers.onScenarioTranscript).toHaveBeenCalledTimes(1);
  });

  it("must route scenario finals even if another mode was used earlier", () => {
    const modeRef = { current: "card_listening" as InputMode };
    const handlers = {
      onChatTranscript: vi.fn(),
      onCardTranscript: vi.fn(),
      onPopupTranscript: vi.fn(),
      onScenarioTranscript: vi.fn(),
    };
    const { result } = renderHook(() => useSpeechRouter({ modeRef, ...handlers }));
    act(() => result.current.routeFinal("card choice"));
    expect(handlers.onCardTranscript).toHaveBeenCalledOnce();

    modeRef.current = "scenario_listening" as InputMode;
    act(() => result.current.routeFinal("water please"));
    expect(handlers.onScenarioTranscript).toHaveBeenCalledTimes(1);
    expect(handlers.onScenarioTranscript).toHaveBeenCalledWith("water please", true);
    expect(handlers.onCardTranscript).toHaveBeenCalledTimes(1);
  });
});
