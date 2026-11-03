import {describe,expect,it} from 'vitest';
import {
  CONVERSATION_PRACTICE_STAGES,
  evaluateConversationPracticeTurn,getConversationPracticeScenes,
  getConversationPracticeStage,
  type ConversationPracticeKind,
} from './stages';

const KINDS:ConversationPracticeKind[]=['conversation-partner','conversation-coach'];

describe('real scripted, practice-only conversation stages',()=>{
  it.each(KINDS)('%s provides eight distinct playable stages and 32 unique linked turns',kind=>{
    const stages=CONVERSATION_PRACTICE_STAGES[kind];
    expect(stages.map(s=>s.level)).toEqual([1,2,3,4,5,6,7,8]);
    expect(new Set(stages.map(s=>s.title)).size).toBe(8);
    const ids=new Set<string>();const sceneIds=new Set<string>();
    for(const stage of stages){
      expect(stage.practiceOnly).toBe(true);
      expect(stage.goal.length).toBeGreaterThan(10);
      expect(getConversationPracticeStage(kind,stage.level)).toEqual(stage);
      const scenes=getConversationPracticeScenes(kind,stage.level);
      expect(scenes).toHaveLength(2);
      for(const scene of scenes){
        expect(sceneIds.has(scene.id),scene.id).toBe(false);
        sceneIds.add(scene.id);
        expect(scene.situation.trim()).not.toBe('');
        expect(scene.turns).toHaveLength(2);
        for(const turn of scene.turns){
          expect(ids.has(turn.id),turn.id).toBe(false);
          ids.add(turn.id);
          expect(turn.mayaPrompt.trim().length).toBeGreaterThan(15);
          expect(turn.clue.trim()).not.toBe('');
          if(turn.kind==='choice'){
            expect(turn.options).toHaveLength(2);
            expect(turn.options[0]).not.toBe(turn.options[1]);
            expect([0,1]).toContain(turn.bestChoice);
          }
        }
      }
    }
    expect(ids.size).toBe(32);
    expect(sceneIds.size).toBe(16);
    for(const invalid of [0,-1,9,1.3,NaN,'8']){
      expect(getConversationPracticeStage(kind,invalid)).toBeNull();
    }
  });

  it.each(KINDS)('%s higher stages require open-ended dialogue, never keyword-based automatic correctness',kind=>{
    for(const level of [6,7,8] as const){
      const scenes=getConversationPracticeScenes(kind,level);
      for(const scene of scenes){
        expect(scene.turns.every(turn=>turn.kind==='open')).toBe(true);
        for(const turn of scene.turns){
          expect(evaluateConversationPracticeTurn(turn,{choiceIndex:0}))
            .toEqual({practiceMatch:null});
        }
      }
    }
  });

  it('scores a prewritten recognition choice only as a practice match',()=>{
    const partner=getConversationPracticeScenes('conversation-partner',1)[0].turns[0];
    expect(partner.kind).toBe('choice');
    expect(evaluateConversationPracticeTurn(partner,{choiceIndex:0}))
      .toEqual({practiceMatch:true});
    expect(evaluateConversationPracticeTurn(partner,{choiceIndex:1}))
      .toEqual({practiceMatch:false});
    // A generic empty/invalid choice never becomes a positive language claim.
    expect(evaluateConversationPracticeTurn(partner,{})).toEqual({practiceMatch:false});
  });

  it('Stage 1 coach actually includes modeled functional phrases; Stage 8 does not',()=>{
    for(const scene of getConversationPracticeScenes('conversation-coach',1)){
      expect(scene.turns.every(turn=>turn.kind==='open'&&!!turn.model)).toBe(true);
    }
    for(const scene of getConversationPracticeScenes('conversation-coach',8)){
      expect(scene.turns.every(turn=>turn.kind==='open'&&!turn.model)).toBe(true);
    }
  });

  it.each(KINDS)('%s selects reproducible, nonrepeating scenes per session',kind=>{
    const a=getConversationPracticeScenes(kind,8,'session-alpha');
    const b=getConversationPracticeScenes(kind,8,'session-alpha');
    expect(a).toEqual(b);
    expect(new Set(a.map(scene=>scene.id)).size).toBe(2);
    expect(new Set(a.flatMap(scene=>scene.turns.map(turn=>turn.id))).size).toBe(4);
    const orderA=getConversationPracticeScenes(kind,8,'one');
    const orderB=getConversationPracticeScenes(kind,8,'two');
    expect(new Set(orderA.map(scene=>scene.id))).toEqual(new Set(orderB.map(scene=>scene.id)));
  });
});
