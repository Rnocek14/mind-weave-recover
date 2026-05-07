/**
 * Version-discipline tests for the shadow gate.
 *
 * Source contract: docs/shadow-gate-replay-spec.md §3 + §11.
 *
 * Purpose:
 *   Make silent governance drift impossible. If POLICY or ADOPTED_GATE_SLUGS
 *   change in gate.ts without a corresponding *_VERSION bump and pinned
 *   fingerprint update in gateVersion.ts, this test fails the build.
 *
 *   Failure message includes the new expected fingerprint so the engineer
 *   making the change can update the pinned constant deliberately, after
 *   bumping the version axis and updating the replay spec if needed.
 */

import { describe, it, expect } from 'vitest';
import {
  __INTERNAL_POLICY,
  __INTERNAL_ADOPTED_GATE_SLUGS,
} from '../gate';
import {
  GATE_POLICY_VERSION,
  ADOPTED_SLUG_SET_VERSION,
  PINNED_POLICY_FINGERPRINT,
  PINNED_ADOPTED_SLUGS_FINGERPRINT,
  fingerprint,
} from '../gateVersion';

/**
 * Deterministic, key-sorted JSON. Order-independent over object keys so the
 * fingerprint depends on semantic content, not source-file ordering.
 */
function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) {
    return '[' + value.map((v) => canonicalize(v)).join(',') + ']';
  }
  const obj = value as Record<string, unknown>;
  const keys = Object.keys(obj).sort();
  return (
    '{' +
    keys
      .map((k) => JSON.stringify(k) + ':' + canonicalize(obj[k]))
      .join(',') +
    '}'
  );
}

describe('gateVersion — version axes are well-formed', () => {
  it('GATE_POLICY_VERSION matches semver-ish v0.x.y shape', () => {
    expect(GATE_POLICY_VERSION).toMatch(/^v\d+\.\d+\.\d+$/);
  });

  it('ADOPTED_SLUG_SET_VERSION matches semver-ish v0.x.y shape', () => {
    expect(ADOPTED_SLUG_SET_VERSION).toMatch(/^v\d+\.\d+\.\d+$/);
  });
});

describe('gateVersion — fingerprint is deterministic', () => {
  it('same input → same output', () => {
    expect(fingerprint('hello')).toBe(fingerprint('hello'));
  });

  it('different input → different output (sanity)', () => {
    expect(fingerprint('a')).not.toBe(fingerprint('b'));
  });

  it('returns 8-char hex string', () => {
    expect(fingerprint('anything')).toMatch(/^[0-9a-f]{8}$/);
  });
});

describe('gateVersion — POLICY fingerprint discipline', () => {
  it('POLICY content matches PINNED_POLICY_FINGERPRINT', () => {
    const actual = fingerprint(canonicalize(__INTERNAL_POLICY));
    if (actual !== PINNED_POLICY_FINGERPRINT) {
      throw new Error(
        `POLICY in gate.ts changed without bumping GATE_POLICY_VERSION.\n` +
          `  Expected fingerprint: ${PINNED_POLICY_FINGERPRINT}\n` +
          `  Actual fingerprint:   ${actual}\n` +
          `\n` +
          `If this change is intentional:\n` +
          `  1. Bump GATE_POLICY_VERSION in src/lib/progression/gateVersion.ts\n` +
          `  2. Update PINNED_POLICY_FINGERPRINT to "${actual}"\n` +
          `  3. Update docs/progression-gating-spec.md §4 if the rule table changed\n` +
          `  4. Update docs/shadow-gate-replay-spec.md §3 if replay semantics changed\n`,
      );
    }
    expect(actual).toBe(PINNED_POLICY_FINGERPRINT);
  });
});

describe('gateVersion — ADOPTED_GATE_SLUGS fingerprint discipline', () => {
  it('adopted slug set matches PINNED_ADOPTED_SLUGS_FINGERPRINT', () => {
    const slugs = [...__INTERNAL_ADOPTED_GATE_SLUGS].sort();
    const actual = fingerprint(canonicalize(slugs));
    if (actual !== PINNED_ADOPTED_SLUGS_FINGERPRINT) {
      throw new Error(
        `ADOPTED_GATE_SLUGS in gate.ts changed without bumping ADOPTED_SLUG_SET_VERSION.\n` +
          `  Expected fingerprint: ${PINNED_ADOPTED_SLUGS_FINGERPRINT}\n` +
          `  Actual fingerprint:   ${actual}\n` +
          `\n` +
          `If this change is intentional:\n` +
          `  1. Bump ADOPTED_SLUG_SET_VERSION in src/lib/progression/gateVersion.ts\n` +
          `  2. Update PINNED_ADOPTED_SLUGS_FINGERPRINT to "${actual}"\n` +
          `  3. Update docs/shadow-gate-spec.md §6 if the adopted set semantics changed\n`,
      );
    }
    expect(actual).toBe(PINNED_ADOPTED_SLUGS_FINGERPRINT);
  });

  it('adopted slug set is non-empty (v0.1 must include photo-naming)', () => {
    expect(__INTERNAL_ADOPTED_GATE_SLUGS.has('photo-naming')).toBe(true);
  });
});

describe('gateVersion — v0.1 baseline pins', () => {
  it('GATE_POLICY_VERSION is v0.1.0', () => {
    expect(GATE_POLICY_VERSION).toBe('v0.1.0');
  });

  it('ADOPTED_SLUG_SET_VERSION is v0.1.0', () => {
    expect(ADOPTED_SLUG_SET_VERSION).toBe('v0.1.0');
  });
});
