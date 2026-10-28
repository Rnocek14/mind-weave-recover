/**
 * Regenerate the checked-in, non-patient speech fixtures with local libflite.
 * Requires ffmpeg built with the flite filter. No network/TTS service is used.
 * Tests consume the committed WAV files, so CI does not need ffmpeg.
 */
import { spawnSync } from 'node:child_process';
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const output = fileURLToPath(new URL('./fixtures/', import.meta.url));
mkdirSync(output, { recursive: true });
const fixtures = [
  ['clear-answer.wav', "flite=text='apple':voice=slt,adelay=200,apad=whole_dur=3.5"],
  ['hesitant-answer.wav', "flite=text='uh':voice=slt[a];flite=text='apple':voice=slt[b];[a]apad=whole_dur=1.7[hesitation];[hesitation][b]concat=n=2:v=0:a=1,adelay=200,apad=whole_dur=4.5"],
  ['silence.wav', 'anullsrc=r=16000:cl=mono,atrim=duration=3.5'],
  ['over-limit-answer.wav', "flite=text='apple':voice=slt,adelay=10500,apad=whole_dur=12"],
];
for (const [name, filter] of fixtures) {
  const result = spawnSync('ffmpeg', [
    '-hide_banner', '-loglevel', 'error', '-y', '-f', 'lavfi', '-i', filter,
    '-map_metadata', '-1', '-bitexact', '-ar', '16000', '-ac', '1',
    '-c:a', 'pcm_s16le', `${output}${name}`,
  ], { stdio: 'inherit' });
  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(`ffmpeg failed for ${name}`);
  process.stdout.write(`Generated ${name}\n`);
}

const descriptions = [
  { id: 'clear-answer', file: 'clear-answer.wav', spokenText: 'apple', expectedTranscripts: ['apple'], target: 'apple', durationMs: 3500 },
  { id: 'hesitant-answer', file: 'hesitant-answer.wav', spokenText: 'uh apple', expectedTranscripts: ['uh apple', 'apple'], target: 'apple', durationMs: 4500 },
  { id: 'silence', file: 'silence.wav', spokenText: '', expectedTranscripts: [''], target: null, durationMs: 3500 },
  { id: 'over-limit-answer', file: 'over-limit-answer.wav', spokenText: 'apple', expectedTranscripts: ['apple'], target: 'apple', durationMs: 12000 },
];
writeFileSync(`${output}manifest.json`, JSON.stringify({
  schemaVersion: 1, synthetic: true, generator: 'ffmpeg/libflite', voice: 'slt',
  audioFormat: { encoding: 'PCM signed 16-bit little-endian WAV', sampleRate: 16000, channels: 1, bitsPerSample: 16 },
  limitations: [
    'Generated locally from text; no patient voice or external speech service.',
    'Expected transcripts identify the synthetic words; browser tests supply recognition events explicitly and do not measure native ASR accuracy.',
    'The hesitant fixture contains a deliberately inserted pause, not a representative clinical speech sample.',
    'Pronunciation/model accuracy and physical devices require separate evaluation; controlled metric responses are not ground-truth acoustic scores for these files.',
  ],
  fixtures: descriptions.map((description) => ({
    ...description, sha256: createHash('sha256').update(readFileSync(`${output}${description.file}`)).digest('hex'),
  })),
}, null, 2) + '\n');
