import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Loader2, FileText, Sparkles } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { ClinicalProfile } from '@/lib/clinicalProfileMapper';

interface ClinicalNoteParserProps {
  onProfileExtracted: (profile: ClinicalProfile) => void;
}

export default function ClinicalNoteParser({ onProfileExtracted }: ClinicalNoteParserProps) {
  const [clinicalNote, setClinicalNote] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [extractedProfile, setExtractedProfile] = useState<ClinicalProfile | null>(null);
  const { toast } = useToast();

  const handleParse = async () => {
    if (!clinicalNote.trim()) {
      toast({
        title: 'No text entered',
        description: 'Please enter or paste clinical notes to parse',
        variant: 'destructive'
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('parse-clinical-notes', {
        body: { clinicalNote }
      });

      if (error) throw error;

      const profile = data.profile as ClinicalProfile;
      setExtractedProfile(profile);
      
      toast({
        title: 'Profile extracted successfully',
        description: `Found ${Object.values(profile.impairments).flat().length} impairments`
      });
    } catch (error) {
      console.error('Error parsing notes:', error);
      toast({
        title: 'Parsing failed',
        description: error instanceof Error ? error.message : 'Failed to parse clinical notes',
        variant: 'destructive'
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleConfirm = () => {
    if (extractedProfile) {
      onProfileExtracted(extractedProfile);
    }
  };

  const exampleNote = `65-year-old patient with left MCA stroke. Presents with right arm and hand weakness (3/5 strength), mild expressive aphasia, and slowed processing. Goal: regain right hand dexterity for daily tasks and improve speaking fluency.`;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Clinical Note Parser
          </CardTitle>
          <CardDescription>
            Paste doctor's notes or therapy evaluations. AI will extract stroke impairments and therapy goals.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Textarea
              placeholder="Paste clinical notes here..."
              value={clinicalNote}
              onChange={(e) => setClinicalNote(e.target.value)}
              rows={8}
              className="font-mono text-sm"
            />
            <Button
              variant="outline"
              size="sm"
              className="mt-2"
              onClick={() => setClinicalNote(exampleNote)}
            >
              Load Example Note
            </Button>
          </div>

          <Button 
            onClick={handleParse} 
            disabled={isLoading || !clinicalNote.trim()}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Parsing with AI...
              </>
            ) : (
              <>
                <Sparkles className="mr-2 h-4 w-4" />
                Parse Clinical Notes
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {extractedProfile && (
        <Card className="border-primary">
          <CardHeader>
            <CardTitle className="text-lg">Extracted Profile</CardTitle>
            <CardDescription>
              Review the extracted information. Edit if needed before confirming.
              {extractedProfile.confidence && (
                <Badge variant={extractedProfile.confidence === 'high' ? 'default' : 'secondary'} className="ml-2">
                  {extractedProfile.confidence} confidence
                </Badge>
              )}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <h4 className="font-semibold mb-2">Motor Impairments</h4>
              <div className="flex flex-wrap gap-2">
                {extractedProfile.impairments.motor.length > 0 ? (
                  extractedProfile.impairments.motor.map((imp, idx) => (
                    <Badge key={idx} variant="outline">{imp.replace(/_/g, ' ')}</Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">None detected</span>
                )}
              </div>
              {extractedProfile.source_phrases?.motor && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Source: "{extractedProfile.source_phrases.motor[0]}"
                </p>
              )}
            </div>

            <div>
              <h4 className="font-semibold mb-2">Speech Impairments</h4>
              <div className="flex flex-wrap gap-2">
                {extractedProfile.impairments.speech.length > 0 ? (
                  extractedProfile.impairments.speech.map((imp, idx) => (
                    <Badge key={idx} variant="outline">{imp.replace(/_/g, ' ')}</Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">None detected</span>
                )}
              </div>
              {extractedProfile.source_phrases?.speech && (
                <p className="text-xs text-muted-foreground mt-1 italic">
                  Source: "{extractedProfile.source_phrases.speech[0]}"
                </p>
              )}
            </div>

            <div>
              <h4 className="font-semibold mb-2">Cognitive Status</h4>
              <div className="flex flex-wrap gap-2">
                {extractedProfile.impairments.cognitive.length > 0 ? (
                  extractedProfile.impairments.cognitive.map((imp, idx) => (
                    <Badge key={idx} variant="outline">{imp.replace(/_/g, ' ')}</Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">None detected</span>
                )}
              </div>
            </div>

            <div>
              <h4 className="font-semibold mb-2">Visual Impairments</h4>
              <div className="flex flex-wrap gap-2">
                {extractedProfile.impairments.visual.length > 0 ? (
                  extractedProfile.impairments.visual.map((imp, idx) => (
                    <Badge key={idx} variant="outline">{imp.replace(/_/g, ' ')}</Badge>
                  ))
                ) : (
                  <span className="text-muted-foreground text-sm">None detected</span>
                )}
              </div>
            </div>

            {extractedProfile.stroke_location && (
              <div>
                <h4 className="font-semibold mb-2">Stroke Location</h4>
                <Badge>{extractedProfile.stroke_location.replace(/_/g, ' ')}</Badge>
                {extractedProfile.source_phrases?.stroke_location && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Source: "{extractedProfile.source_phrases.stroke_location}"
                  </p>
                )}
              </div>
            )}

            {extractedProfile.affected_side && (
              <div>
                <h4 className="font-semibold mb-2">Affected Side</h4>
                <Badge>{extractedProfile.affected_side}</Badge>
                {extractedProfile.source_phrases?.affected_side && (
                  <p className="text-xs text-muted-foreground mt-1 italic">
                    Source: "{extractedProfile.source_phrases.affected_side}"
                  </p>
                )}
              </div>
            )}

            {extractedProfile.therapy_focus.length > 0 && (
              <div>
                <h4 className="font-semibold mb-2">Therapy Goals</h4>
                <div className="flex flex-wrap gap-2">
                  {extractedProfile.therapy_focus.map((goal, idx) => (
                    <Badge key={idx} variant="secondary">{goal.replace(/_/g, ' ')}</Badge>
                  ))}
                </div>
              </div>
            )}

            <Button onClick={handleConfirm} className="w-full">
              Confirm & Use This Profile
            </Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}