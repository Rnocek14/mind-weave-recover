import { describe, it, expect } from 'vitest';
import { validateSpokenResponse, type ResponseMode } from '../responseValidation';

function validate(transcript: string, mode: ResponseMode = 'naming', extra?: { promptText?: string; instructionPhrases?: string[] }) {
  return validateSpokenResponse({ transcript, expectedMode: mode, ...extra });
}

describe('responseValidation', () => {
  // ═══════════════════════════════════════════════════════════════
  // Empty / filler rejection
  // ═══════════════════════════════════════════════════════════════
  describe('empty & filler detection', () => {
    it('rejects empty string', () => {
      expect(validate('').valid).toBe(false);
      expect(validate('').rejectionReason).toBe('empty');
    });

    it('rejects pure fillers', () => {
      expect(validate('um uh hmm').valid).toBe(false);
    });

    it('rejects silence placeholders', () => {
      expect(validate('   ').valid).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Instruction echo detection
  // ═══════════════════════════════════════════════════════════════
  describe('instruction echo detection', () => {
    it('rejects pure instruction echo', () => {
      const r = validate('describe what you see', 'description');
      expect(r.valid).toBe(false);
      expect(r.rejectionReason).toBe('instruction_echo');
    });

    it('rejects "tell me what you see"', () => {
      expect(validate('tell me what you see', 'description').valid).toBe(false);
    });

    it('rejects "say the word"', () => {
      expect(validate('say the word', 'naming').valid).toBe(false);
    });

    it('rejects "fix the sentence"', () => {
      expect(validate('fix the sentence', 'sentence_fix').valid).toBe(false);
    });

    it('rejects "tell it back"', () => {
      expect(validate('tell it back', 'retell').valid).toBe(false);
    });

    it('passes instruction + real answer: "describe what you see… shoe"', () => {
      const r = validate('describe what you see shoe', 'description');
      // "shoe" remains after stripping instruction — should pass
      expect(r.valid).toBe(true);
    });

    it('passes "what do you see… looks like a shoe"', () => {
      const r = validate('what do you see looks like a shoe', 'description');
      expect(r.valid).toBe(true);
    });

    it('passes "say the word… dog"', () => {
      const r = validate('say the word dog', 'naming');
      expect(r.valid).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Non-answer detection
  // ═══════════════════════════════════════════════════════════════
  describe('non-answer detection', () => {
    it('rejects "I don\'t know"', () => {
      const r = validate("i don't know", 'naming');
      expect(r.valid).toBe(false);
      expect(r.rejectionReason).toBe('non_answer');
    });

    it('rejects "pass"', () => {
      expect(validate('pass', 'naming').valid).toBe(false);
    });

    it('rejects "I forgot"', () => {
      expect(validate('I forgot', 'retell').valid).toBe(false);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Content richness (mode-aware)
  // ═══════════════════════════════════════════════════════════════
  describe('content richness by mode', () => {
    it('naming: passes single word "shoe"', () => {
      expect(validate('shoe', 'naming').valid).toBe(true);
    });

    it('description: passes multi-word description', () => {
      expect(validate("it's something you wear on your foot", 'description').valid).toBe(true);
    });

    it('retell: passes narrative', () => {
      expect(validate('the boy went outside and lost his ball', 'retell').valid).toBe(true);
    });

    it('sentence_fix: passes corrected word', () => {
      expect(validate('drinks', 'sentence_fix').valid).toBe(true);
    });

    it('sentence_fix: passes corrected phrase', () => {
      expect(validate('she drinks', 'sentence_fix').valid).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Prompt repetition
  // ═══════════════════════════════════════════════════════════════
  describe('prompt repetition', () => {
    it('rejects when user repeats the exercise prompt', () => {
      const r = validate('the cat sit on the mat', 'sentence_fix', {
        promptText: 'The cat sit on the mat',
      });
      expect(r.valid).toBe(false);
      expect(r.rejectionReason).toBe('prompt_repeat');
    });

    it('passes when user modifies the prompt (actual fix)', () => {
      const r = validate('the cat sits on the mat', 'sentence_fix', {
        promptText: 'The cat sit on the mat',
      });
      // "sits" differs from "sit" — not an exact repeat
      expect(r.valid).toBe(true);
    });

    it('passes morphological fix: sit → sits', () => {
      const r = validate('the dog sits', 'sentence_fix', { promptText: 'the dog sit' });
      expect(r.valid).toBe(true);
    });

    it('passes tense fix: run → ran', () => {
      const r = validate('she ran home', 'sentence_fix', { promptText: 'she run home' });
      expect(r.valid).toBe(true);
    });

    it('still rejects verbatim sentence_fix repeat with no edit', () => {
      const r = validate('the dog sit', 'sentence_fix', { promptText: 'the dog sit' });
      expect(r.valid).toBe(false);
      expect(r.rejectionReason).toBe('prompt_repeat');
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Hesitant but real answers (must NOT be over-rejected)
  // ═══════════════════════════════════════════════════════════════
  describe('preserves hesitant real answers', () => {
    it('passes "umm maybe a shoe"', () => {
      expect(validate('umm maybe a shoe', 'naming').valid).toBe(true);
    });

    it('passes "uh it looks like a dog"', () => {
      expect(validate('uh it looks like a dog', 'naming').valid).toBe(true);
    });

    it('passes "uhh what is this… maybe a shoe" (instruction + answer)', () => {
      expect(validate('uhh what is this maybe a shoe', 'naming').valid).toBe(true);
    });

    it('passes "I think it\'s round and you sit on it"', () => {
      expect(validate("I think it's round and you sit on it", 'description').valid).toBe(true);
    });
  });

  // ═══════════════════════════════════════════════════════════════
  // Exercise-specific custom instruction phrases
  // ═══════════════════════════════════════════════════════════════
  describe('custom instruction phrases', () => {
    it('rejects custom instruction phrase', () => {
      const r = validate('find the synonym', 'synonym', {
        instructionPhrases: ['find the synonym'],
      });
      expect(r.valid).toBe(false);
      expect(r.rejectionReason).toBe('instruction_echo');
    });

    it('passes custom instruction + answer', () => {
      const r = validate('find the synonym happy', 'synonym', {
        instructionPhrases: ['find the synonym'],
      });
      expect(r.valid).toBe(true);
    });
  });
});
