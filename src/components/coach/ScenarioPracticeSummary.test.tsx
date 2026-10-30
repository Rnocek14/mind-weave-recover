import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScenarioPracticeSummary } from "./ScenarioPracticeSummary";

describe("scenario feedback never invents validated readiness from heuristics", () => {
  it("shows observable roleplay activity, not overall readiness or comprehension percent", () => {
    render(<ScenarioPracticeSummary
      title="Order a Coffee"
      exchangeCount={3}
      hintCount={1}
      helpCount={2}
      repeatCount={2}
      automaticWhispers={1}
    />);
    expect(screen.getByText(/roleplay practice complete/i)).toBeTruthy();
    expect(screen.getByText(/3 conversation exchanges practiced/i)).toBeTruthy();
    expect(screen.getByText(/hints or help requested: 3/i)).toBeTruthy();
    expect(screen.getByText(/repeats requested: 2/i)).toBeTruthy();
    expect(screen.getByText(/automatic hints offered: 1/i)).toBeTruthy();
    expect(screen.getByText(/not a measured real-world communication outcome/i)).toBeTruthy();

    const text = document.body.textContent ?? "";
    expect(text).not.toMatch(/real-world readiness|messages understood|\d+%|you are more fluent/i);
  });

  it("does not mistake no participation for an achieved goal", () => {
    render(<ScenarioPracticeSummary
      title="Call the Doctor"
      exchangeCount={0}
      hintCount={0}
      helpCount={0}
      repeatCount={0}
      automaticWhispers={0}
    />);
    expect(screen.getByText(/0 conversation exchanges practiced/i)).toBeTruthy();
    expect(screen.queryByText(/communication improved|message came through/i)).toBeNull();
    expect(screen.queryByText(/automatic hints offered/i)).toBeNull();
  });
});
