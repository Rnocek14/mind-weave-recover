import {cleanup,fireEvent,render,screen} from '@testing-library/react';
import {afterEach,describe,expect,it,vi} from 'vitest';
import React from 'react';

vi.mock('@/hooks/use-mobile',()=>({useIsMobile:()=>true}));
vi.mock('@/components/ui/dialog',()=>({
  Dialog:({children}:{children:React.ReactNode})=><div>{children}</div>,
  DialogContent:({children}:{children:React.ReactNode})=><div>{children}</div>,
  DialogTitle:({children}:{children:React.ReactNode})=><h3>{children}</h3>,
}));
vi.mock('@/components/ui/sheet',()=>({
  Sheet:({children}:{children:React.ReactNode})=><div>{children}</div>,
  SheetContent:({children}:{children:React.ReactNode})=><div>{children}</div>,
  SheetTitle:({children}:{children:React.ReactNode})=><h3>{children}</h3>,
}));
vi.mock('./FollowDirectionsProbe',()=>({
  FollowDirectionsProbe:({practiceLevel}:{practiceLevel:number|null})=>
    <output data-testid="follow-mode">{practiceLevel??'regular'}</output>,
}));
vi.mock('./SequenceBuilderProbe',()=>({
  SequenceBuilderProbe:({practiceLevel}:{practiceLevel:number|null})=>
    <output data-testid="sequence-mode">{practiceLevel??'regular'}</output>,
}));

import {ExerciseModalHost} from './ExerciseModalHost';

afterEach(()=>cleanup());

describe('Coach modal session-scoped patient-safe practice selection',()=>{
  it('offers one large Start and eight caregiver choices, but preserves ordinary quick practice',()=>{
    const activeExercise={slug:'follow-directions',launchedAt:100,config:{totalTrials:3}};
    const view=render(<ExerciseModalHost activeExercise={activeExercise}
      isOpen onClose={vi.fn()} onComplete={vi.fn()}
      userId="synthetic-caregiver" sessionId="synthetic-session"/>);
    expect(screen.getByRole('button',{name:'Start practice'})).toBeTruthy();
    expect(screen.queryByTestId('follow-mode')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
    expect(screen.getByTestId('follow-mode').textContent).toBe('regular');
    view.rerender(<ExerciseModalHost
      activeExercise={{...activeExercise,launchedAt:101}}
      isOpen onClose={vi.fn()} onComplete={vi.fn()}
      userId="synthetic-caregiver" sessionId="synthetic-session"/>);
    fireEvent.click(screen.getByText('Care partner: choose a practice stage'));
    expect(screen.getAllByRole('button',{name:/Stage [1-8]:/})).toHaveLength(8);
    fireEvent.click(screen.getByRole('button',{name:/Stage 6: Understand before and after/}));
    fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
    expect(screen.getByTestId('follow-mode').textContent).toBe('6');
  });

  it('never carries a selected stage between different patient sessions',()=>{
    const ex={slug:'sequence-builder',launchedAt:901,config:{}};
    const view=render(<ExerciseModalHost activeExercise={ex} isOpen
      onClose={vi.fn()} onComplete={vi.fn()} userId="synthetic-user"
      sessionId="session-a"/>);
    fireEvent.click(screen.getByText('Care partner: choose a practice stage'));
    fireEvent.click(screen.getByRole('button',{name:/Stage 8: Plan a new practical sequence/}));
    fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
    expect(screen.getByTestId('sequence-mode').textContent).toBe('8');
    view.rerender(<ExerciseModalHost activeExercise={ex} isOpen
      onClose={vi.fn()} onComplete={vi.fn()} userId="synthetic-user"
      sessionId="session-b"/>);
    expect(screen.getByRole('button',{name:'Start practice'})).toBeTruthy();
    expect(screen.queryByTestId('sequence-mode')).toBeNull();
    fireEvent.click(screen.getByRole('button',{name:'Start practice'}));
    expect(screen.getByTestId('sequence-mode').textContent).toBe('regular');
  });
});
