/**
 * Synonym Generator content bank — L1–L10 perceptual curve
 *
 * Standards (matches FixSentence / DescribeGuess / PhrasePractice):
 *  - Strict tier isolation (no cumulative blending)
 *  - Engine level 1..10 mapped centrally to 3 tiers
 *  - Clear perceptual gradient:
 *      T1 (engine 1–3): concrete, high-frequency adjectives — easy lexical access
 *      T2 (engine 4–7): emotional / evaluative adjectives — abstract but familiar
 *      T3 (engine 8–10): nuanced multi-POS targets (abstract adjectives + verbs)
 *  - Each tier has ≥12 unique prompts; pools are pairwise disjoint by `word`
 */

export type PartOfSpeech = 'adjective' | 'verb' | 'noun' | 'adverb';

export interface SynonymPrompt {
  /** Stable id used by distinctness audits — equals lowercase word */
  id: string;
  word: string;
  partOfSpeech: PartOfSpeech;
  acceptedSynonyms: string[];
  meaningNote: string;
  /** 1..3 — pure tier index, NOT engine level */
  difficulty: 1 | 2 | 3;
}

const T1: Omit<SynonymPrompt, 'difficulty' | 'id'>[] = [
  { word: 'happy', partOfSpeech: 'adjective', meaningNote: 'Feeling good or pleased',
    acceptedSynonyms: ['glad','joyful','cheerful','pleased','delighted','content','merry','thrilled','excited','elated','joyous','blissful','satisfied','upbeat','overjoyed'] },
  { word: 'big', partOfSpeech: 'adjective', meaningNote: 'Large in size',
    acceptedSynonyms: ['large','huge','enormous','giant','massive','great','vast','immense','tall','grand','broad','wide','sizable','hefty','bulky'] },
  { word: 'fast', partOfSpeech: 'adjective', meaningNote: 'Moving quickly',
    acceptedSynonyms: ['quick','rapid','speedy','swift','hasty','brisk','fleet','zippy','snappy','hurried','prompt','express','nimble'] },
  { word: 'cold', partOfSpeech: 'adjective', meaningNote: 'Low temperature',
    acceptedSynonyms: ['cool','chilly','freezing','icy','frigid','frosty','frozen','bitter','nippy','wintry','crisp'] },
  { word: 'small', partOfSpeech: 'adjective', meaningNote: 'Little in size',
    acceptedSynonyms: ['little','tiny','mini','petite','minute','miniature','compact','slim','slight','wee','short','modest'] },
  { word: 'nice', partOfSpeech: 'adjective', meaningNote: 'Pleasant or kind',
    acceptedSynonyms: ['kind','pleasant','friendly','lovely','good','agreeable','warm','sweet','caring','gentle','polite','decent','gracious'] },
  { word: 'hot', partOfSpeech: 'adjective', meaningNote: 'High temperature',
    acceptedSynonyms: ['warm','boiling','scorching','burning','sweltering','sizzling','fiery','blazing','toasty','roasting'] },
  { word: 'old', partOfSpeech: 'adjective', meaningNote: 'Aged or from long ago',
    acceptedSynonyms: ['aged','elderly','ancient','antique','vintage','mature','senior','seasoned','dated'] },
  { word: 'new', partOfSpeech: 'adjective', meaningNote: 'Recently made or arrived',
    acceptedSynonyms: ['fresh','recent','modern','novel','current','latest','brand-new','unused','original'] },
  { word: 'good', partOfSpeech: 'adjective', meaningNote: 'Of high quality',
    acceptedSynonyms: ['great','fine','excellent','wonderful','superb','quality','solid','decent','positive','pleasant'] },
  { word: 'bad', partOfSpeech: 'adjective', meaningNote: 'Of low quality',
    acceptedSynonyms: ['poor','terrible','awful','lousy','dreadful','unpleasant','negative','rotten','inferior','subpar'] },
  { word: 'tired', partOfSpeech: 'adjective', meaningNote: 'In need of rest',
    acceptedSynonyms: ['sleepy','exhausted','weary','drained','fatigued','worn-out','beat','spent','drowsy'] },
];

const T2: Omit<SynonymPrompt, 'difficulty' | 'id'>[] = [
  { word: 'smart', partOfSpeech: 'adjective', meaningNote: 'Having intelligence',
    acceptedSynonyms: ['clever','intelligent','bright','sharp','wise','brilliant','brainy','gifted','knowledgeable','astute','savvy','quick-witted'] },
  { word: 'angry', partOfSpeech: 'adjective', meaningNote: 'Feeling upset or mad',
    acceptedSynonyms: ['mad','furious','upset','irate','cross','annoyed','enraged','irritated','livid','outraged','frustrated','heated','hostile'] },
  { word: 'scared', partOfSpeech: 'adjective', meaningNote: 'Feeling fear',
    acceptedSynonyms: ['afraid','frightened','terrified','fearful','startled','nervous','alarmed','anxious','panicked','worried','uneasy','spooked'] },
  { word: 'beautiful', partOfSpeech: 'adjective', meaningNote: 'Very pleasing to look at',
    acceptedSynonyms: ['pretty','lovely','gorgeous','stunning','attractive','elegant','handsome','striking','charming','radiant','graceful','fine'] },
  { word: 'strong', partOfSpeech: 'adjective', meaningNote: 'Having power or strength',
    acceptedSynonyms: ['powerful','mighty','tough','sturdy','firm','solid','robust','muscular','hardy','forceful','durable','rugged'] },
  { word: 'quiet', partOfSpeech: 'adjective', meaningNote: 'Making little or no noise',
    acceptedSynonyms: ['silent','still','hushed','calm','peaceful','soft','muted','gentle','tranquil','noiseless','subdued','serene'] },
  { word: 'sad', partOfSpeech: 'adjective', meaningNote: 'Feeling sorrow',
    acceptedSynonyms: ['unhappy','down','blue','gloomy','sorrowful','miserable','heartbroken','glum','dejected','mournful','melancholy'] },
  { word: 'brave', partOfSpeech: 'adjective', meaningNote: 'Showing courage',
    acceptedSynonyms: ['bold','courageous','fearless','daring','heroic','gallant','valiant','plucky','intrepid','gutsy'] },
  { word: 'funny', partOfSpeech: 'adjective', meaningNote: 'Causing laughter',
    acceptedSynonyms: ['hilarious','amusing','comic','witty','humorous','entertaining','silly','laughable','comical','jokey'] },
  { word: 'lazy', partOfSpeech: 'adjective', meaningNote: 'Unwilling to work or be active',
    acceptedSynonyms: ['idle','sluggish','slothful','indolent','inactive','listless','unmotivated','lethargic','slack'] },
  { word: 'busy', partOfSpeech: 'adjective', meaningNote: 'Actively engaged in something',
    acceptedSynonyms: ['occupied','engaged','active','swamped','tied-up','hectic','bustling','working','involved','absorbed'] },
  { word: 'rich', partOfSpeech: 'adjective', meaningNote: 'Having much wealth',
    acceptedSynonyms: ['wealthy','affluent','prosperous','well-off','moneyed','loaded','opulent','flush','well-heeled'] },
];

const T3: Omit<SynonymPrompt, 'difficulty' | 'id'>[] = [
  { word: 'important', partOfSpeech: 'adjective', meaningNote: 'Having great value or significance',
    acceptedSynonyms: ['significant','crucial','vital','essential','critical','key','major','meaningful','valuable','serious','notable','central'] },
  { word: 'difficult', partOfSpeech: 'adjective', meaningNote: 'Hard to do or understand',
    acceptedSynonyms: ['hard','tough','challenging','demanding','complex','tricky','arduous','complicated','strenuous','grueling','taxing','rough'] },
  { word: 'strange', partOfSpeech: 'adjective', meaningNote: 'Unusual or unexpected',
    acceptedSynonyms: ['weird','odd','unusual','peculiar','bizarre','curious','uncommon','rare','mysterious','abnormal','quirky','different'] },
  { word: 'generous', partOfSpeech: 'adjective', meaningNote: 'Willing to give or share',
    acceptedSynonyms: ['giving','charitable','selfless','liberal','benevolent','unselfish','big-hearted','magnanimous','bountiful','open-handed'] },
  { word: 'cautious', partOfSpeech: 'adjective', meaningNote: 'Being careful to avoid risk',
    acceptedSynonyms: ['careful','wary','guarded','prudent','watchful','alert','mindful','attentive','hesitant','vigilant','deliberate'] },
  { word: 'create', partOfSpeech: 'verb', meaningNote: 'To bring something into existence',
    acceptedSynonyms: ['make','build','design','produce','construct','develop','form','invent','craft','generate','compose','establish'] },
  { word: 'examine', partOfSpeech: 'verb', meaningNote: 'To look at carefully',
    acceptedSynonyms: ['inspect','study','analyze','review','scrutinize','investigate','assess','probe','survey','check'] },
  { word: 'persuade', partOfSpeech: 'verb', meaningNote: 'To convince someone to do something',
    acceptedSynonyms: ['convince','urge','coax','sway','influence','encourage','win-over','prompt','induce','talk-into'] },
  { word: 'reluctant', partOfSpeech: 'adjective', meaningNote: 'Unwilling and slow to do something',
    acceptedSynonyms: ['hesitant','unwilling','averse','disinclined','loath','resistant','wary','grudging','unenthusiastic'] },
  { word: 'sincere', partOfSpeech: 'adjective', meaningNote: 'Honest and genuine',
    acceptedSynonyms: ['honest','genuine','truthful','earnest','heartfelt','candid','frank','authentic','open','straightforward'] },
  { word: 'abundant', partOfSpeech: 'adjective', meaningNote: 'Existing in large amounts',
    acceptedSynonyms: ['plentiful','ample','copious','bountiful','rich','overflowing','profuse','lavish','generous','full'] },
  { word: 'tolerate', partOfSpeech: 'verb', meaningNote: 'To allow or put up with',
    acceptedSynonyms: ['endure','accept','permit','allow','bear','stand','withstand','abide','stomach','put-up-with'] },
];

function withTier(items: Omit<SynonymPrompt, 'difficulty' | 'id'>[], tier: 1 | 2 | 3): SynonymPrompt[] {
  return items.map(p => ({ ...p, difficulty: tier, id: p.word.toLowerCase() }));
}

export const SYNONYM_PROMPTS: SynonymPrompt[] = [
  ...withTier(T1, 1),
  ...withTier(T2, 2),
  ...withTier(T3, 3),
];

/**
 * Central engine→tier mapping. Mirrors FixSentence/DescribeGuess:
 *   engine 1..3  → tier 1
 *   engine 4..7  → tier 2
 *   engine 8..10 → tier 3
 * Prevents silent clamping and content blending.
 */
export function mapEngineLevelToSynonymTier(engineLevel: number): 1 | 2 | 3 {
  const lvl = Math.max(1, Math.min(10, Math.round(engineLevel)));
  if (lvl <= 3) return 1;
  if (lvl <= 7) return 2;
  return 3;
}

export interface GetSynonymPromptOptions {
  /** Engine level 1..10 (NOT tier) */
  difficulty: number;
  /** Words already used this session */
  usedWords?: Set<string>;
}

/**
 * Strict tier-isolated picker. No cumulative `<=` blending,
 * no ±1 banding. If the tier is exhausted, recycles within the
 * SAME tier (never falls back to easier content).
 */
export function pickSynonymPrompt({ difficulty, usedWords }: GetSynonymPromptOptions): SynonymPrompt {
  const tier = mapEngineLevelToSynonymTier(difficulty);
  const pool = SYNONYM_PROMPTS.filter(p => p.difficulty === tier);
  const used = usedWords ?? new Set<string>();
  const fresh = pool.filter(p => !used.has(p.word.toLowerCase()));
  const candidates = fresh.length > 0 ? fresh : pool;
  return candidates[Math.floor(Math.random() * candidates.length)];
}

/**
 * Audit helper used by distinctness tests. Returns up to `count`
 * tier-isolated prompts at the given engine level.
 */
export function getSynonymTrials({ difficulty, count }: { difficulty: number; count: number }): SynonymPrompt[] {
  const tier = mapEngineLevelToSynonymTier(difficulty);
  const pool = SYNONYM_PROMPTS.filter(p => p.difficulty === tier);
  // Stable order for tests; production picker uses pickSynonymPrompt instead.
  return pool.slice(0, count);
}
