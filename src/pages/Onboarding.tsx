import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ArrowRight, ArrowLeft, CheckCircle2, Hand, MessageSquare, Brain, Target } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useToast } from "@/hooks/use-toast";
import ClinicalProfileForm from "@/components/ClinicalProfileForm";
import { ClinicalProfile } from "@/lib/clinicalProfileMapper";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { StrokeProfileWidget } from "@/components/StrokeProfileWidget";

const Onboarding = () => {
  const [step, setStep] = useState(0);
  const [selectedGoals, setSelectedGoals] = useState<string[]>([]);
  const [clinicalProfile, setClinicalProfile] = useState<ClinicalProfile | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { user } = useAuth();

  const goals = [
    { id: "motor", label: "Rebuild Movement", icon: Hand, desc: "Improve arm, hand, and leg mobility" },
    { id: "speech", label: "Restore Speech", icon: MessageSquare, desc: "Practice naming and communication" },
    { id: "cognition", label: "Enhance Cognition", icon: Brain, desc: "Memory, attention, and problem-solving" },
  ];

  const toggleGoal = (id: string) => {
    setSelectedGoals(prev => 
      prev.includes(id) ? prev.filter(g => g !== id) : [...prev, id]
    );
  };

  const handleClinicalProfileSubmit = async (profile: ClinicalProfile) => {
    setClinicalProfile(profile);
    // The ClinicalProfileForm now handles version creation via useClinicalProfileVersions
    // The create_profile_version function updates profiles.clinical_profile automatically
    setStep(step + 1);
  };

  const handleComplete = async () => {
    if (selectedGoals.length === 0) {
      toast({
        title: "Please select at least one goal",
        variant: "destructive"
      });
      return;
    }

    // Store goals in localStorage for now (later: Supabase)
    localStorage.setItem("recoveryGoals", JSON.stringify(selectedGoals));
    
    toast({
      title: "Welcome to your recovery journey! 🎉",
      description: "Let's get started with your first session",
    });

    navigate("/dashboard");
  };

  const steps = [
    {
      title: "Welcome to Your Recovery Journey",
      subtitle: "Let's personalize your experience in just a few steps",
      content: (
        <div className="space-y-6 text-center max-w-md mx-auto">
          <div className="w-24 h-24 mx-auto rounded-full bg-gradient-healing flex items-center justify-center animate-pulse-glow">
            <CheckCircle2 className="w-12 h-12 text-white" />
          </div>
          <p className="text-lg text-muted-foreground">
            This platform adapts to your unique needs, helping you rebuild skills through 
            engaging exercises that track your progress.
          </p>
          <div className="bg-success-light/20 border border-success/30 rounded-lg p-4 text-left">
            <h4 className="font-semibold text-success mb-2">What to Expect:</h4>
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li>✓ 15-20 minute guided sessions</li>
              <li>✓ Personalized difficulty that adjusts to you</li>
              <li>✓ Track progress with visual reports</li>
              <li>✓ Practice anytime, anywhere</li>
            </ul>
          </div>
        </div>
      )
    },
    {
      title: "What Are Your Goals?",
      subtitle: "Select the areas you'd like to focus on (choose at least one)",
      content: (
        <div className="grid md:grid-cols-3 gap-4 max-w-4xl mx-auto">
          {goals.map((goal) => {
            const Icon = goal.icon;
            const isSelected = selectedGoals.includes(goal.id);
            return (
              <Card
                key={goal.id}
                className={`p-6 cursor-pointer transition-smooth border-2 ${
                  isSelected 
                    ? "border-primary bg-primary-glow shadow-glow scale-105" 
                    : "border-border hover:border-primary hover:shadow-card"
                }`}
                onClick={() => toggleGoal(goal.id)}
              >
                <div className="text-center space-y-4">
                  <div className={`w-16 h-16 mx-auto rounded-full flex items-center justify-center ${
                    isSelected ? "bg-gradient-healing" : "bg-muted"
                  }`}>
                    <Icon className={`w-8 h-8 ${isSelected ? "text-white" : "text-muted-foreground"}`} />
                  </div>
                  <div>
                    <h3 className="font-semibold text-lg mb-1">{goal.label}</h3>
                    <p className="text-sm text-muted-foreground">{goal.desc}</p>
                  </div>
                  {isSelected && (
                    <CheckCircle2 className="w-6 h-6 text-primary mx-auto animate-celebrate" />
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )
    },
    {
      title: "Quick Clinical Info (Optional)",
      subtitle: "Just 3 questions to personalize your experience",
      content: (
        <div className="max-w-lg mx-auto space-y-6">
          <div className="space-y-4">
            <Card className="p-5 cursor-pointer hover:border-primary transition-colors border-2" onClick={() => {
              /* Navigate to full clinical form later if needed */
            }}>
              <div className="space-y-4">
                <div>
                  <label className="text-sm font-medium block mb-2">When did the stroke happen?</label>
                  <div className="flex flex-wrap gap-2">
                    {['Less than 3 months', '3–12 months', 'Over 1 year'].map(opt => (
                      <Badge 
                        key={opt}
                        variant="outline"
                        className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/10"
                      >
                        {opt}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">Main difficulty right now?</label>
                  <div className="flex flex-wrap gap-2">
                    {['Finding words', 'Understanding others', 'Reading/Writing', 'Movement'].map(opt => (
                      <Badge 
                        key={opt}
                        variant="outline"
                        className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/10"
                      >
                        {opt}
                      </Badge>
                    ))}
                  </div>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-2">Current energy level?</label>
                  <div className="flex flex-wrap gap-2">
                    {['😊 Good energy', '😐 Okay', '😫 Easily tired'].map(opt => (
                      <Badge 
                        key={opt}
                        variant="outline"
                        className="cursor-pointer px-4 py-2 text-sm hover:bg-primary/10"
                      >
                        {opt}
                      </Badge>
                    ))}
                  </div>
                </div>
              </div>
            </Card>
            <p className="text-center text-xs text-muted-foreground">
              Your clinician or caregiver can add detailed clinical info later.
            </p>
          </div>
          <div className="text-center">
            <Button variant="ghost" onClick={() => setStep(step + 1)}>
              Skip for now
            </Button>
          </div>
        </div>
      )
    },
    {
      title: "Ready to Start",
      subtitle: "Here's your personalized therapy plan",
      content: (
        <div className="max-w-3xl mx-auto space-y-6">
          {clinicalProfile && (
            <div className="space-y-4">
              <StrokeProfileWidget profile={clinicalProfile} />
              <div className="bg-muted/30 border border-border rounded-lg p-4">
                <h4 className="font-semibold mb-2 flex items-center gap-2">
                  <Target className="w-4 h-4 text-primary" />
                  Your Focus Areas:
                </h4>
                <div className="flex flex-wrap gap-2">
                  {selectedGoals.map(goalId => {
                    const goal = goals.find(g => g.id === goalId);
                    return goal ? (
                      <Badge key={goalId} className="bg-primary/10 text-primary border-primary/20">
                        {goal.label}
                      </Badge>
                    ) : null;
                  })}
                </div>
              </div>
            </div>
          )}
          {!clinicalProfile && (
            <div className="bg-muted/30 border border-border rounded-lg p-6 text-center">
              <h4 className="font-semibold mb-2">Your Focus Areas:</h4>
              <div className="flex flex-wrap gap-2 justify-center">
                {selectedGoals.map(goalId => {
                  const goal = goals.find(g => g.id === goalId);
                  return goal ? (
                    <Badge key={goalId} className="bg-primary/10 text-primary border-primary/20">
                      {goal.label}
                    </Badge>
                  ) : null;
                })}
              </div>
            </div>
          )}
          <div className="text-center text-muted-foreground">
            <p>Your personalized therapy plan is ready. Let's begin your recovery journey!</p>
          </div>
        </div>
      )
    }
  ];

  return (
    <div className="min-h-screen bg-gradient-calm py-12 px-4">
      <div className="container mx-auto max-w-6xl">
        {/* Progress Bar */}
        <div className="mb-12">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-muted-foreground">
              Step {step + 1} of {steps.length}
            </span>
            <span className="text-sm font-medium text-primary">
              {Math.round(((step + 1) / steps.length) * 100)}%
            </span>
          </div>
          <div className="h-2 bg-muted rounded-full overflow-hidden">
            <div 
              className="h-full bg-gradient-healing transition-smooth"
              style={{ width: `${((step + 1) / steps.length) * 100}%` }}
            />
          </div>
        </div>

        {/* Content */}
        <div className="animate-slide-up">
          <div className="text-center mb-12">
            <h1 className="text-3xl md:text-5xl font-bold mb-3">
              {steps[step].title}
            </h1>
            <p className="text-lg text-muted-foreground">
              {steps[step].subtitle}
            </p>
          </div>

          <div className="mb-12">
            {steps[step].content}
          </div>

          {/* Navigation */}
          <div className="flex justify-between max-w-md mx-auto">
            {step > 0 ? (
              <Button
                variant="outline"
                size="lg"
                onClick={() => setStep(step - 1)}
              >
                <ArrowLeft className="w-5 h-5 mr-2" />
                Back
              </Button>
            ) : (
              <div />
            )}

            {step < steps.length - 1 ? (
              <Button
                size="lg"
                onClick={() => setStep(step + 1)}
                className="bg-gradient-healing hover:opacity-90"
              >
                Continue
                <ArrowRight className="w-5 h-5 ml-2" />
              </Button>
            ) : (
              <Button
                size="lg"
                onClick={handleComplete}
                className="bg-gradient-celebrate hover:opacity-90"
                disabled={selectedGoals.length === 0}
              >
                Start My Journey
                <CheckCircle2 className="w-5 h-5 ml-2" />
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Onboarding;
