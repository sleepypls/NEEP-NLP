export const DEFAULT_ROOM_ID = 'neep-main';
export const DEFAULT_ADMIN_PIN = '1234';

const ROOM_CHARS = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';

/**
 * Generates a clean, memorable Room ID, e.g. "NLP-7842" or "NLP-K8B2"
 */
export function generateRoomId(prefix = 'NLP') {
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    const idx = Math.floor(Math.random() * ROOM_CHARS.length);
    suffix += ROOM_CHARS[idx];
  }
  return `${prefix}-${suffix}`;
}

/**
 * Generates a random 4-digit numeric PIN, e.g. "4829"
 */
export function generatePin() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

/**
 * Normalizes user-entered room IDs (uppercase, alphanumeric + hyphens)
 */
export function sanitizeRoomId(raw) {
  if (!raw) return '';
  return String(raw)
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9_-]/g, '')
    .slice(0, 20);
}

/**
 * Returns localStorage key for tournament state of a given room
 */
export function getTournStorageKey(rid) {
  return rid === DEFAULT_ROOM_ID ? 'neep-pickleball-tournament-state-v1' : `neep_tourn_${rid}_v1`;
}

/**
 * Checks if a room has saved tournament data in localStorage
 */
export function checkLocalRoomExists(roomId) {
  if (!roomId) return false;
  try {
    const key = getTournStorageKey(roomId);
    const data = localStorage.getItem(key);
    return Boolean(data);
  } catch (e) {
    return false;
  }
}
