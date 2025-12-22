/**
 * Phoneme Coverage Analysis
 * 
 * Analyzes the photo bank and audio trial bank for phoneme coverage gaps.
 * Run from browser console: window.__runPhonemeCoverageAnalysis?.()
 */

import { PHOTO_BANK } from '@/data/photoBank';
import { AUDIO_TRIAL_BANK } from '@/data/audioTrialBank';
import { WORD_PHONEME_MAP, normalizePhoneme } from '@/lib/phonemeWordMap';
import { MINIMAL_PAIRS } from '@/data/minimalPairsBank';

// All English phonemes we want to cover
const TARGET_PHONEMES = {
  // Consonants - Plosives
  plosives: ['/p/', '/b/', '/t/', '/d/', '/k/', '/g/'],
  
  // Consonants - Fricatives  
  fricatives: ['/f/', '/v/', '/θ/', '/ð/', '/s/', '/z/', '/ʃ/', '/ʒ/', '/h/'],
  
  // Consonants - Affricates
  affricates: ['/tʃ/', '/dʒ/'],
  
  // Consonants - Nasals
  nasals: ['/m/', '/n/', '/ŋ/'],
  
  // Consonants - Approximants
  approximants: ['/l/', '/r/', '/w/', '/j/'],
  
  // Vowels - Monophthongs
  monophthongs: ['/i/', '/ɪ/', '/e/', '/ɛ/', '/æ/', '/ɑ/', '/ɔ/', '/o/', '/ʊ/', '/u/', '/ʌ/', '/ə/', '/ɜ/'],
  
  // Vowels - Diphthongs
  diphthongs: ['/aɪ/', '/aʊ/', '/eɪ/', '/oʊ/', '/ɔɪ/'],
  
  // Common consonant clusters (initial)
  clusters: ['/bl/', '/br/', '/cl/', '/cr/', '/dr/', '/fl/', '/fr/', '/gl/', '/gr/', '/pl/', '/pr/', '/sc/', '/sk/', '/sl/', '/sm/', '/sn/', '/sp/', '/st/', '/sw/', '/tr/', '/tw/'],
};

export interface PhonemeCoverageResult {
  phoneme: string;
  category: string;
  photoWords: string[];
  audioWords: string[];
  totalWords: number;
  hasPhoto: boolean;
  position: {
    initial: string[];
    medial: string[];
    final: string[];
  };
}

export interface CoverageReport {
  timestamp: string;
  totalPhonemes: number;
  coveredPhonemes: number;
  coveragePercent: number;
  
  // Detailed coverage
  byCategory: Record<string, { covered: number; total: number; phonemes: string[] }>;
  
  // Problem areas
  missingPhonemes: string[];
  lowCoveragePhonemes: { phoneme: string; count: number }[];
  
  // Inventory stats
  photoWords: number;
  audioWords: number;
  totalUniqueWords: number;
  
  // Minimal pairs stats
  minimalPairsCount: number;
  minimalPairsWithPhotos: number;
  
  // Full breakdown
  phonemeDetails: PhonemeCoverageResult[];
}

function getPhonemePosition(word: string, phoneme: string): 'initial' | 'medial' | 'final' | null {
  const wordPhonemes = WORD_PHONEME_MAP[word.toLowerCase()];
  if (!wordPhonemes) return null;
  
  const normalizedTarget = normalizePhoneme(phoneme);
  
  for (let i = 0; i < wordPhonemes.length; i++) {
    if (normalizePhoneme(wordPhonemes[i]) === normalizedTarget) {
      if (i === 0) return 'initial';
      if (i === wordPhonemes.length - 1) return 'final';
      return 'medial';
    }
  }
  return null;
}

function getWordsWithPhoneme(words: string[], phoneme: string): string[] {
  const normalizedTarget = normalizePhoneme(phoneme);
  
  return words.filter(word => {
    const phonemes = WORD_PHONEME_MAP[word.toLowerCase()];
    if (!phonemes) return false;
    return phonemes.some(p => normalizePhoneme(p) === normalizedTarget);
  });
}

export function runPhonemeCoverageAnalysis(): CoverageReport {
  const photoWords = PHOTO_BANK.map(p => p.target);
  const audioWords = AUDIO_TRIAL_BANK.map(t => t.word);
  const allWords = [...new Set([...photoWords, ...audioWords])];
  
  const allPhonemes = [
    ...TARGET_PHONEMES.plosives,
    ...TARGET_PHONEMES.fricatives,
    ...TARGET_PHONEMES.affricates,
    ...TARGET_PHONEMES.nasals,
    ...TARGET_PHONEMES.approximants,
    ...TARGET_PHONEMES.monophthongs,
    ...TARGET_PHONEMES.diphthongs,
  ];
  
  const phonemeDetails: PhonemeCoverageResult[] = [];
  const missingPhonemes: string[] = [];
  const lowCoveragePhonemes: { phoneme: string; count: number }[] = [];
  
  // Analyze each phoneme
  for (const [category, phonemes] of Object.entries(TARGET_PHONEMES)) {
    if (category === 'clusters') continue; // Handle clusters separately
    
    for (const phoneme of phonemes) {
      const photoMatches = getWordsWithPhoneme(photoWords, phoneme);
      const audioMatches = getWordsWithPhoneme(audioWords, phoneme);
      const allMatches = [...new Set([...photoMatches, ...audioMatches])];
      
      // Get position breakdown
      const position = {
        initial: [] as string[],
        medial: [] as string[],
        final: [] as string[],
      };
      
      for (const word of allMatches) {
        const pos = getPhonemePosition(word, phoneme);
        if (pos) position[pos].push(word);
      }
      
      const result: PhonemeCoverageResult = {
        phoneme,
        category,
        photoWords: photoMatches,
        audioWords: audioMatches,
        totalWords: allMatches.length,
        hasPhoto: photoMatches.length > 0,
        position,
      };
      
      phonemeDetails.push(result);
      
      if (allMatches.length === 0) {
        missingPhonemes.push(phoneme);
      } else if (allMatches.length < 3) {
        lowCoveragePhonemes.push({ phoneme, count: allMatches.length });
      }
    }
  }
  
  // Calculate category stats
  const byCategory: Record<string, { covered: number; total: number; phonemes: string[] }> = {};
  for (const [category, phonemes] of Object.entries(TARGET_PHONEMES)) {
    if (category === 'clusters') continue;
    
    const covered = phonemes.filter(p => 
      getWordsWithPhoneme(allWords, p).length > 0
    ).length;
    
    byCategory[category] = {
      covered,
      total: phonemes.length,
      phonemes: phonemes.filter(p => getWordsWithPhoneme(allWords, p).length === 0),
    };
  }
  
  // Minimal pairs with photos
  const minimalPairsWithPhotos = MINIMAL_PAIRS.filter(pair => {
    const word1Photo = PHOTO_BANK.find(p => p.target.toLowerCase() === pair.word1.toLowerCase());
    const word2Photo = PHOTO_BANK.find(p => p.target.toLowerCase() === pair.word2.toLowerCase());
    return word1Photo && word2Photo;
  }).length;
  
  const coveredCount = allPhonemes.filter(p => 
    getWordsWithPhoneme(allWords, p).length > 0
  ).length;
  
  return {
    timestamp: new Date().toISOString(),
    totalPhonemes: allPhonemes.length,
    coveredPhonemes: coveredCount,
    coveragePercent: (coveredCount / allPhonemes.length) * 100,
    byCategory,
    missingPhonemes,
    lowCoveragePhonemes: lowCoveragePhonemes.sort((a, b) => a.count - b.count),
    photoWords: photoWords.length,
    audioWords: audioWords.length,
    totalUniqueWords: allWords.length,
    minimalPairsCount: MINIMAL_PAIRS.length,
    minimalPairsWithPhotos,
    phonemeDetails,
  };
}

export function printCoverageReport(report: CoverageReport): void {
  console.log('\n╔════════════════════════════════════════════════════════════════╗');
  console.log('║           PHONEME COVERAGE ANALYSIS REPORT                     ║');
  console.log('╚════════════════════════════════════════════════════════════════╝\n');
  
  console.log(`📊 OVERALL COVERAGE: ${report.coveragePercent.toFixed(1)}% (${report.coveredPhonemes}/${report.totalPhonemes} phonemes)`);
  console.log(`📷 Photo words: ${report.photoWords}`);
  console.log(`🔊 Audio-only words: ${report.audioWords}`);
  console.log(`📚 Total unique words: ${report.totalUniqueWords}`);
  console.log(`🔀 Minimal pairs: ${report.minimalPairsWithPhotos}/${report.minimalPairsCount} have photos\n`);
  
  console.log('─────────────────────────────────────────────────────────────────');
  console.log('COVERAGE BY CATEGORY:');
  console.log('─────────────────────────────────────────────────────────────────');
  
  for (const [category, stats] of Object.entries(report.byCategory)) {
    const pct = ((stats.covered / stats.total) * 100).toFixed(0);
    const bar = '█'.repeat(Math.round(stats.covered / stats.total * 20)) + '░'.repeat(20 - Math.round(stats.covered / stats.total * 20));
    console.log(`${category.padEnd(15)} ${bar} ${pct}% (${stats.covered}/${stats.total})`);
    if (stats.phonemes.length > 0) {
      console.log(`  ⚠️  Missing: ${stats.phonemes.join(', ')}`);
    }
  }
  
  if (report.missingPhonemes.length > 0) {
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('❌ MISSING PHONEMES (no words available):');
    console.log('─────────────────────────────────────────────────────────────────');
    console.log(report.missingPhonemes.join(', '));
  }
  
  if (report.lowCoveragePhonemes.length > 0) {
    console.log('\n─────────────────────────────────────────────────────────────────');
    console.log('⚠️  LOW COVERAGE PHONEMES (<3 words):');
    console.log('─────────────────────────────────────────────────────────────────');
    for (const { phoneme, count } of report.lowCoveragePhonemes) {
      const detail = report.phonemeDetails.find(d => d.phoneme === phoneme);
      const words = detail ? [...detail.photoWords, ...detail.audioWords].slice(0, 5) : [];
      console.log(`  ${phoneme}: ${count} word(s) → ${words.join(', ')}`);
    }
  }
  
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('POSITION COVERAGE (sample):');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Show position gaps for key phonemes
  const keyPhonemes = ['/r/', '/l/', '/s/', '/θ/', '/ð/', '/ʃ/', '/tʃ/', '/dʒ/'];
  for (const phoneme of keyPhonemes) {
    const detail = report.phonemeDetails.find(d => d.phoneme === phoneme);
    if (detail) {
      const init = detail.position.initial.length;
      const med = detail.position.medial.length;
      const fin = detail.position.final.length;
      console.log(`  ${phoneme.padEnd(6)} Initial: ${init.toString().padStart(2)}, Medial: ${med.toString().padStart(2)}, Final: ${fin.toString().padStart(2)}`);
    }
  }
  
  console.log('\n─────────────────────────────────────────────────────────────────');
  console.log('SUGGESTIONS:');
  console.log('─────────────────────────────────────────────────────────────────');
  
  // Generate suggestions
  const suggestions: string[] = [];
  
  if (report.missingPhonemes.includes('/ʒ/')) {
    suggestions.push("Add words for /ʒ/ (zh): 'measure', 'treasure', 'beige', 'garage'");
  }
  if (report.missingPhonemes.includes('/j/')) {
    suggestions.push("Add words for /j/ (y): 'yellow', 'yes', 'yo-yo', 'yard'");
  }
  
  // Check for position gaps
  for (const detail of report.phonemeDetails) {
    if (detail.totalWords >= 3 && detail.position.final.length === 0) {
      suggestions.push(`Add final position words for ${detail.phoneme}`);
    }
    if (detail.totalWords >= 3 && detail.position.initial.length === 0) {
      suggestions.push(`Add initial position words for ${detail.phoneme}`);
    }
  }
  
  if (suggestions.length === 0) {
    suggestions.push('✅ Coverage looks comprehensive!');
  }
  
  suggestions.slice(0, 5).forEach(s => console.log(`  • ${s}`));
  
  console.log('\n');
}

// Expose to window in dev
if (import.meta.env.DEV) {
  (window as any).__runPhonemeCoverageAnalysis = () => {
    const report = runPhonemeCoverageAnalysis();
    printCoverageReport(report);
    return report;
  };
}
