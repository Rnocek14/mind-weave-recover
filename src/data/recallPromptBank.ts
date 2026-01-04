/**
 * Recall Prompt Bank
 * 
 * Open category prompts for word retrieval practice.
 * User says ANY word in the category - no specific target.
 */

export interface RecallPrompt {
  id: string;
  prompt: string;
  category: string;
  examples: string[]; // For validation hints, not shown to user
  difficulty: 'easy' | 'medium';
}

export const RECALL_PROMPTS: RecallPrompt[] = [
  // Easy - very common categories
  { id: 'rp-1', prompt: 'Name any fruit', category: 'fruits', examples: ['apple', 'banana', 'orange', 'grape'], difficulty: 'easy' },
  { id: 'rp-2', prompt: 'Name any color', category: 'colors', examples: ['red', 'blue', 'green', 'yellow'], difficulty: 'easy' },
  { id: 'rp-3', prompt: 'Name any animal', category: 'animals', examples: ['dog', 'cat', 'bird', 'fish'], difficulty: 'easy' },
  { id: 'rp-4', prompt: 'Name a day of the week', category: 'days', examples: ['monday', 'tuesday', 'friday', 'sunday'], difficulty: 'easy' },
  { id: 'rp-5', prompt: 'Name any number', category: 'numbers', examples: ['one', 'two', 'five', 'ten'], difficulty: 'easy' },
  { id: 'rp-6', prompt: 'Name any body part', category: 'body', examples: ['hand', 'head', 'arm', 'leg'], difficulty: 'easy' },
  
  // Medium - still common but slightly more varied
  { id: 'rp-7', prompt: 'Name something in a kitchen', category: 'kitchen', examples: ['spoon', 'cup', 'plate', 'stove'], difficulty: 'medium' },
  { id: 'rp-8', prompt: 'Name something you can drink', category: 'drinks', examples: ['water', 'coffee', 'tea', 'juice'], difficulty: 'medium' },
  { id: 'rp-9', prompt: 'Name something you wear', category: 'clothing', examples: ['shirt', 'shoes', 'hat', 'pants'], difficulty: 'medium' },
  { id: 'rp-10', prompt: 'Name a vehicle', category: 'vehicles', examples: ['car', 'bus', 'bike', 'train'], difficulty: 'medium' },
  { id: 'rp-11', prompt: 'Name a room in a house', category: 'rooms', examples: ['kitchen', 'bedroom', 'bathroom', 'living room'], difficulty: 'medium' },
  { id: 'rp-12', prompt: 'Name something outside', category: 'outdoor', examples: ['tree', 'sun', 'grass', 'cloud'], difficulty: 'medium' },
  { id: 'rp-13', prompt: 'Name a food', category: 'food', examples: ['bread', 'rice', 'egg', 'chicken'], difficulty: 'medium' },
  { id: 'rp-14', prompt: 'Name something in a bathroom', category: 'bathroom', examples: ['soap', 'towel', 'sink', 'mirror'], difficulty: 'medium' },
  { id: 'rp-15', prompt: 'Name a weather word', category: 'weather', examples: ['rain', 'sun', 'wind', 'snow'], difficulty: 'medium' },
];

/**
 * Get a random recall prompt
 */
export function getRandomRecallPrompt(difficulty?: 'easy' | 'medium', exclude?: string[]): RecallPrompt {
  let pool = RECALL_PROMPTS.filter(p => !exclude?.includes(p.id));
  
  if (difficulty) {
    pool = pool.filter(p => p.difficulty === difficulty);
  }
  
  if (pool.length === 0) {
    pool = RECALL_PROMPTS.filter(p => p.difficulty === 'easy');
  }
  
  return pool[Math.floor(Math.random() * pool.length)];
}
