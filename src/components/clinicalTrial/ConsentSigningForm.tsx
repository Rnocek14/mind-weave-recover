import { useEffect, useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Volume2, FileSignature } from 'lucide-react';
import { useTextToSpeech } from '@/hooks/useTextToSpeech';

export interface ConsentDocument {
  id: string;
  version: number;
  title: string;
  body_md: string;
  plain_summary: string | null;
  audio_url: string | null;
}

interface Props {
  document: ConsentDocument;
  patientName: string;
  /**
   * If true, shows the surrogate co-sign block (caregiver signing on
   * behalf of a patient who cannot consent independently).
   */
  allowSurrogate?: boolean;
  onSign: (signature: {
    signedName: string;
    capacityConfirmed: boolean;
    surrogateSignedName?: string;
    surrogateRelationship?: string;
  }) => Promise<void>;
  submitting?: boolean;
}

export function ConsentSigningForm({
  document,
  patientName,
  allowSurrogate = true,
  onSign,
  submitting,
}: Props) {
  const [signedName, setSignedName] = useState(patientName);
  const [capacityConfirmed, setCapacityConfirmed] = useState(false);
  const [useSurrogate, setUseSurrogate] = useState(false);
  const [surrogateName, setSurrogateName] = useState('');
  const [surrogateRel, setSurrogateRel] = useState('');
  const [hasReadFully, setHasReadFully] = useState(false);
  const [scrolledToEnd, setScrolledToEnd] = useState(false);
  const { speak, isSpeaking, stop } = useTextToSpeech();

  useEffect(() => () => stop(), [stop]);

  const canSign =
    signedName.trim().length >= 2 &&
    capacityConfirmed &&
    hasReadFully &&
    (!useSurrogate || (surrogateName.trim().length >= 2 && surrogateRel.trim().length >= 2));

  const speakSummary = () => {
    if (isSpeaking) {
      stop();
      return;
    }
    const text = document.plain_summary ?? document.body_md;
    speak(text, { mode: 'natural' });
  };

  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const el = e.currentTarget;
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 24) {
      setScrolledToEnd(true);
    }
  };

  const handleSubmit = async () => {
    await onSign({
      signedName: signedName.trim(),
      capacityConfirmed,
      surrogateSignedName: useSurrogate ? surrogateName.trim() : undefined,
      surrogateRelationship: useSurrogate ? surrogateRel.trim() : undefined,
    });
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileSignature className="h-5 w-5" />
          {document.title}
        </CardTitle>
        <CardDescription>
          Version {document.version} · please read carefully before signing
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {document.plain_summary && (
          <Alert>
            <AlertDescription className="text-base leading-relaxed">
              <strong className="block mb-1">In plain language:</strong>
              {document.plain_summary}
            </AlertDescription>
          </Alert>
        )}

        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={speakSummary}>
            <Volume2 className="h-4 w-4 mr-2" />
            {isSpeaking ? 'Stop' : 'Listen to summary'}
          </Button>
        </div>

        <div
          className="border rounded-lg p-4 max-h-80 overflow-y-auto prose prose-sm dark:prose-invert max-w-none"
          onScroll={handleScroll}
        >
          <ReactMarkdown>{document.body_md}</ReactMarkdown>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="read-fully"
            checked={hasReadFully}
            onCheckedChange={(c) => setHasReadFully(c === true)}
            disabled={!scrolledToEnd}
          />
          <Label htmlFor="read-fully" className="text-sm font-normal leading-relaxed">
            I have read this consent document
            {!scrolledToEnd && ' (scroll to the bottom to enable)'}.
          </Label>
        </div>

        <div className="flex items-start space-x-2">
          <Checkbox
            id="capacity"
            checked={capacityConfirmed}
            onCheckedChange={(c) => setCapacityConfirmed(c === true)}
          />
          <Label htmlFor="capacity" className="text-sm font-normal leading-relaxed">
            The patient understands what they are agreeing to (capacity confirmed by clinician).
          </Label>
        </div>

        <div className="space-y-2">
          <Label htmlFor="signed-name">Signature — type full name</Label>
          <Input
            id="signed-name"
            value={signedName}
            onChange={(e) => setSignedName(e.target.value)}
            placeholder="Full legal name"
            maxLength={200}
          />
        </div>

        {allowSurrogate && (
          <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
            <div className="flex items-start space-x-2">
              <Checkbox
                id="use-surrogate"
                checked={useSurrogate}
                onCheckedChange={(c) => setUseSurrogate(c === true)}
              />
              <Label htmlFor="use-surrogate" className="text-sm font-normal leading-relaxed">
                A caregiver is signing on the patient's behalf (surrogate consent)
              </Label>
            </div>
            {useSurrogate && (
              <div className="space-y-3 pl-6">
                <div>
                  <Label htmlFor="surrogate-name">Caregiver full name</Label>
                  <Input
                    id="surrogate-name"
                    value={surrogateName}
                    onChange={(e) => setSurrogateName(e.target.value)}
                    maxLength={200}
                  />
                </div>
                <div>
                  <Label htmlFor="surrogate-rel">Relationship to patient</Label>
                  <Input
                    id="surrogate-rel"
                    value={surrogateRel}
                    onChange={(e) => setSurrogateRel(e.target.value)}
                    placeholder="e.g. spouse, adult child"
                    maxLength={100}
                  />
                </div>
              </div>
            )}
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={handleSubmit} disabled={!canSign || submitting}>
            {submitting ? 'Recording signature…' : 'Sign and enroll'}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
