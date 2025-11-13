import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { ArrowRight, Brain, Activity, Target } from 'lucide-react';
import { ClinicalProfile, getExerciseRecommendations } from '@/lib/clinicalProfileMapper';

interface InferenceChainViewerProps {
  profile: ClinicalProfile;
}

export default function InferenceChainViewer({ profile }: InferenceChainViewerProps) {
  const inferenceNotes = profile.inference_notes || [];
  const exerciseRecs = getExerciseRecommendations(profile);
  
  // Group inferences by source (lesion location)
  const groupedBySource = inferenceNotes.reduce((acc, note) => {
    const source = note.source || 'Other findings';
    if (!acc[source]) {
      acc[source] = [];
    }
    acc[source].push(note);
    return acc;
  }, {} as Record<string, typeof inferenceNotes>);

  if (inferenceNotes.length === 0) {
    return null;
  }

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Brain className="h-5 w-5 text-primary" />
          Clinical Inference Chain
        </CardTitle>
        <CardDescription>
          See how detected lesions lead to impairment predictions and therapy recommendations
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Accordion type="multiple" className="w-full space-y-2">
          {Object.entries(groupedBySource).map(([source, notes], idx) => (
            <AccordionItem 
              key={idx} 
              value={`chain-${idx}`}
              className="border rounded-lg px-4 bg-card"
            >
              <AccordionTrigger className="hover:no-underline py-4">
                <div className="flex items-center gap-3 text-left">
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-primary">
                    {idx + 1}
                  </div>
                  <div className="flex-1">
                    <p className="font-semibold text-sm">
                      {source}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {notes.length} impairment{notes.length > 1 ? 's' : ''} inferred
                    </p>
                  </div>
                </div>
              </AccordionTrigger>
              <AccordionContent className="pt-2 pb-4">
                <div className="space-y-4 ml-11">
                  {/* Step 1: Detected Lesion */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-xs font-semibold text-blue-600">
                      1
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground mb-1">
                        DETECTED LESION
                      </p>
                      <p className="text-sm font-semibold">
                        {source}
                      </p>
                    </div>
                  </div>

                  <div className="ml-3 flex items-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Step 2: Inferred Impairments */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-orange-500/20 flex items-center justify-center text-xs font-semibold text-orange-600">
                      2
                    </div>
                    <div className="flex-1 space-y-3">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        INFERRED IMPAIRMENTS
                      </p>
                      {notes.map((note, noteIdx) => (
                        <div 
                          key={noteIdx}
                          className="p-3 rounded-md bg-muted/50 border border-border space-y-2"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2">
                              <Activity className="h-3.5 w-3.5 text-muted-foreground" />
                              <span className="font-semibold text-sm">
                                {note.impairment.replace(/_/g, ' ')}
                              </span>
                            </div>
                            <Badge 
                              variant={
                                note.confidence === 'high' ? 'default' : 
                                note.confidence === 'medium' ? 'secondary' : 
                                'outline'
                              }
                              className={
                                note.confidence === 'high' ? 'bg-green-600 hover:bg-green-700' :
                                note.confidence === 'medium' ? 'bg-yellow-600 hover:bg-yellow-700' :
                                'bg-orange-600 hover:bg-orange-700 text-white'
                              }
                            >
                              {note.confidence}
                            </Badge>
                          </div>
                          <p className="text-xs text-muted-foreground italic">
                            {note.reasoning}
                          </p>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="ml-3 flex items-center">
                    <ArrowRight className="h-4 w-4 text-muted-foreground" />
                  </div>

                  {/* Step 3: Therapy Recommendations */}
                  <div className="flex items-start gap-3">
                    <div className="flex-shrink-0 w-6 h-6 rounded-full bg-green-500/20 flex items-center justify-center text-xs font-semibold text-green-600">
                      3
                    </div>
                    <div className="flex-1">
                      <p className="text-xs font-medium text-muted-foreground mb-2">
                        THERAPY RECOMMENDATIONS
                      </p>
                      <div className="space-y-2">
                        {exerciseRecs.length > 0 ? (
                          exerciseRecs.map((rec, recIdx) => (
                            <div 
                              key={recIdx}
                              className="p-3 rounded-md bg-primary/5 border border-primary/20"
                            >
                              <div className="flex items-center gap-2 mb-1">
                                <Target className="h-3.5 w-3.5 text-primary" />
                                <span className="font-semibold text-sm capitalize">
                                  {rec.slug.replace(/-/g, ' ')}
                                </span>
                                <Badge variant="outline" className="ml-auto">
                                  {rec.priority} priority
                                </Badge>
                              </div>
                              <p className="text-xs text-muted-foreground">
                                {rec.reason}
                              </p>
                            </div>
                          ))
                        ) : (
                          <p className="text-xs text-muted-foreground italic">
                            No specific exercises matched yet
                          </p>
                        )}
                        {profile.therapy_focus.length > 0 && (
                          <div className="mt-2">
                            <p className="text-xs font-medium text-muted-foreground mb-1">
                              Additional therapy goals:
                            </p>
                            <div className="flex flex-wrap gap-1">
                              {profile.therapy_focus.map((goal, goalIdx) => (
                                <Badge key={goalIdx} variant="secondary" className="text-xs">
                                  {goal.replace(/_/g, ' ')}
                                </Badge>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </CardContent>
    </Card>
  );
}
