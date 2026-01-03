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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { cn } from '@/lib/utils';

interface CreateGoalDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreateGoal: (
    goalText: string,
    targetDomain: 'communication' | 'motor' | 'cognitive' | 'daily_living' | 'connected_speech',
    baselineStatus: 'not_yet' | 'partial' | 'achieved',
    targetDate?: string
  ) => Promise<any>;
}

export const CreateGoalDialog = ({ open, onOpenChange, onCreateGoal }: CreateGoalDialogProps) => {
  const [goalText, setGoalText] = useState('');
  const [targetDomain, setTargetDomain] = useState<'communication' | 'motor' | 'cognitive' | 'daily_living' | 'connected_speech'>('communication');
  const [baselineStatus, setBaselineStatus] = useState<'not_yet' | 'partial' | 'achieved'>('not_yet');
  const [targetDate, setTargetDate] = useState<Date | undefined>(undefined);
  const [loading, setLoading] = useState(false);

  const handleSubmit = async () => {
    if (!goalText.trim()) return;

    setLoading(true);
    try {
      await onCreateGoal(
        goalText.trim(),
        targetDomain,
        baselineStatus,
        targetDate ? format(targetDate, 'yyyy-MM-dd') : undefined
      );
      // Reset form
      setGoalText('');
      setTargetDomain('communication');
      setBaselineStatus('not_yet');
      setTargetDate(undefined);
      onOpenChange(false);
    } catch (error) {
      console.error('Failed to create goal:', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px]">
        <DialogHeader>
          <DialogTitle>Create New Goal</DialogTitle>
          <DialogDescription>
            Define a functional goal to track progress in real-world activities.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          <div className="space-y-2">
            <Label htmlFor="goal-text">Goal Description</Label>
            <Textarea
              id="goal-text"
              placeholder="e.g., Have a 5-minute conversation without support..."
              value={goalText}
              onChange={(e) => setGoalText(e.target.value)}
              rows={3}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="domain">Domain</Label>
            <Select value={targetDomain} onValueChange={(value: any) => setTargetDomain(value)}>
              <SelectTrigger id="domain">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="communication">Communication</SelectItem>
                <SelectItem value="connected_speech">Connected Speech</SelectItem>
                <SelectItem value="motor">Motor Skills</SelectItem>
                <SelectItem value="cognitive">Cognitive</SelectItem>
                <SelectItem value="daily_living">Daily Living</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label htmlFor="baseline">Current Status</Label>
            <Select value={baselineStatus} onValueChange={(value: any) => setBaselineStatus(value)}>
              <SelectTrigger id="baseline">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="not_yet">Not Yet</SelectItem>
                <SelectItem value="partial">Partially Achieved</SelectItem>
                <SelectItem value="achieved">Already Achieved</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-2">
            <Label>Target Date (Optional)</Label>
            <Popover>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  className={cn(
                    'w-full justify-start text-left font-normal',
                    !targetDate && 'text-muted-foreground'
                  )}
                >
                  <CalendarIcon className="mr-2 h-4 w-4" />
                  {targetDate ? format(targetDate, 'PPP') : 'Select target date'}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={targetDate}
                  onSelect={setTargetDate}
                  initialFocus
                  disabled={(date) => date < new Date()}
                />
              </PopoverContent>
            </Popover>
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!goalText.trim() || loading}>
            {loading ? 'Creating...' : 'Create Goal'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
