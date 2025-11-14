import { Badge } from "@/components/ui/badge";
import { Brain, Activity } from "lucide-react";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";

interface StrokeProfileWidgetProps {
  profile: ClinicalProfile;
  compact?: boolean;
}

export function StrokeProfileWidget({ profile, compact = false }: StrokeProfileWidgetProps) {
  const mechanismLabels: Record<string, string> = {
    cardioembolic: 'Cardioembolic',
    lacunar: 'Lacunar',
    large_artery: 'Large Artery',
    undetermined: 'Undetermined'
  };

  const mechanismColors: Record<string, string> = {
    cardioembolic: 'bg-purple-500/10 text-purple-700 border-purple-200',
    lacunar: 'bg-blue-500/10 text-blue-700 border-blue-200',
    large_artery: 'bg-orange-500/10 text-orange-700 border-orange-200',
    undetermined: 'bg-gray-500/10 text-gray-700 border-gray-200'
  };

  const sideLabels: Record<string, string> = {
    left: 'Left',
    right: 'Right',
    bilateral: 'Both',
    none: 'Unspecified'
  };

  // Collect primary deficits (max 3-4 for compact view)
  const primaryDeficits: string[] = [];
  
  if (profile.impairments?.motor?.length) {
    primaryDeficits.push(profile.impairments.motor[0]);
  }
  if (profile.impairments?.speech?.length) {
    primaryDeficits.push(profile.impairments.speech[0]);
  }
  if (profile.impairments?.visual?.length) {
    primaryDeficits.push(profile.impairments.visual[0]);
  }
  if (profile.impairments?.cognitive?.length) {
    primaryDeficits.push(profile.impairments.cognitive[0]);
  }

  return (
    <div className={`flex items-center gap-3 ${compact ? 'text-sm' : ''} bg-muted/30 border border-border rounded-lg p-3`}>
      <div className="flex items-center gap-2 text-primary">
        <Brain className={compact ? "w-4 h-4" : "w-5 h-5"} />
        <span className="font-semibold">Profile:</span>
      </div>
      
      <div className="flex items-center gap-2 flex-wrap">
        {/* Mechanism */}
        {profile.stroke_mechanism && (
          <Badge className={`${mechanismColors[profile.stroke_mechanism]} border text-xs`}>
            {mechanismLabels[profile.stroke_mechanism]}
          </Badge>
        )}
        
        {/* Side */}
        {profile.affected_side && (
          <Badge variant="outline" className="text-xs">
            <Activity className="w-3 h-3 mr-1" />
            {sideLabels[profile.affected_side]} side
          </Badge>
        )}
        
        {/* Primary deficits */}
        {primaryDeficits.length > 0 && (
          <span className="text-xs text-muted-foreground">
            • {primaryDeficits.join(', ')}
          </span>
        )}
      </div>
    </div>
  );
}
