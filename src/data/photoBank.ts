// Curated photo-naming trials with semantic foils
// Real images for therapy exercises

import houseImg from '@/assets/photos/house.jpg';
import cupImg from '@/assets/photos/cup.jpg';
import dogImg from '@/assets/photos/dog.jpg';
import appleImg from '@/assets/photos/apple.jpg';
import chairImg from '@/assets/photos/chair.jpg';
import phoneImg from '@/assets/photos/phone.jpg';
import birdImg from '@/assets/photos/bird.jpg';
import breadImg from '@/assets/photos/bread.jpg';
import carImg from '@/assets/photos/car.jpg';
import handImg from '@/assets/photos/hand.jpg';
import eyeImg from '@/assets/photos/eye.jpg';
import catImg from '@/assets/photos/cat.jpg';
import bikeImg from '@/assets/photos/bike.jpg';

export interface PhotoTrial {
  id: string;
  imageUrl: string;
  target: string; // Correct answer
  semanticFoils: string[]; // Related distractors
  phonologicalFoils?: string[]; // Sound-similar distractors (for hard mode)
  category: string;
  minLevel: number; // Minimum difficulty level for this trial
  maxLevel: number; // Maximum difficulty level for this trial
}

export const PHOTO_BANK: PhotoTrial[] = [
  // EASY TRIALS (Levels 1-3): Broad semantic categories, unrelated foils
  {
    id: 'house_1',
    imageUrl: houseImg,
    target: 'house',
    semanticFoils: ['tree', 'car', 'apple'], // Very different categories
    category: 'buildings',
    minLevel: 1,
    maxLevel: 4,
  },
  {
    id: 'cup_1',
    imageUrl: cupImg,
    target: 'cup',
    semanticFoils: ['shoe', 'book', 'chair'], // Unrelated objects
    category: 'kitchenware',
    minLevel: 1,
    maxLevel: 4,
  },
  {
    id: 'dog_1',
    imageUrl: dogImg,
    target: 'dog',
    semanticFoils: ['car', 'tree', 'house'], // Very different
    category: 'animals',
    minLevel: 1,
    maxLevel: 4,
  },
  {
    id: 'apple_1',
    imageUrl: appleImg,
    target: 'apple',
    semanticFoils: ['shoe', 'car', 'chair'], // Unrelated
    category: 'food',
    minLevel: 1,
    maxLevel: 4,
  },
  
  // MEDIUM TRIALS (Levels 4-7): Close semantic foils, same category
  {
    id: 'chair_2',
    imageUrl: chairImg,
    target: 'chair',
    semanticFoils: ['table', 'stool', 'bench', 'couch'], // All furniture
    category: 'furniture',
    minLevel: 4,
    maxLevel: 8,
  },
  {
    id: 'phone_2',
    imageUrl: phoneImg,
    target: 'phone',
    semanticFoils: ['tablet', 'computer', 'watch', 'remote'], // All electronics
    category: 'electronics',
    minLevel: 4,
    maxLevel: 8,
  },
  {
    id: 'dog_2',
    imageUrl: dogImg,
    target: 'dog',
    semanticFoils: ['cat', 'wolf', 'fox', 'puppy'], // Close animals
    category: 'animals',
    minLevel: 4,
    maxLevel: 8,
  },
  {
    id: 'bird_2',
    imageUrl: birdImg,
    target: 'bird',
    semanticFoils: ['eagle', 'robin', 'sparrow', 'crow'], // Specific birds
    category: 'animals',
    minLevel: 4,
    maxLevel: 8,
  },
  {
    id: 'bread_2',
    imageUrl: breadImg,
    target: 'bread',
    semanticFoils: ['toast', 'roll', 'bagel', 'bun'], // Close food items
    category: 'food',
    minLevel: 4,
    maxLevel: 8,
  },
  {
    id: 'car_2',
    imageUrl: carImg,
    target: 'car',
    semanticFoils: ['truck', 'van', 'suv', 'sedan'], // Vehicle types
    category: 'transportation',
    minLevel: 4,
    maxLevel: 8,
  },
  
  // HARD TRIALS (Levels 8-10): Phonological similarity + semantic overlap
  {
    id: 'hand_3',
    imageUrl: handImg,
    target: 'hand',
    semanticFoils: ['arm', 'wrist', 'finger', 'palm'], // Body parts
    phonologicalFoils: ['sand', 'band', 'land'], // Sound-alike
    category: 'body',
    minLevel: 7,
    maxLevel: 10,
  },
  {
    id: 'eye_3',
    imageUrl: eyeImg,
    target: 'eye',
    semanticFoils: ['nose', 'face', 'brow', 'lid'], // Face parts
    phonologicalFoils: ['aye', 'rye', 'pie'], // Sound-alike
    category: 'body',
    minLevel: 7,
    maxLevel: 10,
  },
  {
    id: 'cat_3',
    imageUrl: catImg,
    target: 'cat',
    semanticFoils: ['kitten', 'feline', 'tiger', 'lion'], // Close animals
    phonologicalFoils: ['hat', 'bat', 'mat'], // Sound-alike
    category: 'animals',
    minLevel: 7,
    maxLevel: 10,
  },
  {
    id: 'bike_3',
    imageUrl: bikeImg,
    target: 'bike',
    semanticFoils: ['cycle', 'scooter', 'moped', 'trike'], // Vehicles
    phonologicalFoils: ['hike', 'pike', 'mike'], // Sound-alike
    category: 'transportation',
    minLevel: 7,
    maxLevel: 10,
  },
];

export const getTrialsForLevel = (level: number, count: number): PhotoTrial[] => {
  // Filter trials appropriate for current difficulty level
  const eligible = PHOTO_BANK.filter(
    (trial) => level >= trial.minLevel && level <= trial.maxLevel
  );
  
  if (eligible.length === 0) {
    console.warn(`No trials found for level ${level}, using all trials`);
    return getRandomTrials(count);
  }
  
  const shuffled = [...eligible].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, shuffled.length));
};

export const getRandomTrials = (count: number): PhotoTrial[] => {
  const shuffled = [...PHOTO_BANK].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(count, PHOTO_BANK.length));
};

export const generateChoices = (trial: PhotoTrial, level: number): string[] => {
  const choiceCount = level <= 3 ? 3 : 4; // Easy mode = 3 choices
  const usePhonological = level >= 8 && trial.phonologicalFoils;
  
  let foils: string[];
  if (usePhonological) {
    // Hard mode: mix semantic and phonological foils
    foils = [
      ...trial.semanticFoils.slice(0, 2),
      ...(trial.phonologicalFoils || []).slice(0, 1),
    ];
  } else {
    foils = trial.semanticFoils;
  }
  
  const allChoices = [trial.target, ...foils.slice(0, choiceCount - 1)];
  // Shuffle choices
  return allChoices.sort(() => Math.random() - 0.5);
};
