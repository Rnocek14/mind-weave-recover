import { Badge } from '@/components/ui/badge';
import { Clock, Target, Volume2, Eye, Sparkles, RefreshCw } from 'lucide-react';
import type { ExerciseAdaptation } from '@/lib/exerciseGating';

interface AdaptationBadgesProps {
  adaptations: ExerciseAdaptation | null;
  className?: string;
}

export const AdaptationBadges = ({ adaptations, className = '' }: AdaptationBadgesProps) => {
  if (!adaptations) return null;

  const badges = [];
  const adapt = adaptations.adaptations;

  if (adapt.extendedTimeouts) {
    badges.push({
      icon: Clock,
      label: 'Extended Time',
      variant: 'secondary' as const,
    });
  }

  if (adapt.largeTargets) {
    badges.push({
      icon: Target,
      label: 'Larger Targets',
      variant: 'secondary' as const,
    });
  }

  if (adapt.useAudioCues) {
    badges.push({
      icon: Volume2,
      label: 'Audio Cues',
      variant: 'secondary' as const,
    });
  }

  if (adapt.highContrast) {
    badges.push({
      icon: Eye,
      label: 'High Contrast',
      variant: 'secondary' as const,
    });
  }

  if (adapt.simplifiedUI) {
    badges.push({
      icon: Sparkles,
      label: 'Simplified',
      variant: 'secondary' as const,
    });
  }

  if (badges.length === 0) return null;

  return (
    <div className={`flex flex-wrap gap-2 ${className}`}>
      {badges.map((badge, index) => {
        const Icon = badge.icon;
        return (
          <Badge key={index} variant={badge.variant} className="gap-1">
            <Icon className="h-3 w-3" />
            {badge.label}
          </Badge>
        );
      })}
    </div>
  );
};
