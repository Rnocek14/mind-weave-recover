import { memo } from "react";
import { Card } from "@/components/ui/card";
import { useNavigate } from "react-router-dom";

type GameDifficulty = 'easy' | 'medium' | 'challenge';
type GameCategory = 'motor' | 'speech' | 'thinking';

interface GameInfo {
  emoji: string;
  name: string;
  desc: string;
  difficulty: GameDifficulty;
  category: GameCategory;
}

const DIFFICULTY_LABELS: Record<GameDifficulty, { text: string; className: string }> = {
  easy: { text: 'Good start', className: 'bg-success/10 text-success' },
  medium: { text: 'Try me', className: 'bg-primary/10 text-primary' },
  challenge: { text: 'Challenge', className: 'bg-warning/10 text-warning' },
};

const CATEGORY_LABELS: Record<GameCategory, string> = {
  motor: '🖐️ Motor',
  speech: '🗣️ Speech',
  thinking: '🧠 Thinking',
};

const PATIENT_GAME_INFO: Record<string, GameInfo> = {
  'reach-tap': { emoji: '🎯', name: 'Tap Targets', desc: 'Tap the circles as they appear', difficulty: 'easy', category: 'motor' },
  'phrase-practice': { emoji: '🗣️', name: 'Say Phrases', desc: 'Practice saying phrases', difficulty: 'easy', category: 'speech' },
  'two-clues': { emoji: '🔗', name: 'Two Clues', desc: 'Say a word that connects 2 clues', difficulty: 'easy', category: 'speech' },
  'photo-naming': { emoji: '🖼️', name: 'Picture Naming', desc: 'Say the word for each picture', difficulty: 'medium', category: 'speech' },
  'left-side-hunt': { emoji: '⭐', name: 'Star Hunt', desc: 'Find stars on the left side', difficulty: 'medium', category: 'motor' },
  'phonological': { emoji: '🔤', name: 'Sound Games', desc: 'Practice word sounds', difficulty: 'medium', category: 'speech' },
  'semantic-features': { emoji: '🏷️', name: 'Word Features', desc: 'Describe what things are', difficulty: 'medium', category: 'thinking' },
  'pattern-match': { emoji: '🧩', name: 'Match Patterns', desc: 'Remember and match shapes', difficulty: 'challenge', category: 'thinking' },
  'sentence-construction': { emoji: '📝', name: 'Build Sentences', desc: 'Put words in order', difficulty: 'challenge', category: 'speech' },
  'minimal-pairs': { emoji: '👂', name: 'Minimal Pairs', desc: 'Hear and choose the right word', difficulty: 'medium', category: 'speech' },
  'detective-mind': { emoji: '🔍', name: 'Detective Mind', desc: 'Solve clues and figure things out', difficulty: 'challenge', category: 'thinking' },
  'meaning-match': { emoji: '💡', name: 'Meaning Match', desc: 'Match words with their meanings', difficulty: 'easy', category: 'thinking' },
  'narrative-retell': { emoji: '📖', name: 'Story Retell', desc: 'Listen to a story and retell it', difficulty: 'challenge', category: 'speech' },
  'abstract-compare': { emoji: '⚖️', name: 'Compare Ideas', desc: 'Find what things have in common', difficulty: 'challenge', category: 'thinking' },
  'multi-step-plan': { emoji: '📋', name: 'Plan Steps', desc: 'Put steps in the right order', difficulty: 'medium', category: 'thinking' },
  'dual-load-naming': { emoji: '🔄', name: 'Quick Name', desc: 'Name things while multitasking', difficulty: 'challenge', category: 'speech' },
  'conversation-partner': { emoji: '🎙️', name: 'Free Talk', desc: 'Have a short conversation', difficulty: 'easy', category: 'speech' },
  'conversation-coach': { emoji: '✨', name: 'Smart Coach', desc: 'Chat with helpful exercises', difficulty: 'easy', category: 'speech' },
  'fix-sentence': { emoji: '🔧', name: 'Fix the Sentence', desc: 'Find the wrong word and fix it', difficulty: 'easy', category: 'thinking' },
  'describe-guess': { emoji: '🔍', name: 'Describe & Guess', desc: 'Describe a picture so the app can guess', difficulty: 'medium', category: 'speech' },
  'thought-continuation': { emoji: '💬', name: 'Finish the Thought', desc: 'Practice finishing sentences and ideas', difficulty: 'easy', category: 'speech' },
};

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
};

interface PatientPracticeViewProps {
  userId: string;
  profileId: string;
}

/**
 * Full game picker as its own patient tab.
 * Large touch targets, emoji-led cards, clear descriptions.
 */
export const PatientPracticeView = memo(function PatientPracticeView({
  userId,
  profileId,
}: PatientPracticeViewProps) {
  const navigate = useNavigate();
  const availableGames = Object.entries(PATIENT_GAME_INFO).map(([id, info]) => ({
    id,
    ...info,
  }));

  const handleSelectGame = (exerciseId: string) => {
    const route = EXERCISE_ROUTES[exerciseId];
    if (route) {
      navigate(route, {
        state: { fromLesson: false, userId, profileId },
      });
    }
  };

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="text-center py-2">
        <p className="text-sm font-medium text-muted-foreground uppercase tracking-wide">Choose an exercise</p>
        <h2 className="text-xl md:text-2xl font-bold text-foreground mt-1">
          Pick a Game
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Any exercise you'd like to practice
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pb-2">
        {availableGames.map((game) => {
          const difficultyInfo = DIFFICULTY_LABELS[game.difficulty];
          return (
            <button
              key={game.id}
              onClick={() => handleSelectGame(game.id)}
              className="rounded-xl border-2 border-border p-4 flex items-start gap-4 text-left
                hover:border-primary hover:bg-accent/50 
                active:scale-[0.97] active:bg-accent/60
                transition-all duration-150 ease-out
                min-h-[88px] touch-manipulation select-none"
            >
              <span className="text-4xl leading-none mt-0.5">{game.emoji}</span>
              <div className="flex-1 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground text-base leading-tight">
                    {game.name}
                  </span>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyInfo.className}`}
                  >
                    {difficultyInfo.text}
                  </span>
                </div>
                <span className="text-sm text-muted-foreground block leading-snug">
                  {game.desc}
                </span>
                <span className="text-xs text-muted-foreground/70">
                  {CATEGORY_LABELS[game.category]}
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
});
