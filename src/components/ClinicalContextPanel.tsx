import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, Activity, Zap } from 'lucide-react';

interface ClinicalContextPanelProps {
  profile: { clinical_profile?: any };
}

export const ClinicalContextPanel = ({ profile }: ClinicalContextPanelProps) => {
  const clinicalProfile = profile?.clinical_profile;
  
  if (!clinicalProfile) return null;

  const strokeLocations = Array.isArray(clinicalProfile.stroke_location) 
    ? clinicalProfile.stroke_location 
    : clinicalProfile.stroke_location ? [clinicalProfile.stroke_location] : [];

  const mechanism = clinicalProfile.stroke_mechanism || 'Unknown';
  const affectedSide = clinicalProfile.affected_side || 'Unknown';
  
  // Gather all impairments
  const allDeficits = [
    ...(clinicalProfile.impairments?.motor || []),
    ...(clinicalProfile.impairments?.speech || []),
    ...(clinicalProfile.impairments?.visual || []),
    ...(clinicalProfile.impairments?.cognitive || [])
  ];

  const keyDeficits = allDeficits.slice(0, 5);

  const getMechanismColor = (mech: string) => {
    if (mech.toLowerCase().includes('cardioembolic')) return 'destructive';
    if (mech.toLowerCase().includes('lacunar')) return 'secondary';
    if (mech.toLowerCase().includes('large')) return 'destructive';
    return 'outline';
  };

  const getDeficitIcon = (deficit: string) => {
    const lower = deficit.toLowerCase();
    if (lower.includes('motor') || lower.includes('weakness') || lower.includes('hemipar')) return '💪';
    if (lower.includes('speech') || lower.includes('aphasia')) return '💬';
    if (lower.includes('visual') || lower.includes('vision')) return '👁️';
    if (lower.includes('cognitive') || lower.includes('attention')) return '🧠';
    return '📍';
  };

  return (
    <Card className="mb-4 border-primary/20 bg-gradient-to-r from-background to-muted/30">
      <CardContent className="pt-6">
        <div className="flex items-start gap-2 mb-4">
          <Activity className="w-5 h-5 text-primary mt-0.5" />
          <div className="flex-1">
            <h3 className="text-sm font-semibold mb-3">Clinical Overview</h3>
            
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {/* Vascular Territories */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Affected Territories</p>
                <div className="flex flex-wrap gap-1.5">
                  {strokeLocations.length > 0 ? (
                    strokeLocations.map((loc: string, idx: number) => (
                      <Badge key={idx} variant="default" className="text-xs">
                        {loc}
                      </Badge>
                    ))
                  ) : (
                    <Badge variant="outline" className="text-xs">Not specified</Badge>
                  )}
                </div>
              </div>

              {/* Stroke Mechanism */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Stroke Type</p>
                <Badge variant={getMechanismColor(mechanism)} className="text-xs">
                  {mechanism}
                </Badge>
              </div>

              {/* Affected Side */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Affected Side</p>
                <Badge variant="secondary" className="text-xs capitalize">
                  {affectedSide}
                </Badge>
              </div>

              {/* Key Deficits */}
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Primary Deficits</p>
                {keyDeficits.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5">
                    {keyDeficits.map((deficit, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs">
                        {getDeficitIcon(deficit)} {deficit}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <Badge variant="outline" className="text-xs">None identified</Badge>
                )}
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};
