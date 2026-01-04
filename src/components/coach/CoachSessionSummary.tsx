/**
 * CoachSessionSummary - Clinical insights after a conversation session
 * 
 * Shows meaningful progress data:
 * - Fluency metrics and trends
 * - Pronunciation highlights and challenges
 * - Session highlights
 * - Areas for practice
 * - Recommendations
 */

import React from 'react';
import { 
  TrendingUp, 
  TrendingDown, 
  Minus, 
  MessageCircle, 
  Zap, 
  Heart,
  Target,
  Sparkles,
  ArrowRight,
  Volume2,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface SessionMetrics {
  turnsCompleted: number;
  cardsCompleted: number;
  totalUserWords: number;
  avgLatencyMs: number;
  avgFluency?: number;
  fluencyTrend?: 'improving' | 'stable' | 'declining';
  effortfulCount?: number;
  circumlocutionCount?: number;
  // Enhanced pronunciation metrics
  avgPronunciationScore?: number;
  challengingSounds?: string[];
  bestUtterances?: string[];
}

interface CoachSessionSummaryProps {
  metrics: SessionMetrics;
  onPlayAgain: () => void;
  onFinish: () => void;
  onExerciseRecommendation?: (slug: string) => void;
}

export function CoachSessionSummary({
  metrics,
  onPlayAgain,
  onFinish,
  onExerciseRecommendation,
}: CoachSessionSummaryProps) {
  // Determine session quality
  const sessionQuality = getSessionQuality(metrics);
  
  // Generate personalized insights
  const insights = generateInsights(metrics);
  
  // Generate recommendations
  const recommendations = generateRecommendations(metrics);
  
  // Generate pronunciation highlights
  const pronunciationHighlights = generatePronunciationHighlights(metrics);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header with overall assessment */}
      <div className="text-center">
        <div className={cn(
          "inline-flex items-center justify-center w-20 h-20 rounded-full shadow-lg mb-4",
          sessionQuality === 'excellent' && "bg-success/15",
          sessionQuality === 'good' && "bg-primary/15",
          sessionQuality === 'fair' && "bg-warning/15",
        )}>
          {sessionQuality === 'excellent' ? (
            <Sparkles className="w-10 h-10 text-success" />
          ) : sessionQuality === 'good' ? (
            <Heart className="w-10 h-10 text-primary" />
          ) : (
            <Target className="w-10 h-10 text-warning" />
          )}
        </div>
        
        <h3 className="text-2xl font-semibold mb-2">
          {sessionQuality === 'excellent' ? 'Excellent conversation!' :
           sessionQuality === 'good' ? 'Great practice!' :
           'Good effort!'}
        </h3>
        <p className="text-muted-foreground">
          {metrics.turnsCompleted} turns • {metrics.totalUserWords} words spoken
        </p>
      </div>

      {/* Key metrics */}
      <div className="grid grid-cols-3 gap-4">
        <MetricCard
          label="Fluency"
          value={metrics.avgFluency !== undefined ? `${metrics.avgFluency}%` : '--'}
          trend={metrics.fluencyTrend}
          icon={<Zap className="w-5 h-5" />}
        />
        <MetricCard
          label="Response Time"
          value={formatLatency(metrics.avgLatencyMs)}
          icon={<MessageCircle className="w-5 h-5" />}
        />
        {metrics.avgPronunciationScore !== undefined ? (
          <MetricCard
            label="Pronunciation"
            value={`${metrics.avgPronunciationScore}%`}
            icon={<Volume2 className="w-5 h-5" />}
          />
        ) : (
          <MetricCard
            label="Activities"
            value={metrics.cardsCompleted.toString()}
            icon={<Target className="w-5 h-5" />}
          />
        )}
      </div>

      {/* Pronunciation highlights */}
      {pronunciationHighlights.length > 0 && (
        <div className="bg-gradient-to-r from-primary/10 to-transparent rounded-2xl p-4 space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide flex items-center gap-2">
            <Volume2 className="w-4 h-4" />
            Pronunciation Insights
          </h4>
          <div className="space-y-2">
            {pronunciationHighlights.map((highlight, i) => (
              <div key={i} className="flex items-start gap-2 text-sm">
                {highlight.type === 'success' ? (
                  <CheckCircle className="w-4 h-4 text-success mt-0.5 shrink-0" />
                ) : (
                  <AlertCircle className="w-4 h-4 text-warning mt-0.5 shrink-0" />
                )}
                <span>{highlight.text}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Session insights */}
      {insights.length > 0 && (
        <div className="bg-muted/50 rounded-2xl p-4 space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Session Highlights
          </h4>
          <ul className="space-y-2">
            {insights.map((insight, i) => (
              <li key={i} className="flex items-start gap-2 text-sm">
                <span className="text-primary mt-0.5">•</span>
                <span>{insight}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Best utterances showcase */}
      {metrics.bestUtterances && metrics.bestUtterances.length > 0 && (
        <div className="bg-success/10 border border-success/20 rounded-2xl p-4 space-y-3">
          <h4 className="font-medium text-sm text-success uppercase tracking-wide flex items-center gap-2">
            <Sparkles className="w-4 h-4" />
            Great Moments
          </h4>
          <div className="space-y-2">
            {metrics.bestUtterances.slice(0, 2).map((utterance, i) => (
              <p key={i} className="text-sm italic text-foreground/80 border-l-2 border-success/50 pl-3">
                "{utterance.length > 60 ? utterance.slice(0, 60) + '...' : utterance}"
              </p>
            ))}
          </div>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && onExerciseRecommendation && (
        <div className="space-y-3">
          <h4 className="font-medium text-sm text-muted-foreground uppercase tracking-wide">
            Suggested Practice
          </h4>
          <div className="space-y-2">
            {recommendations.map((rec, i) => (
              <button
                key={i}
                onClick={() => onExerciseRecommendation(rec.slug)}
                className="w-full flex items-center justify-between p-3 bg-card border rounded-xl hover:bg-accent/50 transition-colors text-left"
              >
                <div>
                  <p className="font-medium">{rec.title}</p>
                  <p className="text-sm text-muted-foreground">{rec.reason}</p>
                </div>
                <ArrowRight className="w-5 h-5 text-muted-foreground" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Actions */}
      <div className="flex gap-4 justify-center pt-4">
        <Button size="lg" onClick={onPlayAgain} className="px-8">
          Chat Again
        </Button>
        <Button size="lg" variant="outline" onClick={onFinish} className="px-8">
          Done
        </Button>
      </div>
    </div>
  );
}

// Helper component for metric cards
function MetricCard({ 
  label, 
  value, 
  trend, 
  icon 
}: { 
  label: string; 
  value: string; 
  trend?: 'improving' | 'stable' | 'declining';
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-card border rounded-xl p-4 text-center">
      <div className="flex items-center justify-center gap-2 text-muted-foreground mb-2">
        {icon}
        {trend && (
          <span className={cn(
            "flex items-center",
            trend === 'improving' && "text-success",
            trend === 'declining' && "text-destructive",
          )}>
            {trend === 'improving' && <TrendingUp className="w-4 h-4" />}
            {trend === 'stable' && <Minus className="w-4 h-4" />}
            {trend === 'declining' && <TrendingDown className="w-4 h-4" />}
          </span>
        )}
      </div>
      <div className="text-2xl font-bold text-primary">{value}</div>
      <div className="text-xs text-muted-foreground uppercase tracking-wide mt-1">
        {label}
      </div>
    </div>
  );
}

// Helper functions
function getSessionQuality(metrics: SessionMetrics): 'excellent' | 'good' | 'fair' {
  const fluency = metrics.avgFluency ?? 70;
  const wordRatio = metrics.totalUserWords / Math.max(1, metrics.turnsCompleted);
  const pronunciation = metrics.avgPronunciationScore ?? 70;
  
  // Combined score considering fluency, words per turn, and pronunciation
  const combined = (fluency * 0.4) + (Math.min(wordRatio * 5, 30)) + (pronunciation * 0.3);
  
  if (combined >= 65 && wordRatio >= 6) return 'excellent';
  if (combined >= 45 || wordRatio >= 4) return 'good';
  return 'fair';
}

function formatLatency(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

interface PronunciationHighlight {
  type: 'success' | 'challenge';
  text: string;
}

function generatePronunciationHighlights(metrics: SessionMetrics): PronunciationHighlight[] {
  const highlights: PronunciationHighlight[] = [];
  
  // Pronunciation score highlights
  if (metrics.avgPronunciationScore !== undefined) {
    if (metrics.avgPronunciationScore >= 80) {
      highlights.push({
        type: 'success',
        text: 'Clear pronunciation throughout the session'
      });
    } else if (metrics.avgPronunciationScore >= 60) {
      highlights.push({
        type: 'success',
        text: 'Good pronunciation with some areas to practice'
      });
    }
  }
  
  // Challenging sounds
  if (metrics.challengingSounds && metrics.challengingSounds.length > 0) {
    const soundsStr = metrics.challengingSounds.slice(0, 3).map(s => `/${s}/`).join(', ');
    highlights.push({
      type: 'challenge',
      text: `Sounds to practice: ${soundsStr}`
    });
  }
  
  // Fluency trend as pronunciation indicator
  if (metrics.fluencyTrend === 'improving') {
    highlights.push({
      type: 'success',
      text: 'Speech became smoother as the conversation progressed'
    });
  }
  
  return highlights.slice(0, 3);
}

function generateInsights(metrics: SessionMetrics): string[] {
  const insights: string[] = [];
  
  // Fluency trend
  if (metrics.fluencyTrend === 'improving') {
    insights.push('Your fluency improved as the conversation went on');
  }
  
  // Word count
  const avgWords = metrics.totalUserWords / Math.max(1, metrics.turnsCompleted);
  if (avgWords >= 10) {
    insights.push('You shared detailed responses - great expression!');
  } else if (avgWords >= 5) {
    insights.push('Good conversational flow with balanced responses');
  }
  
  // Activities
  if (metrics.cardsCompleted > 0) {
    insights.push(`Completed ${metrics.cardsCompleted} warm-up ${metrics.cardsCompleted === 1 ? 'activity' : 'activities'}`);
  }
  
  // Response time
  if (metrics.avgLatencyMs < 2000) {
    insights.push('Quick response times - confident speech!');
  }
  
  // Effortful speech handled
  if (metrics.effortfulCount && metrics.effortfulCount > 0 && metrics.turnsCompleted > 2) {
    insights.push('Worked through some challenging moments');
  }
  
  return insights.slice(0, 3); // Max 3 insights
}

interface Recommendation {
  slug: string;
  title: string;
  reason: string;
}

function generateRecommendations(metrics: SessionMetrics): Recommendation[] {
  const recommendations: Recommendation[] = [];
  
  // Based on challenging sounds
  if (metrics.challengingSounds && metrics.challengingSounds.length > 0) {
    recommendations.push({
      slug: 'minimal-pairs',
      title: 'Minimal Pairs Practice',
      reason: `Focus on ${metrics.challengingSounds.slice(0, 2).map(s => `/${s}/`).join(' and ')} sounds`,
    });
  }
  
  // Based on circumlocution
  if (metrics.circumlocutionCount && metrics.circumlocutionCount >= 2) {
    recommendations.push({
      slug: 'photo-naming',
      title: 'Photo Naming',
      reason: 'Practice direct word retrieval',
    });
  }
  
  // Based on effort
  if (metrics.effortfulCount && metrics.effortfulCount >= 2) {
    recommendations.push({
      slug: 'semantic-features',
      title: 'Semantic Features',
      reason: 'Build word associations',
    });
  }
  
  // Based on short responses
  const avgWords = metrics.totalUserWords / Math.max(1, metrics.turnsCompleted);
  if (avgWords < 5) {
    recommendations.push({
      slug: 'thought-continuation',
      title: 'Thought Continuation',
      reason: 'Practice expressing longer thoughts',
    });
  }
  
  // Based on pronunciation
  if (metrics.avgPronunciationScore !== undefined && metrics.avgPronunciationScore < 60) {
    recommendations.push({
      slug: 'phonological',
      title: 'Sound Practice',
      reason: 'Focus on clear pronunciation',
    });
  }
  
  return recommendations.slice(0, 2); // Max 2 recommendations
}