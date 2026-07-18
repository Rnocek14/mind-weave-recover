import {
  KidsPetState,
  getPetStage,
  getNextPetStage,
  getPetStageProgress,
} from "@/lib/kidsPet";

/**
 * Renders the child's practice pet: big emoji creature, stage name, growth
 * bar toward the next evolution, and practice-day streak. Pure display —
 * state comes in via props so games control when it updates/animates.
 */
interface PetDisplayProps {
  pet: KidsPetState;
  /** Play the level-up pop animation. */
  celebrate?: boolean;
  /** Compact renders a small inline pet (for headers). */
  compact?: boolean;
}

export function PetDisplay({ pet, celebrate = false, compact = false }: PetDisplayProps) {
  const stage = getPetStage(pet.xp);
  const next = getNextPetStage(pet.xp);
  const progress = getPetStageProgress(pet.xp);

  if (compact) {
    return (
      <div className="flex items-center gap-2" aria-label={`${pet.name} the ${stage.label}`}>
        <span className="text-2xl kids-pet-idle" aria-hidden>{stage.emoji}</span>
        <span className="text-sm font-bold text-primary">{pet.name}</span>
      </div>
    );
  }

  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div
        className={celebrate ? "text-7xl kids-pet-evolve" : "text-7xl kids-pet-idle"}
        role="img"
        aria-label={`${pet.name} the ${stage.label}`}
      >
        {stage.emoji}
      </div>
      <p className="text-lg font-bold text-primary">
        {pet.name} the {stage.label}
      </p>

      {/* Growth toward next evolution */}
      {next ? (
        <div className="w-full max-w-[220px] space-y-1">
          <div
            className="h-3 rounded-full bg-muted overflow-hidden border border-border"
            role="progressbar"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(progress * 100)}
            aria-label={`Growth toward ${next.label}`}
          >
            <div
              className="h-full rounded-full bg-gradient-healing transition-all duration-700"
              style={{ width: `${Math.round(progress * 100)}%` }}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Growing into {next.emoji} {next.label}!
          </p>
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">All grown up! 🌟</p>
      )}

      {pet.streakDays >= 2 && (
        <p className="text-sm font-semibold rounded-full bg-accent/25 px-3 py-1">
          🔥 {pet.streakDays} days in a row!
        </p>
      )}
    </div>
  );
}
