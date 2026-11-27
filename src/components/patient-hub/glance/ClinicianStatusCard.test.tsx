import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";
import { ClinicianStatusCard } from "./ClinicianStatusCard";

afterEach(cleanup);

const props = {
  patientName: "Synthetic Patient",
  redFlagCount: 0,
  orangeFlagCount: 0,
  unacknowledgedAlerts: 0,
  accuracySlope: null,
  activeDays: 4,
  lastActiveDate: "yesterday",
  scoredRecent: 20,
  scoredPrior: 20,
  practiceDeltaPp: 0,
};

describe("ClinicianStatusCard makes no unsupported clinical claims", () => {
  it("does not call someone recovered, stable or on track simply for recording activity", () => {
    render(<ClinicianStatusCard {...props} />);
    expect(screen.getByText("Practice data available")).toBeInTheDocument();
    expect(screen.getByText(/20 scored responses/)).toBeInTheDocument();
    expect(screen.getByText(/not a diagnosis or validated recovery status/)).toBeInTheDocument();
    expect(screen.queryByText("Stable")).not.toBeInTheDocument();
    expect(screen.queryByText("On track")).not.toBeInTheDocument();
  });

  it("shows review-only guidance when the app registers alerts", () => {
    render(<ClinicianStatusCard {...props} redFlagCount={1} accuracySlope={-20} />);
    expect(screen.getByText("Alerts to review")).toBeInTheDocument();
    expect(screen.getByText(/source, recording and patient context/)).toBeInTheDocument();
    expect(screen.queryByText(/reduce difficulty|add cues|advance a level/i)).not.toBeInTheDocument();
  });

  it("shows a gap and no non-adherence judgment when no practice was recorded", () => {
    render(<ClinicianStatusCard {...props} activeDays={0} lastActiveDate={null}
      scoredRecent={0} scoredPrior={0} />);
    expect(screen.getByText("No recent practice recorded")).toBeInTheDocument();
    expect(screen.getByText(/Check whether this is an expected gap/)).toBeInTheDocument();
  });
});
