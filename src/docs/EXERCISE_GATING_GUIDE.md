# Exercise Gating & Adaptation System

## Overview

The Exercise Gating & Adaptation System automatically determines which exercises are appropriate for each user based on their **capability assessment scores** (vision, motor, attention) and applies appropriate adaptations to make exercises accessible.

## Key Features

- **Automatic Gating**: Exercises are locked if capability requirements aren't met
- **Smart Adaptations**: Exercises automatically adjust (larger targets, extended timeouts, simplified UI) based on capability profile
- **Graceful Degradation**: Users see clear explanations and alternative suggestions for locked exercises
- **Dual-Source Configuration**: Merges clinical profile recommendations + capability-based adaptations

---

## For Exercise Developers

### How to Use Adaptations in Your Exercise

#### Step 1: Import the Hook

```typescript
import { useExerciseConfig } from '@/hooks/useExerciseConfig';
import { useAuth } from '@/hooks/useAuth';
```

#### Step 2: Get Merged Configuration

```typescript
const YourExercise = () => {
  const { user } = useAuth();
  const [clinicalProfile, setClinicalProfile] = useState(null);
  
  const { config, hasCapabilityAdaptations } = useExerciseConfig(
    'your-exercise-id',
    user?.id,
    clinicalProfile
  );
  
  // Use config values in your exercise
  const startDifficulty = config.startDifficulty || 1;
  const timeout = config.timeout || 3000;
  const largeTargets = config.largeTargets || false;
  // ...etc
};
```

#### Step 3: Show Adaptation Banner (Optional)

```typescript
import { ExerciseAdaptationBanner } from '@/components/ExerciseAdaptationBanner';
import { useExerciseGating } from '@/hooks/useExerciseGating';

const YourExercise = () => {
  const { user } = useAuth();
  const { getAdaptations } = useExerciseGating(user?.id);
  const adaptations = getAdaptations('your-exercise-id');
  
  return (
    <div>
      <ExerciseAdaptationBanner 
        adaptation={adaptations} 
        showDetails={true} 
      />
      {/* Your exercise UI */}
    </div>
  );
};
```

---

## Configuration Options

### Available Adaptation Flags

| Flag | Type | Description |
|------|------|-------------|
| `startDifficulty` | number (1-5) | Starting difficulty level |
| `cueLevel` | number (0-3) | How much cueing/support to provide |
| `timeout` | number (ms) | Time allowed per trial |
| `maxChoices` | number (2-4) | Number of options to present |
| `startSize` | number (px) | Size of targets/buttons |
| `largeTargets` | boolean | Use larger interactive elements |
| `extendedTimeouts` | boolean | Use longer time limits |
| `simplifiedUI` | boolean | Reduce visual complexity |
| `eliminateText` | boolean | Remove text, use only visuals |
| `useAudioCues` | boolean | Enable audio guidance |
| `highContrast` | boolean | Use high contrast colors |
| `errorlessMode` | boolean | Provide maximum support to prevent errors |
| `visualCues` | boolean | Show visual hints/guides |
| `textInstructions` | boolean | Show written instructions |
| `enableVoice` | boolean | Enable voice input/output |
| `sessionLength` | 'short' \| 'medium' \| 'long' | Duration of session |
| `breakFrequency` | 'low' \| 'medium' \| 'high' | How often to prompt breaks |

### Conservative Merging Rules

When both clinical profile AND capability assessment suggest different values:

**Numeric Values** → Take the **more conservative** (easier) option:
- `startDifficulty`: MINIMUM of both sources
- `cueLevel`: MAXIMUM of both sources (more support)
- `timeout`: MAXIMUM of both sources (more time)
- `maxChoices`: MINIMUM of both sources (fewer choices)
- `startSize`: MAXIMUM of both sources (larger targets)

**Boolean Flags** → Use **OR** logic (enable if either suggests it):
- Safety features enabled if EITHER source recommends them

---

## Gating Rules

### Current Exercise Requirements

| Exercise | Min Vision | Min Motor | Min Attention | Alternative |
|----------|-----------|-----------|---------------|-------------|
| `reach-tap` | 3 | 2 | 2 | - |
| `photo-naming` | 5 | 3 | 4 | reach-tap |
| `word-practice` | 6 | 3 | 5 | photo-naming |
| `phonological-awareness` | 6 | 3 | 6 | photo-naming |
| `semantic-features` | 6 | 3 | 6 | photo-naming |
| `sentence-construction` | 7 | 4 | 7 | word-practice |
| `left-side-hunt` | 5 | 4 | 5 | reach-tap |

### Adding New Exercises

To add gating rules for a new exercise:

1. Open `src/lib/exerciseGating.ts`
2. Add entry to `EXERCISE_GATING_RULES` array:

```typescript
{
  exerciseId: 'your-new-exercise',
  minRequirements: { 
    vision: 5, 
    motor: 4, 
    attention: 5 
  },
  reason: 'Brief explanation of why these requirements',
  alternativeSuggestion: 'simpler-exercise-id',
}
```

3. Add adaptation logic to `getExerciseAdaptations()` switch statement:

```typescript
case 'your-new-exercise':
  return {
    exerciseId,
    adaptations: {
      ...baseAdaptations,
      startDifficulty: scores.attention < 6 ? 1 : 2,
      timeout: scores.motor < 5 ? 8000 : 5000,
      // ... other exercise-specific adaptations
    },
    reason: 'Adapted for your specific requirements',
  };
```

---

## Testing Adaptations

### Manual Testing Checklist

1. **No Assessment** → All exercises should be accessible, no adaptations shown
2. **Low Scores (Vision: 3, Motor: 3, Attention: 3)** → Most exercises locked, reach-tap adapted heavily
3. **Medium Scores (Vision: 6, Motor: 5, Attention: 5)** → Some exercises available, clear adaptations visible
4. **High Scores (Vision: 8, Motor: 8, Attention: 8)** → All exercises accessible, minimal/no adaptations

### Check These Behaviors

- ✅ Locked exercises show "Locked" badge with reason on hover
- ✅ Adapted exercises show "Adapted (N)" badge
- ✅ Gating info banner appears when assessment is complete
- ✅ Exercise pages respect `config` values
- ✅ Adaptations merge correctly (conservative values win)

---

## Dashboard Integration

The Dashboard automatically:

1. Fetches user's latest capability assessment
2. Checks each exercise for accessibility
3. Shows badges (Locked / Adapted)
4. Displays adaptation summary on hover/expand
5. Suggests capability assessment if not completed

Users see:
- Which exercises they can do RIGHT NOW
- Why exercises are locked (specific capability requirements)
- What adaptations are active (e.g., "Larger targets", "Extended time")

---

## Future Enhancements

Planned improvements:

- [ ] Real-time adaptation adjustment during exercise
- [ ] Capability-based difficulty progression
- [ ] Custom adaptation profiles saved per user
- [ ] Analytics: "Which adaptations help most?"
- [ ] A/B testing different adaptation strategies
- [ ] Auto-unlock when capabilities improve

---

## Questions?

If you're building a new exercise and unsure about:
- What capability requirements to set
- How to implement specific adaptations
- Testing procedures

Refer to existing exercises like `PhotoNamingGame.tsx` or `ReachTapGame.tsx` as examples.
