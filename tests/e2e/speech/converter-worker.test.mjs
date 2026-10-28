import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { runInNewContext } from 'node:vm';

const source = readFileSync(new URL('../../../public/wav-converter.worker.js', import.meta.url), 'utf8');

async function convertDecodedDuration(duration) {
  const messages = [];
  let renders = 0;
  class OfflineAudioContext {
    constructor(_channels, length, sampleRate) { this.length = length; this.sampleRate = sampleRate; }
    async decodeAudioData() { return { duration, sampleRate: 48000, numberOfChannels: 1 }; }
    createBufferSource() { return { connect() {}, start() {} }; }
    async startRendering() {
      renders++;
      return { getChannelData: () => new Float32Array(this.length) };
    }
  }
  const self = { postMessage: (message) => messages.push(message) };
  runInNewContext(source, {
    self, OfflineAudioContext, Float32Array, ArrayBuffer, DataView, performance,
    console: { log() {}, warn() {}, error() {} },
  }, { filename: 'public/wav-converter.worker.js' });
  await self.onmessage({ data: { arrayBuffer: new ArrayBuffer(100), id: 42 } });
  assert.equal(messages.length, 1);
  return { message: messages[0], renders };
}

test('the real worker rejects over-limit decoded input before resampling or returning a WAV', async () => {
  const { message, renders } = await convertDecodedDuration(12);
  assert.equal(message.ok, false);
  assert.equal(message.error.workerStage, 'validation');
  assert.equal(message.error.details.durationSec, 12);
  assert.equal(message.error.details.maxDurationSec, 10);
  assert.match(message.error.message, /partial audio was not analyzed/);
  assert.equal(message.wavBuffer, undefined);
  assert.equal(renders, 0);
});

test('the existing ten-second limit remains accepted and the complete WAV duration is retained', async () => {
  const { message, renders } = await convertDecodedDuration(10);
  assert.equal(message.ok, true);
  assert.equal(renders, 1);
  const header = new DataView(message.wavBuffer);
  assert.equal(header.getUint32(24, true), 16000);
  assert.equal(header.getUint32(40, true) / 2 / 16000, 10);
  assert.equal(message.stats.duration, '10.00');
});
