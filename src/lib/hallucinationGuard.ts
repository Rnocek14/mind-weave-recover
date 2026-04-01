/**
 * Hallucination Guard — prevents Maya from introducing entities
 * the user never mentioned.
 *
 * Architecture:
 *   1. Entity Allowlist  – built from user text + rolling memory + game context
 *   2. Prompt Constraint  – injected into the system prompt as a hard rule
 *   3. Post-Response Validator – flags newly-introduced concrete nouns
 *   4. One Retry  – if validation fails, retry with correction instruction
 *
 * Core rule:
 *   Maya may elaborate on user content but may NOT invent new concrete
 *   entities (people, places, objects, animals, food) unless they come
 *   from an explicitly active game or approved memory item.
 */

// ═══════════════════════════════════════════════════════════════
// Types
// ═══════════════════════════════════════════════════════════════

export interface EntityAllowlist {
  /** Words the user said in the current turn */
  currentTurnEntities: string[];
  /** Words from the rolling memory / recent conversation */
  memoryEntities: string[];
  /** Words from active game context (photo target, minimal pair words) */
  gameEntities: string[];
  /** All combined, lowercased, deduplicated */
  all: Set<string>;
}

export interface HallucinationCheckResult {
  passed: boolean;
  /** New nouns Maya introduced that aren't in the allowlist */
  violatingWords: string[];
  /** The allowlist used for checking */
  allowlistSize: number;
}

// ═══════════════════════════════════════════════════════════════
// Common nouns that are SAFE to introduce (generic / conversational)
// These are words Maya can use without the user having said them.
// ═══════════════════════════════════════════════════════════════

const SAFE_GENERIC_NOUNS = new Set([
  // Conversational fillers / abstract
  'time', 'day', 'way', 'thing', 'things', 'stuff', 'part', 'bit',
  'moment', 'second', 'minute', 'place', 'kind', 'type', 'sort',
  'fun', 'idea', 'story', 'memory', 'memories', 'break', 'rest',
  // Time references
  'today', 'yesterday', 'tomorrow', 'morning', 'afternoon', 'evening',
  'night', 'week', 'weekend', 'month',
  // People (generic)
  'people', 'everyone', 'someone', 'anybody', 'family',
  // Therapy-safe
  'word', 'words', 'sentence', 'sound', 'sounds', 'name',
  'question', 'answer', 'try', 'turn',
  // Body / feelings (always okay to reference)
  'feeling', 'feelings', 'mood', 'energy',
]);

// Concrete noun categories that REQUIRE user mention
const CONCRETE_NOUN_PATTERNS = /\b(dog|cat|bird|duck|ducks|elephant|fish|horse|cow|pig|rabbit|bear|lion|tiger|monkey|penguin|chicken|turtle|frog|snake|spider|ant|bee|butterfly|squirrel|deer|fox|wolf|owl|parrot|hamster|mouse|rat|goat|sheep|donkey|camel|giraffe|zebra|whale|dolphin|shark|octopus|crab|lobster|shrimp|snail|worm|cake|pie|cookie|cookies|bread|toast|egg|eggs|bacon|cheese|butter|milk|juice|soda|wine|beer|pizza|burger|hamburger|sandwich|salad|soup|steak|rice|pasta|noodles|cereal|yogurt|banana|apple|grape|grapes|cherry|cherries|strawberry|strawberries|blueberry|blueberries|watermelon|peach|pear|lemon|lime|mango|pineapple|coconut|tomato|potato|carrot|corn|broccoli|spinach|lettuce|onion|garlic|pepper|mushroom|cucumber|bean|beans|pea|peas|chocolate|vanilla|candy|donut|pancake|waffle|bagel|muffin|pretzel|popcorn|chip|chips|cracker|crackers|car|truck|bus|train|plane|airplane|boat|ship|bicycle|motorcycle|scooter|helicopter|rocket|ambulance|taxi|subway|chair|table|desk|couch|sofa|bed|lamp|mirror|clock|door|window|stairs|shelf|drawer|pillow|blanket|towel|basket|bucket|broom|vacuum|cup|glass|plate|bowl|fork|knife|spoon|pot|pan|oven|stove|fridge|refrigerator|microwave|blender|toaster|kettle|bottle|jar|box|bag|pen|pencil|book|notebook|paper|scissors|tape|glue|ruler|eraser|crayon|marker|brush|paint|camera|phone|computer|laptop|tablet|keyboard|screen|tv|television|radio|speaker|headphone|headphones|guitar|piano|drum|drums|violin|flute|trumpet|ball|balloon|kite|puzzle|doll|robot|block|blocks|lego|swing|swings|slide|seesaw|sandbox|trampoline|skateboard|rollerblades|helmet|bat|glove|racket|net|goal|hoop|pool|beach|ocean|lake|river|pond|stream|waterfall|mountain|hill|valley|forest|jungle|desert|island|cave|bridge|tunnel|fountain|statue|bench|fence|gate|path|trail|garden|flower|flowers|tree|trees|bush|grass|leaf|leaves|branch|root|seed|rock|stone|sand|dirt|mud|snow|rain|cloud|clouds|sun|moon|star|stars|rainbow|hat|cap|helmet|glasses|sunglasses|scarf|glove|gloves|mitten|mittens|sock|socks|shoe|shoes|boot|boots|sandal|sandals|shirt|blouse|sweater|jacket|coat|vest|dress|skirt|pants|jeans|shorts|belt|tie|ribbon|button|zipper|pocket|purse|backpack|suitcase|umbrella|watch|ring|necklace|bracelet|earring|earrings)\b/gi;

// ═══════════════════════════════════════════════════════════════
// Build Allowlist
// ═══════════════════════════════════════════════════════════════

export function buildEntityAllowlist(
  currentUserText: string,
  conversationHistory?: { role: string; text: string }[],
  rollingMemory?: string | null,
  gameContext?: { targets?: string[]; category?: string } | null,
): EntityAllowlist {
  const extract = (text: string): string[] => {
    if (!text) return [];
    const matches = text.match(CONCRETE_NOUN_PATTERNS);
    return matches ? matches.map(m => m.toLowerCase()) : [];
  };

  const currentTurnEntities = extract(currentUserText);

  // Extract from recent conversation history (user turns only)
  const memoryEntities: string[] = [];
  if (conversationHistory) {
    for (const turn of conversationHistory) {
      if (turn.role === 'user') {
        memoryEntities.push(...extract(turn.text));
      }
    }
  }
  if (rollingMemory) {
    memoryEntities.push(...extract(rollingMemory));
  }

  const gameEntities: string[] = [];
  if (gameContext?.targets) {
    gameEntities.push(...gameContext.targets.map(t => t.toLowerCase()));
  }

  const all = new Set([
    ...currentTurnEntities,
    ...memoryEntities,
    ...gameEntities,
  ]);

  return { currentTurnEntities, memoryEntities, gameEntities, all };
}

// ═══════════════════════════════════════════════════════════════
// Post-Response Validator
// ═══════════════════════════════════════════════════════════════

export function checkForHallucinations(
  mayaResponse: string,
  allowlist: EntityAllowlist,
): HallucinationCheckResult {
  const responseNouns = mayaResponse.match(CONCRETE_NOUN_PATTERNS);
  if (!responseNouns || responseNouns.length === 0) {
    return { passed: true, violatingWords: [], allowlistSize: allowlist.all.size };
  }

  const violating: string[] = [];
  const seen = new Set<string>();

  for (const noun of responseNouns) {
    const lower = noun.toLowerCase();
    if (seen.has(lower)) continue;
    seen.add(lower);

    if (SAFE_GENERIC_NOUNS.has(lower)) continue;
    if (allowlist.all.has(lower)) continue;

    // Check plural/singular variants
    const singular = lower.endsWith('s') ? lower.slice(0, -1) : lower;
    const plural = lower + 's';
    if (allowlist.all.has(singular) || allowlist.all.has(plural)) continue;

    violating.push(lower);
  }

  return {
    passed: violating.length === 0,
    violatingWords: violating,
    allowlistSize: allowlist.all.size,
  };
}

// ═══════════════════════════════════════════════════════════════
// Prompt Constraint Block — injected into system prompt
// ═══════════════════════════════════════════════════════════════

export function getHallucinationGuardPromptBlock(allowlist: EntityAllowlist): string {
  const known = Array.from(allowlist.all).slice(0, 15).join(', ');
  return `[HALLUCINATION GUARD — MANDATORY]
You may ONLY reference objects, animals, food, and places that the user has already mentioned.
Known entities from this conversation: ${known || 'none yet'}
FORBIDDEN: Do NOT introduce new concrete nouns (animals, food, objects, places) that the user has not said.
BAD: User says "park" → you say "Did you see ducks?" (user never said ducks)
GOOD: User says "park" → you say "The park — who did you go with?"
If you need to give an A-or-B choice, use entities the user already mentioned, or use abstract options like "fun or relaxing?"`;
}

// ═══════════════════════════════════════════════════════════════
// Retry Instruction — used when first response fails validation
// ═══════════════════════════════════════════════════════════════

export function getHallucinationRetryInstruction(
  originalResponse: string,
  violatingWords: string[],
  allowlist: EntityAllowlist,
): string {
  const known = Array.from(allowlist.all).slice(0, 10).join(', ');
  return `REVISION REQUIRED: Your response "${originalResponse}" introduced words the user never said: [${violatingWords.join(', ')}]. ` +
    `Rewrite it using ONLY entities the user has mentioned: ${known || 'none — use abstract questions only'}. ` +
    `Keep it under 18 words. Do NOT add any new objects, animals, or food items.`;
}
