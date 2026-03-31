import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
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
  'easy': { text: 'Good start', className: 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400' },
  'medium': { text: 'Try me', className: 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400' },
  'challenge': { text: 'Challenge', className: 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400' },
};

const CATEGORY_LABELS: Record<GameCategory, string> = {
  'motor': '🖐️ Motor',
  'speech': '🗣️ Speech',
  'thinking': '🧠 Thinking',
};

const GAME_INFO: Record<string, GameInfo> = {
  'reach-tap': { emoji: '🎯', name: 'Tap Targets', desc: 'Tap the circles as they appear', difficulty: 'easy', category: 'motor' },
  'phrase-practice': { emoji: '🗣️', name: 'Say Phrases', desc: 'Practice saying phrases', difficulty: 'easy', category: 'speech' },
  'conversation-partner': { emoji: '🎙️', name: 'Free Talk', desc: 'Have a short conversation with a patient listener', difficulty: 'easy', category: 'speech' },
  'conversation-coach': { emoji: '✨', name: 'Smart Coach', desc: 'Chat with helpful exercises when you get stuck', difficulty: 'easy', category: 'speech' },
  'two-clues': { emoji: '🔗', name: 'Two Clues', desc: 'Say a word that connects 2 clues', difficulty: 'easy', category: 'speech' },
  'photo-naming': { emoji: '🖼️', name: 'Picture Naming', desc: 'Say the word for each picture', difficulty: 'medium', category: 'speech' },
  'left-side-hunt': { emoji: '⭐', name: 'Star Hunt', desc: 'Find stars on the left side', difficulty: 'medium', category: 'motor' },
  'phonological': { emoji: '🔤', name: 'Sound Games', desc: 'Practice word sounds', difficulty: 'medium', category: 'speech' },
  'semantic-features': { emoji: '🏷️', name: 'Word Features', desc: 'Describe what things are', difficulty: 'medium', category: 'thinking' },
  'pattern-match': { emoji: '🧩', name: 'Match Patterns', desc: 'Remember and match shapes', difficulty: 'challenge', category: 'thinking' },
  'sentence-construction': { emoji: '📝', name: 'Build Sentences', desc: 'Put words in order', difficulty: 'challenge', category: 'speech' },
  'minimal-pairs': { emoji: '👂', name: 'Minimal Pairs', desc: 'Hear and choose the right word', difficulty: 'medium', category: 'speech' },
  'fix-sentence': { emoji: '🔧', name: 'Fix the Sentence', desc: 'Find the wrong word and fix it', difficulty: 'easy', category: 'thinking' },
  'describe-guess': { emoji: '🔍', name: 'Describe & Guess', desc: 'Describe a picture so the app can guess', difficulty: 'medium', category: 'speech' },
  'detective-mind': { emoji: '🕵️', name: 'Detective Mind', desc: 'Solve mysteries by reading short stories', difficulty: 'medium', category: 'thinking' },
  'meaning-match': { emoji: '🏟️', name: 'Meaning Match', desc: 'Read a sentence and pick what it means', difficulty: 'easy', category: 'thinking' },
  'narrative-retell': { emoji: '📖', name: 'Narrative Retell', desc: 'Read a short story and retell it', difficulty: 'medium', category: 'thinking' },
  'abstract-compare': { emoji: '🔗', name: 'Abstract Comparison', desc: 'Explain how two things are similar', difficulty: 'challenge', category: 'thinking' },
  'multi-step-plan': { emoji: '📋', name: 'Step-by-Step Plan', desc: 'Plan the steps to complete a goal', difficulty: 'medium', category: 'thinking' },
  'dual-load-naming': { emoji: '🧠', name: 'Dual-Load Naming', desc: 'Remember words while naming pictures', difficulty: 'challenge', category: 'thinking' },
  'thought-continuation': { emoji: '💬', name: 'Finish the Thought', desc: 'Practice finishing sentences and ideas', difficulty: 'easy', category: 'speech' },
  'category-fluency': { emoji: '🐾', name: 'Category Fluency', desc: 'Name as many animals, foods, etc. as you can', difficulty: 'medium', category: 'speech' },
  'synonym-generator': { emoji: '🔄', name: 'Synonym Generator', desc: 'Think of words with similar meanings', difficulty: 'medium', category: 'thinking' },
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
  'conversation-partner': '/exercise/conversation-partner',
  'conversation-coach': '/exercise/conversation-coach',
  'two-clues': '/exercise/two-clues',
  'fix-sentence': '/exercise/fix-sentence',
  'describe-guess': '/exercise/describe-guess',
  'detective-mind': '/exercise/detective-mind',
  'meaning-match': '/exercise/meaning-match',
  'narrative-retell': '/exercise/narrative-retell',
  'abstract-compare': '/exercise/abstract-compare',
  'multi-step-plan': '/exercise/multi-step-plan',
  'dual-load-naming': '/exercise/dual-load-naming',
  'thought-continuation': '/exercise/thought-continuation',
};

interface GamePickerDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  userId?: string;
  profileId?: string;
}

export function GamePickerDialog({ open, onOpenChange, userId, profileId }: GamePickerDialogProps) {
  const navigate = useNavigate();

  const availableGames = Object.entries(GAME_INFO).map(([id, info]) => ({
    id,
    ...info,
  }));

  const handleSelectGame = (exerciseId: string) => {
    const route = EXERCISE_ROUTES[exerciseId];
    if (route) {
      onOpenChange(false);
      navigate(route, { 
        state: { 
          fromLesson: false,
          userId,
          profileId,
        }
      });
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-2xl">Choose a Game</DialogTitle>
          <DialogDescription>
            Pick any exercise you'd like to practice
          </DialogDescription>
        </DialogHeader>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-4">
          {availableGames.map((game) => {
            const difficultyInfo = DIFFICULTY_LABELS[game.difficulty];
            return (
              <button
                key={game.id}
                onClick={() => handleSelectGame(game.id)}
                className="rounded-xl border-2 border-border p-4 flex items-start gap-3 text-left
                  hover:border-primary hover:bg-accent/50 active:scale-[0.98] transition-all
                  min-h-[90px] touch-manipulation"
              >
                <span className="text-3xl">{game.emoji}</span>
                <div className="flex-1 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="font-semibold text-foreground">{game.name}</span>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${difficultyInfo.className}`}>
                      {difficultyInfo.text}
                    </span>
                  </div>
                  <span className="text-sm text-muted-foreground block">{game.desc}</span>
                  <span className="text-xs text-muted-foreground/70">{CATEGORY_LABELS[game.category]}</span>
                </div>
              </button>
            );
          })}
        </div>
      </DialogContent>
    </Dialog>
  );
}
