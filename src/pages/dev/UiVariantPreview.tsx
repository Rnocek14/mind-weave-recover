/**
 * /dev/ui-variants — static side-by-side QA preview of the
 * three chrome surfaces Phase 2C-iii touches, in all 5 variants.
 *
 * No timers, no real lesson — just frozen markup so you can
 * eyeball differences without waiting for transitions.
 */

import { Card } from "@/components/ui/card";
import { Play } from "lucide-react";
import { SessionArcBar } from "@/components/SessionArcBar";
import { variantClass, isMinimal, type UiVariant } from "@/lib/ui/variantClass";

const VARIANTS: UiVariant[] = [
  "standard",
  "simplified-fluent",
  "simplified-non-fluent",
  "simplified-neglect",
  "minimal",
];

const MOCK_BLOCKS = [
  { exerciseId: "photo-naming", priority: "warmup" as const, targetMinutes: 2 },
  { exerciseId: "fix-sentence", priority: "primary" as const, targetMinutes: 3 },
  { exerciseId: "category-fluency", priority: "secondary" as const, targetMinutes: 3 },
] as any;

function LoadingCardPreview({ variant }: { variant: UiVariant }) {
  return (
    <div
      className={variantClass(variant, {
        base: "bg-background flex items-center justify-center p-4",
        simplified: "p-6",
      })}
    >
      <Card
        className={variantClass(variant, {
          base: "w-full max-w-md p-8 space-y-6 text-center",
          simplified: "max-w-lg p-10 space-y-8",
          minimal: "max-w-lg p-10 space-y-6 shadow-none border-2",
        })}
      >
        {!isMinimal(variant) && (
          <SessionArcBar blocks={MOCK_BLOCKS} currentIndex={1} />
        )}

        <div
          className={variantClass(variant, {
            base: "w-16 h-16 rounded-full bg-primary/20 flex items-center justify-center mx-auto animate-pulse",
            simplified: "w-20 h-20",
            minimal: "w-20 h-20 animate-none",
          })}
        >
          <Play
            className={variantClass(variant, {
              base: "w-8 h-8 text-primary",
              simplified: "w-10 h-10",
            })}
          />
        </div>

        <div className="space-y-2">
          <h2
            className={variantClass(variant, {
              base: "text-2xl font-bold",
              simplified: "text-3xl",
            })}
          >
            Loading Exercise...
          </h2>
          <p
            className={variantClass(variant, {
              base: "text-muted-foreground",
              simplified: "text-lg",
            })}
          >
            Fix Sentence
          </p>
          {!isMinimal(variant) && (
            <p className="text-sm text-muted-foreground/80 italic">
              Read the sentence and tap the word that doesn't fit.
            </p>
          )}
          {!isMinimal(variant) && (
            <p className="text-sm text-primary/80 font-medium mt-2">
              Right in the zone — this is where growth happens ✨
            </p>
          )}
        </div>
      </Card>
    </div>
  );
}

export default function UiVariantPreview() {
  return (
    <div className="min-h-dvh bg-muted/30 p-6">
      <div className="max-w-7xl mx-auto space-y-6">
        <header className="space-y-2">
          <h1 className="text-3xl font-bold">UI Variant Preview — Chrome Surfaces</h1>
          <p className="text-muted-foreground">
            Static side-by-side QA for Phase 2C-iii. Shows the LessonFlow loading
            card + Session Arc Bar across all 5 variants. No timers, no navigation.
          </p>
          <ul className="text-sm text-muted-foreground list-disc pl-6 space-y-1">
            <li><strong>standard:</strong> baseline card, shadow, pulse animation, arc bar visible</li>
            <li><strong>simplified-*:</strong> larger card + heading + icon, extra micro-guidance + adaptivity line</li>
            <li><strong>minimal:</strong> flat card (no shadow, no pulse), arc bar hidden, no extra copy</li>
          </ul>
        </header>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {VARIANTS.map((v) => (
            <section
              key={v}
              className="rounded-xl border-2 border-dashed border-border bg-background/50 p-4 space-y-3"
            >
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold font-mono">{v}</h2>
                <span className="text-xs text-muted-foreground">
                  {v === "standard" && "baseline"}
                  {v.startsWith("simplified") && "larger + extra guidance"}
                  {v === "minimal" && "flat, no chrome"}
                </span>
              </div>
              <LoadingCardPreview variant={v} />
            </section>
          ))}
        </div>
      </div>
    </div>
  );
}
