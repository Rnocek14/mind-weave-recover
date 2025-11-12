// Curated photo-naming trials with semantic foils
// Images use placeholder.svg for MVP - can be replaced with real images from storage

export interface PhotoTrial {
  id: string;
  imageUrl: string;
  target: string; // Correct answer
  semanticFoils: string[]; // 2-3 semantically related distractors
  category: string;
}

export const PHOTO_BANK: PhotoTrial[] = [
  // Household objects
  {
    id: 'house_1',
    imageUrl: '/placeholder.svg',
    target: 'house',
    semanticFoils: ['building', 'home', 'apartment'],
    category: 'buildings',
  },
  {
    id: 'chair_1',
    imageUrl: '/placeholder.svg',
    target: 'chair',
    semanticFoils: ['table', 'stool', 'bench'],
    category: 'furniture',
  },
  {
    id: 'cup_1',
    imageUrl: '/placeholder.svg',
    target: 'cup',
    semanticFoils: ['glass', 'mug', 'bowl'],
    category: 'kitchenware',
  },
  {
    id: 'phone_1',
    imageUrl: '/placeholder.svg',
    target: 'phone',
    semanticFoils: ['tablet', 'remote', 'calculator'],
    category: 'electronics',
  },
  
  // Animals
  {
    id: 'dog_1',
    imageUrl: '/placeholder.svg',
    target: 'dog',
    semanticFoils: ['cat', 'puppy', 'wolf'],
    category: 'animals',
  },
  {
    id: 'bird_1',
    imageUrl: '/placeholder.svg',
    target: 'bird',
    semanticFoils: ['eagle', 'chicken', 'parrot'],
    category: 'animals',
  },
  
  // Food
  {
    id: 'apple_1',
    imageUrl: '/placeholder.svg',
    target: 'apple',
    semanticFoils: ['orange', 'fruit', 'banana'],
    category: 'food',
  },
  {
    id: 'bread_1',
    imageUrl: '/placeholder.svg',
    target: 'bread',
    semanticFoils: ['toast', 'roll', 'bagel'],
    category: 'food',
  },
  
  // Transportation
  {
    id: 'car_1',
    imageUrl: '/placeholder.svg',
    target: 'car',
    semanticFoils: ['truck', 'vehicle', 'bus'],
    category: 'transportation',
  },
  {
    id: 'bike_1',
    imageUrl: '/placeholder.svg',
    target: 'bike',
    semanticFoils: ['bicycle', 'motorcycle', 'scooter'],
    category: 'transportation',
  },
  
  // Body parts
  {
    id: 'hand_1',
    imageUrl: '/placeholder.svg',
    target: 'hand',
    semanticFoils: ['arm', 'finger', 'fist'],
    category: 'body',
  },
  {
    id: 'eye_1',
    imageUrl: '/placeholder.svg',
    target: 'eye',
    semanticFoils: ['face', 'nose', 'ear'],
    category: 'body',
  },
];

export const getRandomTrials = (count: number): PhotoTrial[] => {
  const shuffled = [...PHOTO_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, PHOTO_BANK.length));
};

export const generateChoices = (trial: PhotoTrial): string[] => {
  // Generate 4 choices: 1 target + 3 distractors
  const allChoices = [trial.target, ...trial.semanticFoils.slice(0, 3)];
  // Shuffle choices
  return allChoices.sort(() => Math.random() - 0.5);
};
