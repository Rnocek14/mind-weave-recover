import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import {
  ArrowLeft,
  Download,
  Filter,
  X,
  FileText,
  Calendar
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { useSessionHistory } from "@/hooks/useSessionHistory";
import { SessionHistoryTimeline } from "@/components/SessionHistoryTimeline";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetTrigger
} from "@/components/ui/sheet";

const SessionHistory = () => {
  const navigate = useNavigate();
  const { user } = useAuth();
  const {
    sessions,
    allSessions,
    loading,
    filters,
    updateFilters,
    clearFilters
  } = useSessionHistory(user?.id);

  const [showFilters, setShowFilters] = useState(false);

  // Dynamically build exercise options from actual session data
  const exerciseOptions = useMemo(() => {
    const slugs = new Set<string>();
    allSessions.forEach((s) => s.exercises.forEach((e) => slugs.add(e.slug)));
    const sorted = Array.from(slugs).sort();
    return [
      { value: "all", label: "All Exercises" },
      ...sorted.map((slug) => ({
        value: slug,
        label: slug.replace(/-/g, " ").replace(/\b\w/g, (l) => l.toUpperCase()),
      })),
    ];
  }, [allSessions]);

  const exportToCSV = () => {
    if (sessions.length === 0) {
      toast.error("No data to export");
      return;
    }

    const csvRows: string[][] = [
      ["Session History Report"],
      [`Generated: ${new Date().toLocaleString()}`],
      [`Total Sessions: ${sessions.length}`],
      [""],
      [
        "Date",
        "Time",
        "Duration",
        "Exercise",
        "Trials",
        "Accuracy (%)",
        "Avg RT (ms)",
        "Errors"
      ]
    ];

    sessions.forEach((session) => {
      const date = new Date(session.startedAt).toLocaleDateString();
      const time = new Date(session.startedAt).toLocaleTimeString();
      const duration = session.durationSec
        ? `${Math.floor(session.durationSec / 60)}m ${session.durationSec % 60}s`
        : "N/A";

      session.exercises.forEach((exercise) => {
        const avgRT =
          exercise.trials.length > 0
            ? Math.round(
                exercise.trials.reduce(
                  (sum, t) => sum + (t.reactionTimeMs || 0),
                  0
                ) / exercise.trials.length
              )
            : 0;

        const errorCount = exercise.trials.filter((t) => t.score !== 1).length;

        csvRows.push([
          date,
          time,
          duration,
          exercise.slug,
          exercise.totalTrials.toString(),
          exercise.accuracy.toString(),
          avgRT.toString(),
          errorCount.toString()
        ]);
      });
    });

    const csvContent = csvRows.map((row) => row.join(",")).join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `session-history-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);

    toast.success("Report exported", {
      description: "CSV file downloaded successfully"
    });
  };

  const exportToPDF = () => {
    toast.info("PDF export available soon", {
      description: "Generating comprehensive clinician report..."
    });
  };

  const activeFiltersCount =
    (filters.exerciseSlug ? 1 : 0) +
    (filters.dateFrom ? 1 : 0) +
    (filters.dateTo ? 1 : 0) +
    (filters.minScore !== undefined ? 1 : 0);

  if (loading) {
    return (
      <div className="min-h-dvh bg-background">
        <div className="container max-w-6xl mx-auto p-4 md:p-8">
          <Skeleton className="h-10 w-48 mb-6" />
          <Skeleton className="h-64 w-full" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background">
      <div className="container max-w-6xl mx-auto p-4 md:p-8">
        {/* Header */}
        <Button
          variant="ghost"
          onClick={() => navigate("/today")}
          className="mb-6"
        >
          <ArrowLeft className="w-4 h-4 mr-2" />
          Back to Home
        </Button>

        <div className="flex items-start justify-between mb-8">
          <div>
            <h1 className="text-3xl md:text-4xl font-bold mb-2">
              Session History
            </h1>
            <p className="text-muted-foreground">
              Detailed view of all your therapy sessions
            </p>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={exportToCSV}>
              <Download className="w-4 h-4 mr-2" />
              CSV
            </Button>
            <Button variant="outline" onClick={exportToPDF}>
              <FileText className="w-4 h-4 mr-2" />
              PDF
            </Button>
          </div>
        </div>

        {/* Stats Summary */}
        <div className="grid md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4">
            <p className="text-2xl font-bold">{allSessions.length}</p>
            <p className="text-sm text-muted-foreground">Total Sessions</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold">
              {allSessions.reduce(
                (sum, s) =>
                  sum +
                  s.exercises.reduce((eSum, e) => eSum + e.totalTrials, 0),
                0
              )}
            </p>
            <p className="text-sm text-muted-foreground">Total Trials</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold">
              {allSessions.length > 0
                ? Math.round(
                    allSessions.reduce(
                      (sum, s) =>
                        sum +
                        s.exercises.reduce(
                          (eSum, e) => eSum + e.accuracy,
                          0
                        ) /
                          s.exercises.length,
                      0
                    ) / allSessions.length
                  )
                : 0}
              %
            </p>
            <p className="text-sm text-muted-foreground">Avg Accuracy</p>
          </Card>
          <Card className="p-4">
            <p className="text-2xl font-bold">
              {Math.floor(
                allSessions.reduce(
                  (sum, s) => sum + (s.durationSec || 0),
                  0
                ) / 60
              )}
              m
            </p>
            <p className="text-sm text-muted-foreground">Total Practice Time</p>
          </Card>
        </div>

        {/* Filters */}
        <div className="mb-6">
          <Sheet open={showFilters} onOpenChange={setShowFilters}>
            <SheetTrigger asChild>
              <Button variant="outline" className="gap-2">
                <Filter className="w-4 h-4" />
                Filters
                {activeFiltersCount > 0 && (
                  <Badge variant="secondary">{activeFiltersCount}</Badge>
                )}
              </Button>
            </SheetTrigger>
            <SheetContent>
              <SheetHeader>
                <SheetTitle>Filter Sessions</SheetTitle>
              </SheetHeader>

              <div className="space-y-6 mt-6">
                {/* Exercise Filter */}
                <div className="space-y-2">
                  <Label>Exercise Type</Label>
                  <Select
                    value={filters.exerciseSlug || "all"}
                    onValueChange={(value) =>
                      updateFilters({
                        exerciseSlug: value === "all" ? undefined : value
                      })
                    }
                  >
                    <SelectTrigger>
                      <SelectValue placeholder="All exercises" />
                    </SelectTrigger>
                    <SelectContent>
                      {exerciseOptions.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>
                          {opt.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Date Range */}
                <div className="space-y-2">
                  <Label>Date From</Label>
                  <Input
                    type="date"
                    value={filters.dateFrom || ""}
                    onChange={(e) =>
                      updateFilters({ dateFrom: e.target.value || undefined })
                    }
                  />
                </div>

                <div className="space-y-2">
                  <Label>Date To</Label>
                  <Input
                    type="date"
                    value={filters.dateTo || ""}
                    onChange={(e) =>
                      updateFilters({ dateTo: e.target.value || undefined })
                    }
                  />
                </div>

                {/* Score Filter */}
                <div className="space-y-2">
                  <Label>Minimum Accuracy (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.minScore || ""}
                    onChange={(e) =>
                      updateFilters({
                        minScore: e.target.value
                          ? parseInt(e.target.value)
                          : undefined
                      })
                    }
                    placeholder="0"
                  />
                </div>

                <div className="space-y-2">
                  <Label>Maximum Accuracy (%)</Label>
                  <Input
                    type="number"
                    min="0"
                    max="100"
                    value={filters.maxScore || ""}
                    onChange={(e) =>
                      updateFilters({
                        maxScore: e.target.value
                          ? parseInt(e.target.value)
                          : undefined
                      })
                    }
                    placeholder="100"
                  />
                </div>

                {/* Clear Filters */}
                <Button
                  variant="outline"
                  className="w-full"
                  onClick={() => {
                    clearFilters();
                    setShowFilters(false);
                  }}
                >
                  <X className="w-4 h-4 mr-2" />
                  Clear All Filters
                </Button>
              </div>
            </SheetContent>
          </Sheet>

          {activeFiltersCount > 0 && (
            <div className="mt-3 flex flex-wrap gap-2">
              {filters.exerciseSlug && (
                <Badge variant="secondary" className="gap-2">
                  Exercise: {filters.exerciseSlug}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => updateFilters({ exerciseSlug: undefined })}
                  />
                </Badge>
              )}
              {filters.dateFrom && (
                <Badge variant="secondary" className="gap-2">
                  From: {filters.dateFrom}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => updateFilters({ dateFrom: undefined })}
                  />
                </Badge>
              )}
              {filters.dateTo && (
                <Badge variant="secondary" className="gap-2">
                  To: {filters.dateTo}
                  <X
                    className="w-3 h-3 cursor-pointer"
                    onClick={() => updateFilters({ dateTo: undefined })}
                  />
                </Badge>
              )}
            </div>
          )}
        </div>

        {/* Results Count */}
        <div className="mb-4">
          <p className="text-sm text-muted-foreground">
            Showing {sessions.length} of {allSessions.length} sessions
          </p>
        </div>

        {/* Timeline */}
        <SessionHistoryTimeline sessions={sessions} />
      </div>
    </div>
  );
};

export default SessionHistory;
