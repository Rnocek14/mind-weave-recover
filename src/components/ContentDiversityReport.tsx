/**
 * ContentDiversityReport
 * 
 * Internal stimulus inventory report showing:
 * - Total photo words & cue coverage
 * - Phoneme coverage by position (initial/medial/final)
 * - Minimal pairs count
 * - Top gaps for next expansion
 * 
 * Designed for clinician/admin view in the Evidence tab.
 */

import { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { ScrollArea } from '@/components/ui/scroll-area';
import {
  BookOpen,
  Mic,
  Layers,
  AlertTriangle,
  CheckCircle2,
  BarChart3,
  MessageSquareText,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { PHOTO_BANK } from '@/data/photoBank';
import { getCueBankStats, hasCueCoverage, type CueBankType } from '@/data/cueBank';
import { MINIMAL_PAIRS } from '@/data/minimalPairsBank';
import { WORD_PHONEME_MAP, getPhonemeMapCoverage } from '@/lib/phonemeWordMap';
import { getGradedSentenceBankStats } from '@/data/gradedSentenceBank';

interface PhonemePositionCoverage {
  phoneme: string;
  initial: number;
  medial: number;
  final: number;
  total: number;
}

function computeInventory() {
  // Unique photo words
  const photoWords = [...new Set(PHOTO_BANK.map(t => t.target.toLowerCase()))];
  
  // Cue bank stats
  const cueStats = getCueBankStats();
  
  // Words with vs without cue coverage
  const wordsWithCues = photoWords.filter(w => hasCueCoverage(w));
  const wordsWithoutCues = photoWords.filter(w => !hasCueCoverage(w));
  
  // Phoneme-map coverage
  const phonemeMapCoverage = getPhonemeMapCoverage(photoWords);
  
  // Minimal pairs
  const minimalPairsCount = MINIMAL_PAIRS.length;
  
  // Phoneme position coverage from photoBank features
  const phonemePositions = new Map<string, { initial: Set<string>; medial: Set<string>; final: Set<string> }>();
  
  for (const trial of PHOTO_BANK) {
    const word = trial.target.toLowerCase();
    const phonemes = WORD_PHONEME_MAP[word];
    if (!phonemes || phonemes.length === 0) continue;
    
    // First phoneme = initial position
    const firstPhoneme = phonemes[0];
    if (!phonemePositions.has(firstPhoneme)) {
      phonemePositions.set(firstPhoneme, { initial: new Set(), medial: new Set(), final: new Set() });
    }
    phonemePositions.get(firstPhoneme)!.initial.add(word);
    
    // Last phoneme = final position
    if (phonemes.length > 1) {
      const lastPhoneme = phonemes[phonemes.length - 1];
      if (!phonemePositions.has(lastPhoneme)) {
        phonemePositions.set(lastPhoneme, { initial: new Set(), medial: new Set(), final: new Set() });
      }
      phonemePositions.get(lastPhoneme)!.final.add(word);
    }
    
    // Middle phonemes = medial position
    for (let i = 1; i < phonemes.length - 1; i++) {
      const midPhoneme = phonemes[i];
      if (!phonemePositions.has(midPhoneme)) {
        phonemePositions.set(midPhoneme, { initial: new Set(), medial: new Set(), final: new Set() });
      }
      phonemePositions.get(midPhoneme)!.medial.add(word);
    }
  }
  
  // Build coverage array sorted by total
  const coverageArray: PhonemePositionCoverage[] = [];
  // Only include consonant phonemes (clinical focus)
  const consonantPhonemes = ['/k/', '/g/', '/t/', '/d/', '/p/', '/b/', '/f/', '/v/', '/s/', '/z/',
    '/ʃ/', '/ʒ/', '/tʃ/', '/dʒ/', '/θ/', '/ð/', '/h/', '/m/', '/n/', '/ŋ/', '/l/', '/r/', '/w/', '/j/'];
  
  for (const ph of consonantPhonemes) {
    const data = phonemePositions.get(ph);
    if (data) {
      coverageArray.push({
        phoneme: ph,
        initial: data.initial.size,
        medial: data.medial.size,
        final: data.final.size,
        total: data.initial.size + data.medial.size + data.final.size,
      });
    } else {
      coverageArray.push({ phoneme: ph, initial: 0, medial: 0, final: 0, total: 0 });
    }
  }
  
  coverageArray.sort((a, b) => a.total - b.total);
  
  // Find top 5 weakest position gaps
  const gaps: { phoneme: string; position: string; count: number }[] = [];
  for (const entry of coverageArray) {
    if (entry.initial === 0) gaps.push({ phoneme: entry.phoneme, position: 'initial', count: 0 });
    if (entry.medial === 0) gaps.push({ phoneme: entry.phoneme, position: 'medial', count: 0 });
    if (entry.final === 0) gaps.push({ phoneme: entry.phoneme, position: 'final', count: 0 });
  }
  
  // Categories breakdown
  const categories = new Map<string, number>();
  for (const trial of PHOTO_BANK) {
    const cat = trial.category;
    categories.set(cat, (categories.get(cat) || 0) + 1);
  }
  
  // Graded sentence stats
  const sentenceStats = getGradedSentenceBankStats();
  
  return {
    photoWords,
    photoWordCount: photoWords.length,
    totalPhotoTrials: PHOTO_BANK.length,
    cueStats,
    wordsWithCues: wordsWithCues.length,
    wordsWithoutCues,
    phonemeMapCoverage,
    minimalPairsCount,
    phonemeCoverage: coverageArray,
    positionGaps: gaps.slice(0, 8),
    categories: [...categories.entries()].sort((a, b) => b[1] - a[1]),
    sentenceStats,
  };
}

export function ContentDiversityReport() {
  const inventory = useMemo(computeInventory, []);
  
  const cueCoveragePercent = Math.round((inventory.wordsWithCues / inventory.photoWordCount) * 100);
  const fullCueCoveragePercent = Math.round(
    (inventory.cueStats.wordsWithFullCoverage / inventory.cueStats.totalWords) * 100
  );
  const phonemeMapPct = Math.round(inventory.phonemeMapCoverage.coverage);

  return (
    <div className="space-y-4">
      {/* Headline stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <StatCard
          icon={<BookOpen className="w-4 h-4" />}
          label="Photo Words"
          value={inventory.photoWordCount}
          sub={`${inventory.totalPhotoTrials} trials total`}
        />
        <StatCard
          icon={<Layers className="w-4 h-4" />}
          label="Cue Variants"
          value={inventory.cueStats.totalCues}
          sub={`${inventory.cueStats.totalWords} words covered`}
        />
        <StatCard
          icon={<Mic className="w-4 h-4" />}
          label="Minimal Pairs"
          value={inventory.minimalPairsCount}
          sub="phoneme contrasts"
        />
        <StatCard
          icon={<MessageSquareText className="w-4 h-4" />}
          label="Sentence Layers"
          value={inventory.sentenceStats.totalSentences}
          sub={`${inventory.sentenceStats.uniqueWords} words × 4 levels`}
        />
        <StatCard
          icon={<BarChart3 className="w-4 h-4" />}
          label="Phoneme Map"
          value={`${phonemeMapPct}%`}
          sub={`${inventory.phonemeMapCoverage.unmapped.length} unmapped`}
          alert={inventory.phonemeMapCoverage.unmapped.length > 3}
        />
      </div>

      {/* Unmapped words warning */}
      {inventory.phonemeMapCoverage.unmapped.length > 0 && (
        <Card className="border-destructive/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-destructive" />
              Unmapped Words ({inventory.phonemeMapCoverage.unmapped.length})
            </CardTitle>
            <CardDescription className="text-xs">
              Photo words missing phoneme mappings — affects targeting accuracy
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {inventory.phonemeMapCoverage.unmapped.map(w => (
                <Badge key={w} variant="destructive" className="text-xs">{w}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Cue type breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Cue Type Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            {(['phonemic', 'semantic', 'sentence_completion', 'repetition'] as CueBankType[]).map(type => (
              <div key={type} className="text-center">
                <div className="text-lg font-bold text-foreground">
                  {inventory.cueStats.byType[type]}
                </div>
                <div className="text-xs text-muted-foreground capitalize">
                  {type.replace('_', ' ')}
                </div>
              </div>
            ))}
          </div>
          <div className="mt-3">
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Full 4-type coverage</span>
              <span>{fullCueCoveragePercent}%</span>
            </div>
            <Progress value={fullCueCoveragePercent} className="h-2" />
          </div>
        </CardContent>
      </Card>

      {/* Phoneme Position Coverage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Phoneme Coverage by Position</CardTitle>
          <CardDescription className="text-xs">
            Consonant phonemes in photo bank (initial / medial / final)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ScrollArea className="h-[280px]">
            <div className="space-y-1.5">
              {inventory.phonemeCoverage.map(entry => (
                <div key={entry.phoneme} className="flex items-center gap-2 text-sm">
                  <code className="w-10 text-xs font-mono text-muted-foreground">
                    {entry.phoneme}
                  </code>
                  <div className="flex gap-1 flex-1">
                    <PositionPill label="I" count={entry.initial} />
                    <PositionPill label="M" count={entry.medial} />
                    <PositionPill label="F" count={entry.final} />
                  </div>
                  <span className="text-xs text-muted-foreground w-6 text-right">
                    {entry.total}
                  </span>
                </div>
              ))}
            </div>
          </ScrollArea>
        </CardContent>
      </Card>

      {/* Position Gaps */}
      {inventory.positionGaps.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Top Position Gaps
            </CardTitle>
            <CardDescription className="text-xs">
              Phoneme × position combos with zero photo words
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-2">
              {inventory.positionGaps.map((gap, i) => (
                <Badge key={i} variant="outline" className="text-xs border-warning/50">
                  {gap.phoneme} {gap.position}
                </Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Words missing cue coverage */}
      {inventory.wordsWithoutCues.length > 0 && (
        <Card className="border-warning/30">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 text-warning" />
              Words Missing Cue Coverage ({inventory.wordsWithoutCues.length})
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex flex-wrap gap-1.5">
              {inventory.wordsWithoutCues.map(w => (
                <Badge key={w} variant="secondary" className="text-xs">{w}</Badge>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Recommended Next Batch */}
      {inventory.positionGaps.length > 0 && (
        <Card className="border-primary/30 bg-primary/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-sm font-medium flex items-center gap-2">
              <CheckCircle2 className="w-4 h-4 text-primary" />
              Recommended Next Batch
            </CardTitle>
            <CardDescription className="text-xs">
              Priority words to fill zero-coverage positions
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-1.5 text-xs">
              {inventory.positionGaps.map((gap, i) => {
                const suggestion = getGapSuggestion(gap.phoneme, gap.position);
                if (!suggestion) return null;
                return (
                  <div key={i} className="flex items-center gap-2">
                    <Badge variant="outline" className="text-[10px] border-primary/40 min-w-[80px] justify-center">
                      {gap.phoneme} {gap.position}
                    </Badge>
                    <span className="text-muted-foreground">{suggestion}</span>
                  </div>
                );
              })}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Graded Sentence Coverage */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium flex items-center gap-2">
            <MessageSquareText className="w-4 h-4 text-primary" />
            Graded Sentence Coverage
          </CardTitle>
          <CardDescription className="text-xs">
            4-level sentence progression per target word (isolation → complex)
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-3">
            {([1, 2, 3, 4] as const).map(level => (
              <div key={level} className="text-center">
                <div className="text-lg font-bold text-foreground">
                  {inventory.sentenceStats.byLevel[level]}
                </div>
                <div className="text-xs text-muted-foreground">
                  {level === 1 ? 'L1: Word' : level === 2 ? 'L2: Simple' : level === 3 ? 'L3: Expanded' : 'L4: Complex'}
                </div>
              </div>
            ))}
          </div>
          <div>
            <div className="flex justify-between text-xs text-muted-foreground mb-1">
              <span>Words with full 4-level coverage</span>
              <span>{inventory.sentenceStats.fullCoveragePercent}%</span>
            </div>
            <Progress value={inventory.sentenceStats.fullCoveragePercent} className="h-2" />
          </div>
          {/* Words without sentence coverage */}
          {(() => {
            const sentenceWords = new Set(inventory.sentenceStats.wordList);
            const photoWordsWithout = inventory.photoWords.filter((w: string) => !sentenceWords.has(w));
            if (photoWordsWithout.length === 0) return null;
            return (
              <div className="mt-3">
                <div className="text-xs text-muted-foreground mb-1.5">
                  Photo words without sentences ({photoWordsWithout.length}):
                </div>
                <div className="flex flex-wrap gap-1">
                  {photoWordsWithout.slice(0, 20).map((w: string) => (
                    <Badge key={w} variant="secondary" className="text-[10px]">{w}</Badge>
                  ))}
                  {photoWordsWithout.length > 20 && (
                    <Badge variant="secondary" className="text-[10px]">+{photoWordsWithout.length - 20} more</Badge>
                  )}
                </div>
              </div>
            );
          })()}
        </CardContent>
      </Card>

      {/* Category breakdown */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Category Distribution</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-wrap gap-2">
            {inventory.categories.map(([cat, count]) => (
              <Badge key={cat} variant="outline" className="text-xs gap-1">
                {cat} <span className="font-bold">{count}</span>
              </Badge>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

// ─── Gap suggestions ─────────────────────────────────────────

const GAP_SUGGESTIONS: Record<string, Record<string, string>> = {
  '/θ/': {
    initial: 'think, thank, thin',
    medial: 'birthday, bathtub, toothbrush',
    final: 'bath, mouth, cloth',
  },
  '/ð/': {
    initial: 'this, that, the (function words — low priority)',
    medial: 'brother, weather, feather',
    final: 'breathe, bathe, smooth',
  },
  '/ʒ/': {
    initial: '(does not occur in English)',
    medial: 'treasure, measure, vision',
    final: 'beige, garage, massage',
  },
  '/ŋ/': {
    initial: '(does not occur in English)',
    medial: 'finger, monkey, hanger',
    final: 'ring, king, swing',
  },
  '/h/': {
    initial: 'house, hat, hen',
    medial: '(rare in English)',
    final: '(does not occur in English)',
  },
  '/w/': {
    initial: 'watch, web, wagon',
    medial: '(treated as onset in English)',
    final: '(does not occur in English)',
  },
  '/j/': {
    initial: 'yellow, yes, yard',
    medial: '(treated as onset in English)',
    final: '(does not occur in English)',
  },
  '/v/': {
    initial: 'van, vase, vest',
    medial: 'oven, river, seven',
    final: 'glove, five, dove',
  },
  '/tʃ/': {
    initial: 'chair, cheese, chip',
    medial: 'kitchen, ketchup, teacher',
    final: 'watch, match, beach',
  },
  '/dʒ/': {
    initial: 'jar, jug, jet',
    medial: 'pigeon, magic, soldier',
    final: 'bridge, fridge, badge',
  },
  '/s/': {
    initial: 'star, spoon, sun',
    medial: 'basket, pencil, whistle',
    final: 'house, bus, dress',
  },
  '/f/': {
    initial: 'fan, fish, flower',
    medial: 'coffee, muffin, dolphin',
    final: 'leaf, knife, roof',
  },
  '/b/': {
    initial: 'ball, book, bed',
    medial: 'rabbit, ribbon, elbow',
    final: 'cab, web, crab',
  },
  '/t/': {
    initial: 'tree, towel, tiger',
    medial: 'button, water, kitten',
    final: 'cat, hat, net',
  },
};

function getGapSuggestion(phoneme: string, position: string): string | null {
  const suggestions = GAP_SUGGESTIONS[phoneme];
  if (!suggestions) return `Add words with ${phoneme} in ${position} position`;
  return suggestions[position] || `Add words with ${phoneme} in ${position} position`;
}

// ─── Sub-components ──────────────────────────────────────────

function StatCard({ icon, label, value, sub, alert }: {
  icon: React.ReactNode;
  label: string;
  value: string | number;
  sub: string;
  alert?: boolean;
}) {
  return (
    <Card className={cn(alert && 'border-warning/30')}>
      <CardContent className="p-3 text-center">
        <div className="flex justify-center mb-1 text-muted-foreground">{icon}</div>
        <div className="text-xl font-bold text-foreground">{value}</div>
        <div className="text-xs text-muted-foreground">{label}</div>
        <div className="text-[10px] text-muted-foreground/70 mt-0.5">{sub}</div>
      </CardContent>
    </Card>
  );
}

function PositionPill({ label, count }: { label: string; count: number }) {
  const color = count === 0 ? 'bg-destructive/20 text-destructive' :
                count <= 2 ? 'bg-warning/20 text-warning' :
                'bg-primary/10 text-primary';
  return (
    <span className={cn('text-[10px] font-mono rounded px-1.5 py-0.5 min-w-[28px] text-center', color)}>
      {label}:{count}
    </span>
  );
}
