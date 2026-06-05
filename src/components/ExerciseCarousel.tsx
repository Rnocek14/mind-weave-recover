import { useCallback, useEffect, memo } from "react";
import useEmblaCarousel from "embla-carousel-react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { ChevronLeft, ChevronRight, Play } from "lucide-react";
import { cn } from "@/lib/utils";

interface Exercise {
  id: string;
  title: string;
  icon: React.ComponentType<{ className?: string }>;
  category: string;
  duration: string;
  difficulty: string;
  color: string;
}

interface ExerciseCarouselProps {
  exercises: Exercise[];
  onStartExercise: (slug: string) => void;
  gatingInfo?: Record<string, any>;
}

export const ExerciseCarousel = memo(function ExerciseCarousel({
  exercises,
  onStartExercise,
  gatingInfo = {},
}: ExerciseCarouselProps) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  });

  const scrollPrev = useCallback(() => {
    if (emblaApi) emblaApi.scrollPrev();
  }, [emblaApi]);

  const scrollNext = useCallback(() => {
    if (emblaApi) emblaApi.scrollNext();
  }, [emblaApi]);

  // Auto-scroll on mount for discoverability
  useEffect(() => {
    if (emblaApi) {
      const timer = setTimeout(() => {
        emblaApi.scrollTo(1);
        setTimeout(() => emblaApi.scrollTo(0), 800);
      }, 1000);
      return () => clearTimeout(timer);
    }
  }, [emblaApi]);

  return (
    <div className="relative">
      {/* Navigation Buttons - Hidden on mobile, visible on tablet+ */}
      <Button
        variant="outline"
        size="icon"
        aria-label="Previous exercises"
        className="absolute left-0 top-1/2 -translate-y-1/2 -translate-x-4 z-10 hidden md:flex shadow-lg"
        onClick={scrollPrev}
      >
        <ChevronLeft className="h-4 w-4" />
      </Button>
      <Button
        variant="outline"
        size="icon"
        aria-label="Next exercises"
        className="absolute right-0 top-1/2 -translate-y-1/2 translate-x-4 z-10 hidden md:flex shadow-lg"
        onClick={scrollNext}
      >
        <ChevronRight className="h-4 w-4" />
      </Button>

      {/* Carousel */}
      <div className="overflow-hidden" ref={emblaRef}>
        <div className="flex gap-4 md:gap-6">
          {exercises.map((exercise) => {
            const Icon = exercise.icon;
            const info = gatingInfo[exercise.id];

            return (
              <div
                key={exercise.id}
                className="flex-[0_0_85%] sm:flex-[0_0_70%] md:flex-[0_0_45%] lg:flex-[0_0_30%] min-w-0"
              >
                <Card className="h-full flex flex-col p-6 hover:shadow-xl transition-all touch-manipulation">
                  <div className="flex items-start gap-4 mb-4">
                    <div
                      className={cn(
                        "w-14 h-14 rounded-xl flex items-center justify-center shrink-0",
                        exercise.color
                      )}
                    >
                      <Icon className="w-7 h-7 text-white" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-semibold text-base mb-1 line-clamp-2">
                        {exercise.title}
                      </h3>
                      <div className="flex flex-wrap gap-2">
                        <Badge variant="secondary" className="text-xs">
                          {exercise.category}
                        </Badge>
                        <Badge variant="outline" className="text-xs">
                          {exercise.difficulty}
                        </Badge>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-muted-foreground mb-4">
                    {exercise.duration}
                  </div>

                  {info?.blocked && (
                    <div className="text-xs text-destructive mb-4">
                      {info.reason}
                    </div>
                  )}

                  <Button
                    className="w-full mt-auto touch-manipulation min-h-[48px]"
                    disabled={info?.blocked}
                    onClick={() => onStartExercise(exercise.id)}
                  >
                    <Play className="w-4 h-4 mr-2" />
                    Start Exercise
                  </Button>
                </Card>
              </div>
            );
          })}
        </div>
      </div>

      {/* Scroll Indicator */}
      <div className="flex justify-center gap-2 mt-4 md:hidden">
        {exercises.slice(0, 5).map((_, idx) => (
          <div
            key={idx}
            className="h-1.5 rounded-full bg-muted transition-all"
            style={{ width: idx === 0 ? "24px" : "8px" }}
          />
        ))}
      </div>
    </div>
  );
});
