import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

export function StatCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card 
      className="p-6 shadow-card animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading statistics...</span>
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-full" />
        <div className="space-y-2 flex-1">
          <Skeleton className="h-8 w-16" />
          <Skeleton className="h-4 w-24" />
        </div>
      </div>
    </Card>
  );
}

export function ProgressCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card 
      className="p-6 shadow-card animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading progress data...</span>
      <div className="flex justify-between items-center mb-4">
        <Skeleton className="h-6 w-32" />
        <Skeleton className="h-5 w-12" />
      </div>
      <Skeleton className="h-3 w-full mb-2" />
      <Skeleton className="h-4 w-48" />
    </Card>
  );
}

export function RecoverySummarySkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card 
      className="p-6 shadow-card animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading recovery summary...</span>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-5 w-20" />
        </div>
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-3/4" />
        <div className="pt-4 space-y-2">
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-2/3" />
        </div>
      </div>
    </Card>
  );
}

export function ExerciseCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card 
      className="p-6 shadow-card animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading exercise card...</span>
      <div className="space-y-4">
        <div className="flex items-start justify-between">
          <Skeleton className="w-14 h-14 rounded-full" />
          <Skeleton className="h-6 w-16" />
        </div>
        <div>
          <Skeleton className="h-4 w-20 mb-2" />
          <Skeleton className="h-6 w-full mb-2" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-3/4" />
        </div>
        <Skeleton className="h-10 w-full" />
      </div>
    </Card>
  );
}

export function AnalyticsCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card 
      className="p-6 shadow-card animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading analytics...</span>
      <div className="space-y-4">
        <div className="flex justify-between items-center">
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-8 w-24" />
        </div>
        <div className="space-y-2">
          <Skeleton className="h-32 w-full" />
        </div>
        <div className="grid grid-cols-2 gap-4">
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-6 w-16" />
          </div>
          <div>
            <Skeleton className="h-4 w-20 mb-2" />
            <Skeleton className="h-6 w-16" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ClinicalProfileSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card 
      className="p-6 shadow-card animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading clinical profile...</span>
      <div className="space-y-6">
        <div>
          <Skeleton className="h-7 w-48 mb-4" />
          <div className="grid md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
            <div className="space-y-2">
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-5 w-32" />
            </div>
          </div>
        </div>
        <div className="space-y-2">
          <Skeleton className="h-5 w-32" />
          <div className="flex flex-wrap gap-2">
            <Skeleton className="h-7 w-24" />
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-7 w-20" />
          </div>
        </div>
      </div>
    </Card>
  );
}

export function ExerciseProgressCardSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card 
      className="p-6 shadow-card animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading exercise progress...</span>
      <div className="flex items-start gap-4">
        <Skeleton className="w-12 h-12 rounded-full flex-shrink-0" />
        <div className="flex-1 space-y-3">
          <div className="flex items-center justify-between">
            <Skeleton className="h-6 w-40" />
            <Skeleton className="h-5 w-16" />
          </div>
          <Skeleton className="h-4 w-full" />
          <div className="space-y-2 pt-2">
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-6 w-12" />
            </div>
            <div className="flex items-center justify-between">
              <Skeleton className="h-4 w-28" />
              <Skeleton className="h-5 w-16" />
            </div>
          </div>
          <Skeleton className="h-16 w-full mt-3" />
          <Skeleton className="h-9 w-full" />
        </div>
      </div>
    </Card>
  );
}

export function ExerciseStatsTileSkeleton({ delay = 0 }: { delay?: number }) {
  return (
    <Card 
      className="p-6 shadow-card animate-fade-in"
      style={{ animationDelay: `${delay}ms` }}
      role="status"
      aria-live="polite"
    >
      <span className="sr-only">Loading exercise statistics...</span>
      <div className="space-y-4">
        <div className="flex items-center gap-2">
          <Skeleton className="h-5 w-5 rounded" />
          <Skeleton className="h-6 w-48" />
        </div>
        <div className="grid grid-cols-3 gap-4">
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-4 mx-auto" />
            <Skeleton className="h-8 w-16 mx-auto" />
            <Skeleton className="h-3 w-12 mx-auto" />
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-4 mx-auto" />
            <Skeleton className="h-8 w-16 mx-auto" />
            <Skeleton className="h-3 w-16 mx-auto" />
          </div>
          <div className="bg-muted/50 rounded-lg p-4 space-y-2">
            <Skeleton className="h-4 w-4 mx-auto" />
            <Skeleton className="h-8 w-12 mx-auto" />
            <Skeleton className="h-3 w-10 mx-auto" />
          </div>
        </div>
      </div>
    </Card>
  );
}
