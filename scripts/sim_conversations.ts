/**
 * Maya Conversation Simulator
 * 
 * Simulates 10 different user profiles through 50+ turns each,
 * testing orchestrator decisions, card variety, follow-up quality,
 * anti-loop behavior, and phase transitions.
 */

// Import the actual orchestrator logic
import { 
  getNextAction, 
  createInitialState, 
  updateState,
  updateStateAfterPopup,
  getCardIntro,
  CARD_OUTRO_LINES,
  type OrchestratorState,
  type SpeechAnalysisForOrchestrator,
  type NextAction,
  type CardType,
} from '@/lib/coachOrchestrator';
import { type StuckType } from '@/lib/stuckTypeClassifier';
import { 
  getFollowupLine, 
  getRandomOpener, 
  type FollowupType 
} from '@/lib/conversationFollowups';

// ============================================================================
// USER PROFILES - Different aphasia presentations
// ============================================================================

interface SimulatedUser {
  name: string;
  description: string;
  // Probability distributions for stuck types per turn
  stuckDistribution: Record<StuckType, number>;
  // Average word count range
  wordCountRange: [number, number];
  // Speech characteristics
  effortfulRate: number;
  circumlocutionRate: number;
  filledPauseRate: number;
  pausePattern: 'fluent' | 'hesitant' | 'very_slow';
}

const USERS: SimulatedUser[] = [
  {
    name: "Strong Speaker",
    description: "Mild anomic aphasia, mostly fluent",
    stuckDistribution: { strong_flow: 0.7, word_search_stall: 0.15, thought_abandonment: 0.1, prompt_overload: 0.03, no_speech: 0.02 },
    wordCountRange: [5, 15],
    effortfulRate: 0.1,
    circumlocutionRate: 0.05,
    filledPauseRate: 0.1,
    pausePattern: 'fluent',
  },
  {
    name: "Hesitant Speaker",
    description: "Moderate anomic, frequent word-finding pauses",
    stuckDistribution: { strong_flow: 0.3, word_search_stall: 0.35, thought_abandonment: 0.15, prompt_overload: 0.1, no_speech: 0.1 },
    wordCountRange: [2, 8],
    effortfulRate: 0.4,
    circumlocutionRate: 0.2,
    filledPauseRate: 0.3,
    pausePattern: 'hesitant',
  },
  {
    name: "Non-Fluent Speaker",
    description: "Broca's-like, very effortful, short utterances",
    stuckDistribution: { strong_flow: 0.1, word_search_stall: 0.2, thought_abandonment: 0.3, prompt_overload: 0.2, no_speech: 0.2 },
    wordCountRange: [0, 4],
    effortfulRate: 0.7,
    circumlocutionRate: 0.1,
    filledPauseRate: 0.5,
    pausePattern: 'very_slow',
  },
  {
    name: "Silent Starter",
    description: "Severe apraxia, often can't initiate",
    stuckDistribution: { strong_flow: 0.05, word_search_stall: 0.1, thought_abandonment: 0.15, prompt_overload: 0.3, no_speech: 0.4 },
    wordCountRange: [0, 3],
    effortfulRate: 0.8,
    circumlocutionRate: 0.05,
    filledPauseRate: 0.6,
    pausePattern: 'very_slow',
  },
  {
    name: "Circumlocutor",
    description: "Good fluency but word-finding causes talking around words",
    stuckDistribution: { strong_flow: 0.25, word_search_stall: 0.4, thought_abandonment: 0.2, prompt_overload: 0.1, no_speech: 0.05 },
    wordCountRange: [4, 12],
    effortfulRate: 0.3,
    circumlocutionRate: 0.5,
    filledPauseRate: 0.2,
    pausePattern: 'hesitant',
  },
  {
    name: "Improving Patient",
    description: "Getting better over session - starts slow, improves",
    stuckDistribution: { strong_flow: 0.3, word_search_stall: 0.25, thought_abandonment: 0.2, prompt_overload: 0.15, no_speech: 0.1 },
    wordCountRange: [2, 10],
    effortfulRate: 0.3,
    circumlocutionRate: 0.15,
    filledPauseRate: 0.2,
    pausePattern: 'hesitant',
  },
  {
    name: "Fatiguing Patient",
    description: "Starts well, gets worse as session progresses",
    stuckDistribution: { strong_flow: 0.5, word_search_stall: 0.2, thought_abandonment: 0.15, prompt_overload: 0.1, no_speech: 0.05 },
    wordCountRange: [3, 12],
    effortfulRate: 0.2,
    circumlocutionRate: 0.1,
    filledPauseRate: 0.15,
    pausePattern: 'fluent',
  },
  {
    name: "One-Word Responder",
    description: "Mostly single words or very short phrases",
    stuckDistribution: { strong_flow: 0.15, word_search_stall: 0.3, thought_abandonment: 0.25, prompt_overload: 0.15, no_speech: 0.15 },
    wordCountRange: [1, 3],
    effortfulRate: 0.5,
    circumlocutionRate: 0.05,
    filledPauseRate: 0.4,
    pausePattern: 'hesitant',
  },
  {
    name: "Verbose but Disorganized",
    description: "Speaks a lot but loses track, tangential",
    stuckDistribution: { strong_flow: 0.35, word_search_stall: 0.15, thought_abandonment: 0.35, prompt_overload: 0.1, no_speech: 0.05 },
    wordCountRange: [8, 20],
    effortfulRate: 0.15,
    circumlocutionRate: 0.3,
    filledPauseRate: 0.15,
    pausePattern: 'fluent',
  },
  {
    name: "Anxious Beginner",
    description: "First session, nervous, variable performance",
    stuckDistribution: { strong_flow: 0.2, word_search_stall: 0.2, thought_abandonment: 0.2, prompt_overload: 0.25, no_speech: 0.15 },
    wordCountRange: [1, 8],
    effortfulRate: 0.4,
    circumlocutionRate: 0.1,
    filledPauseRate: 0.35,
    pausePattern: 'hesitant',
  },
];

// ============================================================================
// SIMULATION ENGINE
// ============================================================================

function pickStuckType(user: SimulatedUser, turnNumber: number): StuckType {
  // For "Improving Patient" - shift distribution over time
  let dist = { ...user.stuckDistribution };
  
  if (user.name === "Improving Patient" && turnNumber > 5) {
    dist.strong_flow = Math.min(0.7, dist.strong_flow + turnNumber * 0.03);
    dist.no_speech = Math.max(0.02, dist.no_speech - turnNumber * 0.01);
    dist.word_search_stall = Math.max(0.1, dist.word_search_stall - turnNumber * 0.01);
  }
  
  // For "Fatiguing Patient" - gets worse over time
  if (user.name === "Fatiguing Patient" && turnNumber > 8) {
    dist.strong_flow = Math.max(0.1, dist.strong_flow - (turnNumber - 8) * 0.04);
    dist.no_speech = Math.min(0.3, dist.no_speech + (turnNumber - 8) * 0.03);
    dist.thought_abandonment = Math.min(0.3, dist.thought_abandonment + (turnNumber - 8) * 0.02);
  }
  
  // Normalize
  const total = Object.values(dist).reduce((a, b) => a + b, 0);
  const r = Math.random() * total;
  let cumulative = 0;
  for (const [type, prob] of Object.entries(dist)) {
    cumulative += prob;
    if (r <= cumulative) return type as StuckType;
  }
  return 'strong_flow';
}

function generateSpeechAnalysis(user: SimulatedUser, stuckType: StuckType, turnNumber: number): SpeechAnalysisForOrchestrator {
  const wordCount = stuckType === 'no_speech' ? 0 :
    Math.floor(Math.random() * (user.wordCountRange[1] - user.wordCountRange[0]) + user.wordCountRange[0]);
  
  return {
    effortfulSpeech: Math.random() < user.effortfulRate,
    circumlocutionDetected: Math.random() < user.circumlocutionRate,
    fluencyScore: stuckType === 'strong_flow' ? 0.8 : stuckType === 'no_speech' ? 0 : 0.4,
    pausePattern: user.pausePattern,
    wordCount,
    filledPauseCount: Math.random() < user.filledPauseRate ? Math.floor(Math.random() * 4) + 1 : 0,
  };
}

interface TurnLog {
  turn: number;
  stuckType: StuckType;
  action: NextAction;
  phase: string;
  aiText: string;
  wordCount: number;
}

interface ConversationReport {
  userName: string;
  userDescription: string;
  totalTurns: number;
  turnLogs: TurnLog[];
  // Quality metrics
  phaseTransitions: string[];
  uniqueCardTypes: Set<string>;
  uniqueFollowupTypes: Set<string>;
  cardCount: number;
  popupCount: number;
  consecutiveFollowupMax: number;
  repeatIntros: Map<string, number>;
  questionsPerTurn: number[];
  wrapUpReached: boolean;
  // Issues detected
  issues: string[];
}

function simulateConversation(user: SimulatedUser, maxTurns: number = 20): ConversationReport {
  const state: { current: OrchestratorState } = { current: createInitialState(maxTurns) };
  const report: ConversationReport = {
    userName: user.name,
    userDescription: user.description,
    totalTurns: 0,
    turnLogs: [],
    phaseTransitions: ['warmup'],
    uniqueCardTypes: new Set(),
    uniqueFollowupTypes: new Set(),
    cardCount: 0,
    popupCount: 0,
    consecutiveFollowupMax: 0,
    repeatIntros: new Map(),
    questionsPerTurn: [],
    wrapUpReached: false,
    issues: [],
  };

  let prevPhase = state.current.sessionPhase;
  let consecutiveFollowups = 0;
  let lastAIText = '';
  let lastReactionStem = '';

  for (let turn = 0; turn < maxTurns; turn++) {
    const stuckType = pickStuckType(user, turn);
    const speechAnalysis = generateSpeechAnalysis(user, stuckType, turn);
    
    const action = getNextAction(stuckType, state.current, speechAnalysis);
    
    // Generate the AI text that would be spoken
    let aiText = '';
    if (action.type === 'insert_card') {
      aiText = getCardIntro(action.cardType, state.current.currentTopic);
      report.uniqueCardTypes.add(action.cardType);
      report.cardCount++;
    } else if (action.type === 'chat_followup') {
      aiText = getFollowupLine(action.followupType);
      report.uniqueFollowupTypes.add(action.followupType);
      consecutiveFollowups++;
    } else if (action.type === 'popup_exercise') {
      aiText = `[POPUP: ${action.slug}]`;
      report.popupCount++;
      consecutiveFollowups = 0;
    } else if (action.type === 'wrap_up') {
      aiText = getFollowupLine('wrap_up');
      report.wrapUpReached = true;
    } else if (action.type === 'topic_shift') {
      aiText = getRandomOpener(false);
      consecutiveFollowups = 0;
    } else if (action.type === 'summary_verify') {
      aiText = action.summary;
      consecutiveFollowups = 0;
    }

    if (action.type !== 'chat_followup') {
      report.consecutiveFollowupMax = Math.max(report.consecutiveFollowupMax, consecutiveFollowups);
      consecutiveFollowups = 0;
    }

    // Track repeat intros
    const introKey = aiText.toLowerCase().trim();
    report.repeatIntros.set(introKey, (report.repeatIntros.get(introKey) || 0) + 1);
    
    // Count questions in this turn
    const questionCount = (aiText.match(/\?/g) || []).length;
    report.questionsPerTurn.push(questionCount);
    
    // Check for issues
    if (aiText === lastAIText) {
      report.issues.push(`Turn ${turn}: EXACT REPEAT of previous turn: "${aiText}"`);
    }
    
    // Check double questions under struggle
    if (questionCount > 1 && (stuckType === 'no_speech' || stuckType === 'word_search_stall' || stuckType === 'prompt_overload')) {
      report.issues.push(`Turn ${turn}: ${questionCount} questions during ${stuckType}: "${aiText}"`);
    }
    
    // Log
    report.turnLogs.push({
      turn,
      stuckType,
      action,
      phase: state.current.sessionPhase,
      aiText,
      wordCount: speechAnalysis.wordCount,
    });
    
    // Update state
    const isCard = action.type === 'insert_card';
    const cardSuccess = isCard ? (stuckType === 'strong_flow' || Math.random() > 0.3) : undefined;
    
    if (action.type === 'popup_exercise') {
      state.current = updateStateAfterPopup(
        state.current, 
        Math.random() > 0.4, 
        undefined, 
        action.slug
      );
    } else {
      state.current = updateState(
        state.current,
        stuckType,
        isCard,
        isCard ? action.cardType : undefined,
        cardSuccess,
        state.current.currentTopic || 'food',
        speechAnalysis.wordCount > 0 ? ['word1', 'word2'] : undefined,
      );
    }
    
    // Track phase transitions
    if (state.current.sessionPhase !== prevPhase) {
      report.phaseTransitions.push(state.current.sessionPhase);
      prevPhase = state.current.sessionPhase;
    }
    
    lastAIText = aiText;
    report.totalTurns = turn + 1;
    
    // Stop at wrap_up
    if (action.type === 'wrap_up') break;
  }
  
  report.consecutiveFollowupMax = Math.max(report.consecutiveFollowupMax, consecutiveFollowups);
  
  // Check for global issues
  const repeatCounts = Array.from(report.repeatIntros.entries())
    .filter(([_, count]) => count > 3)
    .sort((a, b) => b[1] - a[1]);
  
  for (const [text, count] of repeatCounts) {
    if (text.length > 5) { // ignore very short texts
      report.issues.push(`OVERUSED (${count}x): "${text}"`);
    }
  }
  
  if (!report.phaseTransitions.includes('conversation') && report.totalTurns > 8) {
    report.issues.push(`STUCK IN PHASE: Never reached conversation phase after ${report.totalTurns} turns. Phases: ${report.phaseTransitions.join(' → ')}`);
  }
  
  if (report.cardCount > report.totalTurns * 0.6) {
    report.issues.push(`TOO MANY CARDS: ${report.cardCount} cards in ${report.totalTurns} turns (${Math.round(report.cardCount/report.totalTurns*100)}%)`);
  }
  
  return report;
}

// ============================================================================
// RUN ALL SIMULATIONS
// ============================================================================

console.log('='.repeat(80));
console.log('MAYA CONVERSATION SIMULATOR - 10 User Profiles × 20 Turns');
console.log('='.repeat(80));
console.log('');

const allReports: ConversationReport[] = [];
let totalIssues = 0;

for (const user of USERS) {
  const report = simulateConversation(user, 20);
  allReports.push(report);
  
  console.log(`\n${'─'.repeat(70)}`);
  console.log(`👤 ${report.userName} (${report.userDescription})`);
  console.log(`${'─'.repeat(70)}`);
  
  // Print turn-by-turn
  for (const log of report.turnLogs) {
    const actionLabel = log.action.type === 'insert_card' ? `🃏 ${(log.action as any).cardType}` :
      log.action.type === 'popup_exercise' ? `🎮 ${(log.action as any).slug}` :
      log.action.type === 'chat_followup' ? `💬 ${(log.action as any).followupType}` :
      log.action.type === 'wrap_up' ? '🏁 wrap_up' :
      log.action.type === 'topic_shift' ? '🔄 topic_shift' :
      log.action.type === 'summary_verify' ? '📝 summary' : log.action.type;
    
    const stuckEmoji = log.stuckType === 'strong_flow' ? '✅' :
      log.stuckType === 'no_speech' ? '🔇' :
      log.stuckType === 'word_search_stall' ? '🔍' :
      log.stuckType === 'thought_abandonment' ? '💭' :
      log.stuckType === 'prompt_overload' ? '😰' : '❓';
    
    console.log(
      `  T${String(log.turn).padStart(2,'0')} [${log.phase.padEnd(12)}] ${stuckEmoji} ${log.stuckType.padEnd(20)} → ${actionLabel.padEnd(30)} "${log.aiText.substring(0, 50)}"`
    );
  }
  
  // Print summary
  console.log(`\n  📊 Summary:`);
  console.log(`     Turns: ${report.totalTurns} | Cards: ${report.cardCount} | Popups: ${report.popupCount}`);
  console.log(`     Phases: ${report.phaseTransitions.join(' → ')}`);
  console.log(`     Card types used: ${[...report.uniqueCardTypes].join(', ') || 'none'}`);
  console.log(`     Followup types: ${[...report.uniqueFollowupTypes].join(', ') || 'none'}`);
  console.log(`     Max consecutive followups: ${report.consecutiveFollowupMax}`);
  console.log(`     Wrap-up reached: ${report.wrapUpReached}`);
  
  if (report.issues.length > 0) {
    console.log(`\n  ⚠️  ISSUES (${report.issues.length}):`);
    for (const issue of report.issues) {
      console.log(`     🔴 ${issue}`);
    }
    totalIssues += report.issues.length;
  } else {
    console.log(`\n  ✅ No issues detected`);
  }
}

// ============================================================================
// AGGREGATE ANALYSIS
// ============================================================================

console.log(`\n${'='.repeat(80)}`);
console.log('AGGREGATE ANALYSIS');
console.log(`${'='.repeat(80)}`);

// 1. Phase transition analysis
console.log('\n📊 Phase Transitions:');
for (const r of allReports) {
  const reached = r.phaseTransitions.includes('conversation');
  console.log(`  ${reached ? '✅' : '❌'} ${r.userName}: ${r.phaseTransitions.join(' → ')}`);
}

// 2. Card variety analysis
console.log('\n📊 Card Variety:');
const allCardTypes = new Set<string>();
for (const r of allReports) {
  r.uniqueCardTypes.forEach(c => allCardTypes.add(c));
}
console.log(`  Total unique card types across all sims: ${allCardTypes.size} (${[...allCardTypes].join(', ')})`);

// 3. Most repeated lines
console.log('\n📊 Most Repeated Lines (across all sims):');
const globalRepeats = new Map<string, number>();
for (const r of allReports) {
  for (const [text, count] of r.repeatIntros) {
    globalRepeats.set(text, (globalRepeats.get(text) || 0) + count);
  }
}
const topRepeats = Array.from(globalRepeats.entries())
  .filter(([text]) => text.length > 5)
  .sort((a, b) => b[1] - a[1])
  .slice(0, 15);

for (const [text, count] of topRepeats) {
  const flag = count > 10 ? '🔴' : count > 5 ? '🟡' : '🟢';
  console.log(`  ${flag} ${count}x: "${text.substring(0, 60)}"`);
}

// 4. Action distribution
console.log('\n📊 Action Distribution:');
const actionCounts: Record<string, number> = {};
let totalActions = 0;
for (const r of allReports) {
  for (const log of r.turnLogs) {
    const key = log.action.type === 'insert_card' ? `card:${(log.action as any).cardType}` :
      log.action.type === 'popup_exercise' ? `popup:${(log.action as any).slug}` :
      log.action.type === 'chat_followup' ? `followup:${(log.action as any).followupType}` :
      log.action.type;
    actionCounts[key] = (actionCounts[key] || 0) + 1;
    totalActions++;
  }
}
for (const [action, count] of Object.entries(actionCounts).sort((a, b) => b[1] - a[1])) {
  console.log(`  ${action.padEnd(35)} ${count} (${Math.round(count/totalActions*100)}%)`);
}

// 5. Double question analysis
console.log('\n📊 Double Questions Under Struggle:');
let doubleQuestionCount = 0;
for (const r of allReports) {
  for (const issue of r.issues) {
    if (issue.includes('questions during')) doubleQuestionCount++;
  }
}
console.log(`  Total double-question issues: ${doubleQuestionCount}`);

// 6. Final verdict
console.log(`\n${'='.repeat(80)}`);
console.log('FINAL VERDICT');
console.log(`${'='.repeat(80)}`);
console.log(`Total issues found: ${totalIssues}`);
const phaseStuck = allReports.filter(r => !r.phaseTransitions.includes('conversation') && r.totalTurns > 8).length;
console.log(`Users stuck in warmup/build: ${phaseStuck}/${allReports.length}`);
const avgCards = allReports.reduce((sum, r) => sum + r.cardCount, 0) / allReports.length;
console.log(`Average cards per session: ${avgCards.toFixed(1)}`);
const avgFollowups = allReports.reduce((sum, r) => sum + r.consecutiveFollowupMax, 0) / allReports.length;
console.log(`Average max consecutive followups: ${avgFollowups.toFixed(1)}`);

if (totalIssues === 0) {
  console.log('\n✅ ALL CONVERSATIONS PASSED - No critical issues detected');
} else {
  console.log(`\n⚠️ ${totalIssues} ISSUES NEED ATTENTION`);
}
