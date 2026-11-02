/**
 * Eight distinct Functional Command Scenes practice modes, deliberately
 * separate from clinical/mastery progression or speech-independent metrics.
 * All tasks operate on the six authored photo scenes and their real command
 * engine. The player labels modeled/tapped assistance separately from speech.
 */
import type { SceneDefinition } from './sceneEngine';

export type ScenePracticeLevel = 1|2|3|4|5|6|7|8;
export type ScenePracticeMode =
  'model'|'two_choices'|'goal_with_choices'|'independent_goal'|
  'object_action'|'repair'|'alternative_expression'|'context_switch';

export interface ScenePracticeStage {
  level: ScenePracticeLevel;
  title: string;
  instruction: string;
  mode: ScenePracticeMode;
  visibleChoices: boolean;
  requiredSteps: number;
}
const STAGES: readonly ScenePracticeStage[] = [
  {level:1,title:'One word, one action',instruction:'Watch the example. Try the one helpful word.',mode:'model',visibleChoices:true,requiredSteps:1},
  {level:2,title:'Choose the action',instruction:'Choose between two different commands and see what happens.',mode:'two_choices',visibleChoices:true,requiredSteps:1},
  {level:3,title:'Help the scene',instruction:'Choose a word that helps the scene reach its goal.',mode:'goal_with_choices',visibleChoices:true,requiredSteps:1},
  {level:4,title:'Say the command',instruction:'Try a command from the scene goal, without an automatic word model.',mode:'independent_goal',visibleChoices:false,requiredSteps:1},
  {level:5,title:'Action and object',instruction:'Give the object and what you want it to do in one short message.',mode:'object_action',visibleChoices:false,requiredSteps:1},
  {level:6,title:'Change and repair',instruction:'Make a change, then use another command to put it back.',mode:'repair',visibleChoices:false,requiredSteps:2},
  {level:7,title:'Say it another way',instruction:'Try a different word or expression with the same meaning.',mode:'alternative_expression',visibleChoices:false,requiredSteps:1},
  {level:8,title:'Move between situations',instruction:'Help in this scene, then adapt your command in the next scene.',mode:'context_switch',visibleChoices:false,requiredSteps:2},
];

export const SCENE_PRACTICE_STAGES = STAGES;
export function getScenePracticeStage(level: unknown): ScenePracticeStage | null {
  if (typeof level!=='number'||!Number.isInteger(level)||level<1||level>8)return null;
  return STAGES[level-1];
}

/** Authored goals: use intents, not the answer word, in the patient prompt. */
const GOALS: Record<string, readonly [string,string,string,string]> = {
  lamp: ['Help someone read in this room.','brighter','Make it easier to sleep here.','darker'],
  ball: ['Make this ball easier to see.','bigger','Make the ball take less room.','smaller'],
  bird: ['Help the bird reach the sky.','up','Bring the bird closer to the ground.','down'],
  car: ['Get the car moving.','go','Bring the car to a rest.','stop'],
  cup: ['Give the cup another little serving.','more','Reduce what is in the cup.','less'],
  candle: ['Make the candle safe to leave unattended.','out','Make the candle glow again.','light'],
};
export interface ScenePracticeGoal {
  prompt: string;
  command: string;
  requireObjectName: boolean;
  requireAlternateForm: boolean;
}
export function getScenePracticeGoal(
  scene: SceneDefinition,
  stage: ScenePracticeStage,
  step = 0,
): ScenePracticeGoal {
  const choice=GOALS[scene.id];
  const idx = stage.mode==='repair' && step===1 ? 2:0;
  const prompt=choice?.[idx] ?? scene.prompt;
  const command=choice?.[idx+1] ?? scene.commands[0]?.word ?? '';
  return {
    prompt,
    command,
    requireObjectName: stage.mode==='object_action',
    requireAlternateForm: stage.mode==='alternative_expression',
  };
}
export function commandMeetsScenePracticeGoal(
  utterance: string,
  actualWord: string,
  matchedForm: string | null,
  goal: ScenePracticeGoal,
  sceneId: string,
): boolean {
  if (actualWord !== goal.command) return false;
  if (goal.requireObjectName && !utterance.toLowerCase().split(/[^a-z]+/).includes(sceneId)) return false;
  if (goal.requireAlternateForm && matchedForm === 'canonical') return false;
  return true;
}
