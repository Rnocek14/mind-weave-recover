/**
 * Therapy Intelligence Report — surfaces cross-session patterns for clinicians.
 * 
 * Clean, short, clinically readable. No flashy charts.
 * Sections: Word Retrieval, Phonology, Behavior, Recommendations.
 */
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Brain, TrendingUp, TrendingDown, Minus, AlertTriangle, CheckCircle, BookOpen, Volume2, MessageSquare, Lightbulb } from "lucide-react";
import type { PatientIntelligenceProfile } from "@/lib/patientIntelligence";
import { selectTherapyStrategy, formatStrategyForClinician } from "@/lib/therapyStrategyEngine";

interface TherapyIntelligenceReportProps {
  profile: PatientIntelligenceProfile;
}

const trendIcon = (trend: string) => {
  if (trend === 'improving' || trend === 'faster') return <TrendingUp className="w-3.5 h-3.5 text-green-600 dark:text-green-400" />;
  if (trend === 'declining' || trend === 'slower') return <TrendingDown className="w-3.5 h-3.5 text-red-500" />;
  return <Minus className="w-3.5 h-3.5 text-muted-foreground" />;
};

const trendColor = (trend: string) => {
  if (trend === 'improving' || trend === 'faster') return 'text-green-600 dark:text-green-400';
  if (trend === 'declining' || trend === 'slower') return 'text-red-500';
  return 'text-muted-foreground';
};

function generateRecommendations(profile: PatientIntelligenceProfile): string[] {
  const recs: string[] = [];
  
  if (profile.persistentPhonemeErrors.length > 0) {
    const top = profile.persistentPhonemeErrors[0];
    recs.push(`Increase minimal pair practice targeting ${top.phonemes} (persistent across ${top.sessionCount} sessions)`);
  }
  
  if (profile.persistentStruggledWords.length > 0) {
    const words = profile.persistentStruggledWords.slice(0, 3).map(w => `"${w.word}"`).join(', ');
    recs.push(`Revisit naming for ${words} — consistently difficult`);
  }
  
  if (profile.circumlocutionTendency === 'high') {
    recs.push('Focus on direct word retrieval strategies — high circumlocution pattern detected');
  }
  
  if (profile.latencyTrend === 'slower') {
    recs.push('Consider longer response windows before cueing — retrieval speed declining');
  }
  
  if (profile.successRateTrend === 'declining') {
    recs.push('Review task difficulty — success rate trending downward');
  }
  
  if (profile.recoveredWords.length > 0) {
    recs.push(`Reinforce recovered words (${profile.recoveredWords.slice(0, 3).join(', ')}) with spaced repetition`);
  }

  if (recs.length === 0) {
    recs.push('Continue current therapy plan — patterns are stable');
  }
  
  return recs;
}

export function TherapyIntelligenceReport({ profile }: TherapyIntelligenceReportProps) {
  const recommendations = generateRecommendations(profile);
  const hasPhonology = profile.persistentPhonemeErrors.length > 0;
  const hasWordData = profile.persistentStruggledWords.length > 0 || profile.recoveredWords.length > 0;
  const hasBehavior = profile.dominantPatterns.length > 0 || profile.circumlocutionTendency !== 'low';

  return (
    <Card className="border-primary/20">
      <CardHeader className="pb-2 pt-3">
        <div className="flex items-center justify-between">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Brain className="h-4 w-4 text-primary" />
            Therapy Intelligence Report
          </CardTitle>
          <Badge variant="secondary" className="text-[10px]">
            {profile.sessionCount} sessions analyzed
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="pb-4 space-y-4">
        {/* ─── Overall Trends ─── */}
        <div className="flex flex-wrap gap-x-6 gap-y-1.5 text-sm">
          <div className="flex items-center gap-1.5">
            {trendIcon(profile.successRateTrend)}
            <span className="text-muted-foreground">Accuracy:</span>
            <span className={`font-medium ${trendColor(profile.successRateTrend)}`}>
              {profile.successRateTrend}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            {trendIcon(profile.latencyTrend)}
            <span className="text-muted-foreground">Retrieval speed:</span>
            <span className={`font-medium ${trendColor(profile.latencyTrend)}`}>
              {profile.latencyTrend}
            </span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-muted-foreground">Circumlocution:</span>
            <span className={`font-medium ${
              profile.circumlocutionTendency === 'high' ? 'text-amber-600 dark:text-amber-400' :
              profile.circumlocutionTendency === 'moderate' ? 'text-muted-foreground' :
              'text-green-600 dark:text-green-400'
            }`}>
              {profile.circumlocutionTendency}
            </span>
          </div>
        </div>

        {/* ─── Word Retrieval ─── */}
        {hasWordData && (
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <BookOpen className="w-3.5 h-3.5" />
              Word Retrieval
            </h4>
            <div className="space-y-2">
              {profile.persistentStruggledWords.length > 0 && (
                <div className="text-sm">
                  <span className="text-muted-foreground">Persistent difficulty: </span>
                  <span className="font-medium">
                    {profile.persistentStruggledWords.map((w, i) => (
                      <span key={w.word}>
                        {i > 0 && ', '}
                        {w.word}
                        <span className="text-[10px] text-muted-foreground ml-0.5">({w.sessionCount}s)</span>
                      </span>
                    ))}
                  </span>
                </div>
              )}
              {profile.recoveredWords.length > 0 && (
                <div className="text-sm flex items-start gap-1.5">
                  <CheckCircle className="w-3.5 h-3.5 text-green-600 dark:text-green-400 shrink-0 mt-0.5" />
                  <div>
                    <span className="text-muted-foreground">Recovered: </span>
                    <span className="font-medium text-green-600 dark:text-green-400">
                      {profile.recoveredWords.join(', ')}
                    </span>
                    <span className="text-[10px] text-muted-foreground ml-1">(previously struggled, now mastered)</span>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {/* ─── Phonology ─── */}
        {hasPhonology && (
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <Volume2 className="w-3.5 h-3.5" />
              Phonology
            </h4>
            <div className="space-y-1.5">
              {profile.persistentPhonemeErrors.map((pe) => (
                <div key={pe.phonemes} className="flex items-center gap-2 text-sm">
                  <Badge variant="outline" className="text-[10px] font-mono shrink-0">
                    {pe.phonemes}
                  </Badge>
                  <span className="text-muted-foreground">
                    {pe.totalCount} errors across {pe.sessionCount} sessions
                  </span>
                  {pe.sessionCount >= 3 && (
                    <AlertTriangle className="w-3 h-3 text-amber-500 shrink-0" />
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ─── Behavioral Patterns ─── */}
        {hasBehavior && (
          <section>
            <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
              <MessageSquare className="w-3.5 h-3.5" />
              Behavioral Patterns
            </h4>
            <div className="space-y-1.5">
              {profile.dominantPatterns.map((p) => {
                const label =
                  p.type === 'circumlocution_habit' ? 'Circumlocution tendency' :
                  p.type === 'slow_retrieval' ? 'Slow word retrieval' :
                  p.type === 'improving' ? 'Improving within sessions' :
                  p.type === 'phoneme_confusion' ? 'Sound confusion pattern' :
                  p.type === 'semantic_substitution' ? 'Semantic substitution' :
                  p.type;
                return (
                  <div key={p.type} className="flex items-center gap-2 text-sm">
                    <span className="font-medium">{label}</span>
                    <span className="text-[10px] text-muted-foreground">
                      ({p.sessionCount} sessions)
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* ─── Recommended Focus Areas ─── */}
        <section className="border-t border-border/50 pt-3">
          <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide mb-2 flex items-center gap-1.5">
            <Lightbulb className="w-3.5 h-3.5 text-primary" />
            Recommended Focus Areas
          </h4>
          <ul className="space-y-1.5">
            {recommendations.map((rec, i) => (
              <li key={i} className="text-sm flex items-start gap-2">
                <span className="text-primary font-bold text-xs mt-0.5">→</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </section>
      </CardContent>
    </Card>
  );
}
