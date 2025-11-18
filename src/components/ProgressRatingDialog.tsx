import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';
import { Circle, Clock, CheckCircle2 } from 'lucide-react';
import type { FunctionalGoal } from '@/hooks/useFunctionalGoals';

interface ProgressRatingDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  goal: FunctionalGoal;
  onAddRating: (
    goalId: string,
    status: 'not_yet' | 'partial' | 'achieved',
    notes?: string,
    confidenceLevel?: number
  ) => Promise<any>;
}

export const ProgressRatingDialog = ({
  open,
  onOpenChange,
  goal,
  onAddRating,
}: ProgressRatingDialogProps) => {
  const [status, setStatus] = useState<'not_yet' | 'partial' | 'achieved'>(
    goal.latest_rating?.status || goal.baseline_status
  );
  const [notes, setNotes] = useState('');
  const [confidence, setConfidence] = useState<number>(3);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    setLoading(true);
    try {
      await onAddRating(goal.id, status, notes.trim() || undefined, confidence);
      setNotes('');
      setConfidence(3);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to add rating:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Update Progress</DialogTitle>
          <DialogDescription>{goal.goal_text}</DialogDescription>
        </DialogHeader>

        <div className="space-y-6 py-4">
          <div className="space-y-3">
            <Label>Current Status</Label>
            <RadioGroup value={status} onValueChange={(value: any) => setStatus(value)}>
              <div className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="not_yet" id="not_yet" />
                <Label htmlFor="not_yet" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Circle className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <div className="font-medium">Not Yet</div>
                    <div className="text-xs text-muted-foreground">
                      Haven't started or very little progress
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="partial" id="partial" />
                <Label htmlFor="partial" className="flex items-center gap-2 cursor-pointer flex-1">
                  <Clock className="h-4 w-4 text-yellow-500" />
                  <div>
                    <div className="font-medium">In Progress</div>
                    <div className="text-xs text-muted-foreground">
                      Making progress, but not fully achieved yet
                    </div>
                  </div>
                </Label>
              </div>

              <div className="flex items-center space-x-3 p-3 border border-border rounded-lg hover:bg-muted/50 transition-colors">
                <RadioGroupItem value="achieved" id="achieved" />
                <Label htmlFor="achieved" className="flex items-center gap-2 cursor-pointer flex-1">
                  <CheckCircle2 className="h-4 w-4 text-green-500" />
                  <div>
                    <div className="font-medium">Achieved</div>
                    <div className="text-xs text-muted-foreground">
                      Goal fully accomplished!
                    </div>
                  </div>
                </Label>
              </div>
            </RadioGroup>
          </div>

          <div className="space-y-3">
            <Label>Confidence Level: {confidence}/5</Label>
            <div className="flex items-center gap-4">
              <span className="text-xs text-muted-foreground">Low</span>
              <Slider
                value={[confidence]}
                onValueChange={(value) => setConfidence(value[0])}
                min={1}
                max={5}
                step={1}
                className="flex-1"
              />
              <span className="text-xs text-muted-foreground">High</span>
            </div>
            <p className="text-xs text-muted-foreground">
              How confident are you in this assessment?
            </p>
          </div>

          <div className="space-y-2">
            <Label htmlFor="notes">Notes (Optional)</Label>
            <Textarea
              id="notes"
              placeholder="Add any observations or details about progress..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={loading}>
            {loading ? 'Saving...' : 'Save Progress'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
