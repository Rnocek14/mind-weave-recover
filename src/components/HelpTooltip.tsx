import { useHelpMode } from '@/contexts/HelpModeContext';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';
import { HelpCircle } from 'lucide-react';

interface HelpTooltipProps {
  term: string;
  children?: React.ReactNode;
}

/**
 * Glossary of explanations for complex terms.
 * Add new terms here — they'll automatically get ? icons when help mode is on.
 */
const GLOSSARY: Record<string, string> = {
  // Adaptation & Coverage
  'Strong Adaptation': 'These exercises change their content based on your speech profile — like which sounds to practice or which hints to give.',
  'Partial Adaptation': 'These exercises adjust difficulty based on your level, but don\'t yet personalize the specific sounds or hints.',
  'Telemetry Only': 'These exercises record your performance for analysis but don\'t yet change their content based on your profile.',
  'Adaptation Coverage': 'Shows how many exercises actually personalize based on your speech profile vs. those that don\'t yet.',
  'Adapted': 'This exercise changes what it shows you based on your speech profile and performance history.',
  'Non-Adapted': 'This exercise doesn\'t yet change its content based on your profile — it plays the same for everyone.',

  // Speech Profile
  'Focus Phonemes': 'Specific speech sounds (like /s/ or /r/) that the system has identified as challenging for you, based on your practice history.',
  'Phoneme': 'A single speech sound — for example, the /s/ in "sun" or the /r/ in "red".',
  'Phoneme Difficulty Map': 'A breakdown of how well you produce each speech sound, based on accuracy across multiple practice sessions.',
  'Cue Efficacy': 'How well different types of hints help you find the right word. The system tracks which hint styles work best for you.',
  'Recommended Cue Type': 'The type of hint (e.g., first-sound hint vs. meaning-based hint) that has been most helpful for you so far.',
  'Error Distribution': 'A breakdown of the types of mistakes made — like mixing up similar-sounding words vs. similar-meaning words.',
  'Challenging Categories': 'Word categories (like animals, tools, food) where you tend to have more difficulty.',
  'Difficulty Tier': 'The current difficulty level the system has chosen for you, based on your recent performance.',

  // Session & Performance
  'Learning Rate': 'How quickly your accuracy is improving over time in a specific area. A positive slope means you\'re getting better.',
  'Accuracy': 'The percentage of correct responses out of all attempts in an exercise.',
  'Reaction Time': 'How long it takes you to respond after seeing or hearing a prompt. Faster times often indicate stronger recall.',
  'Trial Count': 'The number of individual attempts or responses recorded — more trials means more reliable data.',
  'Confidence Level': 'How reliable the system\'s assessment is, based on the amount of data collected. More data = higher confidence.',
  'Recency Penalty': 'The system avoids repeating the same exercises too often by reducing their selection score if done recently.',

  // Clinical
  'Speech Profile': 'A personalized model of your speech patterns built from your practice sessions — it tracks which sounds are hard, which hints help, and how you\'re progressing.',
  'Clinical Profile': 'Medical information about your condition that helps the system choose appropriate exercises and difficulty levels.',
  'Profile Freshness': 'How recently your speech profile was updated. A fresh profile means the system is using your latest performance data.',
  'Stale Profile': 'Your speech profile hasn\'t been updated recently — the system may not reflect your most current abilities.',
  'Domain': 'A broad area of recovery, such as language, motor skills, attention, or memory.',
  'Spaced Repetition': 'A learning technique where items are reviewed at increasing intervals to strengthen long-term memory.',

  // Dashboard
  'Streak': 'The number of consecutive days you\'ve completed at least one practice session.',
  'Daily Dose': 'The recommended amount of practice for today, adjusted based on your energy level and recent performance.',
  'Dose Target': 'The prescribed amount of practice (in minutes or repetitions) recommended for a specific recovery area.',
  'Recovery Domain': 'A specific area of recovery being tracked, like expressive language, attention, or motor control.',
  'Fatigue Sensitivity': 'How much your performance drops when you\'re tired — the system uses this to adjust session length.',
  'Transfer Index': 'A measure of whether improvements in practice exercises are carrying over to real-world communication.',

  // Insights
  'Semantic Error': 'Saying a related but wrong word — like "cat" instead of "dog". These are meaning-based mix-ups.',
  'Phonological Error': 'Saying a similar-sounding but wrong word — like "bat" instead of "cat". These are sound-based mix-ups.',
  'GOP Score': 'Goodness of Pronunciation — a technical measure of how closely your speech matches the expected pronunciation.',
  'Adaptation Event': 'A moment when the system changed something (difficulty, hints, content) based on your performance.',
  'Primary Domains': 'The main recovery areas the system is focusing on for your current sessions.',
  'Session Duration Cap': 'The maximum session length set to prevent fatigue — shorter if you\'re tired, longer if you\'re doing well.',

  // Adaptation Engine & Evidence
  'Adaptation Rate': 'The percentage of exercise trials where the system actively changed something (content, difficulty, or hints) based on your profile.',
  'Telemetry Coverage': 'How many of your exercise trials included tracking data. Higher coverage means the system has better insight into your performance.',
  'Games Adapted': 'How many different exercises had active personalization applied during the time window.',
  'Dominant Mode': 'The most common type of adaptation the system used — e.g., targeting specific sounds, personalizing hints, or adjusting difficulty.',
  'Adaptation Engine': 'The part of the system that decides how to change exercises in real time based on your speech profile and performance.',
  'Top Coverage Gaps': 'Exercises where the system has limited data or hasn\'t been able to personalize effectively yet.',
  'Mode Distribution': 'A breakdown of which adaptation strategies were used and how often — such as phoneme targeting vs. cue personalization.',
  'Data Quality': 'An assessment of whether the tracking data is complete and reliable enough to make good adaptation decisions.',
  'Outcome Comparison': 'Compares your accuracy on exercises that were personalized vs. those that weren\'t, to see if adaptation is helping.',
  'Cross-Game Evidence': 'A detailed table showing how adaptation worked across every exercise — which sounds were targeted, which hints were used, and at what difficulty.',
};

export function HelpTooltip({ term, children }: HelpTooltipProps) {
  const { helpMode } = useHelpMode();

  if (!helpMode) return null;

  const explanation = GLOSSARY[term];
  if (!explanation) return null;

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            className="inline-flex items-center justify-center w-4 h-4 rounded-full text-muted-foreground hover:text-foreground hover:bg-accent transition-colors ml-1 align-middle"
            aria-label={`Help: ${term}`}
          >
            <HelpCircle className="w-3.5 h-3.5" />
          </button>
        </TooltipTrigger>
        <TooltipContent
          side="top"
          className="max-w-[280px] text-sm leading-relaxed"
        >
          {children || explanation}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}

/**
 * Inline wrapper: renders label + help icon together.
 * Usage: <HelpLabel term="Focus Phonemes">Focus Phonemes</HelpLabel>
 */
export function HelpLabel({ term, children }: { term: string; children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center">
      {children}
      <HelpTooltip term={term} />
    </span>
  );
}
