/**
 * Functional Command Scenes — played like a human (tap mode).
 * Wave-14: real component, real bank, per the wave-13 lesson that only
 * UI-level tests catch wiring gaps.
 */
import React from "react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { FunctionalScenePlayer } from "@/components/FunctionalScenePlayer";

const speakMock = vi.fn(async () => {});
vi.mock("@/hooks/useTextToSpeech", () => ({
  useTextToSpeech: () => ({ speak: speakMock, isLoading: false, error: null }),
}));
vi.mock("@/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    startListening: vi.fn(),
    stopListening: vi.fn(),
    isSupported: false, // tap-only run; mic button hidden
  }),
}));

afterEach(() => {
  cleanup();
  speakMock.mockClear();
});

describe("FunctionalScenePlayer — tap playthrough", () => {
  it("renders the lamp scene with its two command buttons", () => {
    render(<FunctionalScenePlayer />);
    expect(screen.getByText("The Lamp")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /brighter/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /darker/i })).toBeInTheDocument();
  });

  it("tapping a command models the word via TTS, changes the photo, announces the result", () => {
    const onCommandApplied = vi.fn();
    render(<FunctionalScenePlayer onCommandApplied={onCommandApplied} />);

    const photo = screen.getByTestId("scene-photo");
    const before = photo.style.filter;

    fireEvent.click(screen.getByRole("button", { name: /brighter/i }));

    expect(speakMock).toHaveBeenCalledWith("brighter");
    expect(screen.getByRole("status")).toHaveTextContent("The lamp is brighter.");
    expect(photo.style.filter).not.toBe(before);
    expect(onCommandApplied).toHaveBeenCalledWith(
      expect.objectContaining({
        sceneId: "lamp",
        command: "brighter",
        formUsed: "canonical",
        inputMode: "tap",
        changed: true,
      }),
    );
  });

  it("answers honestly at the boundary instead of ignoring the patient", () => {
    render(<FunctionalScenePlayer />);
    const brighter = screen.getByRole("button", { name: /brighter/i });
    for (let i = 0; i < 5; i++) fireEvent.click(brighter);
    expect(screen.getByRole("status")).toHaveTextContent("That's as bright as it goes.");
  });

  it("navigates scenes and keeps each scene's state independent", () => {
    render(<FunctionalScenePlayer />);
    fireEvent.click(screen.getByRole("button", { name: /brighter/i }));

    fireEvent.click(screen.getByRole("button", { name: /next scene/i }));
    expect(screen.getByText("The Ball")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /bigger/i })).toBeInTheDocument();
    // Feedback resets on scene change.
    expect(screen.getByRole("status")).toHaveTextContent("");

    // Back to the lamp — its brightened state survived the round trip.
    fireEvent.click(screen.getByRole("button", { name: /previous scene/i }));
    expect(screen.getByText("The Lamp")).toBeInTheDocument();
    const photo = screen.getByTestId("scene-photo");
    expect(photo.style.filter).toContain("1.29"); // initial 2 → +1 = 3 → 0.4 + 3*0.3 ≈ 1.3
  });

  it("the cup scene renders its fill overlay and 'more' raises it", () => {
    render(<FunctionalScenePlayer />);
    // lamp → ball → bird → car → cup
    const next = () => fireEvent.click(screen.getByRole("button", { name: /next scene/i }));
    next(); next(); next(); next();
    expect(screen.getByText("The Cup")).toBeInTheDocument();

    const fill = screen.getByTestId("cup-fill").firstElementChild as HTMLElement;
    const before = fill.style.height;
    fireEvent.click(screen.getByRole("button", { name: /^more$/i }));
    expect(fill.style.height).not.toBe(before);
    expect(screen.getByRole("status")).toHaveTextContent("More in the cup.");
  });
});
