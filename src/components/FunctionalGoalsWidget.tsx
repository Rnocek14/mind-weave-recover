import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Badge } from '@/components/ui/badge';
import { Target, Plus, TrendingUp, Circle, CheckCircle2, Clock } from 'lucide-react';
import { useFunctionalGoals } from '@/hooks/useFunctionalGoals';
import { useState } from 'react';
import { CreateGoalDialog } from './CreateGoalDialog';
import { ProgressRatingDialog } from './ProgressRatingDialog';
import type { FunctionalGoal } from '@/hooks/useFunctionalGoals';

interface FunctionalGoalsWidgetProps {
  userId: string;
  compact?: boolean;
}

export const FunctionalGoalsWidget = ({ userId, compact = false }: FunctionalGoalsWidgetProps) => {
  const { goals, loading, createGoal, addProgressRating } = useFunctionalGoals(userId);
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [ratingDialogOpen, setRatingDialogOpen] = useState(false);
  const [selectedGoal, setSelectedGoal] = useState<FunctionalGoal | null>(null);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'achieved':
        return <CheckCircle2 className="h-4 w-4 text-green-500" />;
      case 'partial':
        return <Clock className="h-4 w-4 text-yellow-500" />;
      default:
        return <Circle className="h-4 w-4 text-muted-foreground" />;
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'achieved':
        return 'Achieved';
      case 'partial':
        return 'In Progress';
      default:
        return 'Not Yet';
    }
  };

  const getDomainColor = (domain: string) => {
    switch (domain) {
      case 'communication':
        return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'connected_speech':
        return 'bg-indigo-500/10 text-indigo-500 border-indigo-500/20';
      case 'motor':
        return 'bg-purple-500/10 text-purple-500 border-purple-500/20';
      case 'cognitive':
        return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'daily_living':
        return 'bg-orange-500/10 text-orange-500 border-orange-500/20';
      default:
        return 'bg-muted text-muted-foreground';
    }
  };

  const getProgressPercentage = (status: string) => {
    switch (status) {
      case 'achieved':
        return 100;
      case 'partial':
        return 50;
      default:
        return 0;
    }
  };

  const handleRateProgress = (goal: FunctionalGoal) => {
    setSelectedGoal(goal);
    setRatingDialogOpen(true);
  };

  if (loading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Target className="h-5 w-5" />
            Functional Goals
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 bg-muted animate-pulse rounded-lg" />
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  const activeGoals = goals.filter((g) => !g.archived_at);
  const achievedCount = activeGoals.filter(
    (g) => g.latest_rating?.status === 'achieved' || g.baseline_status === 'achieved'
  ).length;

  return (
    <>
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <Target className="h-5 w-5" />
                Functional Goals
              </CardTitle>
              <CardDescription>
                Track real-world progress and achievements
              </CardDescription>
            </div>
            <Button onClick={() => setCreateDialogOpen(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add Goal
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-4">
          {activeGoals.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Target className="h-12 w-12 mx-auto mb-3 opacity-50" />
              <p className="text-sm">No goals yet. Create your first goal to start tracking progress!</p>
            </div>
          ) : (
            <>
              {!compact && (
                <div className="flex items-center gap-4 p-3 bg-muted/50 rounded-lg">
                  <div className="flex-1">
                    <div className="text-sm font-medium">Overall Progress</div>
                    <div className="text-xs text-muted-foreground">
                      {achievedCount} of {activeGoals.length} goals achieved
                    </div>
                  </div>
                  <div className="text-2xl font-bold">
                    {activeGoals.length > 0
                      ? Math.round((achievedCount / activeGoals.length) * 100)
                      : 0}
                    %
                  </div>
                </div>
              )}

              <div className="space-y-3">
                {activeGoals.slice(0, compact ? 3 : undefined).map((goal) => {
                  const currentStatus = goal.latest_rating?.status || goal.baseline_status;
                  const progress = getProgressPercentage(currentStatus);

                  return (
                    <div
                      key={goal.id}
                      className="p-4 border border-border rounded-lg space-y-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="flex-1 space-y-1">
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className={getDomainColor(goal.target_domain)}>
                              {goal.target_domain.replace('_', ' ')}
                            </Badge>
                            <div className="flex items-center gap-1">
                              {getStatusIcon(currentStatus)}
                              <span className="text-xs text-muted-foreground">
                                {getStatusLabel(currentStatus)}
                              </span>
                            </div>
                          </div>
                          <p className="text-sm font-medium">{goal.goal_text}</p>
                          {goal.target_date && (
                            <p className="text-xs text-muted-foreground">
                              Target: {new Date(goal.target_date).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => handleRateProgress(goal)}
                        >
                          <TrendingUp className="h-4 w-4 mr-1" />
                          Update
                        </Button>
                      </div>
                      <Progress value={progress} className="h-2" />
                    </div>
                  );
                })}
              </div>

              {compact && activeGoals.length > 3 && (
                <Button variant="ghost" className="w-full" size="sm">
                  View all {activeGoals.length} goals
                </Button>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <CreateGoalDialog
        open={createDialogOpen}
        onOpenChange={setCreateDialogOpen}
        onCreateGoal={createGoal}
      />

      {selectedGoal && (
        <ProgressRatingDialog
          open={ratingDialogOpen}
          onOpenChange={setRatingDialogOpen}
          goal={selectedGoal}
          onAddRating={addProgressRating}
        />
      )}
    </>
  );
};
