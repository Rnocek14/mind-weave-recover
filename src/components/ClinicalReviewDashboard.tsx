import { useState, useEffect, useCallback, useRef } from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import { 
  Play, 
  Pause, 
  Volume2, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  Target,
  FileAudio,
  Loader2,
  ChevronRight,
  X,
  RefreshCw
} from "lucide-react";

interface UtteranceAnalysis {
  attempt_id: string;
  created_at: string;
  target_word: string;
  transcript: string | null;
  transcript_source: string | null;
  exercise_slug: string | null;
  analysis_status: string | null;
  review_status: string | null;
  gop_data: any;
  alignment_data: any;
  asr_warning_flags: string[] | null;
  human_labels: any;
  is_correct: boolean | null;
  error_type: string | null;
  speech_ratio: number | null;
}

interface ReviewFormData {
  is_correct: boolean | null;
  error_type: string;
  intelligibility: number;
  notes: string;
}

const ERROR_TYPES = [
  { value: "correct", label: "Correct" },
  { value: "phonemic_paraphasia", label: "Phonemic Paraphasia" },
  { value: "semantic_paraphasia", label: "Semantic Paraphasia" },
  { value: "circumlocution", label: "Circumlocution" },
  { value: "neologism", label: "Neologism" },
  { value: "no_response", label: "No Response" },
  { value: "dysarthric", label: "Dysarthric/Unclear" },
  { value: "attempted", label: "Attempted (partial)" },
  { value: "other", label: "Other" },
];

const ClinicalReviewDashboard = () => {
  const { toast } = useToast();
  const [analyses, setAnalyses] = useState<UtteranceAnalysis[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedAnalysis, setSelectedAnalysis] = useState<UtteranceAnalysis | null>(null);
  const [audioUrl, setAudioUrl] = useState<string | null>(null);
  const [audioLoading, setAudioLoading] = useState(false);
  const [isPlaying, setIsPlaying] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reviewForm, setReviewForm] = useState<ReviewFormData>({
    is_correct: null,
    error_type: "",
    intelligibility: 3,
    notes: "",
  });

  // Use ref for audio element to avoid state sync issues
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Fetch queue with SQL-based ordering
  const fetchQueue = useCallback(async () => {
    setLoading(true);
    try {
      // Use RPC or raw query for proper ordering
      // Order by: flagged items first, then lowest GOP, then most recent
      const { data, error } = await supabase
        .from("utterance_analyses")
        .select("*")
        .eq("analysis_status", "complete")
        .in("review_status", ["needs_review", "unreviewed"])
        .order("created_at", { ascending: false })
        .limit(100);

      if (error) throw error;

      // Client-side sort as backup (SQL ordering preferred via view/RPC)
      const sorted = (data || []).sort((a, b) => {
        // Prioritize flagged items
        const aFlags = a.asr_warning_flags?.length ?? 0;
        const bFlags = b.asr_warning_flags?.length ?? 0;
        if (aFlags !== bFlags) return bFlags - aFlags;
        
        // Then by lowest GOP score
        const aGopData = a.gop_data as Record<string, unknown> | null;
        const bGopData = b.gop_data as Record<string, unknown> | null;
        const aGop = (aGopData?.overall_score as number) ?? 1;
        const bGop = (bGopData?.overall_score as number) ?? 1;
        return aGop - bGop;
      });

      setAnalyses(sorted);
    } catch (error) {
      console.error("Error fetching queue:", error);
      toast({
        title: "Error",
        description: "Failed to load review queue",
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchQueue();
  }, [fetchQueue]);

  // Clean up audio on unmount
  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.src = "";
      }
    };
  }, []);

  // Load audio for selected analysis
  const loadAudio = async (attemptId: string) => {
    setAudioLoading(true);
    setAudioUrl(null);
    setIsPlaying(false);
    
    try {
      const { data, error } = await supabase.functions.invoke("get-review-audio-signed-url", {
        body: { attempt_id: attemptId },
      });

      if (error) throw error;
      if (data?.signed_url) {
        setAudioUrl(data.signed_url);
      }
    } catch (error) {
      console.error("Error loading audio:", error);
      toast({
        title: "Audio Load Failed",
        description: "Could not load audio file",
        variant: "destructive",
      });
    } finally {
      setAudioLoading(false);
    }
  };

  // Handle analysis selection
  const handleSelect = (analysis: UtteranceAnalysis) => {
    // Stop any playing audio
    if (audioRef.current) {
      audioRef.current.pause();
    }
    
    setSelectedAnalysis(analysis);
    setIsPlaying(false);
    
    // Pre-fill form with existing human labels or model predictions
    const existingLabels = analysis.human_labels || {};
    setReviewForm({
      is_correct: existingLabels.is_correct ?? analysis.is_correct ?? null,
      error_type: existingLabels.error_type ?? analysis.error_type ?? "",
      intelligibility: existingLabels.intelligibility ?? 3,
      notes: existingLabels.notes ?? "",
    });

    loadAudio(analysis.attempt_id);
  };

  // Audio controls using ref
  const togglePlayback = () => {
    if (!audioRef.current) return;
    
    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.play().then(() => {
        setIsPlaying(true);
      }).catch((err) => {
        console.error("Playback failed:", err);
        toast({
          title: "Playback Error",
          description: "Could not play audio",
          variant: "destructive",
        });
      });
    }
  };

  // Submit review
  const submitReview = async (status: "reviewed" | "needs_followup" | "escalated") => {
    if (!selectedAnalysis) return;

    setSubmitting(true);
    try {
      const humanLabels = {
        is_correct: reviewForm.is_correct,
        error_type: reviewForm.error_type,
        intelligibility: reviewForm.intelligibility,
        notes: reviewForm.notes,
        reviewed_at: new Date().toISOString(),
        review_decision: status,
      };

      const { error } = await supabase
        .from("utterance_analyses")
        .update({
          review_status: status === "reviewed" ? "reviewed" : status === "needs_followup" ? "needs_review" : "escalated",
          human_labels: humanLabels,
        })
        .eq("attempt_id", selectedAnalysis.attempt_id);

      if (error) throw error;

      toast({
        title: "Review Saved",
        description: `Marked as ${status}`,
      });

      // Stop audio and clear selection
      if (audioRef.current) {
        audioRef.current.pause();
      }
      
      // Remove from queue and clear selection
      setAnalyses(prev => prev.filter(a => a.attempt_id !== selectedAnalysis.attempt_id));
      setSelectedAnalysis(null);
      setAudioUrl(null);
      setIsPlaying(false);
    } catch (error) {
      console.error("Error submitting review:", error);
      toast({
        title: "Error",
        description: "Failed to save review",
        variant: "destructive",
      });
    } finally {
      setSubmitting(false);
    }
  };

  const getGopColor = (score: number | null) => {
    if (score === null) return "bg-muted";
    if (score >= 0.8) return "bg-green-500";
    if (score >= 0.6) return "bg-yellow-500";
    if (score >= 0.4) return "bg-orange-500";
    return "bg-red-500";
  };

  const getGopLabel = (score: number | null) => {
    if (score === null) return "N/A";
    if (score >= 0.8) return "Excellent";
    if (score >= 0.6) return "Good";
    if (score >= 0.4) return "Fair";
    if (score >= 0.2) return "Needs Work";
    return "Poor";
  };

  const gopData = selectedAnalysis?.gop_data as Record<string, unknown> | null;
  const alignmentData = selectedAnalysis?.alignment_data as Record<string, unknown> | null;

  return (
    <div className="flex h-[calc(100vh-200px)] gap-4">
      {/* Hidden audio element */}
      <audio
        ref={audioRef}
        src={audioUrl ?? undefined}
        onEnded={() => setIsPlaying(false)}
        onPause={() => setIsPlaying(false)}
        onPlay={() => setIsPlaying(true)}
        className="hidden"
      />

      {/* Queue Panel */}
      <Card className="w-1/2 flex flex-col">
        <div className="p-4 border-b flex items-center justify-between">
          <div>
            <h3 className="font-semibold">Review Queue</h3>
            <p className="text-sm text-muted-foreground">
              {analyses.length} items pending review
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={fetchQueue} disabled={loading}>
            <RefreshCw className={`w-4 h-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
        </div>

        <ScrollArea className="flex-1">
          {loading ? (
            <div className="flex items-center justify-center py-12">
              <Loader2 className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : analyses.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
              <CheckCircle2 className="w-12 h-12 mb-4 opacity-50" />
              <p>All caught up! No items to review.</p>
            </div>
          ) : (
            <div className="divide-y">
              {analyses.map((analysis) => {
                const itemGopData = analysis.gop_data as Record<string, unknown> | null;
                return (
                  <button
                    key={analysis.attempt_id}
                    onClick={() => handleSelect(analysis)}
                    className={`w-full p-4 text-left hover:bg-muted/50 transition-colors ${
                      selectedAnalysis?.attempt_id === analysis.attempt_id ? "bg-muted" : ""
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 mb-1">
                          <Target className="w-4 h-4 text-primary" />
                          <span className="font-medium truncate">
                            {analysis.target_word || "Unknown"}
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground truncate">
                          "{analysis.transcript || "No transcript"}"
                        </p>
                        <div className="flex items-center gap-2 mt-2 flex-wrap">
                          <Badge 
                            variant="secondary" 
                            className={`text-xs text-white ${getGopColor(itemGopData?.overall_score as number | null)}`}
                          >
                            GOP: {(itemGopData?.overall_score as number)?.toFixed(2) ?? "N/A"}
                          </Badge>
                          {analysis.asr_warning_flags?.map((flag, i) => (
                            <Badge key={i} variant="destructive" className="text-xs">
                              <AlertTriangle className="w-3 h-3 mr-1" />
                              {flag.replace(/_/g, " ")}
                            </Badge>
                          ))}
                        </div>
                      </div>
                      <ChevronRight className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">
                      <Clock className="w-3 h-3 inline mr-1" />
                      {new Date(analysis.created_at).toLocaleString()}
                    </p>
                  </button>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </Card>

      {/* Detail Panel */}
      <Card className="w-1/2 flex flex-col">
        {!selectedAnalysis ? (
          <div className="flex-1 flex items-center justify-center text-muted-foreground">
            <div className="text-center">
              <FileAudio className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <p>Select an item to review</p>
            </div>
          </div>
        ) : (
          <>
            <div className="p-4 border-b flex items-center justify-between">
              <div>
                <h3 className="font-semibold">Review Detail</h3>
                <p className="text-sm text-muted-foreground">
                  {selectedAnalysis.exercise_slug || "Exercise"} • Trial
                </p>
              </div>
              <Button variant="ghost" size="sm" onClick={() => {
                if (audioRef.current) audioRef.current.pause();
                setSelectedAnalysis(null);
                setAudioUrl(null);
                setIsPlaying(false);
              }}>
                <X className="w-4 h-4" />
              </Button>
            </div>

            <ScrollArea className="flex-1 p-4">
              {/* Audio Player */}
              <div className="mb-6">
                <Label className="text-sm font-medium mb-2 block">Audio Playback</Label>
                <div className="flex items-center gap-3 p-3 bg-muted rounded-lg">
                  {audioLoading ? (
                    <Loader2 className="w-5 h-5 animate-spin" />
                  ) : audioUrl ? (
                    <Button variant="outline" size="icon" aria-label={isPlaying ? "Pause audio" : "Play audio"} onClick={togglePlayback}>
                      {isPlaying ? <Pause className="w-4 h-4" /> : <Play className="w-4 h-4" />}
                    </Button>
                  ) : (
                    <Volume2 className="w-5 h-5 text-muted-foreground" />
                  )}
                  <span className="text-sm">
                    {audioLoading ? "Loading audio..." : audioUrl ? (isPlaying ? "Playing..." : "Audio ready") : "No audio available"}
                  </span>
                </div>
              </div>

              {/* Context */}
              <div className="mb-6 space-y-3">
                <div>
                  <Label className="text-sm text-muted-foreground">Target Word</Label>
                  <p className="font-medium text-lg">{selectedAnalysis.target_word}</p>
                </div>
                <div>
                  <Label className="text-sm text-muted-foreground">Transcript ({selectedAnalysis.transcript_source || "unknown"})</Label>
                  <p className="font-medium">"{selectedAnalysis.transcript || "No transcript"}"</p>
                </div>
              </div>

              <Separator className="my-4" />

              {/* GOP Scores */}
              {gopData && (
                <div className="mb-6">
                  <Label className="text-sm font-medium mb-2 block">Proxy GOP Analysis</Label>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-3 bg-muted rounded-lg">
                      <p className="text-xs text-muted-foreground">Overall Score</p>
                      <p className="text-xl font-bold">
                        {((gopData.overall_score as number) * 100).toFixed(0)}%
                      </p>
                      <Badge className={`text-xs text-white ${getGopColor(gopData.overall_score as number)}`}>
                        {getGopLabel(gopData.overall_score as number)}
                      </Badge>
                    </div>
                    {gopData.subscores && (
                      <>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground">Duration Accuracy</p>
                          <p className="text-lg font-semibold">
                            {(((gopData.subscores as Record<string, number>).duration_accuracy) * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground">Fluency</p>
                          <p className="text-lg font-semibold">
                            {(((gopData.subscores as Record<string, number>).fluency) * 100).toFixed(0)}%
                          </p>
                        </div>
                        <div className="p-3 bg-muted rounded-lg">
                          <p className="text-xs text-muted-foreground">Articulation</p>
                          <p className="text-lg font-semibold">
                            {(((gopData.subscores as Record<string, number>).articulation_rate) * 100).toFixed(0)}%
                          </p>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              )}

              {/* Alignment Data */}
              {alignmentData?.word_segments && (
                <div className="mb-6">
                  <Label className="text-sm font-medium mb-2 block">Word Alignment</Label>
                  <div className="flex flex-wrap gap-2">
                    {(alignmentData.word_segments as any[]).map((seg: any, i: number) => (
                      <Badge key={i} variant="outline" className="font-mono text-xs">
                        {seg.word} ({seg.start.toFixed(2)}s - {seg.end.toFixed(2)}s)
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <Separator className="my-4" />

              {/* Review Form */}
              <div className="space-y-4">
                <h4 className="font-medium">Human Review</h4>

                <div>
                  <Label>Is Correct?</Label>
                  <div className="flex gap-2 mt-1">
                    <Button
                      variant={reviewForm.is_correct === true ? "default" : "outline"}
                      size="sm"
                      onClick={() => setReviewForm(prev => ({ ...prev, is_correct: true }))}
                    >
                      <CheckCircle2 className="w-4 h-4 mr-1" />
                      Yes
                    </Button>
                    <Button
                      variant={reviewForm.is_correct === false ? "destructive" : "outline"}
                      size="sm"
                      onClick={() => setReviewForm(prev => ({ ...prev, is_correct: false }))}
                    >
                      <X className="w-4 h-4 mr-1" />
                      No
                    </Button>
                  </div>
                </div>

                <div>
                  <Label>Error Type</Label>
                  <Select
                    value={reviewForm.error_type}
                    onValueChange={(v) => setReviewForm(prev => ({ ...prev, error_type: v }))}
                  >
                    <SelectTrigger className="mt-1">
                      <SelectValue placeholder="Select error type..." />
                    </SelectTrigger>
                    <SelectContent>
                      {ERROR_TYPES.map((type) => (
                        <SelectItem key={type.value} value={type.value}>
                          {type.label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div>
                  <Label>Intelligibility (1-5)</Label>
                  <div className="flex gap-2 mt-1">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Button
                        key={n}
                        variant={reviewForm.intelligibility === n ? "default" : "outline"}
                        size="sm"
                        onClick={() => setReviewForm(prev => ({ ...prev, intelligibility: n }))}
                      >
                        {n}
                      </Button>
                    ))}
                  </div>
                </div>

                <div>
                  <Label>Notes (optional)</Label>
                  <Textarea
                    value={reviewForm.notes}
                    onChange={(e) => setReviewForm(prev => ({ ...prev, notes: e.target.value }))}
                    placeholder="Any additional observations..."
                    className="mt-1"
                    rows={2}
                  />
                </div>
              </div>
            </ScrollArea>

            {/* Action Buttons */}
            <div className="p-4 border-t flex gap-2">
              <Button
                className="flex-1"
                onClick={() => submitReview("reviewed")}
                disabled={submitting}
              >
                {submitting ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : null}
                Mark Reviewed
              </Button>
              <Button
                variant="outline"
                onClick={() => submitReview("needs_followup")}
                disabled={submitting}
              >
                Needs Follow-up
              </Button>
              <Button
                variant="destructive"
                onClick={() => submitReview("escalated")}
                disabled={submitting}
              >
                Escalate
              </Button>
            </div>
          </>
        )}
      </Card>
    </div>
  );
};

export default ClinicalReviewDashboard;
