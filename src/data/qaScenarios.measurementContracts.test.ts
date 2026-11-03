import { describe,expect,it } from 'vitest';
import { CANONICAL_EXERCISES } from './canonicalExerciseRegistry';
import { QA_GAME_INVENTORY,QA_RUNBOOK_VERSION,QA_SCENARIOS } from './qaScenarios';
import { getGameMeasurementSpec } from '@/lib/clinical/gameMeasurementContracts';

describe('the 29-game guided audit includes each game-specific clinical measurement contract',()=>{
  it('includes 29 unique activities, not just the persisted ladder subset',()=>{
    const expected=[...CANONICAL_EXERCISES.map(item=>item.slug),'functional-scenes'].sort();
    expect(QA_GAME_INVENTORY.map(item=>item.slug).sort()).toEqual(expected);
    const gameScenarios=QA_SCENARIOS.filter(s=>s.area==='game'&&s.slug);
    expect(gameScenarios.map(s=>s.slug).sort()).toEqual(expected);
    expect(QA_RUNBOOK_VERSION).toBe('2.1.0');
    for(const scenario of gameScenarios){
      const spec=getGameMeasurementSpec(scenario.slug!)!;
      expect(spec,scenario.slug).not.toBeNull();
      const steps=scenario.steps;
      expect(steps).toHaveLength(13);
      expect(new Set(steps.map(step=>step.id)).size).toBe(13);
      const measurement=steps.find(step=>step.id==='measurement-contract')!;
      expect(measurement.action).toContain(spec.primaryMeasureId);
      for(const key of spec.proposedTaskFields){
        expect(measurement.action,scenario.slug).toContain(key);
      }
      expect(measurement.safety).toMatch(/not mark Pass/i);
      expect(measurement.expect).toMatch(/instrumentation gaps/i);
    }
  });

  it('does not replace the existing identity, source and patient safety checks',()=>{
    for(const game of QA_SCENARIOS.filter(x=>x.area==='game'&&x.slug)){
      expect(game.steps.map(step=>step.id)).toEqual(expect.arrayContaining([
        'enter','purpose','start','response','support','skip',
        'speech-if-used','stages','evidence','measurement-contract',
        'resume','guided-session','accessibility',
      ]));
    }
  });
});
