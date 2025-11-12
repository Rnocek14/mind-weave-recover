/**
 * Generate progressive cues for photo-naming tasks
 */

export const generateSemanticCue = (category: string, target: string): string => {
  const categoryHints: Record<string, string> = {
    animals: "It's a type of animal",
    buildings: "It's a type of building or structure",
    furniture: "It's a piece of furniture",
    kitchenware: "It's something you'd find in the kitchen",
    electronics: "It's an electronic device",
    food: "It's something you can eat",
    transportation: "It's a type of vehicle or transportation",
    body: "It's a part of the body",
  };
  
  return categoryHints[category] || `It's related to ${category}`;
};

export const generatePhonologicalCue = (target: string): string => {
  const firstLetter = target.charAt(0).toUpperCase();
  return `It starts with the letter "${firstLetter}"`;
};

export const generateFullCue = (target: string): string => {
  return `The word is "${target}"`;
};

export const getCueText = (
  cueLevel: number,
  category: string,
  target: string
): string => {
  switch (cueLevel) {
    case 1:
      return generateSemanticCue(category, target);
    case 2:
      return generatePhonologicalCue(target);
    case 3:
      return generateFullCue(target);
    default:
      return '';
  }
};
