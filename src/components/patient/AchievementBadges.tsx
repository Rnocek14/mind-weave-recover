import { Card } from "@/components/ui/card";
import { ACHIEVEMENT_DEFS, type Achievement } from "@/hooks/useAchievements";
import { useMemo } from "react";

interface AchievementBadgesProps {
  achievements: Achievement[];
  newAchievements?: Achievement[];
}

/**
 * Visual badge display for earned achievements.
 * New achievements pulse to draw attention.
 */
export function AchievementBadges({ achievements, newAchievements = [] }: AchievementBadgesProps) {
  const earned = useMemo(() => {
    return ACHIEVEMENT_DEFS
      .filter((def) => achievements.some((a) => a.type === def.type))
      .map((def) => ({
        ...def,
        isNew: newAchievements.some((n) => n.type === def.type),
      }));
  }, [achievements, newAchievements]);

  if (earned.length === 0) return null;

  return (
    <div className="space-y-2">
      <h3 className="text-base font-semibold text-foreground px-1">Your Achievements</h3>
      <div className="flex flex-wrap gap-2">
        {earned.map((badge) => (
          <Card
            key={badge.type}
            className={`px-3 py-2 border flex items-center gap-2 transition-all ${
              badge.isNew
                ? "border-primary/50 bg-primary/10 animate-pulse shadow-md"
                : "border-border"
            }`}
          >
            <span className="text-xl">{badge.icon}</span>
            <span className="text-sm font-medium text-foreground">{badge.label}</span>
          </Card>
        ))}
      </div>
    </div>
  );
}
