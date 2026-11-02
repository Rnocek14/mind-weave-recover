/**
 * Narrative Retell: 8 executable practice stages selected from the actual
 * story bank, with content complexity and fading/rescue supports.
 * No new clinical promotion rules or validated coherence score.
 */
import { stallRevealLevel, type VisualSupportLevel } from '@/lib/narrative/visualSupport';

export type NarrativeTrainingStageLevel = 1|2|3|4|5|6|7|8;
export type NarrativeTrainingStage = {
  level: NarrativeTrainingStageLevel;
  label: string;
  storyTier: 1|2|3;
  baselineSupport: VisualSupportLevel;
  taskPrompt: string;
  novelOnly?: boolean;
};
const STAGES: Readonly<Record<NarrativeTrainingStageLevel,NarrativeTrainingStage>> = {
  1: {level:1,label:'Short story with scene help',storyTier:1,baselineSupport:3,taskPrompt:'Tell one important thing that happened.'},
  2: {level:2,label:'Short story with picture clues',storyTier:1,baselineSupport:2,taskPrompt:'Tell what happened first, next and last.'},
  3: {level:3,label:'Cause-and-effect with a sequence guide',storyTier:2,baselineSupport:1,taskPrompt:'Tell what happened and what caused the problem.'},
  4: {level:4,label:'Complete the story episode',storyTier:2,baselineSupport:1,taskPrompt:'Tell what the person wanted, what they tried, and what happened in the end.'},
  5: {level:5,label:'Retell a longer sequence',storyTier:3,baselineSupport:1,taskPrompt:'Tell the longer story in order. Include the important turning points.'},
  6: {level:6,label:'Tell the meaning of a story',storyTier:3,baselineSupport:0,taskPrompt:'Retell the events, then tell what the story might mean or teach us.'},
  7: {level:7,label:'Explain a character’s choices',storyTier:3,baselineSupport:0,taskPrompt:'Retell what happened, why the person acted that way, and how another person might feel.'},
  8: {level:8,label:'New story, your own retelling',storyTier:3,baselineSupport:0,novelOnly:true,
      taskPrompt:'Retell a new story in your own words. Explain the main events and what changed because of them.'},
};
export function getNarrativeTrainingStage(level: number|null|undefined): NarrativeTrainingStage|null {
  if (!Number.isInteger(level)||level == null||level<1||level>8)return null;
  return STAGES[level as NarrativeTrainingStageLevel];
}
export function resolveNarrativeTrainingVisualSupport(
  stage:NarrativeTrainingStage,stallPromptIndex:number,
):{baseline:VisualSupportLevel;stallReveal:VisualSupportLevel;level:VisualSupportLevel} {
  const stallReveal=stallRevealLevel(stallPromptIndex);
  return {baseline:stage.baselineSupport,stallReveal,
    level:Math.max(stage.baselineSupport,stallReveal) as VisualSupportLevel};
}