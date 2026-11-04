/**
 * Short, adult-oriented single-/two-/three-fact listening material.
 * One scored fact per scene. Clinical calibration defaults, not validated
 * diagnostic items. Every tier has 18 unique stories; do not substitute a
 * four-event narrative when a patient is assigned one-fact recall.
 */
import type { NarrativeStory } from './narrativeRetellStimuli';

interface EverydaySequence {
  id: string;
  title: string;
  scenes: [string, string, string];
  facts: [string, string, string];
  emoji: [string, string, string];
}

const EVERYDAY_SEQUENCES: EverydaySequence[] = [
  { id: 'clinic', title: 'Clinic Visit', scenes: ['Rita went to the clinic.', 'She spoke with a nurse.', 'She received a reminder card.'], facts: ['clinic', 'nurse', 'card'], emoji: ['🏥', '👩‍⚕️', '📅'] },
  { id: 'market', title: 'At the Market', scenes: ['Tom went to the market.', 'He bought some milk.', 'He paid at the counter.'], facts: ['market', 'milk', 'counter'], emoji: ['🏪', '🥛', '💳'] },
  { id: 'cafe', title: 'A Cup of Tea', scenes: ['Anna visited a cafe.', 'She ordered tea.', 'She sat near a window.'], facts: ['cafe', 'tea', 'window'], emoji: ['☕', '🍵', '🪟'] },
  { id: 'library', title: 'The Library', scenes: ['Sam visited the library.', 'He borrowed a book.', 'He carried it home.'], facts: ['library', 'book', 'home'], emoji: ['📚', '📖', '🏠'] },
  { id: 'garden', title: 'In the Garden', scenes: ['Mia walked into her garden.', 'She planted a flower.', 'She watered the soil.'], facts: ['garden', 'flower', 'water'], emoji: ['🌻', '🌷', '💧'] },
  { id: 'laundry', title: 'Laundry Day', scenes: ['Paul found a laundry basket.', 'He washed his shirts.', 'He folded them on the bed.'], facts: ['basket', 'shirts', 'bed'], emoji: ['🧺', '👕', '🛏️'] },
  { id: 'bus', title: 'The Bus Stop', scenes: ['Dana waited at a bus stop.', 'She boarded a bus.', 'She got off near the park.'], facts: ['stop', 'bus', 'park'], emoji: ['🚏', '🚌', '🌳'] },
  { id: 'phone', title: 'Calling a Friend', scenes: ['Lee picked up a phone.', 'He called a friend.', 'They planned to meet on Friday.'], facts: ['phone', 'friend', 'Friday'], emoji: ['📱', '📞', '📆'] },
  { id: 'meal', title: 'Making Lunch', scenes: ['Joan entered the kitchen.', 'She made a sandwich.', 'She ate at the table.'], facts: ['kitchen', 'sandwich', 'table'], emoji: ['🍽️', '🥪', '🪑'] },
  { id: 'mail', title: 'Sending a Letter', scenes: ['Eric wrote a letter.', 'He put it in an envelope.', 'He carried it to the mailbox.'], facts: ['letter', 'envelope', 'mailbox'], emoji: ['✉️', '📨', '📮'] },
  { id: 'rain', title: 'The Rainy Walk', scenes: ['Nina stepped outside.', 'It started raining.', 'She opened an umbrella.'], facts: ['outside', 'rain', 'umbrella'], emoji: ['🚶', '🌧️', '☂️'] },
  { id: 'train', title: 'Taking the Train', scenes: ['Ben arrived at the station.', 'He bought a ticket.', 'He boarded the train.'], facts: ['station', 'ticket', 'train'], emoji: ['🚉', '🎫', '🚆'] },
  { id: 'dog', title: 'Walking the Dog', scenes: ['Omar found the dog leash.', 'He walked his dog.', 'They stopped by a bench.'], facts: ['leash', 'dog', 'bench'], emoji: ['🦮', '🐕', '🪑'] },
  { id: 'baker', title: 'At the Bakery', scenes: ['Grace visited the bakery.', 'She chose some bread.', 'She carried it in a bag.'], facts: ['bakery', 'bread', 'bag'], emoji: ['🥐', '🍞', '🛍️'] },
  { id: 'shoes', title: 'New Shoes', scenes: ['Alex entered the shoe store.', 'He tried on boots.', 'He paid with a card.'], facts: ['store', 'boots', 'card'], emoji: ['🏬', '🥾', '💳'] },
  { id: 'concert', title: 'Evening Music', scenes: ['Helen went to a concert.', 'She heard a violin.', 'She applauded at the end.'], facts: ['concert', 'violin', 'applauded'], emoji: ['🎟️', '🎻', '👏'] },
  { id: 'doctor', title: 'Checking the Time', scenes: ['Martin checked his calendar.', 'He saw an appointment.', 'He set an alarm.'], facts: ['calendar', 'appointment', 'alarm'], emoji: ['🗓️', '🩺', '⏰'] },
  { id: 'flowers', title: 'Flowers for a Friend', scenes: ['Carla went to a florist.', 'She bought roses.', 'She gave them to a friend.'], facts: ['florist', 'roses', 'friend'], emoji: ['💐', '🌹', '🤝'] },
];

/** A given story contains exactly N factual targets, rather than a long story
 * with an artificially reduced scoring denominator. */
export type MicroRecallStory = NarrativeStory & { microRecallLevel: 1 | 2 | 3 };

export const MICRO_RECALL_STORIES: MicroRecallStory[] =
  EVERYDAY_SEQUENCES.flatMap((entry) =>
    ([1, 2, 3] as const).map((level): MicroRecallStory => ({
      id: `micro-${entry.id}-${level}`,
      title: entry.title,
      scenes: entry.scenes.slice(0, level).map((text, i) => ({ text, emoji: entry.emoji[i] })),
      keyEvents: entry.facts.slice(0, level),
      expectedClauses: level,
      tier: 1,
      microRecallLevel: level,
      structureMap: {
        beginning: [0],
        middle: level === 3 ? [1] : [],
        end: level === 2 ? [1] : level === 3 ? [2] : [],
      },
    })),
  );
