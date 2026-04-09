/**
 * Category Fluency Analysis — Clustering & Switching
 * 
 * Analyzes word generation patterns in verbal fluency tasks:
 * - Clusters: groups of semantically related words produced together
 * - Switches: transitions between clusters
 * - Perseverations: repeated words
 * 
 * Clinical basis: Troyer et al. (1997) — clustering reflects semantic memory,
 * switching reflects executive function/cognitive flexibility.
 */

// Subcategory maps for clustering analysis
const SUBCATEGORIES: Record<string, Record<string, string[]>> = {
  animals: {
    pets: ['dog', 'cat', 'hamster', 'goldfish', 'parrot', 'rabbit', 'guinea pig', 'turtle', 'bird', 'fish', 'kitten', 'puppy', 'bunny'],
    farm: ['cow', 'pig', 'chicken', 'horse', 'sheep', 'goat', 'rooster', 'hen', 'duck', 'donkey', 'bull', 'lamb', 'turkey'],
    wild: ['lion', 'tiger', 'elephant', 'bear', 'wolf', 'deer', 'fox', 'giraffe', 'zebra', 'leopard', 'cheetah', 'panther', 'moose'],
    ocean: ['whale', 'shark', 'dolphin', 'octopus', 'seal', 'crab', 'lobster', 'jellyfish', 'starfish', 'shrimp', 'tuna', 'salmon'],
    birds: ['eagle', 'hawk', 'owl', 'robin', 'sparrow', 'crow', 'pigeon', 'penguin', 'flamingo', 'pelican', 'hummingbird'],
    insects: ['ant', 'bee', 'butterfly', 'spider', 'fly', 'mosquito', 'beetle', 'ladybug', 'dragonfly', 'grasshopper'],
    reptiles: ['snake', 'lizard', 'crocodile', 'alligator', 'turtle', 'gecko', 'iguana', 'chameleon', 'frog', 'toad'],
  },
  foods: {
    fruits: ['apple', 'banana', 'orange', 'grape', 'strawberry', 'blueberry', 'mango', 'pineapple', 'watermelon', 'peach', 'pear', 'cherry', 'lemon', 'lime', 'kiwi'],
    vegetables: ['carrot', 'broccoli', 'potato', 'tomato', 'onion', 'lettuce', 'corn', 'pepper', 'cucumber', 'celery', 'peas', 'beans', 'spinach', 'cabbage'],
    grains: ['bread', 'rice', 'pasta', 'cereal', 'oatmeal', 'noodles', 'tortilla', 'bagel', 'cracker', 'pancake', 'waffle'],
    protein: ['chicken', 'beef', 'fish', 'egg', 'steak', 'pork', 'bacon', 'sausage', 'ham', 'turkey', 'shrimp', 'salmon', 'tuna'],
    dairy: ['milk', 'cheese', 'yogurt', 'butter', 'cream', 'ice cream'],
    sweets: ['cake', 'cookie', 'chocolate', 'candy', 'pie', 'donut', 'brownie', 'cupcake'],
  },
  clothes: {
    tops: ['shirt', 'blouse', 'sweater', 'jacket', 'coat', 'hoodie', 'vest', 'tank top', 'polo'],
    bottoms: ['pants', 'jeans', 'shorts', 'skirt', 'leggings', 'trousers', 'sweatpants'],
    footwear: ['shoes', 'boots', 'sandals', 'sneakers', 'slippers', 'heels', 'flip flops', 'loafers'],
    accessories: ['hat', 'scarf', 'gloves', 'belt', 'tie', 'watch', 'sunglasses', 'earrings', 'necklace', 'bracelet', 'ring'],
    underwear: ['socks', 'underwear', 'bra', 'boxers'],
  },
  kitchen: {
    cookware: ['pan', 'pot', 'skillet', 'wok', 'baking sheet', 'casserole'],
    utensils: ['fork', 'knife', 'spoon', 'spatula', 'ladle', 'whisk', 'tongs', 'peeler'],
    dishes: ['plate', 'bowl', 'cup', 'mug', 'glass', 'saucer'],
    appliances: ['stove', 'oven', 'microwave', 'toaster', 'blender', 'mixer', 'refrigerator', 'dishwasher', 'coffee maker'],
  },
  tools: {
    hand: ['hammer', 'screwdriver', 'wrench', 'pliers', 'chisel', 'file', 'clamp'],
    cutting: ['saw', 'knife', 'scissors', 'axe', 'blade'],
    measuring: ['ruler', 'tape measure', 'level', 'square', 'protractor'],
    power: ['drill', 'sander', 'grinder', 'jigsaw', 'circular saw'],
    garden: ['shovel', 'rake', 'hoe', 'pruner', 'wheelbarrow', 'lawn mower'],
  },
  vehicles: {
    road: ['car', 'truck', 'bus', 'van', 'motorcycle', 'taxi', 'ambulance', 'fire truck', 'suv'],
    two_wheel: ['bicycle', 'bike', 'scooter', 'motorcycle', 'moped'],
    water: ['boat', 'ship', 'canoe', 'kayak', 'yacht', 'sailboat', 'ferry', 'submarine'],
    air: ['airplane', 'helicopter', 'jet', 'plane', 'blimp', 'glider'],
    rail: ['train', 'subway', 'trolley', 'tram', 'monorail'],
  },
  professions: {
    medical: ['doctor', 'nurse', 'dentist', 'surgeon', 'pharmacist', 'therapist', 'paramedic', 'veterinarian'],
    education: ['teacher', 'professor', 'tutor', 'principal', 'counselor', 'librarian'],
    trades: ['plumber', 'electrician', 'carpenter', 'mechanic', 'welder', 'painter'],
    service: ['chef', 'waiter', 'bartender', 'cashier', 'barber', 'janitor', 'driver'],
    office: ['lawyer', 'accountant', 'engineer', 'manager', 'secretary', 'analyst'],
    public: ['police', 'firefighter', 'soldier', 'judge', 'politician', 'mayor'],
  },
  emotions: {
    positive: ['happy', 'joyful', 'excited', 'grateful', 'proud', 'content', 'hopeful', 'calm', 'peaceful', 'cheerful', 'delighted'],
    negative: ['sad', 'angry', 'scared', 'anxious', 'frustrated', 'lonely', 'jealous', 'ashamed', 'guilty', 'nervous', 'worried'],
    neutral: ['surprised', 'confused', 'curious', 'bored', 'tired', 'indifferent'],
  },
  sports: {
    ball: ['soccer', 'basketball', 'baseball', 'football', 'tennis', 'volleyball', 'golf', 'cricket', 'rugby'],
    water: ['swimming', 'surfing', 'diving', 'water polo', 'rowing', 'sailing', 'kayaking'],
    winter: ['skiing', 'snowboarding', 'ice skating', 'hockey', 'curling'],
    combat: ['boxing', 'wrestling', 'karate', 'judo', 'fencing', 'taekwondo'],
    individual: ['running', 'cycling', 'gymnastics', 'archery', 'weightlifting', 'yoga'],
  },
  colors: {
    primary: ['red', 'blue', 'yellow'],
    warm: ['orange', 'red', 'pink', 'gold', 'maroon', 'coral', 'peach'],
    cool: ['blue', 'green', 'purple', 'teal', 'turquoise', 'cyan', 'navy', 'indigo'],
    neutral: ['black', 'white', 'gray', 'grey', 'brown', 'tan', 'beige', 'cream', 'silver'],
  },
};

function getSubcategory(word: string, category: string): string | null {
  const subs = SUBCATEGORIES[category];
  if (!subs) return null;
  const normalized = word.toLowerCase().trim();
  for (const [subName, words] of Object.entries(subs)) {
    if (words.some(w => w === normalized || normalized.includes(w) || w.includes(normalized))) {
      return subName;
    }
  }
  return null;
}

export interface ClusterInfo {
  subcategory: string;
  words: string[];
}

export interface FluencyAnalysis {
  totalWords: number;
  uniqueWords: number;
  clusters: ClusterInfo[];
  clusterCount: number;
  switchCount: number;
  averageClusterSize: number;
  perseverations: number;
  /** Ratio of switches to total words — higher = more flexible retrieval */
  switchRate: number;
  /** Dominant cluster label */
  dominantCluster: string | null;
  /** Whether user stayed in one cluster vs explored */
  retrievalPattern: 'focused' | 'flexible' | 'scattered';
}

export function analyzeFluency(words: string[], category: string): FluencyAnalysis {
  const seen = new Set<string>();
  const perseverations: string[] = [];
  const uniqueWords: string[] = [];

  for (const word of words) {
    const normalized = word.toLowerCase().trim();
    if (seen.has(normalized)) {
      perseverations.push(normalized);
    } else {
      seen.add(normalized);
      uniqueWords.push(normalized);
    }
  }

  // Assign subcategories in order
  const subcats = uniqueWords.map(w => getSubcategory(w, category) ?? 'other');

  // Build clusters (consecutive words in the same subcategory)
  const clusters: ClusterInfo[] = [];
  let currentCluster: ClusterInfo | null = null;

  for (let i = 0; i < uniqueWords.length; i++) {
    const sub = subcats[i];
    if (currentCluster && currentCluster.subcategory === sub) {
      currentCluster.words.push(uniqueWords[i]);
    } else {
      if (currentCluster) clusters.push(currentCluster);
      currentCluster = { subcategory: sub, words: [uniqueWords[i]] };
    }
  }
  if (currentCluster) clusters.push(currentCluster);

  const switchCount = Math.max(0, clusters.length - 1);
  const avgClusterSize = clusters.length > 0
    ? clusters.reduce((sum, c) => sum + c.words.length, 0) / clusters.length
    : 0;

  // Find dominant cluster
  const subCounts: Record<string, number> = {};
  for (const sub of subcats) {
    subCounts[sub] = (subCounts[sub] || 0) + 1;
  }
  const dominantEntry = Object.entries(subCounts)
    .filter(([k]) => k !== 'other')
    .sort((a, b) => b[1] - a[1])[0];
  const dominantCluster = dominantEntry ? dominantEntry[0] : null;

  // Retrieval pattern
  const distinctSubs = new Set(subcats.filter(s => s !== 'other')).size;
  let retrievalPattern: 'focused' | 'flexible' | 'scattered';
  if (distinctSubs <= 1) retrievalPattern = 'focused';
  else if (switchCount <= uniqueWords.length * 0.3) retrievalPattern = 'focused';
  else if (avgClusterSize >= 2) retrievalPattern = 'flexible';
  else retrievalPattern = 'scattered';

  return {
    totalWords: words.length,
    uniqueWords: uniqueWords.length,
    clusters: clusters.filter(c => c.subcategory !== 'other'),
    clusterCount: clusters.filter(c => c.subcategory !== 'other').length,
    switchCount,
    averageClusterSize: Math.round(avgClusterSize * 10) / 10,
    perseverations: perseverations.length,
    switchRate: uniqueWords.length > 1 ? Math.round((switchCount / (uniqueWords.length - 1)) * 100) / 100 : 0,
    dominantCluster,
    retrievalPattern,
  };
}

/** Build structured feedback from fluency analysis */
export function buildFluencyFeedback(analysis: FluencyAnalysis, category: string) {
  const strengths: string[] = [];
  const weaknesses: string[] = [];
  let nextStep: string;

  // Strengths
  if (analysis.uniqueWords >= 5) {
    strengths.push(`Generated ${analysis.uniqueWords} unique words — strong retrieval`);
  } else if (analysis.uniqueWords >= 3) {
    strengths.push(`Found ${analysis.uniqueWords} words — good start`);
  }

  if (analysis.clusterCount >= 2) {
    const clusterNames = analysis.clusters.slice(0, 3).map(c => c.subcategory.replace(/_/g, ' '));
    strengths.push(`Found groups: ${clusterNames.join(', ')}`);
  }

  if (analysis.retrievalPattern === 'flexible') {
    strengths.push('Good flexibility — switched between different groups');
  }

  if (analysis.averageClusterSize >= 3) {
    strengths.push('Strong depth within groups');
  }

  // Weaknesses
  if (analysis.perseverations > 0) {
    weaknesses.push(`Repeated ${analysis.perseverations} word${analysis.perseverations > 1 ? 's' : ''} — try to track what you've said`);
  }

  if (analysis.retrievalPattern === 'focused' && analysis.uniqueWords >= 3) {
    weaknesses.push('Stayed in one group — try switching to a new group when you get stuck');
  }

  if (analysis.retrievalPattern === 'scattered') {
    weaknesses.push('Words jumped between groups quickly — try staying in one group longer');
  }

  if (analysis.uniqueWords < 3) {
    weaknesses.push('Finding words was harder this time — that's okay, it builds with practice');
  }

  // Next step
  if (analysis.retrievalPattern === 'focused') {
    nextStep = 'Try the "switch" strategy: when you run out of words in one group, jump to a new group.';
  } else if (analysis.retrievalPattern === 'scattered') {
    nextStep = 'Try staying in one group (like "pets") until you can't think of more, then switch.';
  } else if (analysis.uniqueWords < 5) {
    nextStep = `Think about subcategories within ${category} — it helps you find more words.`;
  } else {
    nextStep = 'Keep practicing to make word retrieval faster and more automatic.';
  }

  return { strengths, weaknesses, nextStep };
}
