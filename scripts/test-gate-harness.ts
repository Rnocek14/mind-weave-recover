/**
 * Headless run of the 5 canned gate tests.
 * Mirrors /dev/gate-harness exactly so we can prove the pipeline before UI testing.
 */
import { gateResponse } from '../src/lib/evaluation/gateResponse';
import { voiceController } from '../src/lib/voiceController';

const CHIP_QUESTIONS = [
  'What do you use it for?',
  'Where do you see it?',
  'What does it look like?',
  'What is it made of?',
  'What kind of thing is it?',
];

const MAYA_HISTORY = [
  'Describe what you see without saying the word.',
  'Tell me what it looks like, where you find it, or what it is used for.',
];

const TESTS = [
  { id: '1. instruction echo (short mimic)', transcript: 'say what you see', expectReject: true },
  { id: '2. prompt repeat',                 transcript: 'describe what you see without saying the word', expectReject: true },
  { id: '3. chip echo',                     transcript: 'what do you use it for', expectReject: true },
  { id: '4. wrong answer (banana)',         transcript: 'banana', expectReject: false },
  { id: '5. real description',              transcript: 'it is a striped orange animal that lives in the jungle and is very large', expectReject: false },
];

voiceController.clearSpokenHistory();
MAYA_HISTORY.forEach(l => voiceController.recordSpoken(l));

let passCount = 0;
for (const t of TESTS) {
  const r = gateResponse({
    transcript: t.transcript,
    promptText: 'Describe what you see without saying the word',
    expectedMode: 'description',
    extraSpokenContext: CHIP_QUESTIONS,
  });
  const wasRejected = !r.ok;
  const passed = wasRejected === t.expectReject;
  if (passed) passCount++;
  console.log(
    `${passed ? '✅ PASS' : '❌ FAIL'}  ${t.id}\n` +
    `         input: "${t.transcript}"\n` +
    `         ok=${r.ok}  classification=${r.classification}  rejectionReason=${r.rejectionReason ?? '—'}\n` +
    `         echoScore=${r.echoScore.toFixed(2)}  echoMatched=${r.echoMatched ?? '—'}\n` +
    (r.coachingText ? `         coaching: "${r.coachingText}"\n` : '')
  );
}

console.log(`\n${passCount}/${TESTS.length} tests passed`);
process.exit(passCount === TESTS.length ? 0 : 1);
