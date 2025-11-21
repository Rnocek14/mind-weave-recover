import { useState, useEffect } from "react";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { StrokeProfileSummary } from "@/components/StrokeProfileSummary";
import { BrainMap } from "@/components/BrainMap";
import { MechanismSessionPlanner } from "@/components/MechanismSessionPlanner";
import { Card } from "@/components/ui/card";
import { AlertCircle } from "lucide-react";
import { ClinicalProfileSkeleton } from "./DashboardSkeletons";

interface ClinicalTabProps {
  userId: string;
  clinicalProfile: ClinicalProfile | null;
}

export function ClinicalTab({ userId, clinicalProfile }: ClinicalTabProps) {
  const [showProfile, setShowProfile] = useState(false);
  const [showBrainMap, setShowBrainMap] = useState(false);
  const [showPlanner, setShowPlanner] = useState(false);

  useEffect(() => {
    // Phase 1: Profile summary (immediate)
    setShowProfile(true);
    
    // Phase 2: Brain map (400ms delay)
    const timer1 = setTimeout(() => setShowBrainMap(true), 400);
    
    // Phase 3: Planner (700ms delay)
    const timer2 = setTimeout(() => setShowPlanner(true), 700);
    
    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
    };
  }, []);

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
    <div className="space-y-8">
      {/* Stroke Profile Summary */}
      {!showProfile ? (
        <ClinicalProfileSkeleton delay={0} />
      ) : (
        <div className="animate-fade-in">
          <StrokeProfileSummary profile={clinicalProfile} />
        </div>
      )}

      {/* Brain & Recovery Map */}
      {!showBrainMap ? (
        <ClinicalProfileSkeleton delay={0} />
      ) : (
        <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
          <BrainMap profile={{ clinical_profile: clinicalProfile }} userId={userId} />
        </div>
      )}

      {/* Mechanism-Based Session Planner */}
      {(clinicalProfile as any).stroke_mechanism && (
        !showPlanner ? (
          <ClinicalProfileSkeleton delay={0} />
        ) : (
          <div className="animate-fade-in" style={{ animationDelay: '100ms' }}>
            <MechanismSessionPlanner profile={clinicalProfile} />
          </div>
        )
      )}
    </div>
  );
}
