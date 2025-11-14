import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { TrendingUp, Award, Target, CheckCircle2 } from 'lucide-react';
import { Progress } from '@/components/ui/progress';

interface ConfidenceBoostProps {
  open: boolean;
  onClose: () => void;
  onContinue: () => void;
  onSwitchExercise?: () => void;
  stats: {
    correct: number;
    total: number;
    weeklyAccuracy: number;
    improvement: number;
  };
}

export const ConfidenceBoost = ({
  open,
  onClose,
  onContinue,
  onSwitchExercise,
  stats
}: ConfidenceBoostProps) => {
  const todayAccuracy = stats.total > 0 
    ? Math.round((stats.correct / stats.total) * 100)
    : 0;

  const handleContinue = () => {
    onContinue();
    onClose();
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-2xl">
            <Award className="h-6 w-6 text-warning" />
            You're Doing Great!
          </DialogTitle>
          <DialogDescription>
            Let's take a moment to see your progress
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Today's Performance */}
          <Card className="border-primary/20 bg-primary/5">
            <CardContent className="pt-6">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="h-5 w-5 text-success" />
                  <span className="font-medium">Today's Session</span>
                </div>
                <span className="text-2xl font-bold text-primary">
                  {stats.correct}/{stats.total}
                </span>
              </div>
              <Progress value={todayAccuracy} className="h-2" />
              <p className="text-sm text-muted-foreground mt-2">
                {todayAccuracy}% accuracy today
              </p>
            </CardContent>
          </Card>

          {/* Weekly Progress */}
          {stats.weeklyAccuracy > 0 && (
            <Card className="border-success/20 bg-success/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Target className="h-5 w-5 text-success" />
                    <span className="font-medium">This Week</span>
                  </div>
                  <span className="text-2xl font-bold text-success">
                    {Math.round(stats.weeklyAccuracy)}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  Average accuracy this week
                </p>
              </CardContent>
            </Card>
          )}

          {/* Improvement Indicator */}
          {stats.improvement > 0 && (
            <Card className="border-warning/20 bg-warning/5">
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5 text-warning" />
                    <span className="font-medium">Improvement</span>
                  </div>
                  <span className="text-2xl font-bold text-warning">
                    +{Math.round(stats.improvement)}%
                  </span>
                </div>
                <p className="text-sm text-muted-foreground mt-2">
                  You're improving compared to last week
                </p>
              </CardContent>
            </Card>
          )}

          {/* Encouragement Message */}
          <div className="text-center p-4 bg-muted/50 rounded-lg">
            <p className="text-sm text-muted-foreground">
              Remember: Making mistakes is part of learning. 
              Every attempt helps your brain build stronger connections.
            </p>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex flex-col gap-2">
          <Button 
            onClick={handleContinue}
            size="lg"
            className="w-full"
          >
            Let's Keep Going
          </Button>
          
          {onSwitchExercise && (
            <Button 
              onClick={() => {
                onSwitchExercise();
                onClose();
              }}
              variant="outline"
              size="lg"
              className="w-full"
            >
              Try a Different Exercise
            </Button>
          )}
          
          <Button 
            onClick={onClose}
            variant="ghost"
            size="sm"
            className="w-full"
          >
            Take a Break
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
