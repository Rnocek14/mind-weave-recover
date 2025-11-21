import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { StrokeProfileSummary } from "@/components/StrokeProfileSummary";
import { BrainMap } from "@/components/BrainMap";
import { MechanismSessionPlanner } from "@/components/MechanismSessionPlanner";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";

interface ClinicalTabProps {
  userId: string;
  clinicalProfile: ClinicalProfile | null;
}

export function ClinicalTab({ userId, clinicalProfile }: ClinicalTabProps) {
  if (!clinicalProfile) {
    return (
      <div className="animate-fade-in">
        <Card className="p-8 text-center">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <h3 className="text-lg font-semibold mb-2">No Clinical Profile</h3>
          <p className="text-muted-foreground">
            Set up your clinical stroke profile to view personalized clinical information and insights.
          </p>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-8 animate-fade-in">
      {/* Stroke Profile Summary */}
      <StrokeProfileSummary profile={clinicalProfile} />

      {/* Brain & Recovery Map */}
      <BrainMap profile={{ clinical_profile: clinicalProfile }} userId={userId} />

      {/* Mechanism-Based Session Planner */}
      {(clinicalProfile as any).stroke_mechanism && (
        <MechanismSessionPlanner profile={clinicalProfile} />
      )}
    </div>
  );
}
