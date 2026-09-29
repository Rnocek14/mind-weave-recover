// Temporary, one-shot source transform for PR 51. No network/database calls.
// Every input is pinned by Git blob SHA, every edit has exact boundaries, and
// no file is written until all transforms validate. Removed after application.
import { createHash } from 'node:crypto';
import { readFileSync, writeFileSync } from 'node:fs';

function load(path, expected) {
  const text = readFileSync(path, 'utf8');
  const bytes = Buffer.from(text);
  const actual = createHash('sha1').update(`blob ${bytes.length}\0`).update(bytes).digest('hex');
  if (actual !== expected) throw new Error(`Refusing changed input: ${path} (${actual})`);
  return text;
}
function replace(text, old, replacement, expected = 1) {
  const count = text.split(old).length - 1;
  if (count !== expected) throw new Error(`Expected ${expected} exact matches, got ${count}: ${old.slice(0, 100)}`);
  return text.split(old).join(replacement);
}
function span(text, start, end, transform) {
  const a = text.indexOf(start);
  const b = text.indexOf(end, a + start.length);
  if (a < 0 || b < 0 || text.indexOf(start, a + start.length) !== -1) throw new Error(`Ambiguous source boundary: ${start}`);
  return text.slice(0, a) + transform(text.slice(a, b)) + text.slice(b);
}
const outputs = new Map();

const loggerPath = 'src/hooks/useUtteranceLogger.ts';
let logger = load(loggerPath, 'c425e42b68f669d277e9bc3cec717de778fb811d');
logger = replace(logger, 'interface UtteranceLoggerReturn {', `export interface CapturedAttempt {
  readonly attemptId: string | null;
  readonly finalize: (analysis: Omit<FinalAnalysisInput, 'attemptId'>) => Promise<FinalizationResult>;
}

interface UtteranceLoggerReturn {`);
logger = replace(logger, '  logFinalAnalysis: (analysis: FinalAnalysisInput) => Promise<FinalizationResult>;', '  logFinalAnalysis: (analysis: FinalAnalysisInput) => Promise<FinalizationResult>;\n  captureAttempt: () => CapturedAttempt;');
logger = replace(logger, '  const epochRef = useRef(0);\n', '');
logger = replace(logger, '  const renderEpoch = epochRef.current;\n', '');
logger = replace(logger, '    epochRef.current += 1;\n', '', 2);
logger = span(logger, '    const explicitIdentity = Object.prototype.hasOwnProperty.call(analysis,', '    const record = id ? attemptsRef.current.get(id) : undefined;', () => `    const explicitIdentity = Object.prototype.hasOwnProperty.call(analysis, 'attemptId');
    // Keep the synchronous legacy API stable. Async game callbacks must use
    // captureAttempt() before awaiting work, or pass an explicit original ID.
    const id = explicitIdentity ? analysis.attemptId ?? null : activeAttemptRef.current;
`);
logger = replace(logger, '  }, [currentAttemptId, renderEpoch]);', '  }, []);');
logger = replace(logger, '  const resetAttempt = useCallback((): void => {', `  const captureAttempt = useCallback((): CapturedAttempt => {
    const id = activeAttemptRef.current;
    const browserTranscript = id ? attemptsRef.current.get(id)?.browserTranscript : null;
    // This function is stable across renders and reads the active identity at
    // invocation. The returned finalizer never reads the next active attempt.
    return Object.freeze({
      attemptId: id,
      finalize: (analysis: Omit<FinalAnalysisInput, 'attemptId'>) => logFinalAnalysis({
        ...analysis,
        attemptId: id,
        transcript: analysis.transcript ?? browserTranscript ?? undefined,
      }),
    });
  }, [logFinalAnalysis]);

  const resetAttempt = useCallback((): void => {`);
logger = replace(logger, '      record.state = \'persisted\';\n', `      record.state = 'persisted';
      // Retain the deduplication marker, not completed audio-analysis payloads.
      record.payload = undefined;
      record.browserTranscript = null;
`);
logger = replace(logger, 'return { currentAttemptId, isFinalized, startAttempt, logBrowserTranscript, logFinalAnalysis, resetAttempt };', 'return { currentAttemptId, isFinalized, startAttempt, logBrowserTranscript, logFinalAnalysis, captureAttempt, resetAttempt };');
outputs.set(loggerPath, logger);

const photoPath = 'src/components/PhotoNamingGame.tsx';
let photo = load(photoPath, '1203004f7daeb1ae72611b1d7b9ece194810418e');
photo = replace(photo, '    logFinalAnalysis, \n    resetAttempt ', '    logFinalAnalysis, \n    captureAttempt,\n    resetAttempt ');
photo = span(photo, '  const handleAnswerSelect = async (', '  const handleCaregiverResponse = async (', (handler) => {
  handler = replace(handler, '    if (showFeedback || selectedAnswer || timedOut) return;', `    if (showFeedback || selectedAnswer || timedOut) return;

    // Freeze response identity and recognition metadata before recording,
    // upload, or analysis can yield to the next trial.
    const pendingAttempt = captureAttempt();
    const capturedRecognitionConfidence = getLastRecognition()?.confidence;
    const capturedResponseLatency = micStartTimeRef.current > 0
      ? Date.now() - micStartTimeRef.current : undefined;`);
  handler = replace(handler, 'const capturedAttemptId = currentAttemptId ?? undefined;', 'const capturedAttemptId = pendingAttempt.attemptId ?? undefined;');
  handler = replace(handler, 'getLastRecognition()?.confidence ?? whisperConfidence ?? 0.8', 'capturedRecognitionConfidence ?? whisperConfidence ?? 0.8');
  handler = replace(handler, '        logFinalAnalysis({', '        void pendingAttempt.finalize({');
  handler = replace(handler, 'latencyMs: micStartTimeRef.current > 0 ? Date.now() - micStartTimeRef.current : undefined,', 'latencyMs: capturedResponseLatency,', 2);
  handler = replace(handler, 'trialCount: state.trialNumber,', 'trialCount: capturedTrialNumber,', 2);
  handler = replace(handler, '        if (pronData) {', '        if (pronData && pendingAttempt.attemptId !== null && pendingAttempt.attemptId === captureAttempt().attemptId) {');
  return handler;
});
photo = span(photo, '  const handleTimeout = async () => {', '  const handleRequestHint = () => {', (handler) => {
  handler = replace(handler, '    if (showFeedback || selectedAnswer || timedOut) return;', `    if (showFeedback || selectedAnswer || timedOut) return;
    const pendingAttempt = captureAttempt();
    const capturedResponseLatency = micStartTimeRef.current > 0
      ? Date.now() - micStartTimeRef.current : undefined;`);
  handler = replace(handler, 'attemptId: currentAttemptId ?? undefined,', 'attemptId: pendingAttempt.attemptId ?? undefined,');
  handler = replace(handler, '    logFinalAnalysis({', '    void pendingAttempt.finalize({');
  handler = replace(handler, 'latencyMs: micStartTimeRef.current > 0 ? Date.now() - micStartTimeRef.current : undefined,', 'latencyMs: capturedResponseLatency,');
  return handler;
});
outputs.set(photoPath, photo);

const intelligencePath = 'src/components/patient-hub/IntelligenceTab.tsx';
let intelligence = load(intelligencePath, '53a70902c103ee41383b36357f68944cf94bc1ed');
intelligence = replace(intelligence, 'import { useMemo, useState, useEffect } from "react";', 'import { useMemo, useState } from "react";');
intelligence = replace(intelligence, '  Brain, Pill, CheckCircle2, AlertTriangle, ArrowRight, Shield,', '  Brain, Pill, CheckCircle2, AlertTriangle, ArrowRight,');
intelligence = replace(intelligence, '  TrendingUp, TrendingDown, Minus, Info, Activity, Target,', '  TrendingUp, TrendingDown, Minus, Activity, Target,');
intelligence = replace(intelligence, 'import { useRecoveryScore } from "@/hooks/useRecoveryScore";\n', '');
intelligence = replace(intelligence, 'import { loadWordHistory, getRetentionDifficultyHint } from "@/lib/smartCoach/crossSessionRetention";', 'import { buildPracticeObservations } from "@/lib/clinical/practiceObservations";');
intelligence = replace(intelligence, '  const { score: recoveryScore, breakdown: rsBreakdown, confidence: rsConfidence, loading: rsLoading } = useRecoveryScore(userId, profileId);\n', '');
intelligence = span(intelligence, '  // Retention data for readiness signal', '  const { currentDayGroups, priorDayGroups, currentTimeline, priorTimelineSplit }', () => '');
intelligence = span(intelligence, '  // Readiness / Discharge Signal', '  const isLoading = snapshotLoading', () => `  // Observations stay within measured app performance. Patient goals are
  // preserved, but scores do not establish recovery or treatment readiness.
  const functionalLinks = useMemo(() => {
    const links = buildPracticeObservations({
      averageScorePct: sessionStats.avgAccuracy,
      scoreSlopePerDay: sessionStats.accuracySlope,
      cueIndexPct: cueScore,
    });
    goals.filter(g => !g.archived_at).forEach(g => {
      links.push({ exercise: \`Goal: \${g.target_domain}\`, functional: g.goal_text, signal: \`Active goal - \${g.baseline_status}\` });
    });
    return links;
  }, [sessionStats, cueScore, goals]);

`);
intelligence = span(intelligence, '            {/* Readiness Signal */}', '            {/* Functional Communication Transfer */}', () => `            <p role="note" className="text-xs text-muted-foreground px-3">
              App practice does not establish readiness for discharge or reduced therapy.
              Everyday communication requires separate assessment.
            </p>

`);
intelligence = replace(intelligence, '            {/* Functional Communication Transfer */}', '            {/* Observed practice and patient-defined goals */}');
intelligence = replace(intelligence, '                    Functional Communication Impact', '                    Practice observations and goals');
outputs.set(intelligencePath, intelligence);

for (const [path, content] of outputs) {
  if (!content.trim()) throw new Error(`Empty result: ${path}`);
}
for (const [path, content] of outputs) {
  writeFileSync(path, content);
  console.log(`Applied verified source transform: ${path}`);
}
