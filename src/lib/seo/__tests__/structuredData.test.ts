/**
 * Structured-data integrity.
 *
 * Bad JSON-LD is worse than none: markup that describes content a visitor
 * cannot see is a manual-action risk, and a malformed node is silently
 * ignored, which looks exactly like success. These tests guard the shapes
 * Google actually validates, and — more importantly — the rule that the FAQ
 * markup must mirror the FAQ the page really renders.
 */
import { describe, it, expect } from 'vitest';
import {
  faqPageSchema,
  aboutPageSchema,
  personSchema,
  absoluteUrl,
  FOUNDER,
  SITE_ORIGIN,
} from '@/lib/seo/structuredData';

const FAQ = [
  { q: 'Is it free?', a: 'Yes, the whole pack downloads with no email address.' },
  { q: 'Who is it for?', a: 'Adults practicing speech after a stroke.' },
];

describe('faqPageSchema', () => {
  it('emits one Question per visible FAQ entry, in order', () => {
    const schema = faqPageSchema(FAQ, '/free-aphasia-worksheets') as Record<string, unknown>;
    const entities = schema.mainEntity as Array<Record<string, unknown>>;
    expect(entities).toHaveLength(2);
    expect(entities.map((e) => e.name)).toEqual(['Is it free?', 'Who is it for?']);
    for (const e of entities) {
      expect(e['@type']).toBe('Question');
      const answer = e.acceptedAnswer as Record<string, unknown>;
      expect(answer['@type']).toBe('Answer');
      expect(String(answer.text).length).toBeGreaterThan(0);
    }
  });

  it('is anchored to an absolute canonical URL', () => {
    const schema = faqPageSchema(FAQ, '/free-aphasia-games') as Record<string, unknown>;
    expect(schema['@context']).toBe('https://schema.org');
    expect(schema['@type']).toBe('FAQPage');
    expect(schema.url).toBe(`${SITE_ORIGIN}/free-aphasia-games`);
    expect(schema['@id']).toBe(`${SITE_ORIGIN}/free-aphasia-games#faq`);
  });

  it('returns null rather than an empty FAQPage', () => {
    // An FAQPage with no questions is invalid markup, and emitting one would
    // advertise a rich result the page cannot back up.
    expect(faqPageSchema([], '/free-aphasia-games')).toBeNull();
    expect(faqPageSchema([{ q: '  ', a: '  ' }], '/free-aphasia-games')).toBeNull();
  });

  it('drops entries that are missing either half', () => {
    const schema = faqPageSchema(
      [...FAQ, { q: 'Unanswered?', a: '' }],
      '/free-aphasia-games'
    ) as Record<string, unknown>;
    expect((schema.mainEntity as unknown[]).length).toBe(2);
  });

  it('serializes to valid JSON (it is injected as a script body)', () => {
    const schema = faqPageSchema(FAQ, '/free-aphasia-games');
    expect(() => JSON.parse(JSON.stringify(schema))).not.toThrow();
  });
});

describe('aboutPageSchema', () => {
  it('attributes the page to the founder person node', () => {
    const schema = aboutPageSchema({
      path: '/about',
      name: 'About NeuroSpark',
      description: 'Why it was built.',
    }) as Record<string, unknown>;
    expect(schema['@type']).toBe('AboutPage');
    expect(schema.url).toBe(`${SITE_ORIGIN}/about`);
    expect(schema.author).toEqual({ '@id': `${FOUNDER.url}#person` });
  });

  it('references a person node that actually exists', () => {
    // A dangling @id reference is the most common way author markup silently
    // does nothing.
    const about = aboutPageSchema({ path: '/about', name: 'x', description: 'y' }) as Record<string, unknown>;
    const person = personSchema() as Record<string, unknown>;
    expect((about.author as Record<string, string>)['@id']).toBe(person['@id']);
    expect(person['@type']).toBe('Person');
    expect(person.name).toBe(FOUNDER.name);
  });
});

describe('absoluteUrl', () => {
  it('always produces one origin and one slash', () => {
    expect(absoluteUrl('/about')).toBe(`${SITE_ORIGIN}/about`);
    expect(absoluteUrl('about')).toBe(`${SITE_ORIGIN}/about`);
  });
});

describe('the byline stays honest', () => {
  it('never claims clinical credentials', () => {
    // The disclaimer is load-bearing: overstating authority is the one thing
    // on this site that could actually cause harm.
    expect(FOUNDER.description.toLowerCase()).toContain('not a speech-language pathologist');
  });
});
