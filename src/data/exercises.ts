/**
 * UI Exercise Registry — derived from canonical registry.
 * Used by dashboard and exercise picker components.
 */

import type { LucideIcon } from "lucide-react";
import { CANONICAL_EXERCISES } from "./canonicalExerciseRegistry";

export interface Exercise {
  id: string;
  title: string;
  icon: LucideIcon;
  category: string;
  duration: string;
  difficulty: string;
  color: string;
}

export const EXERCISES: Exercise[] = CANONICAL_EXERCISES.map(e => ({
  id: e.slug,
  title: e.title,
  icon: e.icon,
  category: e.category,
  duration: e.duration,
  difficulty: e.difficulty,
  color: e.color,
}));
