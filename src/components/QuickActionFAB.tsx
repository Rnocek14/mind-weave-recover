import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Zap, Play, Brain, Activity, FileText, TrendingUp, Map } from "lucide-react";
import { cn } from "@/lib/utils";
import { useNavigate } from "react-router-dom";

interface QuickAction {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
  action: () => void;
  color: string;
}

interface QuickActionFABProps {
  activeTab: string;
  onStartAssessment?: () => void;
  onShowTour?: () => void;
  recommendedExercises?: any[];
  hasRecoverySummary?: boolean;
}

export const QuickActionFAB = ({
  activeTab,
  onStartAssessment,
  onShowTour,
  recommendedExercises = [],
  hasRecoverySummary = false,
}: QuickActionFABProps) => {
  const [isOpen, setIsOpen] = useState(false);
  const navigate = useNavigate();

  // Context-aware actions based on active tab
  const getActions = (): QuickAction[] => {
    switch (activeTab) {
      case "overview":
        return [
          {
            icon: Play,
            label: "Start Exercise",
            action: () => {
              const firstExercise = recommendedExercises[0];
              if (firstExercise?.slug) {
                navigate(`/exercise/${firstExercise.slug}`);
              }
            },
            color: "bg-primary text-primary-foreground",
          },
          {
            icon: Brain,
            label: "Take Assessment",
            action: () => {
              onStartAssessment?.();
              setIsOpen(false);
            },
            color: "bg-secondary text-secondary-foreground",
          },
          {
            icon: Map,
            label: "Dashboard Tour",
            action: () => {
              onShowTour?.();
              setIsOpen(false);
            },
            color: "bg-accent text-accent-foreground",
          },
        ];
      case "analytics":
        return [
          {
            icon: Map,
            label: "Dashboard Tour",
            action: () => {
              onShowTour?.();
              setIsOpen(false);
            },
            color: "bg-primary text-primary-foreground",
          },
          {
            icon: Brain,
            label: "AI Insights",
            action: () => {
              if (hasRecoverySummary) {
                setIsOpen(false);
                // Scroll to recovery summary
                document.querySelector('[data-recovery-summary]')?.scrollIntoView({ behavior: 'smooth' });
              }
            },
            color: "bg-secondary text-secondary-foreground",
          },
          {
            icon: Play,
            label: "Start Exercise",
            action: () => {
              const firstExercise = recommendedExercises[0];
              if (firstExercise?.slug) {
                navigate(`/exercise/${firstExercise.slug}`);
              }
            },
            color: "bg-accent text-accent-foreground",
          },
        ];
      case "clinical":
        return [
          {
            icon: FileText,
            label: "Upload Document",
            action: () => navigate("/clinical-documents"),
            color: "bg-primary text-primary-foreground",
          },
          {
            icon: Map,
            label: "Dashboard Tour",
            action: () => {
              onShowTour?.();
              setIsOpen(false);
            },
            color: "bg-secondary text-secondary-foreground",
          },
          {
            icon: Activity,
            label: "View History",
            action: () => navigate("/profile-version-history"),
            color: "bg-accent text-accent-foreground",
          },
        ];
      default:
        return [];
    }
  };

  const actions = getActions();

  // Keyboard shortcut: Cmd+K (Mac) or Ctrl+K (Windows/Linux)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      // Escape to close
      if (e.key === "Escape" && isOpen) {
        setIsOpen(false);
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen]);

  return (
    <>
      {/* Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-background/80 backdrop-blur-sm z-40 animate-fade-in"
          onClick={() => setIsOpen(false)}
        />
      )}

      {/* Speed Dial Menu */}
      <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
        {/* Action Buttons */}
        {isOpen && (
          <div className="flex flex-col gap-2 animate-fade-in">
            {actions.map((action, index) => {
              const Icon = action.icon;
              return (
                <div
                  key={index}
                  className="flex items-center gap-3 animate-slide-up"
                  style={{ animationDelay: `${index * 50}ms` }}
                >
                  <span className="bg-background/95 backdrop-blur-sm border border-border px-3 py-1.5 rounded-md text-sm font-medium shadow-lg whitespace-nowrap">
                    {action.label}
                  </span>
                  <Button
                    size="icon"
                    aria-label={action.label}
                    className={cn(
                      "h-12 w-12 rounded-full shadow-lg hover:scale-110 transition-transform",
                      action.color
                    )}
                    onClick={action.action}
                  >
                    <Icon className="h-5 w-5" />
                  </Button>
                </div>
              );
            })}
          </div>
        )}

        {/* Main FAB */}
        <Button
          size="icon"
          aria-label={isOpen ? "Close quick actions" : "Open quick actions"}
          aria-expanded={isOpen}
          className={cn(
            "h-14 w-14 rounded-full shadow-xl hover:shadow-2xl transition-all hover:scale-110",
            "bg-primary text-primary-foreground",
            isOpen && "rotate-45"
          )}
          onClick={() => setIsOpen(!isOpen)}
        >
          <Zap className="h-6 w-6" />
        </Button>

        {/* Keyboard hint */}
        {!isOpen && (
          <div className="text-xs text-muted-foreground mt-1 mr-1 animate-fade-in">
            <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
              ⌘K
            </kbd>
          </div>
        )}
      </div>
    </>
  );
};
