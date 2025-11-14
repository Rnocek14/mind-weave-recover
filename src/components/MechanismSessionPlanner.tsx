import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Brain, Clock, Target, TrendingUp, Play } from "lucide-react";
import { generateMechanismBasedSession } from "@/lib/mechanismSessionPlanner";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { useNavigate } from "react-router-dom";

interface MechanismSessionPlannerProps {
  profile: ClinicalProfile | null;
}

export function MechanismSessionPlanner({ profile }: MechanismSessionPlannerProps) {
  const navigate = useNavigate();
  const sessionPlan = generateMechanismBasedSession(profile);

  if (!sessionPlan) {
    return null;
  }

  const mechanismLabels: Record<string, string> = {
    cardioembolic: 'Cardioembolic',
    lacunar: 'Lacunar',
    large_artery: 'Large Artery',
    undetermined: 'Undetermined'
  };

  const mechanismColors: Record<string, string> = {
    cardioembolic: 'bg-purple-500/10 text-purple-700 border-purple-200',
    lacunar: 'bg-blue-500/10 text-blue-700 border-blue-200',
    large_artery: 'bg-orange-500/10 text-orange-700 border-orange-200',
    undetermined: 'bg-gray-500/10 text-gray-700 border-gray-200'
  };

  const handleStartSession = () => {
    if (sessionPlan.exercises.length > 0) {
      navigate(`/exercise/${sessionPlan.exercises[0].slug}`);
    }
  };

  return (
    <Card className="border-primary/20">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <CardTitle className="flex items-center gap-2">
              <Brain className="w-5 h-5 text-primary" />
              Mechanism-Based Session Plan
            </CardTitle>
            <CardDescription>
              Tailored exercise combination for {mechanismLabels[sessionPlan.mechanism]} stroke pattern
            </CardDescription>
          </div>
          <Badge className={mechanismColors[sessionPlan.mechanism] + " border"}>
            {mechanismLabels[sessionPlan.mechanism]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Strategy */}
        <div className="flex items-start gap-3 p-4 rounded-lg bg-muted/50">
          <Target className="w-5 h-5 text-primary mt-0.5" />
          <div>
            <h4 className="font-semibold mb-1">Strategy</h4>
            <p className="text-sm text-muted-foreground">{sessionPlan.strategy}</p>
          </div>
        </div>

        {/* Rationale */}
        <div className="text-sm text-muted-foreground bg-background border border-border rounded-lg p-4">
          <strong>Clinical Rationale:</strong> {sessionPlan.rationale}
        </div>

        {/* Session Structure */}
        <div className="grid grid-cols-3 gap-4">
          <div className="flex flex-col items-center p-3 rounded-lg bg-background border border-border">
            <Clock className="w-4 h-4 text-muted-foreground mb-1" />
            <span className="text-2xl font-bold text-foreground">{sessionPlan.sessionStructure.duration}</span>
            <span className="text-xs text-muted-foreground">minutes</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-background border border-border">
            <Target className="w-4 h-4 text-muted-foreground mb-1" />
            <span className="text-2xl font-bold text-foreground">{sessionPlan.exercises.length}</span>
            <span className="text-xs text-muted-foreground">exercises</span>
          </div>
          <div className="flex flex-col items-center p-3 rounded-lg bg-background border border-border">
            <TrendingUp className="w-4 h-4 text-muted-foreground mb-1" />
            <span className="text-2xl font-bold text-foreground capitalize">{sessionPlan.sessionStructure.difficultyProgression}</span>
            <span className="text-xs text-muted-foreground">progression</span>
          </div>
        </div>

        {/* Exercise List */}
        <div className="space-y-2">
          <h4 className="font-semibold text-sm">Exercise Sequence</h4>
          {sessionPlan.exercises.map((exercise, index) => (
            <div
              key={exercise.slug + index}
              className="flex items-start gap-3 p-3 rounded-lg bg-muted/30 border border-border"
            >
              <div className="flex items-center justify-center w-6 h-6 rounded-full bg-primary text-primary-foreground text-xs font-bold">
                {index + 1}
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="font-medium text-sm capitalize">
                    {exercise.slug.replace('-', ' ')}
                  </span>
                  <Badge variant="outline" className="text-xs">
                    {exercise.priority}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground">{exercise.reason}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Action Button */}
        <Button 
          onClick={handleStartSession} 
          className="w-full"
          size="lg"
        >
          <Play className="w-4 h-4 mr-2" />
          Start Mechanism-Based Session
        </Button>
      </CardContent>
    </Card>
  );
}
