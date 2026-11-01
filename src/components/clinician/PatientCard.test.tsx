import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { PatientCard } from "./PatientCard";
import type { CaseloadPatient } from "@/hooks/useClinicianCaseload";

afterEach(cleanup);

const patient: CaseloadPatient = {
  profileId: "p-one",
  userId: "patient-owner",
  name: "Synthetic Patient",
  strokeDate: null,
  daysPostStroke: null,
  aphasiaLabel: null,
  aphasiaType: null,
  laterality: null,
  chronicity: null,
  strokeMechanism: null,
  trials7d: 15,
  priorTrials7d: 14,
  adherenceDays7d: 4,
  avgAccuracy7d: 64,
  accuracyDelta7d: -8,
  activeAlertCount: 0,
  criticalAlertCount: 0,
  lastActiveDate: new Date().toISOString(),
  trend: "down",
};

describe("PatientCard supports access and cautious app score language", () => {
  it("is a proper keyboard-focusable button rather than a clickable div", () => {
    const open = vi.fn();
    render(<PatientCard patient={{ ...patient, accuracyDelta7d: null, trend: "unknown" }} onClick={open} />);
    const button = screen.getByRole("button", { name: /Review Synthetic Patient/ });
    expect(button).toHaveAttribute("type", "button");
    expect(button).toHaveClass("focus-visible:ring-2");
    fireEvent.click(button);
    expect(open).toHaveBeenCalledExactlyOnceWith("p-one");
    expect(screen.queryByText("On track")).not.toBeInTheDocument();
    expect(screen.getByText(/Not a prescribed therapy target/)).toBeInTheDocument();
  });

  it("describes a measured app-score change in percentage points, not deterioration", () => {
    render(<PatientCard patient={patient} />);
    expect(screen.getByText("Lower app scores")).toBeInTheDocument();
    expect(screen.getByText("-8 pp")).toBeInTheDocument();
    expect(screen.queryByText("Declining")).not.toBeInTheDocument();
    expect(screen.queryByText("Stable")).not.toBeInTheDocument();
    expect(screen.getByText("15")).toBeInTheDocument();
  });

  it("keeps a high-priority app alert visible without labeling recovery status", () => {
    render(<PatientCard patient={{ ...patient, criticalAlertCount: 1, activeAlertCount: 1 }} />);
    expect(screen.getByText("Alerts to review")).toBeInTheDocument();
    expect(screen.getByText(/1 high-priority app/)).toBeInTheDocument();
  });
});
