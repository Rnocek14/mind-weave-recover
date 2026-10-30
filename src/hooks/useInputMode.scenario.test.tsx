import { act, renderHook } from "@testing-library/react";
import { describe, expect, it } from "vitest";
import { useInputMode } from "./useInputMode";

describe("roleplay has an exclusive microphone owner", () => {
  it("recognizes scenario listening as active microphone ownership", () => {
    const { result } = renderHook(() => useInputMode("idle"));
    expect(result.current.isAnyListening()).toBe(false);

    act(() => result.current.setMode("scenario_listening"));
    expect(result.current.mode).toBe("scenario_listening");
    expect(result.current.modeRef.current).toBe("scenario_listening");
    expect(result.current.isAnyListening()).toBe(true);

    act(() => result.current.setMode("tts_playing"));
    expect(result.current.isAnyListening()).toBe(false);

    act(() => result.current.setMode("idle"));
    expect(result.current.isAnyListening()).toBe(false);
  });

  it("preserves existing chat, popup and card ownership contracts", () => {
    const { result } = renderHook(() => useInputMode("chat_listening"));
    expect(result.current.isAnyListening()).toBe(true);
    act(() => result.current.setMode("card_listening"));
    expect(result.current.isAnyListening()).toBe(true);
    act(() => result.current.setMode("popup_listening"));
    expect(result.current.isAnyListening()).toBe(true);
    act(() => result.current.setMode("processing"));
    expect(result.current.isAnyListening()).toBe(false);
  });
});
