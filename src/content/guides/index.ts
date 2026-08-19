/**
 * The guide registry.
 *
 * Order is editorial, not alphabetical: the hub lists them in this order, so
 * the article a frightened person needs first goes first.
 *
 * ADDING A GUIDE: write the module, add it here, and add its slug to
 * slugs.json. The slugs file exists because the prerender script is plain
 * Node and cannot import TypeScript — and a route that is not prerendered is
 * invisible to the AI-search crawlers these pages are written for. A test
 * asserts the two lists agree, so they cannot drift apart in a merge.
 */

import type { Guide } from './types';
import { guide as firstWeeks } from './first-weeks-after-stroke-communication';
import { guide as findingAWord } from './helping-someone-find-a-word';
import { guide as practiceLength } from './how-long-should-speech-practice-be';
import { guide as diagnoses } from './aphasia-apraxia-dysarthria';

export const GUIDES: Guide[] = [
  firstWeeks,
  findingAWord,
  practiceLength,
  diagnoses,
];

export function getGuide(slug: string | undefined): Guide | undefined {
  if (!slug) return undefined;
  return GUIDES.find((g) => g.slug === slug);
}

export function guidePath(slug: string): string {
  return `/guides/${slug}`;
}

export type { Guide, GuideFaq } from './types';
export { readingMinutes } from './types';
