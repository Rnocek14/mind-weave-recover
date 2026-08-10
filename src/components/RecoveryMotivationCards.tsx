/**
 * Recovery Motivation Cards - Patient-safe motivational insights
 * 
 * Translates metrics into encouraging, plain-language cards that
 * show progress in terms patients and caregivers can understand.
 */

import { memo } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  Wind, Lightbulb, HandHelping, Mic, TrendingUp, TrendingDown, 
  Equal, Sparkles, Clock 
} from 'lucide-react';
import { useErrorPatternAnalytics } from '@/hooks/useErrorPatternAnalytics';
import { useLearningRate, findSpeechLearningRate } from '@/hooks/useLearningRate';

interface RecoveryMotivationCardsProps {
  userId: string;
}

interface MotivationCard {
  id: string;
  icon: React.ReactNode;
  headline: string;
  detail: string;
  trend: 'improving' | 'steady' | 'needs_attention' | 'building';
  visible: boolean;
}

export const RecoveryMotivationCards = memo(({ userId }: RecoveryMotivationCardsProps) => {
  const { analytics, isLoading: errorLoading } = useErrorPatternAnalytics(userId, { weeksBack: 4 });
  const { learningRates, isLoading: ratesLoading } = useLearningRate(userId);

  if (errorLoading || ratesLoading) {
    return null;
  }

  const fluency = analytics?.fluencyMetrics;
  const cues = analytics?.cueEfficacy || [];
  const namingRate = findSpeechLearningRate(learningRates);

  // Build motivation cards from data
  const cards: MotivationCard[] = [];

  // 1. Speech flowing longer (pause metrics improving)
  if (fluency?.avgPauseCount !== null && fluency.avgPauseCount !== undefined) {
    const pauseCount = fluency.avgPauseCount;
    const trend = pauseCount < 3 ? 'improving' : pauseCount < 5 ? 'steady' : 'needs_attention';
    
    cards.push({
      id: 'speech-flow',
      icon: <Wind className="w-5 h-5" />,
      headline: pauseCount < 3 
        ? 'Speech is flowing smoothly' 
        : pauseCount < 5 
          ? 'Finding your rhythm'
          : 'Taking your time—that\'s okay',
      detail: pauseCount < 3
        ? 'Fewer pauses means words are coming easier'
        : 'Each session helps build your natural pace',
      trend,
      visible: true
    });
  }

  // 2. Finding words easier (semantic errors down, accuracy up)
  if (namingRate) {
    const isImproving = namingRate.trend === 'improving';
    const slope = namingRate.accuracySlope || 0;
    
    cards.push({
      id: 'word-finding',
      icon: <Lightbulb className="w-5 h-5" />,
      headline: isImproving 
        ? 'Finding words is getting easier'
        : slope < 0 
          ? 'Word finding takes effort—keep practicing'
          : 'Building your word bank',
      detail: isImproving
        ? `Your accuracy improved ${Math.round(slope * 100)}% this week`
        : 'Each attempt strengthens your connections',
      trend: isImproving ? 'improving' : 'steady',
      visible: namingRate.trialCount >= 10
    });
  }

  // 3. Needing less help (cue dependency decreasing)
  const bestCue = cues.find(c => c.totalGiven >= 3 && c.efficacyRate > 0.5);
  if (bestCue) {
    const efficacy = bestCue.efficacyRate;
    const trend = efficacy > 0.7 ? 'improving' : efficacy > 0.4 ? 'steady' : 'needs_attention';
    
    // Check if "none" cue is doing well (working independently)
    const noCue = cues.find(c => c.cueType === 'none');
    const workingIndependently = noCue && noCue.efficacyRate > 0.6;
    
    cards.push({
      id: 'cue-dependency',
      icon: <HandHelping className="w-5 h-5" />,
      headline: workingIndependently
        ? 'Working more independently'
        : `${getCueFriendlyName(bestCue.cueType)} hints help most`,
      detail: workingIndependently
        ? 'You\'re succeeding on your own more often'
        : `They work ${Math.round(efficacy * 100)}% of the time`,
      trend: workingIndependently ? 'improving' : trend,
      visible: true
    });
  }

  // 4. Clearer pronunciation (only if we have GOP data)
  // This card only shows when MFA alignment is available
  if (analytics && (analytics as any).gopTrend !== undefined) {
    const gopTrend = (analytics as any).gopTrend;
    cards.push({
      id: 'pronunciation',
      icon: <Mic className="w-5 h-5" />,
      headline: gopTrend > 0 
        ? 'Pronunciation getting clearer'
        : 'Building speech clarity',
      detail: gopTrend > 0
        ? 'Your sounds are becoming more distinct'
        : 'Practice is strengthening your speech',
      trend: gopTrend > 0 ? 'improving' : 'steady',
      visible: true
    });
  }

  // 5. Consistency (only if enough data)
  if (analytics && analytics.totalTrials >= 20) {
    const accuracy = analytics.overallAccuracy;
    cards.push({
      id: 'consistency',
      icon: <Clock className="w-5 h-5" />,
      headline: accuracy > 0.7 
        ? 'Staying consistent'
        : accuracy > 0.5 
          ? 'Building your baseline'
          : 'Every session counts',
      detail: `${Math.round(accuracy * 100)}% accuracy across ${analytics.totalTrials} attempts`,
      trend: accuracy > 0.7 ? 'improving' : 'steady',
      visible: true
    });
  }

  const visibleCards = cards.filter(c => c.visible);

  if (visibleCards.length === 0) {
    return null;
  }

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {visibleCards.slice(0, 4).map(card => (
        <Card key={card.id} className={getCardStyles(card.trend)}>
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <div className={`p-2 rounded-full ${getIconBgStyles(card.trend)}`}>
                {card.icon}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1">
                  <h4 className="font-medium text-sm">{card.headline}</h4>
                  {getTrendBadge(card.trend)}
                </div>
                <p className="text-xs text-muted-foreground">{card.detail}</p>
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
});

RecoveryMotivationCards.displayName = 'RecoveryMotivationCards';

function getCueFriendlyName(cueType: string): string {
  const names: Record<string, string> = {
    'semantic': 'Category',
    'phonemic': 'First-sound',
    'full_word': 'Hearing the word',
    'none': 'Independent'
  };
  return names[cueType] || cueType;
}

function getCardStyles(trend: MotivationCard['trend']): string {
  switch (trend) {
    case 'improving':
      return 'border-success/30 bg-success/5';
    case 'needs_attention':
      return 'border-warning/30 bg-warning/5';
    case 'building':
      return 'border-primary/30 bg-primary/5';
    default:
      return '';
  }
}

function getIconBgStyles(trend: MotivationCard['trend']): string {
  switch (trend) {
    case 'improving':
      return 'bg-success/20 text-success';
    case 'needs_attention':
      return 'bg-warning/20 text-warning';
    case 'building':
      return 'bg-primary/20 text-primary';
    default:
      return 'bg-muted text-muted-foreground';
  }
}

function getTrendBadge(trend: MotivationCard['trend']): React.ReactNode {
  switch (trend) {
    case 'improving':
      return (
        <Badge variant="outline" className="text-success border-success/30 gap-1 text-xs py-0">
          <TrendingUp className="w-3 h-3" />
        </Badge>
      );
    case 'needs_attention':
      return (
        <Badge variant="outline" className="text-warning border-warning/30 gap-1 text-xs py-0">
          <TrendingDown className="w-3 h-3" />
        </Badge>
      );
    case 'building':
      return (
        <Badge variant="outline" className="text-primary border-primary/30 gap-1 text-xs py-0">
          <Sparkles className="w-3 h-3" />
        </Badge>
      );
    default:
      return (
        <Badge variant="outline" className="text-muted-foreground gap-1 text-xs py-0">
          <Equal className="w-3 h-3" />
        </Badge>
      );
  }
}

export default RecoveryMotivationCards;
