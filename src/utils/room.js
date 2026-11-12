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

const SAVED_ROOMS_STORAGE_KEY = 'neep_saved_rooms_v1';

/**
 * Loads the list of saved/recent rooms on this device.
 * Each item: { roomId, adminPin: string | null, isAdmin: boolean, lastVisited: number }
 */
export function loadSavedRoomsHistory() {
  try {
    const raw = localStorage.getItem(SAVED_ROOMS_STORAGE_KEY);
    let list = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(list)) list = [];

    // Migrate legacy single `neep_current_room` if not already in list
    const legacyRoom = sanitizeRoomId(localStorage.getItem('neep_current_room') || '');
    if (legacyRoom && !list.some((r) => r.roomId === legacyRoom)) {
      let legacyPin = null;
      try {
        const savedTournRaw = localStorage.getItem(getTournStorageKey(legacyRoom));
        if (savedTournRaw) {
          const parsed = JSON.parse(savedTournRaw);
          if (parsed?.adminPin) legacyPin = parsed.adminPin;
        }
      } catch (e) {}
      list.unshift({
        roomId: legacyRoom,
        adminPin: legacyPin,
        isAdmin: Boolean(legacyPin),
        lastVisited: Date.now(),
      });
      localStorage.setItem(SAVED_ROOMS_STORAGE_KEY, JSON.stringify(list));
    }

    return list;
  } catch (e) {
    return [];
  }
}

/**
 * Saves or updates a room entry in the device's saved rooms history.
 * Preserves an existing adminPin if the user previously had admin access to this room.
 */
export function upsertSavedRoomHistory(roomId, adminPin = null, isAdmin = false) {
  const cleanId = sanitizeRoomId(roomId);
  if (!cleanId) return [];
  try {
    const current = loadSavedRoomsHistory();
    const existing = current.find((r) => r.roomId === cleanId);
    const resolvedPin = (isAdmin && adminPin) ? String(adminPin) : (existing?.adminPin || null);
    const resolvedIsAdmin = Boolean(isAdmin || existing?.isAdmin);

    const updatedEntry = {
      roomId: cleanId,
      adminPin: resolvedPin,
      isAdmin: resolvedIsAdmin,
      lastVisited: Date.now(),
    };

    const filtered = current.filter((r) => r.roomId !== cleanId);
    const nextList = [updatedEntry, ...filtered].slice(0, 12);
    localStorage.setItem(SAVED_ROOMS_STORAGE_KEY, JSON.stringify(nextList));
    return nextList;
  } catch (e) {
    return [];
  }
}

/**
 * Removes a room from the saved rooms history list.
 */
export function removeSavedRoomHistory(roomId) {
  const cleanId = sanitizeRoomId(roomId);
  try {
    const current = loadSavedRoomsHistory();
    const nextList = current.filter((r) => r.roomId !== cleanId);
    localStorage.setItem(SAVED_ROOMS_STORAGE_KEY, JSON.stringify(nextList));
    const currentRecent = sanitizeRoomId(localStorage.getItem('neep_current_room') || '');
    if (currentRecent === cleanId) {
      if (nextList.length > 0) {
        localStorage.setItem('neep_current_room', nextList[0].roomId);
      } else {
        localStorage.removeItem('neep_current_room');
      }
    }
    return nextList;
  } catch (e) {
    return [];
  }
}
