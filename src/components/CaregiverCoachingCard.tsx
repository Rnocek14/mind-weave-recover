import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useUiMode } from "@/hooks/useUiMode";
import { ClinicalTerm } from "@/components/ClinicalTerm";
import { getCueTermInfo } from "@/lib/insightLanguageMap";
import { Heart, MessageCircle } from "lucide-react";

type CueEfficacy = {
  cueType: string;
  efficacyRate: number;
  effectiveCount: number;
  totalGiven: number;
};

interface CaregiverCoachingCardProps {
  cueEfficacy: CueEfficacy[] | null | undefined;
}

export function CaregiverCoachingCard({ cueEfficacy }: CaregiverCoachingCardProps) {
  const { isAtLeast } = useUiMode();
  
  // Only show in caregiver mode or above
  if (!isAtLeast("caregiver")) return null;

  const valid = (cueEfficacy || []).filter(c => (c?.effectiveCount ?? 0) >= 3);
  const best = valid.length
    ? [...valid].sort((a, b) => b.efficacyRate - a.efficacyRate)[0]
    : null;

  // Building baseline state
  if (!best) {
    return (
      <Card className="border-primary/20 bg-primary/5">
        <CardHeader className="pb-2">
          <CardTitle className="text-base flex items-center gap-2">
            <Heart className="h-4 w-4 text-primary" />
            How to Help Today
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm font-medium">
            Building baseline — keep sessions short and encouraging.
          </p>
          <div className="space-y-2 text-sm text-muted-foreground">
            <p className="flex items-center gap-2">
              <MessageCircle className="h-3 w-3 flex-shrink-0" />
              If they get stuck, try a gentle hint like:
            </p>
            <ul className="ml-5 space-y-1 list-disc">
              <li>"What category is it in?"</li>
              <li>"What does it do?"</li>
              <li>"Where would you find it?"</li>
            </ul>
          </div>
        </CardContent>
      </Card>
    );
  }

  const term = getCueTermInfo(best.cueType);

  return (
    <Card className="border-primary/20 bg-primary/5">
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Heart className="h-4 w-4 text-primary" />
          How to Help Today
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <p className="text-sm">
          When they get stuck, start with{" "}
          <ClinicalTerm type="cue" value={best.cueType} className="font-semibold text-primary" />.
        </p>
        <p className="text-xs text-muted-foreground">
          This hint style has been most effective so far (~{Math.round(best.efficacyRate * 100)}% within 6s, n={best.totalGiven}).
        </p>
        {term.description && (
          <p className="text-xs text-muted-foreground italic">
            Tip: {term.description}
          </p>
        )}
      </CardContent>
    </Card>
  );
}
