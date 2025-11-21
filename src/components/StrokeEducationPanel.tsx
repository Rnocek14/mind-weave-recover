import { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Brain, 
  Info,
  ChevronDown,
  ChevronUp,
  Activity,
  Eye,
  MessageSquare,
  Hand
} from 'lucide-react';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Button } from '@/components/ui/button';

interface StrokeEducationPanelProps {
  strokeLocation?: string;
  affectedSide?: string;
  impairments?: {
    motor?: string[];
    speech?: string[];
    visual?: string[];
    cognitive?: string[];
  };
}

export const StrokeEducationPanel = ({ 
  strokeLocation, 
  affectedSide,
  impairments 
}: StrokeEducationPanelProps) => {
  const [expandedSection, setExpandedSection] = useState<string | null>(null);

  const toggleSection = (section: string) => {
    setExpandedSection(expandedSection === section ? null : section);
  };

  const hasImpairments = impairments && Object.values(impairments).some(arr => arr && arr.length > 0);

  const getImpairmentIcon = (type: string) => {
    switch (type) {
      case 'motor': return <Hand className="h-4 w-4" />;
      case 'speech': return <MessageSquare className="h-4 w-4" />;
      case 'visual': return <Eye className="h-4 w-4" />;
      case 'cognitive': return <Brain className="h-4 w-4" />;
      default: return <Activity className="h-4 w-4" />;
    }
  };

  const getImpairmentColor = (type: string) => {
    switch (type) {
      case 'motor': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-300';
      case 'speech': return 'bg-purple-100 text-purple-800 dark:bg-purple-900/30 dark:text-purple-300';
      case 'visual': return 'bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300';
      case 'cognitive': return 'bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-300';
      default: return 'bg-muted text-muted-foreground';
    }
  };

  const simplifyTerm = (term: string): { simple: string; explanation: string } => {
    const glossary: Record<string, { simple: string; explanation: string }> = {
      'aphasia': {
        simple: 'Language Difficulty',
        explanation: 'Trouble with speaking, understanding, reading, or writing words'
      },
      'dysarthria': {
        simple: 'Speech Clarity',
        explanation: 'Difficulty making clear speech sounds due to muscle weakness'
      },
      'hemiparesis': {
        simple: 'Weakness',
        explanation: 'Weakness on one side of the body'
      },
      'hemiplegia': {
        simple: 'Paralysis',
        explanation: 'Paralysis on one side of the body'
      },
      'hemianopia': {
        simple: 'Vision Loss',
        explanation: 'Loss of half of the visual field in both eyes'
      },
      'neglect': {
        simple: 'Awareness Issue',
        explanation: 'Not noticing things on one side of space'
      },
      'apraxia': {
        simple: 'Movement Planning',
        explanation: 'Difficulty planning and coordinating movements'
      },
      'dysphagia': {
        simple: 'Swallowing Difficulty',
        explanation: 'Trouble swallowing food or liquids safely'
      }
    };

    const lowerTerm = term.toLowerCase();
    for (const [key, value] of Object.entries(glossary)) {
      if (lowerTerm.includes(key)) {
        return value;
      }
    }
    
    return { simple: term, explanation: '' };
  };

  if (!strokeLocation && !affectedSide && !hasImpairments) {
    return (
      <Alert>
        <Info className="h-4 w-4" />
        <AlertDescription>
          No clinical information available yet. Upload clinical notes to see your stroke education summary.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {/* Brain Location Overview */}
      <Card>
        <CardHeader className="pb-4">
          <div className="flex items-center gap-2">
            <Brain className="h-5 w-5 text-primary" />
            <CardTitle>Your Stroke Location</CardTitle>
          </div>
          <CardDescription>
            Understanding what parts of the brain were affected
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {strokeLocation && (
            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <Badge variant="secondary" className="font-normal">
                  {strokeLocation}
                </Badge>
                {affectedSide && (
                  <Badge variant="outline">
                    {affectedSide} side affected
                  </Badge>
                )}
              </div>
              
              <div className="p-4 rounded-lg bg-muted/50 border">
                <p className="text-sm leading-relaxed text-muted-foreground">
                  The stroke occurred in the <span className="font-medium text-foreground">{strokeLocation}</span> region of your brain
                  {affectedSide && <>, affecting the <span className="font-medium text-foreground">{affectedSide}</span> side</>}.
                  Each brain region controls different functions, which is why you may experience specific challenges.
                </p>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Impairments Breakdown */}
      {hasImpairments && (
        <Card>
          <CardHeader className="pb-4">
            <CardTitle>Understanding Your Challenges</CardTitle>
            <CardDescription>
              Plain-language explanation of each impairment and what it means
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-3">
            {Object.entries(impairments).map(([type, items]) => {
              if (!items || items.length === 0) return null;
              
              return (
                <Collapsible
                  key={type}
                  open={expandedSection === type}
                  onOpenChange={() => toggleSection(type)}
                >
                  <div className="border rounded-lg overflow-hidden">
                    <CollapsibleTrigger asChild>
                      <Button
                        variant="ghost"
                        className="w-full justify-between p-4 h-auto hover:bg-muted/50"
                      >
                        <div className="flex items-center gap-3">
                          <div className={`p-2 rounded-md ${getImpairmentColor(type)}`}>
                            {getImpairmentIcon(type)}
                          </div>
                          <div className="text-left">
                            <div className="font-medium capitalize">{type} Challenges</div>
                            <div className="text-xs text-muted-foreground">
                              {items.length} {items.length === 1 ? 'item' : 'items'}
                            </div>
                          </div>
                        </div>
                        {expandedSection === type ? (
                          <ChevronUp className="h-4 w-4 text-muted-foreground" />
                        ) : (
                          <ChevronDown className="h-4 w-4 text-muted-foreground" />
                        )}
                      </Button>
                    </CollapsibleTrigger>

                    <CollapsibleContent>
                      <div className="px-4 pb-4 space-y-3 border-t bg-muted/20">
                        {items.map((item, idx) => {
                          const { simple, explanation } = simplifyTerm(item);
                          return (
                            <div key={idx} className="pt-3 space-y-2">
                              <div className="flex items-start gap-2">
                                <div className="h-6 w-6 rounded-full bg-background border-2 border-primary/20 flex items-center justify-center shrink-0 mt-0.5">
                                  <span className="text-xs font-semibold text-primary">{idx + 1}</span>
                                </div>
                                <div className="flex-1 space-y-1">
                                  <div className="flex flex-wrap items-center gap-2">
                                    <span className="font-medium text-sm">{simple}</span>
                                    {explanation && simple !== item && (
                                      <Badge variant="outline" className="text-xs font-normal">
                                        {item}
                                      </Badge>
                                    )}
                                  </div>
                                  {explanation && (
                                    <p className="text-sm text-muted-foreground leading-relaxed">
                                      {explanation}
                                    </p>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </CollapsibleContent>
                  </div>
                </Collapsible>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Recovery Expectations */}
      <Card className="border-primary/20 bg-gradient-to-br from-primary/5 to-background">
        <CardHeader className="pb-4">
          <CardTitle className="text-lg">Recovery Journey</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm leading-relaxed">
            <p>
              <span className="font-medium">Every stroke is unique,</span> and recovery varies from person to person. 
              The brain has remarkable ability to adapt and form new connections, especially with consistent practice and therapy.
            </p>
            <p>
              <span className="font-medium">What helps recovery:</span> Regular exercise completion, adequate rest, 
              proper nutrition, and staying engaged with therapy activities all contribute to better outcomes.
            </p>
            <p className="text-muted-foreground">
              Your therapy program is designed to challenge the specific areas affected by your stroke while 
              building on your strengths. Progress may be gradual, but each session contributes to your recovery.
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};
