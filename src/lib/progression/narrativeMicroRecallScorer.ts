/**
 * Conservative lexical scoring for the new one-/two-/three-fact adult recall
 * exercises. The general explanation scorer permits edit-distance matches to
 * tolerate ASR noise; on a one-word task, "silk" would otherwise satisfy
 * "milk" and grant an entire clinical trial. That is too weak evidence for
 * promotion. Keep this small explicit equivalence table distinct from
 * narrative main-concept scoring and disclose it as an uncalibrated proxy.
 */
const FACT_EQUIVALENTS: Record<string, readonly string[]> = {
  market: ['grocery store', 'supermarket'],
  clinic: ['medical clinic', 'doctor office', "doctor's office"],
  cafe: ['coffee shop', 'café'],
  phone: ['telephone'],
  friend: ['buddy', 'pal'],
  florist: ['flower shop'],
  rain: ['raining', 'rained'],
  roses: ['rose'],
  boots: ['boot'],
  shirts: ['shirt'],
  applauded: ['clapped', 'clapping'],
};

function normalize(text: string): string {
  return text.toLowerCase().normalize('NFKD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();
}

export interface MicroRecallScore {
  matchedEvents: string[];
  eventsFound: number;
  eventsTotal: number;
  eventCoverage: number;
}

export function scoreMicroRecall(transcript: string, expectedFacts: readonly string[]): MicroRecallScore {
  const response = ` ${normalize(transcript)} `;
  const matchedEvents = expectedFacts.filter((fact) => {
    const aliases = [fact, ...(FACT_EQUIVALENTS[normalize(fact)] ?? [])];
    return aliases.some(alias => {
      const target = normalize(alias);
      return target.length > 0 && response.includes(` ${target} `);
    });
  });
  return {
    matchedEvents,
    eventsFound: matchedEvents.length,
    eventsTotal: expectedFacts.length,
    eventCoverage: expectedFacts.length > 0 ? matchedEvents.length / expectedFacts.length : 0,
  };
}
