import { useState, useEffect } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, X, LayoutDashboard, BarChart3, Activity, Target, TrendingUp, Calendar } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

const TOUR_STORAGE_KEY = "dashboard-tour-completed";

interface TourStep {
  title: string;
  description: string;
  icon: React.ReactNode;
  visual: React.ReactNode;
}

const tourSteps: TourStep[] = [
  {
    title: "Welcome to Your Dashboard! 👋",
    description: "Let's take a quick tour to help you navigate your recovery journey. This will only take a minute.",
    icon: <LayoutDashboard className="h-12 w-12 text-primary" />,
    visual: (
      <div className="flex gap-2 justify-center mt-4">
        <Badge variant="outline" className="text-sm">Overview</Badge>
        <Badge variant="outline" className="text-sm">Analytics</Badge>
        <Badge variant="outline" className="text-sm">Clinical</Badge>
      </div>
    ),
  },
  {
    title: "Overview Tab - Your Daily Hub",
    description: "The Overview tab is your action center. Here you'll find today's exercises, progress tracking, and personalized recommendations. It's designed to answer: 'What should I do today?'",
    icon: <Activity className="h-12 w-12 text-primary" />,
    visual: (
      <Card className="mt-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <Calendar className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">Today's Progress</span>
          </div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">Personalized Plan</span>
          </div>
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">Recommended Exercises</span>
          </div>
        </CardContent>
      </Card>
    ),
  },
  {
    title: "Analytics Tab - Track Your Journey",
    description: "The Analytics tab shows your historical data and trends. Here you'll find learning rates, capability assessments, and detailed progress charts. It answers: 'How am I progressing over time?'",
    icon: <BarChart3 className="h-12 w-12 text-primary" />,
    visual: (
      <Card className="mt-4">
        <CardContent className="p-4 space-y-3">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">Learning Rate Trends</span>
          </div>
          <div className="flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">Capability Profiles</span>
          </div>
          <div className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
            <span className="text-sm font-medium">Exercise History Charts</span>
          </div>
        </CardContent>
      </Card>
    ),
  },
  {
    title: "Finding Your Data",
    description: "Language Recovery Progress and Motor Performance sections appear in Analytics once you complete sessions. Session Adherence Tracker shows your consistency, and Learning Rate Intelligence reveals how quickly you're improving.",
    icon: <Target className="h-12 w-12 text-primary" />,
    visual: (
      <div className="mt-4 space-y-2 text-left">
        <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
          <span className="text-lg">📊</span>
          <div className="flex-1">
            <p className="text-sm font-medium">Language & Motor Sections</p>
            <p className="text-xs text-muted-foreground">Populate after completing sessions</p>
          </div>
        </div>
        <div className="flex items-start gap-2 p-2 rounded-md bg-muted/50">
          <span className="text-lg">📈</span>
          <div className="flex-1">
            <p className="text-sm font-medium">Learning Rate Intelligence</p>
            <p className="text-xs text-muted-foreground">Shows improvement velocity</p>
          </div>
        </div>
      </div>
    ),
  },
];

export function DashboardQuickTour() {
  const [open, setOpen] = useState(false);
  const [currentStep, setCurrentStep] = useState(0);

  useEffect(() => {
    const hasCompletedTour = localStorage.getItem(TOUR_STORAGE_KEY);
    if (!hasCompletedTour) {
      // Show tour after a short delay for better UX
      const timer = setTimeout(() => setOpen(true), 800);
      return () => clearTimeout(timer);
    }
  }, []);

  const handleNext = () => {
    if (currentStep < tourSteps.length - 1) {
      setCurrentStep(currentStep + 1);
    } else {
      handleComplete();
    }
  };

  const handleBack = () => {
    if (currentStep > 0) {
      setCurrentStep(currentStep - 1);
    }
  };

  const handleComplete = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setOpen(false);
  };

  const handleSkip = () => {
    localStorage.setItem(TOUR_STORAGE_KEY, "true");
    setOpen(false);
  };

  const currentStepData = tourSteps[currentStep];
  const isFirstStep = currentStep === 0;
  const isLastStep = currentStep === tourSteps.length - 1;

  return (
    <Dialog open={open} onOpenChange={(isOpen) => {
      if (!isOpen) {
        handleSkip();
      }
    }}>
      <DialogContent className="sm:max-w-[500px]" aria-describedby="tour-description">
        <button
          onClick={handleSkip}
          className="absolute right-4 top-4 rounded-sm opacity-70 ring-offset-background transition-opacity hover:opacity-100 focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none data-[state=open]:bg-accent data-[state=open]:text-muted-foreground"
          aria-label="Skip tour"
        >
          <X className="h-4 w-4" />
        </button>

        <DialogHeader className="space-y-4">
          <div className="flex justify-center" aria-hidden="true">
            {currentStepData.icon}
          </div>
          <DialogTitle className="text-center text-xl">
            {currentStepData.title}
          </DialogTitle>
          <DialogDescription id="tour-description" className="text-center text-base">
            {currentStepData.description}
          </DialogDescription>
        </DialogHeader>

        <div className="py-4">
          {currentStepData.visual}
        </div>

        <DialogFooter className="flex-col sm:flex-col space-y-2">
          <div className="flex justify-center gap-1.5 mb-2" role="status" aria-label={`Step ${currentStep + 1} of ${tourSteps.length}`}>
            {tourSteps.map((_, index) => (
              <div
                key={index}
                className={`h-2 w-2 rounded-full transition-all ${
                  index === currentStep
                    ? "bg-primary w-6"
                    : "bg-muted"
                }`}
                aria-hidden="true"
              />
            ))}
          </div>

          <div className="flex gap-2 w-full">
            {!isFirstStep && (
              <Button
                variant="outline"
                onClick={handleBack}
                className="flex-1"
                aria-label="Go to previous step"
              >
                <ChevronLeft className="h-4 w-4 mr-1" aria-hidden="true" />
                Back
              </Button>
            )}
            <Button
              onClick={handleNext}
              className="flex-1"
              aria-label={isLastStep ? "Complete tour" : "Go to next step"}
            >
              {isLastStep ? "Get Started" : "Next"}
              {!isLastStep && <ChevronRight className="h-4 w-4 ml-1" aria-hidden="true" />}
            </Button>
          </div>

          <Button
            variant="ghost"
            onClick={handleSkip}
            className="w-full text-muted-foreground"
            aria-label="Skip tour"
          >
            Skip Tour
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
