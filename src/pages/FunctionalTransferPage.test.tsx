import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import FunctionalTransferPage from "./FunctionalTransferPage";
import { setDeviceScope } from "@/lib/deviceStore";
import { recordPresentedFunctionalScript } from "@/lib/scriptPracticeQueue";

vi.mock("@/hooks/useSpeechRecognition", () => ({
  useSpeechRecognition: () => ({
    isListening: false,
    startListening: vi.fn(),
    stopListening: vi.fn(),
    resetTranscript: vi.fn(),
    isSupported: false,
    error: null,
    getLastRecognition: () => null,
  }),
}));

function show(url: string) {
  return render(
    <MemoryRouter initialEntries={[url]}>
      <FunctionalTransferPage />
    </MemoryRouter>,
  );
}

describe("functional practice screen (mic unavailable)", () => {
  beforeEach(() => {
    localStorage.clear();
    setDeviceScope("patient-transfer-test");
  });
  afterEach(() => {
    localStorage.clear();
    setDeviceScope(null);
  });

  it("shows no different-session or unscoped patient data", () => {
    recordPresentedFunctionalScript("need_help", "session-other");
    show("/functional-transfer?lesson=session-here");
    expect(screen.getByText(/No phrase practice to review/i)).toBeTruthy();
    expect(screen.queryByRole("button", { name: /^Start$/ })).toBeNull();
  });

  it("makes two new real-life contexts skippable and never credits failed microphone input", () => {
    recordPresentedFunctionalScript("need_help", "session-here");
    show("/functional-transfer?lesson=session-here");
    fireEvent.click(screen.getByRole("button", { name: /^Start$/ }));
    expect(screen.getByText(/carrying a heavy box/i)).toBeTruthy();
    expect(screen.getByRole("button", { name: /^Speak$/ })).toHaveProperty("disabled", true);
    fireEvent.click(screen.getByRole("button", { name: /I tried saying it/i }));
    expect(screen.getByText(/jar won't open/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Skip this situation/i }));
    expect(screen.getByText(/Conversation practice complete/i)).toBeTruthy();
    expect(screen.getByText(/0 possible responses matched before hints/i)).toBeTruthy();
    expect(screen.getByText(/2 unverified or skipped attempts/i)).toBeTruthy();
  });

  it("limits manually requested cues to two and keeps a one-button exit", () => {
    recordPresentedFunctionalScript("im_thirsty", "session-here");
    show("/functional-transfer?lesson=session-here");
    fireEvent.click(screen.getByRole("button", { name: /^Start$/ }));
    fireEvent.click(screen.getByRole("button", { name: /Give me a hint/i }));
    expect(screen.getByText(/tell the person what you would like/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /Give me a hint/i }));
    expect(screen.getByRole("button", { name: /All hints shown/i })).toHaveProperty("disabled", true);
    expect(screen.getByRole("button", { name: /^Back$/ })).toBeTruthy();
  });
});
