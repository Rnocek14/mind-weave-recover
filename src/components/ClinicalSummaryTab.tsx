import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, MapPin, Activity, Target, Lightbulb } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

interface ClinicalSummaryTabProps {
  profile: { clinical_profile?: any };
}

export const ClinicalSummaryTab = ({ profile }: ClinicalSummaryTabProps) => {
  const clinicalProfile = profile?.clinical_profile;
  
  if (!clinicalProfile) {
    return (
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-center gap-2 text-muted-foreground">
            <AlertCircle className="w-5 h-5" />
            <p>No clinical profile available</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  const strokeLocations = Array.isArray(clinicalProfile.stroke_location) 
    ? clinicalProfile.stroke_location 
    : clinicalProfile.stroke_location ? [clinicalProfile.stroke_location] : [];

  const inferenceNotes = clinicalProfile.inference_notes || [];
  const impairments = clinicalProfile.impairments || {};
  const therapyFocus = clinicalProfile.therapy_focus || [];

  return (
    <div className="space-y-4">
      {/* Lesion Locations */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <MapPin className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 space-y-3">
              <h3 className="text-sm font-semibold">Lesion Locations & Vascular Territories</h3>
              
              <div className="space-y-2">
                <p className="text-xs text-muted-foreground font-medium">Affected Areas:</p>
                <div className="flex flex-wrap gap-2">
                  {strokeLocations.map((loc: string, idx: number) => (
                    <Badge key={idx} variant="default">{loc}</Badge>
                  ))}
                </div>
              </div>

              {clinicalProfile.stroke_mechanism && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Stroke Mechanism:</p>
                  <Badge variant="secondary">{clinicalProfile.stroke_mechanism}</Badge>
                </div>
              )}

              {clinicalProfile.affected_side && (
                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground font-medium">Affected Side:</p>
                  <Badge variant="outline" className="capitalize">{clinicalProfile.affected_side}</Badge>
                </div>
              )}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Predicted Impairments */}
      <Card>
        <CardContent className="pt-6">
          <div className="flex items-start gap-3">
            <Activity className="w-5 h-5 text-primary mt-0.5" />
            <div className="flex-1 space-y-3">
              <h3 className="text-sm font-semibold">Predicted Functional Impairments</h3>
              
              {Object.entries(impairments).map(([category, deficits]: [string, any]) => {
                if (!deficits || deficits.length === 0) return null;
                
                return (
                  <div key={category} className="space-y-2">
                    <p className="text-xs text-muted-foreground font-medium capitalize">{category} Impairments:</p>
                    <div className="flex flex-wrap gap-2">
                      {deficits.map((deficit: string, idx: number) => (
                        <Badge key={idx} variant="outline">{deficit}</Badge>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Clinical Reasoning */}
      {inferenceNotes.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Lightbulb className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-4">
                <h3 className="text-sm font-semibold">Clinical Reasoning & Confidence</h3>
                
                {inferenceNotes.map((note: any, idx: number) => (
                  <div key={idx} className="space-y-2 pb-4 border-b last:border-b-0 last:pb-0">
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium">{note.impairment}</p>
                      <Badge 
                        variant={note.confidence === 'high' ? 'default' : note.confidence === 'medium' ? 'secondary' : 'outline'}
                        className="text-xs shrink-0"
                      >
                        {note.confidence}
                      </Badge>
                    </div>
                    
                    {note.source && (
                      <p className="text-xs text-muted-foreground">
                        <span className="font-medium">Source:</span> {note.source}
                      </p>
                    )}
                    
                    {note.reasoning && (
                      <p className="text-xs text-muted-foreground leading-relaxed">
                        {note.reasoning}
                      </p>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Therapy Recommendations */}
      {therapyFocus.length > 0 && (
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-start gap-3">
              <Target className="w-5 h-5 text-primary mt-0.5" />
              <div className="flex-1 space-y-3">
                <h3 className="text-sm font-semibold">Recommended Therapy Focus</h3>
                
                <div className="space-y-2">
                  <p className="text-xs text-muted-foreground">
                    Based on the lesion pattern and predicted impairments, therapy should prioritize:
                  </p>
                  <ul className="space-y-1.5 ml-4">
                    {therapyFocus.map((focus: string, idx: number) => (
                      <li key={idx} className="text-sm flex items-start gap-2">
                        <span className="text-primary mt-1">•</span>
                        <span>{focus}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Disclaimer */}
      <div className="flex items-start gap-2 p-3 bg-muted/50 rounded-lg">
        <AlertCircle className="w-4 h-4 text-muted-foreground mt-0.5 shrink-0" />
        <p className="text-xs text-muted-foreground leading-relaxed">
          This summary is based on automated analysis of clinical notes and exercise data. 
          All predictions should be validated by a healthcare professional. Functional scores 
          are estimates based on exercise performance, not clinical assessments.
        </p>
      </div>
    </div>
  );
};
