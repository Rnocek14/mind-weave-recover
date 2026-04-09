/**
 * Profile Completeness Banner — shows missing phenotype fields and prompts clinician to fill them.
 * Appears at the top of Patient Hub when critical fields are empty.
 */
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { AlertTriangle } from "lucide-react";

interface Props {
  profile: {
    aphasia_type?: string | null;
    laterality?: string | null;
    chronicity_tag?: string | null;
    stroke_mechanism_tag?: string | null;
    primary_territory?: string | null;
    stroke_date?: string | null;
  } | null;
  onEditProfile?: () => void;
}

const REQUIRED_FIELDS: { key: string; label: string }[] = [
  { key: "aphasia_type", label: "Aphasia Type" },
  { key: "laterality", label: "Laterality" },
  { key: "chronicity_tag", label: "Chronicity" },
  { key: "stroke_mechanism_tag", label: "Stroke Mechanism" },
  { key: "primary_territory", label: "Vascular Territory" },
  { key: "stroke_date", label: "Stroke Date" },
];

export function ProfileCompletenessBanner({ profile, onEditProfile }: Props) {
  if (!profile) return null;

  const missing = REQUIRED_FIELDS.filter(
    (f) => !(profile as any)[f.key]
  );

  if (missing.length === 0) return null;

  const completeness = Math.round(((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100);

  return (
    <Card className="border-amber-500/40 bg-amber-500/5">
      <CardContent className="py-3 flex items-center gap-3 flex-wrap">
        <AlertTriangle className="w-4 h-4 text-amber-500 shrink-0" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="text-xs font-medium">Profile Incomplete</span>
            <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600">
              {completeness}% complete
            </Badge>
          </div>
          <div className="flex flex-wrap gap-1 mt-1">
            {missing.map((f) => (
              <Badge key={f.key} variant="secondary" className="text-xs bg-amber-500/10 text-amber-700">
                {f.label}
              </Badge>
            ))}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            ⚠️ Incomplete data limits analytics reliability. Complete the profile to unlock accurate cohort insights.
          </p>
        </div>
        {onEditProfile && (
          <Button size="sm" variant="outline" className="text-xs h-7 shrink-0 border-amber-500/30" onClick={onEditProfile}>
            Complete Profile
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

/** Small badge for use in clinician dashboard patient lists */
export function ProfileIncompleteChip({ profile }: { profile: Props["profile"] }) {
  if (!profile) return null;
  const missing = REQUIRED_FIELDS.filter((f) => !(profile as any)[f.key]);
  if (missing.length === 0) return null;
  const pct = Math.round(((REQUIRED_FIELDS.length - missing.length) / REQUIRED_FIELDS.length) * 100);
  return (
    <Badge variant="outline" className="text-xs border-amber-500/30 text-amber-600">
      Profile {pct}%
    </Badge>
  );
}
