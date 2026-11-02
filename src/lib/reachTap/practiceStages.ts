/**
 * Actual eight-stage motor/visual-attention *practice* formats.
 *
 * The same target component serves two different tasks. Neither variant
 * updates language mastery, proves neglect recovery or imposes speed failure.
 */
import type { ReachTapPlacement, ReachTapVariant } from './placeReachTapTarget';

export type ReachPracticeLevel = 1|2|3|4|5|6|7|8;
export type ReachPracticeLayout =
  'center'|'center_vertical'|'wide'|'alternating_sides'|'four_quadrants'|'left'|'left_vertical';
export interface ReachPracticeStage {
  level: ReachPracticeLevel;
  title: string;
  prompt: string;
  sizePx: number;
  layout: ReachPracticeLayout;
  distractors: number;
  visualGuide: boolean;
}
type Eight = readonly [ReachPracticeStage,ReachPracticeStage,ReachPracticeStage,ReachPracticeStage,ReachPracticeStage,ReachPracticeStage,ReachPracticeStage,ReachPracticeStage];
const REACH: Eight = [
  {level:1,title:'One large target',prompt:'Tap the big circle in the middle.',sizePx:132,layout:'center',distractors:0,visualGuide:true},
  {level:2,title:'Up and down',prompt:'Tap the big target as it moves up and down.',sizePx:122,layout:'center_vertical',distractors:0,visualGuide:true},
  {level:3,title:'Reach across',prompt:'Find a large target at a new position.',sizePx:112,layout:'wide',distractors:0,visualGuide:true},
  {level:4,title:'Careful precision',prompt:'Reach carefully for the smaller target. No rush.',sizePx:96,layout:'wide',distractors:0,visualGuide:false},
  {level:5,title:'Alternate sides',prompt:'Alternate between the left and right target positions.',sizePx:88,layout:'alternating_sides',distractors:0,visualGuide:false},
  {level:6,title:'Four positions',prompt:'Tap targets in different screen regions.',sizePx:80,layout:'four_quadrants',distractors:0,visualGuide:false},
  {level:7,title:'New positions',prompt:'Practice a changing four-position pattern.',sizePx:72,layout:'four_quadrants',distractors:1,visualGuide:false},
  {level:8,title:'Functional tap practice',prompt:'Find precise targets across changing positions. Rest as needed.',sizePx:64,layout:'wide',distractors:2,visualGuide:false},
];
const LEFT: Eight = [
  {level:1,title:'Look left',prompt:'Find the large star at the left. Look for the guide.',sizePx:132,layout:'left',distractors:0,visualGuide:true},
  {level:2,title:'Left, up and down',prompt:'Find the star up or down on the left side.',sizePx:128,layout:'left_vertical',distractors:0,visualGuide:true},
  {level:3,title:'Find the left target',prompt:'Scan toward the left, then tap the star.',sizePx:120,layout:'left',distractors:0,visualGuide:true},
  {level:4,title:'Variable left targets',prompt:'Find the star at different left positions.',sizePx:108,layout:'left',distractors:0,visualGuide:false},
  {level:5,title:'Left search with distractions',prompt:'Find the STAR on the left. Ignore the circles.',sizePx:102,layout:'left',distractors:2,visualGuide:false},
  {level:6,title:'Organized left scan',prompt:'Start at the center and scan left for the star.',sizePx:96,layout:'left_vertical',distractors:3,visualGuide:true},
  {level:7,title:'Busy left search',prompt:'Find the left star among other shapes across the screen.',sizePx:90,layout:'left',distractors:4,visualGuide:false},
  {level:8,title:'New left search scenes',prompt:'Find the star on the left in a new busy layout.',sizePx:84,layout:'left',distractors:5,visualGuide:false},
];
export const REACH_PRACTICE_STAGES = REACH;
export const LEFT_HUNT_PRACTICE_STAGES = LEFT;

export function getReachPracticeStage(variant: ReachTapVariant, level: unknown): ReachPracticeStage | null {
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1 || level > 8) return null;
  return (variant === 'left-side-hunt' ? LEFT : REACH)[level-1];
}

/** Respect screen bounds even at 320px wide and with an oversized target. */
export function placeStagedReachTarget(
  candidate: ReachTapPlacement,
  width: number,
  height: number,
  stage: ReachPracticeStage,
  trialNumber: number,
): ReachTapPlacement {
  const padding = 12;
  const xMax = Math.max(padding, width - candidate.size - padding);
  const yMax = Math.max(padding, height - candidate.size - padding);
  const clampX = (x:number) => Math.max(padding, Math.min(xMax, x));
  const clampY = (y:number) => Math.max(padding, Math.min(yMax, y));
  let x = candidate.x;
  let y = candidate.y;
  const leftX = padding + Math.max(0, xMax-padding)*0.10;
  const rightX = padding + Math.max(0, xMax-padding)*0.90;
  const midX = (padding+xMax)/2;
  const lowY = padding + Math.max(0,yMax-padding)*0.20;
  const highY = padding + Math.max(0,yMax-padding)*0.80;
  switch(stage.layout) {
    case 'center': x=midX; y=(padding+yMax)/2; break;
    case 'center_vertical': x=midX; y=trialNumber%2?lowY:highY; break;
    case 'alternating_sides': x=trialNumber%2?leftX:rightX; break;
    case 'four_quadrants':
      x=trialNumber%2?leftX:rightX;
      y=Math.floor((trialNumber-1)/2)%2?highY:lowY;
      break;
    case 'left': x=leftX; break;
    case 'left_vertical': x=leftX; y=trialNumber%2?lowY:highY; break;
    case 'wide': break;
  }
  x=clampX(x); y=clampY(y);
  const centerX=x+candidate.size/2;
  return {
    ...candidate,x,y,
    side: centerX<=width/3?'left':centerX>=2*width/3?'right':'center',
  };
}
