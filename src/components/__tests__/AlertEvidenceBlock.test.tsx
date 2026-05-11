import { describe, it, expect, vi } from "vitest";
import { render, fireEvent } from "@testing-library/react";
import { AlertEvidenceBlock } from "@/components/AlertEvidenceBlock";

// Mock useUiMode
vi.mock("@/hooks/useUiMode", () => ({
  useUiMode: () => ({ uiMode: "clinician", setUiMode: () => {}, toggleMode: () => {}, isAtLeast: () => true }),
}));

describe("AlertEvidenceBlock", () => {
  it("renders deconditioning_risk evidence with 'Inactive days' line", async () => {
    const { getByText } = render(
      <AlertEvidenceBlock
        alertType="deconditioning_risk"
        triggerData={{
          inactive_phys_days: 6,
          coverage_days: 7,
          threshold_active_minutes: 10,
          threshold_steps: 2500,
          rule_version: "phys_alerts_v1",
        }}
      />
    );
    const toggle = getByText(/Evidence/);
    expect(toggle).toBeInTheDocument();
    fireEvent.click(toggle);
    expect(getByText("Inactive days:")).toBeInTheDocument();
    expect(getByText("6/7")).toBeInTheDocument();
  });

  it("renders generic fallback for unknown alert types", () => {
    const { getByText } = render(
      <AlertEvidenceBlock
        alertType="unknown_future_alert"
        triggerData={{ some_key: 42, another_key: "hello" }}
      />
    );
    fireEvent.click(getByText(/Evidence|Why/));
    expect(getByText("some key:")).toBeInTheDocument();
    expect(getByText("42")).toBeInTheDocument();
  });

  it("shows spike_pct_rounded from trigger_data for overexertion", () => {
    const { getByText } = render(
      <AlertEvidenceBlock
        alertType="overexertion_risk"
        triggerData={{
          avg_phys_last3: 60,
          avg_phys_prev4: 20,
          spike_pct_rounded: 200,
          avg_fatigue_last3: 4.5,
          avg_fatigue_prev4: 2.0,
          avg_dose_last3: 10,
          avg_dose_prev4: 30,
          rule_version: "phys_alerts_v1",
        }}
      />
    );
    fireEvent.click(getByText(/Evidence/));
    expect(getByText("200%")).toBeInTheDocument();
  });
});
