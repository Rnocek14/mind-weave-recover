/**
 * Cross-session history tracking
 * Prevents items from appearing too frequently across multiple sessions
 */

interface HistoryEntry {
  id: string;
  shownAt: number;
}

interface GameHistory {
  entries: HistoryEntry[];
}

const MAX_HISTORY_SIZE = 100;
const DEFAULT_COOLDOWN_DAYS = 3;

function getStorageKey(gameType: string): string {
  return `game_history_${gameType}`;
}

/**
 * Get IDs of items shown recently (within cooldown period)
 */
export function getRecentlyShownIds(
  gameType: string, 
  cooldownDays: number = DEFAULT_COOLDOWN_DAYS
): Set<string> {
  try {
    const key = getStorageKey(gameType);
    const data = localStorage.getItem(key);
    if (!data) return new Set();

    const history: GameHistory = JSON.parse(data);
    const cutoff = Date.now() - (cooldownDays * 24 * 60 * 60 * 1000);
    
    const recentIds = history.entries
      .filter(entry => entry.shownAt > cutoff)
      .map(entry => entry.id);
    
    return new Set(recentIds);
  } catch {
    return new Set();
  }
}

/**
 * Mark an item as shown in this session
 */
export function markItemShown(gameType: string, itemId: string): void {
  try {
    const key = getStorageKey(gameType);
    const data = localStorage.getItem(key);
    const history: GameHistory = data ? JSON.parse(data) : { entries: [] };
    
    // Add new entry
    history.entries.push({
      id: itemId,
      shownAt: Date.now(),
    });
    
    // Prune old entries to prevent unbounded growth
    if (history.entries.length > MAX_HISTORY_SIZE) {
      history.entries = history.entries
        .sort((a, b) => b.shownAt - a.shownAt)
        .slice(0, MAX_HISTORY_SIZE);
    }
    
    localStorage.setItem(key, JSON.stringify(history));
  } catch {
    // localStorage might be unavailable, silently fail
  }
}

/**
 * Filter an array to exclude recently shown items
 */
export function filterRecentlyShown<T extends { id: string }>(
  items: T[],
  gameType: string,
  cooldownDays: number = DEFAULT_COOLDOWN_DAYS
): T[] {
  const recentIds = getRecentlyShownIds(gameType, cooldownDays);
  const filtered = items.filter(item => !recentIds.has(item.id));
  
  // If all items are filtered out, return all items (reset history effect)
  return filtered.length > 0 ? filtered : items;
}

/**
 * Clear history for a game type
 */
export function clearGameHistory(gameType: string): void {
  try {
    localStorage.removeItem(getStorageKey(gameType));
  } catch {
    // silently fail
  }
}
