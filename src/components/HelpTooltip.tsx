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
  'Adaptation Rate': 'The percentage of exercise trials where the system actively changed something (content, difficulty, or hints) based on your profile.',
  'Adaptation Engine': 'The part of the system that decides how to change exercises in real time based on your speech profile and performance.',
  'Adaptation Event': 'A moment when the system changed something (difficulty, hints, content) based on your performance.',
  'Dominant Mode': 'The most common type of adaptation the system used — e.g., targeting specific sounds, personalizing hints, or adjusting difficulty.',
  'Mode Distribution': 'A breakdown of which adaptation strategies were used and how often — such as phoneme targeting vs. cue personalization.',
  'Top Coverage Gaps': 'Exercises where the system has limited data or hasn\'t been able to personalize effectively yet.',
  'Games Adapted': 'How many different exercises had active personalization applied during the time window.',

  // Speech Profile & Phonemes
  'Speech Profile': 'A personalized model of your speech patterns built from your practice sessions — it tracks which sounds are hard, which hints help, and how you\'re progressing.',
  'Focus Phonemes': 'Specific speech sounds (like /s/ or /r/) that the system has identified as challenging for you, based on your practice history.',
  'Phoneme': 'A single speech sound — for example, the /s/ in "sun" or the /r/ in "red".',
  'Phoneme Difficulty Map': 'A breakdown of how well you produce each speech sound, based on accuracy across multiple practice sessions.',
  'Phoneme Targets': 'The specific sounds the system is focusing on in your exercises right now.',
  'Phonological Error': 'Saying a similar-sounding but wrong word — like "bat" instead of "cat". These are sound-based mix-ups.',
  'Phonological Similarity': 'A score measuring how similar two words sound — higher means the mistake was close to the right answer.',
  'GOP Score': 'Goodness of Pronunciation — a technical measure of how closely your speech matches the expected pronunciation.',
  'Profile Freshness': 'How recently your speech profile was updated. A fresh profile means the system is using your latest performance data.',
  'Stale Profile': 'Your speech profile hasn\'t been updated recently — the system may not reflect your most current abilities.',

  // Cues & Hints
  'Cue Efficacy': 'How well different types of hints help you find the right word. The system tracks which hint styles work best for you.',
  'Recommended Cue Type': 'The type of hint (e.g., first-sound hint vs. meaning-based hint) that has been most helpful for you so far.',
  'Cue Types': 'The different kinds of hints the system can give: sound hints (first letter), meaning hints (category), or the full word.',
  'Semantic Cue': 'A hint about what category or meaning a word belongs to — like "it\'s an animal" for the word "dog".',
  'Phonemic Cue': 'A hint about how a word starts or sounds — like "it starts with /d/" for the word "dog".',
  'Full Word Model': 'Hearing the complete word so you can repeat it — the strongest level of support.',
  'Cue Level': 'How much help was given: 0 = no hint, 1 = meaning hint, 2 = sound hint, 3 = full word.',
  'Cue Ladder': 'The sequence of increasingly helpful hints — starting with no help, then meaning hints, sound hints, and finally the full word.',

  // Error Types
  'Error Distribution': 'A breakdown of the types of mistakes made — like mixing up similar-sounding words vs. similar-meaning words.',
  'Semantic Error': 'Saying a related but wrong word — like "cat" instead of "dog". These are meaning-based mix-ups.',
  'Error Type': 'The category of mistake made — such as sound mix-up, meaning mix-up, no response, or self-correction.',
  'Error Classification': 'The system\'s analysis of what type of mistake was made and how confident it is in that classification.',
  'Classification Confidence': 'How sure the system is about its analysis of what type of error occurred (0–100%).',
  'Semantic Similarity': 'A score measuring how related two words are in meaning — higher means the words are closely related.',
  'Needs Review': 'The system flagged this response for a clinician to double-check because it wasn\'t confident in its analysis.',
  'Self-Corrected': 'You caught and fixed your own mistake — a sign of good self-monitoring skills.',

  // Session & Performance
  'Accuracy': 'The percentage of correct responses out of all attempts in an exercise.',
  'Reaction Time': 'How long it takes you to respond after seeing or hearing a prompt. Faster times often indicate stronger recall.',
  'Trial': 'A single attempt at answering a question or completing a task within an exercise.',
  'Trial Count': 'The number of individual attempts or responses recorded — more trials means more reliable data.',
  'Round': 'One complete pass through a set of exercise items — you might do multiple rounds in a session.',
  'Score': 'How well you did on a trial — 100 means correct, 0 means incorrect.',
  'Learning Rate': 'How quickly your accuracy is improving over time in a specific area. A positive slope means you\'re getting better.',
  'Accuracy Slope': 'The mathematical trend of your accuracy over time — positive means improving, negative means declining.',
  'RT Slope': 'The trend in your response speed over time — a negative slope means you\'re getting faster (which is good).',
  'Confidence Level': 'How reliable the system\'s assessment is, based on the amount of data collected. More data = higher confidence.',
  'Recency Penalty': 'The system avoids repeating the same exercises too often by reducing their selection score if done recently.',
  'Streak': 'The number of consecutive days you\'ve completed at least one practice session.',

  // Telemetry & Data
  'Telemetry': 'The performance data automatically collected during your exercises — like accuracy, speed, and error types.',
  'Telemetry Coverage': 'How many of your exercise trials included tracking data. Higher coverage means the system has better insight into your performance.',
  'Data Quality': 'An assessment of whether the tracking data is complete and reliable enough to make good adaptation decisions.',
  'Task Parameters': 'The settings the system used for a specific exercise trial — like difficulty level, target words, or time limits.',
  'Exercise Events': 'Individual records of each trial you completed, including what happened, how you responded, and how long it took.',
  'Inputs': 'What was presented to you in a trial — the target word, image, or prompt.',
  'Outputs': 'What the system recorded about your response — your answer, timing, and any analysis results.',
  'Exercise Slug': 'The internal name the system uses to identify a specific exercise type.',
  'Session ID': 'A unique identifier for each practice session — used to group related exercise trials together.',
  'Engagement Flags': 'Signals the system detected about your focus or fatigue during practice — like long pauses or declining accuracy.',

  // Audio & Speech Recognition
  'Whisper Transcript': 'The text version of what the AI speech recognition heard you say.',
  'Whisper Confidence': 'How sure the speech recognition system is about what it heard (0–100%). Lower confidence means it may have misheard.',
  'Acoustic Metrics': 'Measurements of your speech patterns — like how fast you talked, how many pauses you took, and how long each pause was.',
  'Speech Rate': 'How many words per minute you spoke — helps track fluency over time.',
  'Pause Count': 'How many pauses occurred during your speech — frequent pauses might indicate word-finding difficulty.',
  'Speech to Pause Ratio': 'The balance between talking and pausing — a higher ratio means more fluent speech.',
  'Browser Transcript': 'What your browser\'s built-in speech recognition heard — used as a quick first check before the more accurate AI analysis.',
  'Audio Storage Path': 'Where your voice recording is saved — used by clinicians to review your actual speech.',
  'Recording Duration': 'How long your voice recording lasted in milliseconds.',

  // Clinical
  'Clinical Profile': 'Medical information about your condition that helps the system choose appropriate exercises and difficulty levels.',
  'Domain': 'A broad area of recovery, such as language, motor skills, attention, or memory.',
  'Recovery Domain': 'A specific area of recovery being tracked, like expressive language, attention, or motor control.',
  'Primary Domains': 'The main recovery areas the system is focusing on for your current sessions.',
  'Challenging Categories': 'Word categories (like animals, tools, food) where you tend to have more difficulty.',
  'Difficulty Tier': 'The current difficulty level the system has chosen for you, based on your recent performance.',
  'Spaced Repetition': 'A learning technique where items are reviewed at increasing intervals to strengthen long-term memory.',

  // Dashboard
  'Daily Dose': 'The recommended amount of practice for today, adjusted based on your energy level and recent performance.',
  'Dose Target': 'The prescribed amount of practice (in minutes or repetitions) recommended for a specific recovery area.',
  'Fatigue Sensitivity': 'How much your performance drops when you\'re tired — the system uses this to adjust session length.',
  'Transfer Index': 'A measure of whether improvements in practice exercises are carrying over to real-world communication.',
  'Session Duration Cap': 'The maximum session length set to prevent fatigue — shorter if you\'re tired, longer if you\'re doing well.',

  // Insights & Analysis
  'Outcome Comparison': 'Compares your accuracy on exercises that were personalized vs. those that weren\'t, to see if adaptation is helping.',
  'Cross-Game Evidence': 'A detailed table showing how adaptation worked across every exercise — which sounds were targeted, which hints were used, and at what difficulty.',
  'Coverage Gaps': 'Exercises where the system doesn\'t have enough data or hasn\'t been able to personalize — these are opportunities for improvement.',
  'Hero Lift': 'The difference in accuracy between adapted and non-adapted exercises — shows whether personalization is actually helping.',

  // Cognitive State Engine
  'Cognitive Recovery Map': 'A visual map of your brain\'s recovery across different areas like word-finding, grammar, reasoning, and endurance.',
  'Lexical Retrieval': 'Your ability to find and say the right word — one of the core language skills tracked by the system.',
  'Syntax': 'Your ability to put words together in the right order to form correct sentences.',
  'Semantic Depth': 'How well you understand word meanings and relationships between concepts.',
  'Executive Function': 'Higher-level thinking skills like planning, reasoning, and problem-solving.',
  'Discourse Organization': 'Your ability to organize thoughts into coherent stories or explanations.',
  'Cognitive Endurance': 'How well you maintain performance over time without mental fatigue causing a decline.',
  'Domain Score': 'A 0–100 score representing your current ability level in a specific cognitive area.',
  'Weekly Changes': 'How your scores in each cognitive area have changed compared to last week.',

  // Utterance & Shadow Analysis
  'Utterance Analysis': 'A detailed breakdown of a single spoken response — what you said, how it compared to the target, and what errors were detected.',
  'Shadow Event': 'A behind-the-scenes record of what the system observed and decided during a single interaction.',
  'Attempt': 'One try at saying a word or completing a task — you might get multiple attempts with increasing hints.',
  'Target Word': 'The specific word or phrase you were asked to say or identify.',
  'User Transcript': 'What the system heard you say, converted to text for analysis.',
  'System Confidence': 'How sure the system is about its analysis of your response.',
  'Interaction Mode': 'Whether you worked independently or with caregiver assistance during this exercise.',

  // Engagement & Interventions
  'Engagement Score': 'A measure of how actively and consistently you\'re participating in exercises.',
  'Engagement Summary': 'An overview of your focus and participation levels during a session.',
  'Frustration Detection': 'The system noticed signs of frustration — like repeated errors or long pauses — and may adjust difficulty.',
  'Fatigue Detection': 'The system noticed your performance declining over time, which might mean you\'re getting tired.',
  'Intervention': 'An action the system took to help — like offering encouragement, reducing difficulty, or suggesting a break.',

  // Dose & Adherence
  'Adherence': 'How consistently you\'re completing your recommended practice — shown as a percentage of target.',
  'Dose Value': 'The amount of practice completed, measured in minutes or repetitions.',
  'Quality Score': 'A rating of how well you performed during practice, not just whether you did it.',
  'Intensity Score': 'How challenging the practice was — higher intensity means harder exercises or faster pacing.',

  // Red Flags & Alerts
  'Red Flag': 'A warning that something needs attention — like a sudden drop in performance or missed sessions.',
  'Recovery Alert': 'A notification about a significant change in your recovery pattern that a clinician should know about.',
  'Alert Severity': 'How urgent a warning is — ranging from informational to critical.',
  'Trigger Data': 'The specific data that caused a warning to be generated — helps clinicians understand what happened.',

  // Assessment
  'Capability Assessment': 'An initial evaluation of your basic abilities — like tapping, visual tracking, and pattern matching — used to set starting difficulty.',
  'Assessment Score': 'Your result on an evaluation, used to track progress or set exercise difficulty.',
  'Motor Score': 'How well you can physically interact with the app — tapping, swiping, and dragging.',
  'Vision Score': 'How well you can see and track visual elements on screen.',
  'Attention Score': 'How well you can focus on and respond to prompts without getting distracted.',

  // Profile & Settings
  'Profile Confidence': 'How much data the system has about you — more sessions and trials mean higher confidence in its recommendations.',
  'Hand Bias': 'Which hand you prefer to use — the system adjusts where it places interactive elements.',
  'Accessibility Preferences': 'Your personal settings for things like larger text, high contrast, or audio cues.',
  'Caregiver Mode': 'A mode that shows additional controls and notes for someone helping you with exercises.',
  'Daily Goal': 'The number of minutes of practice you\'re aiming to complete each day.',
  'Session Cap': 'The maximum length of a single practice session — prevents overwork and fatigue.',
  'Daily Cap': 'The maximum total practice time in one day — a safety limit to prevent exhaustion.',
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
