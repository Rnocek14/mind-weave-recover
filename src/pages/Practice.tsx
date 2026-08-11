/**
 * Practice — Free exercise picker with smart suggestions + browse all
 * 
 * Shows 2-3 recommended games based on patient intelligence,
 * then full browsable grid grouped by skill domain.
 */

import React, { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Sparkles, Loader2, LayoutDashboard } from 'lucide-react';
import { PatientTabBar } from '@/components/PatientTabBar';
import { Button } from '@/components/ui/button';
import { useAuth } from '@/hooks/useAuth';
import { useProfile } from '@/hooks/useProfile';
import { usePatientIntelligence } from '@/hooks/usePatientIntelligence';
import { useKidsMode } from '@/contexts/KidsModeContext';
import { loadPet, getPetStage } from '@/lib/kidsPet';
import { getTodaysPracticedWords } from '@/lib/reviewQueue';

type GameDifficulty = 'easy' | 'medium' | 'challenge';
type GameCategory = 'motor' | 'speech' | 'thinking';

interface GameInfo {
  id: string;
  emoji: string;
  name: string;
  desc: string;
  difficulty: GameDifficulty;
  category: GameCategory;
  domain: string;
}

const DIFFICULTY_LABELS: Record<GameDifficulty, { text: string; className: string }> = {
  easy: { text: 'Good start', className: 'bg-primary/10 text-primary' },
  medium: { text: 'Try me', className: 'bg-accent text-accent-foreground' },
  challenge: { text: 'Challenge', className: 'bg-muted text-muted-foreground' },
};

const ALL_GAMES: GameInfo[] = [
  { id: 'photo-naming', emoji: '🖼️', name: 'Picture Naming', desc: 'Say the word for each picture', difficulty: 'medium', category: 'speech', domain: 'Word Finding' },
  { id: 'two-clues', emoji: '🔗', name: 'Two Clues', desc: 'Say a word that connects 2 clues', difficulty: 'easy', category: 'speech', domain: 'Word Finding' },
  { id: 'describe-guess', emoji: '🔍', name: 'Describe & Guess', desc: 'Describe a picture so the app can guess', difficulty: 'medium', category: 'speech', domain: 'Word Finding' },
  { id: 'category-fluency', emoji: '🐾', name: 'Category Fluency', desc: 'Name as many as you can in a category', difficulty: 'medium', category: 'speech', domain: 'Word Finding' },
  { id: 'sentence-construction', emoji: '📝', name: 'Build Sentences', desc: 'Put words in order', difficulty: 'challenge', category: 'speech', domain: 'Sentence Building' },
  { id: 'fix-sentence', emoji: '🔧', name: 'Fix the Sentence', desc: 'Find the wrong word and fix it', difficulty: 'easy', category: 'thinking', domain: 'Sentence Building' },
  { id: 'thought-continuation', emoji: '💬', name: 'Finish the Thought', desc: 'Practice finishing sentences', difficulty: 'easy', category: 'speech', domain: 'Sentence Building' },
  { id: 'semantic-features', emoji: '🏷️', name: 'Word Features', desc: 'Describe what things are', difficulty: 'medium', category: 'thinking', domain: 'Understanding' },
  { id: 'meaning-match', emoji: '💡', name: 'Meaning Match', desc: 'Match words with meanings', difficulty: 'easy', category: 'thinking', domain: 'Understanding' },
  { id: 'synonym-generator', emoji: '🔄', name: 'Synonym Generator', desc: 'Think of similar words', difficulty: 'medium', category: 'thinking', domain: 'Understanding' },
  { id: 'detective-mind', emoji: '🕵️', name: 'Detective Mind', desc: 'Solve mysteries from short stories', difficulty: 'medium', category: 'thinking', domain: 'Thinking Skills' },
  { id: 'abstract-compare', emoji: '⚖️', name: 'Compare Ideas', desc: 'Find what things have in common', difficulty: 'challenge', category: 'thinking', domain: 'Thinking Skills' },
  { id: 'multi-step-plan', emoji: '📋', name: 'Plan Steps', desc: 'Put steps in the right order', difficulty: 'medium', category: 'thinking', domain: 'Thinking Skills' },
  { id: 'dual-load-naming', emoji: '🧠', name: 'Quick Name', desc: 'Name things while multitasking', difficulty: 'challenge', category: 'speech', domain: 'Thinking Skills' },
  { id: 'phonological', emoji: '🔤', name: 'Sound Games', desc: 'Practice word sounds', difficulty: 'medium', category: 'speech', domain: 'Sound Skills' },
  { id: 'minimal-pairs', emoji: '👂', name: 'Minimal Pairs', desc: 'Hear and choose the right word', difficulty: 'medium', category: 'speech', domain: 'Sound Skills' },
  { id: 'narrative-retell', emoji: '📖', name: 'Story Retell', desc: 'Listen and retell a story', difficulty: 'challenge', category: 'speech', domain: 'Conversation' },
  { id: 'conversation-partner', emoji: '🎙️', name: 'Free Talk', desc: 'Have a short conversation', difficulty: 'easy', category: 'speech', domain: 'Conversation' },
  { id: 'conversation-coach', emoji: '✨', name: 'Smart Coach', desc: 'Chat with helpful exercises', difficulty: 'easy', category: 'speech', domain: 'Conversation' },
  { id: 'reach-tap', emoji: '🎯', name: 'Tap Targets', desc: 'Tap circles as they appear', difficulty: 'easy', category: 'motor', domain: 'Motor' },
  { id: 'left-side-hunt', emoji: '⭐', name: 'Star Hunt', desc: 'Find stars on the left side', difficulty: 'medium', category: 'motor', domain: 'Motor' },
  { id: 'pattern-match', emoji: '🧩', name: 'Match Patterns', desc: 'Remember and match shapes', difficulty: 'challenge', category: 'thinking', domain: 'Motor' },
  { id: 'phrase-practice', emoji: '🗣️', name: 'Say Phrases', desc: 'Practice saying phrases', difficulty: 'easy', category: 'speech', domain: 'Word Finding' },
];

const EXERCISE_ROUTES: Record<string, string> = {
  'photo-naming': '/exercise/photo-naming',
  'reach-tap': '/exercise/reach-tap',
  'left-side-hunt': '/exercise/left-side-hunt',
  'pattern-match': '/exercise/pattern-match',
  'phonological': '/exercise/phonological-awareness',
  'semantic-features': '/exercise/semantic-features',
  'sentence-construction': '/exercise/sentence-construction',
  'phrase-practice': '/exercise/word-practice',
  'minimal-pairs': '/exercise/minimal-pairs',
  'two-clues': '/exercise/two-clues',
  'detective-mind': '/exercise/detective-mind',
  'meaning-match': '/exercise/meaning-match',
  'narrative-retell': '/exercise/narrative-retell',
  'abstract-compare': '/exercise/abstract-compare',
  'multi-step-plan': '/exercise/multi-step-plan',
  'dual-load-naming': '/exercise/dual-load-naming',
  'conversation-partner': '/exercise/conversation-partner',
  'conversation-coach': '/exercise/conversation-coach',
  'fix-sentence': '/exercise/fix-sentence',
  'describe-guess': '/exercise/describe-guess',
  'thought-continuation': '/exercise/thought-continuation',
  'category-fluency': '/exercise/category-fluency',
  'synonym-generator': '/exercise/synonym-generator',
};

const DOMAIN_ORDER = ['Word Finding', 'Sentence Building', 'Understanding', 'Thinking Skills', 'Sound Skills', 'Conversation', 'Motor'];

function getSmartSuggestions(profile: any): GameInfo[] {
  // Default suggestions if no profile data
  const defaults = ['photo-naming', 'two-clues', 'fix-sentence'];
  
  if (!profile || profile.sessionCount < 2) {
    return ALL_GAMES.filter(g => defaults.includes(g.id));
  }

  const suggestions: GameInfo[] = [];
  
  // If they struggle with phonemes, suggest sound games
  if (profile.persistentPhonemeErrors?.length > 0) {
    const soundGame = ALL_GAMES.find(g => g.id === 'phonological');
    if (soundGame) suggestions.push(soundGame);
  }
  
  // If they struggle with words, suggest naming exercises
  if (profile.persistentStruggledWords?.length > 0) {
    const naming = ALL_GAMES.find(g => g.id === 'photo-naming');
    if (naming) suggestions.push(naming);
  }
  
  // If circumlocution tendency is high, suggest sentence building
  if (profile.circumlocutionTendency === 'high') {
    const sent = ALL_GAMES.find(g => g.id === 'sentence-construction');
    if (sent) suggestions.push(sent);
  }

  // Fill up to 3 with defaults
  for (const id of defaults) {
    if (suggestions.length >= 3) break;
    if (!suggestions.find(s => s.id === id)) {
      const game = ALL_GAMES.find(g => g.id === id);
      if (game) suggestions.push(game);
    }
  }

  return suggestions.slice(0, 3);
}

export default function Practice() {
  const navigate = useNavigate();
  const { user, loading: authLoading } = useAuth();
  const { activeProfile } = useProfile();
  const { profile: intelligence, isLoading: intellLoading } = usePatientIntelligence(user?.id, activeProfile?.id);
  const { kidsMode } = useKidsMode();

  const suggestions = useMemo(() => getSmartSuggestions(intelligence), [intelligence]);

  const groupedGames = useMemo(() => {
    const groups: Record<string, GameInfo[]> = {};
    for (const domain of DOMAIN_ORDER) {
      const games = ALL_GAMES.filter(g => g.domain === domain);
      if (games.length > 0) groups[domain] = games;
    }
    return groups;
  }, []);

  const handleSelect = (gameId: string) => {
    const route = EXERCISE_ROUTES[gameId];
    if (route) {
      navigate(route, {
        state: { fromLesson: false, userId: user?.id, profileId: activeProfile?.id },
      });
    }
  };

  if (authLoading) {
    return (
      <div className="min-h-dvh bg-background flex items-center justify-center">
        <Loader2 className="w-8 h-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="min-h-dvh bg-background flex flex-col pb-44">
      {/* Header */}
      <div className="flex items-center gap-3 p-4 border-b border-border">
        <Button variant="ghost" size="icon" aria-label="Back to home" onClick={() => navigate("/today")} className="shrink-0">
          <ArrowLeft className="w-5 h-5" />
        </Button>
        <div>
          <h1 className="text-lg font-bold text-foreground">Practice Games</h1>
          <p className="text-xs text-muted-foreground">Pick any exercise to practice</p>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-6 max-w-lg mx-auto w-full">
        {/* Kids Mode: Feed the Monster entry — invisible in adult mode */}
        {kidsMode && (
          <button
            onClick={() => navigate('/exercise/feed-the-monster')}
            className="w-full rounded-3xl border-2 border-secondary/40 bg-gradient-celebrate/10 shadow-card p-4 flex items-center gap-4 text-left transition-transform hover:scale-[1.01]"
          >
            <span className="text-5xl kids-monster-idle" aria-hidden>👾</span>
            <span className="flex-1">
              <span className="block text-lg font-bold text-foreground">Feed the Monster!</span>
              <span className="block text-sm text-muted-foreground">
                Say the words to feed Momo — your pet {getPetStage(loadPet().xp).emoji} grows too!
              </span>
            </span>
            <span className="text-2xl" aria-hidden>→</span>
          </button>
        )}

        {/* Post-practice review conversation (adult + kids): appears once
            today's games have produced words worth talking about. */}
        {getTodaysPracticedWords().length > 0 && (
          <button
            onClick={() => navigate('/review-chat')}
            className="w-full rounded-2xl border-2 border-primary/30 bg-primary/5 shadow-card p-4 flex items-center gap-4 text-left transition-transform hover:scale-[1.01]"
          >
            <span className="text-4xl" aria-hidden>💬</span>
            <span className="flex-1">
              <span className="block text-base font-bold text-foreground">Chat about today&apos;s words</span>
              <span className="block text-sm text-muted-foreground">
                A quick conversation with Maya using what you just practiced
              </span>
            </span>
            <span className="text-xl" aria-hidden>→</span>
          </button>
        )}

        {/* Smart suggestions */}
        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Suggested for you</h2>
          </div>
          {intellLoading ? (
            <div className="flex justify-center py-4">
              <Loader2 className="w-5 h-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-2">
              {suggestions.map(game => (
                <button
                  key={game.id}
                  onClick={() => handleSelect(game.id)}
                  className="rounded-xl border-2 border-primary/20 bg-primary/5 p-4 flex items-center gap-4 text-left
                    hover:border-primary hover:bg-primary/10
                    active:scale-[0.97] transition-all duration-150 ease-out
                    min-h-[72px] touch-manipulation select-none"
                >
                  <span className="text-3xl leading-none">{game.emoji}</span>
                  <div className="flex-1">
                    <span className="font-semibold text-foreground text-base">{game.name}</span>
                    <span className="text-sm text-muted-foreground block">{game.desc}</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Adaptive Session */}
        <button
          onClick={() => navigate('/today')}
          className="w-full rounded-xl border-2 border-border p-4 flex items-center gap-4 text-left
            hover:border-primary hover:bg-accent/50
            active:scale-[0.97] transition-all duration-150 ease-out
            touch-manipulation select-none"
        >
          <LayoutDashboard className="w-8 h-8 text-muted-foreground shrink-0" />
          <div>
            <span className="font-semibold text-foreground text-base block">Adaptive Session</span>
            <span className="text-sm text-muted-foreground">Structured lesson with multiple exercises</span>
          </div>
        </button>

        {/* All games by domain */}
        {Object.entries(groupedGames).map(([domain, games]) => (
          <div key={domain} className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">{domain}</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {games.map(game => {
                const diff = DIFFICULTY_LABELS[game.difficulty];
                return (
                  <button
                    key={game.id}
                    onClick={() => handleSelect(game.id)}
                    className="rounded-xl border-2 border-border p-3 flex items-center gap-3 text-left
                      hover:border-primary hover:bg-accent/50
                      active:scale-[0.97] transition-all duration-150 ease-out
                      min-h-[64px] touch-manipulation select-none"
                  >
                    <span className="text-2xl leading-none">{game.emoji}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className="font-medium text-foreground text-sm">{game.name}</span>
                        <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${diff.className}`}>
                          {diff.text}
                        </span>
                      </div>
                      <span className="text-xs text-muted-foreground block truncate">{game.desc}</span>
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        ))}
      </div>

      <PatientTabBar />
    </div>
  );
}
