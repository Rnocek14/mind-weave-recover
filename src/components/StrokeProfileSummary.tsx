import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, MapPin, Activity, Target, Calendar, TrendingUp } from "lucide-react";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { format } from "date-fns";

interface StrokeProfileSummaryProps {
  profile: ClinicalProfile;
}

export function StrokeProfileSummary({ profile }: StrokeProfileSummaryProps) {
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
    left: 'Left Side',
    right: 'Right Side',
    bilateral: 'Bilateral',
    none: 'Not Specified'
  };

  // Extract territories from stroke_location
  const territories = profile.stroke_location
    ? (Array.isArray(profile.stroke_location) 
        ? profile.stroke_location 
        : profile.stroke_location.split(/[,;]/).map(t => t.trim()).filter(Boolean))
    : [];

  // Get all impairments
  const allImpairments = [
    ...(profile.impairments?.motor || []),
    ...(profile.impairments?.speech || []),
    ...(profile.impairments?.visual || []),
    ...(profile.impairments?.cognitive || [])
  ];

  return (
    <Card className="border-primary/20 bg-gradient-to-br from-background to-muted/30">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Stroke Profile Summary
            </CardTitle>
            <CardDescription>
              {profile.extraction_metadata?.last_updated && (
                <span className="flex items-center gap-1 text-xs">
                  <Calendar className="w-3 h-3" />
                  Inferred from clinical note on {format(new Date(profile.extraction_metadata.last_updated), 'MMM d, yyyy')}
                </span>
              )}
            </CardDescription>
          </div>
          {profile.stroke_mechanism && (
            <Badge className={mechanismColors[profile.stroke_mechanism] + " border"}>
              {mechanismLabels[profile.stroke_mechanism]}
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Territories & Basic Info */}
        <div className="grid md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <MapPin className="w-4 h-4 text-primary" />
              Territories Affected
            </div>
            <div className="flex flex-wrap gap-2">
              {territories.length > 0 ? (
                territories.map((territory, idx) => (
                  <Badge key={idx} variant="secondary" className="font-normal">
                    {territory}
                  </Badge>
                ))
              ) : (
                <span className="text-sm text-muted-foreground">Not specified</span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Activity className="w-4 h-4 text-primary" />
              Clinical Details
            </div>
            <div className="space-y-1 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Side Affected:</span>
                <span className="font-medium">{sideLabels[profile.affected_side || 'none']}</span>
              </div>
              {profile.stroke_mechanism && (
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Mechanism:</span>
                  <span className="font-medium">{mechanismLabels[profile.stroke_mechanism]}</span>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Deficits Predicted */}
        {allImpairments.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <Target className="w-4 h-4 text-primary" />
              Deficits Predicted
            </div>
            <div className="grid md:grid-cols-2 gap-3">
              {profile.impairments?.motor && profile.impairments.motor.length > 0 && (
                <div className="p-3 rounded-lg bg-background border border-border">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Motor</div>
                  <div className="space-y-1">
                    {profile.impairments.motor.map((imp, idx) => (
                      <div key={idx} className="text-sm">{imp}</div>
                    ))}
                  </div>
                </div>
              )}
              {profile.impairments?.speech && profile.impairments.speech.length > 0 && (
                <div className="p-3 rounded-lg bg-background border border-border">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Speech</div>
                  <div className="space-y-1">
                    {profile.impairments.speech.map((imp, idx) => (
                      <div key={idx} className="text-sm">{imp}</div>
                    ))}
                  </div>
                </div>
              )}
              {profile.impairments?.visual && profile.impairments.visual.length > 0 && (
                <div className="p-3 rounded-lg bg-background border border-border">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Visual</div>
                  <div className="space-y-1">
                    {profile.impairments.visual.map((imp, idx) => (
                      <div key={idx} className="text-sm">{imp}</div>
                    ))}
                  </div>
                </div>
              )}
              {profile.impairments?.cognitive && profile.impairments.cognitive.length > 0 && (
                <div className="p-3 rounded-lg bg-background border border-border">
                  <div className="text-xs font-semibold text-muted-foreground mb-1">Cognitive</div>
                  <div className="space-y-1">
                    {profile.impairments.cognitive.map((imp, idx) => (
                      <div key={idx} className="text-sm">{imp}</div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Therapy Focus */}
        {profile.therapy_focus && profile.therapy_focus.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-semibold">
              <TrendingUp className="w-4 h-4 text-primary" />
              Primary Focus Areas
            </div>
            <div className="flex flex-wrap gap-2">
              {profile.therapy_focus.map((focus, idx) => (
                <Badge key={idx} variant="outline" className="capitalize">
                  {focus.replace('_', ' ')}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Session Strategy Note */}
        {profile.stroke_mechanism && (
          <div className="p-4 rounded-lg bg-muted/50 border border-border">
            <p className="text-sm text-muted-foreground">
              <strong>Session Strategy:</strong>{' '}
              {profile.stroke_mechanism === 'cardioembolic' && 
                'Multi-domain adaptive sessions with 20-min duration and 3-exercise rotation to address widespread deficits.'}
              {profile.stroke_mechanism === 'lacunar' && 
                'Focused single-domain therapy with high repetition to reinforce specific neural pathways.'}
              {profile.stroke_mechanism === 'large_artery' && 
                'Gradual difficulty progression with motor emphasis, starting with foundational skills.'}
              {profile.stroke_mechanism === 'undetermined' && 
                'Balanced multi-domain approach with adaptive difficulty based on performance.'}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
