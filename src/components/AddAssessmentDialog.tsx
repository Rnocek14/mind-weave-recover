import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Plus } from 'lucide-react';
import { AssessmentType } from '@/hooks/useStandardizedAssessments';

interface AddAssessmentDialogProps {
  onAdd: (type: AssessmentType, date: string, scores: Record<string, any>, notes?: string) => Promise<void>;
}

export const AddAssessmentDialog = ({ onAdd }: AddAssessmentDialogProps) => {
  const [open, setOpen] = useState(false);
  const [assessmentType, setAssessmentType] = useState<AssessmentType>('WAB-R');
  const [assessmentDate, setAssessmentDate] = useState(new Date().toISOString().split('T')[0]);
  const [notes, setNotes] = useState('');
  const [scores, setScores] = useState<Record<string, string>>({});

  const assessmentFields: Record<AssessmentType, { key: string; label: string; max?: number }[]> = {
    'WAB-R': [
      { key: 'spontaneous_speech', label: 'Spontaneous Speech', max: 20 },
      { key: 'comprehension', label: 'Comprehension', max: 200 },
      { key: 'repetition', label: 'Repetition', max: 100 },
      { key: 'naming', label: 'Naming', max: 100 },
      { key: 'aphasia_quotient', label: 'Aphasia Quotient (AQ)', max: 100 },
    ],
    'BNT': [
      { key: 'total_correct', label: 'Total Correct (out of 60)', max: 60 },
    ],
    'NIHSS': [
      { key: 'total_score', label: 'Total Score', max: 42 },
      { key: 'consciousness', label: 'Level of Consciousness', max: 3 },
      { key: 'motor_arm', label: 'Motor Arm', max: 8 },
      { key: 'motor_leg', label: 'Motor Leg', max: 8 },
      { key: 'language', label: 'Language', max: 3 },
    ],
    'ASHA-NOMS': [
      { key: 'swallowing', label: 'Swallowing (1-7)', max: 7 },
      { key: 'motor_speech', label: 'Motor Speech (1-7)', max: 7 },
      { key: 'spoken_comprehension', label: 'Spoken Language Comprehension (1-7)', max: 7 },
      { key: 'spoken_expression', label: 'Spoken Language Expression (1-7)', max: 7 },
      { key: 'attention', label: 'Attention (1-7)', max: 7 },
      { key: 'memory', label: 'Memory (1-7)', max: 7 },
    ],
  };

  const handleSubmit = async () => {
    const numericScores = Object.fromEntries(
      Object.entries(scores).map(([k, v]) => [k, parseFloat(v) || 0])
    );

    await onAdd(assessmentType, assessmentDate, numericScores, notes || undefined);
    
    setOpen(false);
    setScores({});
    setNotes('');
  };

  const fields = assessmentFields[assessmentType];

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Plus className="w-4 h-4 mr-2" />
          Add Assessment
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add Standardized Assessment</DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Assessment Type</Label>
            <Select value={assessmentType} onValueChange={(v) => setAssessmentType(v as AssessmentType)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="WAB-R">WAB-R (Western Aphasia Battery)</SelectItem>
                <SelectItem value="BNT">BNT (Boston Naming Test)</SelectItem>
                <SelectItem value="NIHSS">NIHSS (Stroke Scale)</SelectItem>
                <SelectItem value="ASHA-NOMS">ASHA-NOMS (Functional Outcomes)</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Assessment Date</Label>
            <Input
              type="date"
              value={assessmentDate}
              onChange={(e) => setAssessmentDate(e.target.value)}
            />
          </div>

          <div className="space-y-3">
            <Label>Scores</Label>
            <div className="grid grid-cols-2 gap-3">
              {fields.map((field) => (
                <div key={field.key} className="space-y-1">
                  <Label className="text-sm text-muted-foreground">
                    {field.label}
                    {field.max && ` (0-${field.max})`}
                  </Label>
                  <Input
                    type="number"
                    min="0"
                    max={field.max}
                    step="0.1"
                    placeholder="0"
                    value={scores[field.key] || ''}
                    onChange={(e) => setScores({ ...scores, [field.key]: e.target.value })}
                  />
                </div>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            <Label>Notes (Optional)</Label>
            <Textarea
              placeholder="Clinical observations, testing conditions, etc."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>

          <div className="flex justify-end gap-2 pt-4">
            <Button variant="outline" onClick={() => setOpen(false)}>
              Cancel
            </Button>
            <Button onClick={handleSubmit}>
              Save Assessment
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
};
