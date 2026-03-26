import { Card } from "@/components/ui/card";
import { Eye, Lightbulb, Target } from "lucide-react";
import type { MayaInsight } from "@/lib/mayaNarrative";

interface MayaInterpretationCardProps {
  interpretation: MayaInsight["interpretation"];
  anticipation: string | null;
}

interface SectionProps {
  icon: typeof Eye;
  title: string;
  items: string[];
  accentClass: string;
  iconClass: string;
}

function Section({ icon: Icon, title, items, accentClass, iconClass }: SectionProps) {
  if (items.length === 0) return null;
  return (
    <div className={`p-3.5 rounded-xl border ${accentClass}`}>
      <div className="flex items-center gap-2 mb-2">
        <Icon className={`w-4 h-4 ${iconClass}`} />
        <span className="text-sm font-semibold text-foreground">{title}</span>
      </div>
      <ul className="space-y-1.5">
        {items.map((item, i) => (
          <li key={i} className="text-sm text-foreground/80 leading-relaxed pl-6 relative">
            <span className="absolute left-1.5 top-1.5 w-1.5 h-1.5 rounded-full bg-current opacity-40" />
            {item}
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Maya's interpretation of recovery progress.
 * Shows "What I'm Seeing", "What's Helping", and "What We're Working On".
 */
export function MayaInterpretationCard({ interpretation, anticipation }: MayaInterpretationCardProps) {
  const { seeing, helping, workingOn } = interpretation;
  const hasContent = seeing.length > 0 || helping.length > 0 || workingOn.length > 0;

  if (!hasContent) return null;

  return (
    <Card className="p-4 border-2 space-y-3">
      <div className="flex items-center gap-2">
        <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center">
          <span className="text-xs">🧠</span>
        </div>
        <h3 className="text-base font-semibold text-foreground">
          Your Recovery Story
        </h3>
      </div>

      <div className="space-y-2.5">
        <Section
          icon={Eye}
          title="What I'm Seeing"
          items={seeing}
          accentClass="bg-primary/5 border-primary/15"
          iconClass="text-primary"
        />
        <Section
          icon={Lightbulb}
          title="What's Helping"
          items={helping}
          accentClass="bg-emerald-500/5 border-emerald-500/15"
          iconClass="text-emerald-600"
        />
        <Section
          icon={Target}
          title="What We're Working On"
          items={workingOn}
          accentClass="bg-amber-500/5 border-amber-500/15"
          iconClass="text-amber-600"
        />
      </div>

      {anticipation && (
        <p className="text-sm text-muted-foreground italic pt-1 border-t border-border/50">
          ✨ {anticipation}
        </p>
      )}
    </Card>
  );
}
