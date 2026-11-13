/**
 * Validates a completed game score against target points and win-by-2 / win-by-1 rules.
 * Returns { valid: true } or { valid: false, error: string }.
 */
export function validateGameScore(scoreA, scoreB, pointsTo = 11, winByTwo = true) {
  const a = Number(scoreA);
  const b = Number(scoreB);
  const target = Math.max(1, Number(pointsTo) || 11);

  if (!Number.isInteger(a) || !Number.isInteger(b) || a < 0 || b < 0) {
    return { valid: false, error: 'Scores must be non-negative whole numbers.' };
  }
  if (a === b) {
    return { valid: false, error: 'Game cannot end in a tie.' };
  }

  const high = Math.max(a, b);
  const low = Math.min(a, b);
  const diff = high - low;

  if (high < target) {
    return {
      valid: false,
      error: `Winner must reach at least ${target} points (currently ${a}–${b}).`,
    };
  }

  if (winByTwo) {
    if (diff < 2) {
      return {
        valid: false,
        error: `Win-by-2 format requires at least a 2-point lead (currently ${a}–${b}).`,
      };
    }
    if (high > target && diff !== 2) {
      return {
        valid: false,
        error: `In a game to ${target} (win by 2), scores past ${target} must end by exactly 2 points (e.g. ${low + 2}–${low}).`,
      };
    }
  } else if (high > target) {
    return {
      valid: false,
      error: `In win-by-1 format to ${target}, the game ends at ${target} points (${a}–${b} is invalid).`,
    };
  }

  return { valid: true };
}
