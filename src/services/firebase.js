import { initializeApp, getApps, getApp } from 'firebase/app';
import {
  getFirestore,
  doc,
  setDoc,
  onSnapshot,
  getDoc,
  collection,
  collectionGroup,
  getDocs,
  deleteDoc,
} from 'firebase/firestore';

const STORAGE_KEY_FIREBASE_CONFIG = 'neep_firebase_config_v1';
const DEFAULT_CLUB_ID = 'neep-pickleball';

export const DEFAULT_FIREBASE_CONFIG = {
  apiKey: "AIzaSyCkbXjIwd0BLRpR3Q5YkUR3p8DXfJQa5B0",
  authDomain: "neep-pb-tracker.firebaseapp.com",
  projectId: "neep-pb-tracker",
  storageBucket: "neep-pb-tracker.firebasestorage.app",
  messagingSenderId: "483596216306",
  appId: "1:483596216306:web:40f0f884fbc2436257ed6b",
  measurementId: "G-VWBYTCV1JE"
};

// Try loading config from env vars, localStorage, or fallback to default
export function getFirebaseConfig() {
  try {
    const fromStorage = localStorage.getItem(STORAGE_KEY_FIREBASE_CONFIG);
    if (fromStorage === 'disabled') {
      return null;
    }
    if (fromStorage) {
      const parsed = JSON.parse(fromStorage);
      if (parsed && parsed.apiKey && parsed.projectId) return parsed;
    }
  } catch (e) {
    // ignore
  }

  // Check Vite env variables
  if (typeof import.meta !== 'undefined' && import.meta.env && import.meta.env.VITE_FIREBASE_API_KEY && import.meta.env.VITE_FIREBASE_PROJECT_ID) {
    return {
      apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
      authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebaseapp.com`,
      projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
      storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || `${import.meta.env.VITE_FIREBASE_PROJECT_ID}.firebasestorage.app`,
      messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
      appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
      measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || '',
    };
  }

  return DEFAULT_FIREBASE_CONFIG;
}

export function saveFirebaseConfig(config) {
  try {
    if (config) {
      localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, JSON.stringify(config));
    } else {
      localStorage.setItem(STORAGE_KEY_FIREBASE_CONFIG, 'disabled');
    }
  } catch (e) {
    // ignore
  }
}

let dbInstance = null;

export function getDb() {
  if (dbInstance) return dbInstance;
  const config = getFirebaseConfig();
  if (!config) return null;

  try {
    const app = getApps().length > 0 ? getApp() : initializeApp(config);
    dbInstance = getFirestore(app);
    return dbInstance;
  } catch (err) {
    console.warn('[Firebase] Initialization error:', err);
    return null;
  }
}

export function isCloudEnabled() {
  return getDb() !== null;
}

/**
 * Checks whether an active tournament document exists in Firestore for the given roomId/clubId
 */
export async function checkRoomExistsInCloud(clubId = DEFAULT_CLUB_ID) {
  const db = getDb();
  if (!db) return false;
  try {
    const tournamentDocRef = doc(db, 'clubs', clubId, 'tournaments', 'active');
    const snap = await getDoc(tournamentDocRef);
    return snap.exists();
  } catch (err) {
    console.warn('[Firebase] Room existence check error:', err);
    return false;
  }
}

// ---------------- Realtime Listeners ----------------

export function subscribeToActiveTournament(clubId = DEFAULT_CLUB_ID, onUpdate, onError) {
  const db = getDb();
  if (!db) return () => {};

  const tournamentDocRef = doc(db, 'clubs', clubId, 'tournaments', 'active');
  return onSnapshot(
    tournamentDocRef,
    (snap) => {
      if (snap.exists()) {
        const raw = snap.data();
        onUpdate(decodeStateFromFirestore(raw));
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn('[Firebase] Tournament listener error:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToStats(clubId = DEFAULT_CLUB_ID, onUpdate, onError) {
  const db = getDb();
  if (!db) return () => {};

  const statsDocRef = doc(db, 'clubs', clubId, 'data', 'stats');
  return onSnapshot(
    statsDocRef,
    (snap) => {
      if (snap.exists()) {
        const data = snap.data();
        onUpdate({
          playerStats: data.playerStats || {},
          partnershipStats: data.partnershipStats || {},
        });
      }
    },
    (err) => {
      console.warn('[Firebase] Stats listener error:', err);
      if (onError) onError(err);
    }
  );
}

export function subscribeToKnownPlayers(clubId = DEFAULT_CLUB_ID, onUpdate) {
  const db = getDb();
  if (!db) return () => {};

  const playersDocRef = doc(db, 'clubs', clubId, 'data', 'players');
  return onSnapshot(
    playersDocRef,
    (snap) => {
      if (snap.exists()) {
        onUpdate(snap.data().roster || []);
      }
    },
    (err) => {
      console.warn('[Firebase] Players listener error:', err);
    }
  );
}

export function subscribeToSavedConfigs(clubId = DEFAULT_CLUB_ID, onUpdate) {
  const db = getDb();
  if (!db) return () => {};

  const configDocRef = doc(db, 'clubs', clubId, 'data', 'config');
  return onSnapshot(
    configDocRef,
    (snap) => {
      if (snap.exists()) {
        const raw = snap.data();
        const decodedDefault = raw.defaultConfig ? decodeStateFromFirestore(raw.defaultConfig) : null;
        const decodedPresets = Array.isArray(raw.presets)
          ? raw.presets.map((p) => decodeStateFromFirestore(p))
          : [];
        onUpdate({
          defaultConfig: decodedDefault,
          presets: decodedPresets,
        });
      }
    },
    (err) => {
      console.warn('[Firebase] Saved configs listener error:', err);
    }
  );
}

// ---------------- Document Sanitizer & Codec ----------------

export function sanitizeForFirestore(val) {
  if (val === undefined) return null;
  if (val === null || typeof val !== 'object') return val;

  if (Array.isArray(val)) {
    return val.map((item) => (item === undefined ? null : sanitizeForFirestore(item)));
  }

  const clean = {};
  for (const [key, value] of Object.entries(val)) {
    if (value !== undefined) {
      clean[key] = sanitizeForFirestore(value);
    }
  }
  return clean;
}

export function encodeStateForFirestore(state) {
  if (!state) return state;
  const clone = JSON.parse(JSON.stringify(state));
  // Firestore doesn't support nested arrays (bracket.rounds = [[...]], matchupConfig.customSlotPairs = [[1,2]])
  if (clone.bracket && Array.isArray(clone.bracket.rounds)) {
    clone.bracket = {
      ...clone.bracket,
      rounds: clone.bracket.rounds.map((round) => ({
        matches: Array.isArray(round) ? round : [],
      })),
    };
  }
  if (clone.matchupConfig && Array.isArray(clone.matchupConfig.customSlotPairs)) {
    clone.matchupConfig = {
      ...clone.matchupConfig,
      customSlotPairs: clone.matchupConfig.customSlotPairs.map((pair) => ({
        slots: Array.isArray(pair) ? pair : [],
      })),
    };
  }
  return clone;
}

export function decodeStateFromFirestore(data) {
  if (!data) return data;
  const clone = { ...data };
  if (clone.bracket && Array.isArray(clone.bracket.rounds)) {
    clone.bracket = {
      ...clone.bracket,
      rounds: clone.bracket.rounds.map((r) => (r && r.matches ? r.matches : r)),
    };
  }
  if (clone.matchupConfig && Array.isArray(clone.matchupConfig.customSlotPairs)) {
    clone.matchupConfig = {
      ...clone.matchupConfig,
      customSlotPairs: clone.matchupConfig.customSlotPairs.map((p) => (p && p.slots ? p.slots : p)),
    };
  }
  return clone;
}

// ---------------- Document Writers ----------------

export async function saveTournamentToCloud(clubId = DEFAULT_CLUB_ID, tournamentState) {
  const db = getDb();
  if (!db || !tournamentState) return false;

  try {
    const now = new Date().toISOString();
    const tournamentDocRef = doc(db, 'clubs', clubId, 'tournaments', 'active');
    const prepared = encodeStateForFirestore(tournamentState);
    const sanitized = sanitizeForFirestore({
      ...prepared,
      roomId: clubId,
      updatedAt: now,
    });
    await setDoc(tournamentDocRef, sanitized, { merge: true });

    // Also store lightweight room metadata on the parent club doc & admin registry for room discovery
    const roomSummary = sanitizeForFirestore({
      roomId: clubId,
      adminPin: tournamentState.adminPin || '1234',
      view: tournamentState.view || 'setup',
      playerCount: Array.isArray(tournamentState.playerPool) ? tournamentState.playerPool.length : 0,
      numTeams: tournamentState.numTeams || 4,
      hasBracket: Boolean(tournamentState.bracket),
      updatedAt: now,
    });
    setDoc(doc(db, 'clubs', clubId), roomSummary, { merge: true }).catch(() => {});
    setDoc(
      doc(db, 'clubs', '_admin_registry', 'data', 'rooms'),
      { rooms: { [clubId]: roomSummary }, updatedAt: now },
      { merge: true }
    ).catch(() => {});

    return true;
  } catch (err) {
    console.error('[Firebase] Error saving tournament to cloud:', err);
    return false;
  }
}

export async function saveStatsToCloud(clubId = DEFAULT_CLUB_ID, playerStats, partnershipStats) {
  const db = getDb();
  if (!db) return false;

  try {
    const statsDocRef = doc(db, 'clubs', clubId, 'data', 'stats');
    const sanitized = sanitizeForFirestore({
      playerStats: playerStats || {},
      partnershipStats: partnershipStats || {},
      updatedAt: new Date().toISOString(),
    });
    await setDoc(statsDocRef, sanitized, { merge: true });
    return true;
  } catch (err) {
    console.error('[Firebase] Error saving stats to cloud:', err);
    return false;
  }
}

export async function saveKnownPlayersToCloud(clubId = DEFAULT_CLUB_ID, roster) {
  const db = getDb();
  if (!db) return false;

  try {
    const playersDocRef = doc(db, 'clubs', clubId, 'data', 'players');
    const sanitized = sanitizeForFirestore({
      roster: roster || [],
      updatedAt: new Date().toISOString(),
    });
    await setDoc(playersDocRef, sanitized, { merge: true });
    return true;
  } catch (err) {
    console.error('[Firebase] Error saving players to cloud:', err);
    return false;
  }
}

export async function saveConfigsToCloud(clubId = DEFAULT_CLUB_ID, { defaultConfig, presets }) {
  const db = getDb();
  if (!db) return false;

  try {
    const configDocRef = doc(db, 'clubs', clubId, 'data', 'config');
    const encodedDefault = defaultConfig ? encodeStateForFirestore(defaultConfig) : null;
    const encodedPresets = Array.isArray(presets)
      ? presets.map((p) => encodeStateForFirestore(p))
      : [];
    const sanitized = sanitizeForFirestore({
      defaultConfig: encodedDefault,
      presets: encodedPresets,
      updatedAt: new Date().toISOString(),
    });
    await setDoc(configDocRef, sanitized, { merge: true });
    return true;
  } catch (err) {
    console.error('[Firebase] Error saving tournament configs to cloud:', err);
    return false;
  }
}

/**
 * Deletes active tournament, stats, and known player documents in Firestore for all known/discovered rooms,
 * and wipes all NEEP-NLP localStorage keys on this device.
 */
export async function wipeAllDatabaseData(additionalRoomIds = []) {
  const db = getDb();
  const roomIdsToClear = new Set([
    DEFAULT_CLUB_ID,
    'neep-main',
    ...additionalRoomIds.filter(Boolean),
  ]);

  // Discover any rooms stored in localStorage keys
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;
      const match = k.match(/^neep_(?:tourn|stats|pairs|players)_(.+)_v1$/);
      if (match && match[1]) {
        roomIdsToClear.add(match[1]);
      }
    }
    const savedRoomsRaw = localStorage.getItem('neep_saved_rooms_v1');
    if (savedRoomsRaw) {
      const parsed = JSON.parse(savedRoomsRaw);
      if (Array.isArray(parsed)) {
        parsed.forEach((r) => {
          if (r?.roomId) roomIdsToClear.add(r.roomId);
        });
      }
    }
    const currRoom = localStorage.getItem('neep_current_room');
    if (currRoom) roomIdsToClear.add(currRoom);
  } catch (e) {}

  // Also try listing top-level `clubs` documents if any exist in Firestore
  if (db) {
    try {
      const clubsSnap = await getDocs(collection(db, 'clubs'));
      clubsSnap.forEach((docSnap) => {
        if (docSnap.id) roomIdsToClear.add(docSnap.id);
      });
    } catch (e) {
      // ignore if top-level docs don't exist
    }

    // Delete subcollection docs for every roomId
    for (const rid of roomIdsToClear) {
      try {
        await deleteDoc(doc(db, 'clubs', rid, 'tournaments', 'active'));
      } catch (e) {}
      try {
        await deleteDoc(doc(db, 'clubs', rid, 'data', 'players'));
      } catch (e) {}
      try {
        await deleteDoc(doc(db, 'clubs', rid, 'data', 'stats'));
      } catch (e) {}
      try {
        await deleteDoc(doc(db, 'clubs', rid));
      } catch (e) {}
    }
  }

  // Clear local storage keys for all tournaments, players, stats, and room history
  try {
    const keysToRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('neep_') || k.startsWith('neep-pickleball-')) &&
        k !== STORAGE_KEY_FIREBASE_CONFIG
      ) {
        keysToRemove.push(k);
      }
    }
    keysToRemove.forEach((k) => localStorage.removeItem(k));
  } catch (e) {}

  return Array.from(roomIdsToClear);
}

// ---------------- Super Admin Room Management ----------------

export async function fetchAllRoomsForAdmin() {
  const db = getDb();
  const roomsById = new Map();
  let cloudPermissionError = false;

  function upsertEntry(rid, partial) {
    if (!rid || rid === '_admin_registry' || rid === 'neep-main' || rid === DEFAULT_CLUB_ID) return;
    const cleanId = String(rid).trim().toUpperCase();
    if (!cleanId) return;
    const existing = roomsById.get(cleanId) || {
      roomId: cleanId,
      adminPin: '1234',
      view: 'setup',
      playerCount: 0,
      directoryCount: 0,
      numTeams: 4,
      goalScore: 11,
      dreambreakerScore: 21,
      dreambreakerFormat: 'singles',
      hasBracket: false,
      updatedAt: null,
      source: 'local',
    };
    const nextSource =
      existing.source && partial.source && existing.source !== partial.source
        ? 'both'
        : partial.source || existing.source;

    roomsById.set(cleanId, {
      ...existing,
      ...partial,
      roomId: cleanId,
      source: nextSource,
    });
  }

  // 1. Scan localStorage for any rooms on this device
  try {
    const savedHistoryRaw = localStorage.getItem('neep_saved_rooms_v1');
    if (savedHistoryRaw) {
      const parsedHistory = JSON.parse(savedHistoryRaw);
      if (Array.isArray(parsedHistory)) {
        parsedHistory.forEach((h) => {
          if (h?.roomId) {
            upsertEntry(h.roomId, {
              adminPin: h.adminPin || '1234',
              updatedAt: h.updatedAt ? new Date(h.updatedAt).toISOString() : null,
              source: 'local',
            });
          }
        });
      }
    }

    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (!k) continue;

      const tournMatch = k.match(/^neep_tourn_(.+)_v1$/);
      if (tournMatch && tournMatch[1]) {
        const rid = tournMatch[1];
        try {
          const tData = JSON.parse(localStorage.getItem(k) || '{}');
          upsertEntry(rid, {
            adminPin: tData.adminPin || '1234',
            view: tData.view || 'setup',
            playerCount: Array.isArray(tData.playerPool) ? tData.playerPool.length : 0,
            numTeams: tData.numTeams || 4,
            goalScore: tData.goalScore || 11,
            dreambreakerScore: tData.dreambreakerScore || 21,
            dreambreakerFormat: tData.dreambreakerFormat || 'singles',
            hasBracket: Boolean(tData.bracket),
            updatedAt: tData.updatedAt || null,
            source: 'local',
          });
        } catch (e) {}
      }

      const playersMatch = k.match(/^neep_players_(.+)_v1$/);
      if (playersMatch && playersMatch[1]) {
        const rid = playersMatch[1];
        try {
          const pList = JSON.parse(localStorage.getItem(k) || '[]');
          if (Array.isArray(pList)) {
            upsertEntry(rid, {
              directoryCount: pList.length,
              source: 'local',
            });
          }
        } catch (e) {}
      }
    }
  } catch (e) {}

  // 2. Scan Firestore cloud registry, top-level clubs collection, and tournaments collectionGroup
  if (db) {
    try {
      const regSnap = await getDoc(doc(db, 'clubs', '_admin_registry', 'data', 'rooms'));
      if (regSnap.exists()) {
        const regRooms = regSnap.data()?.rooms || {};
        Object.entries(regRooms).forEach(([rid, summary]) => {
          if (summary && typeof summary === 'object') {
            upsertEntry(rid, {
              adminPin: summary.adminPin || '1234',
              view: summary.view || 'setup',
              playerCount: summary.playerCount ?? 0,
              numTeams: summary.numTeams || 4,
              hasBracket: Boolean(summary.hasBracket),
              updatedAt: summary.updatedAt || null,
              source: 'cloud',
            });
          }
        });
      }
    } catch (err) {
      if (String(err?.message || '').toLowerCase().includes('permission')) {
        cloudPermissionError = true;
      }
    }

    try {
      const clubsSnap = await getDocs(collection(db, 'clubs'));
      clubsSnap.forEach((docSnap) => {
        if (docSnap.id && docSnap.id !== '_admin_registry') {
          const d = docSnap.data() || {};
          upsertEntry(docSnap.id, {
            adminPin: d.adminPin || '1234',
            view: d.view || 'setup',
            playerCount: d.playerCount ?? 0,
            numTeams: d.numTeams || 4,
            hasBracket: Boolean(d.hasBracket),
            updatedAt: d.updatedAt || null,
            source: 'cloud',
          });
        }
      });
    } catch (err) {
      if (String(err?.message || '').toLowerCase().includes('permission')) {
        cloudPermissionError = true;
      }
    }

    try {
      const cgSnap = await getDocs(collectionGroup(db, 'tournaments'));
      cgSnap.forEach((docSnap) => {
        const d = docSnap.data() || {};
        const pathParts = docSnap.ref.path.split('/');
        const ridFromPath = pathParts.length >= 2 ? pathParts[1] : d.roomId;
        if (ridFromPath && ridFromPath !== '_admin_registry') {
          upsertEntry(ridFromPath, {
            adminPin: d.adminPin || '1234',
            view: d.view || 'setup',
            playerCount: Array.isArray(d.playerPool) ? d.playerPool.length : 0,
            numTeams: d.numTeams || 4,
            goalScore: d.goalScore || 11,
            dreambreakerScore: d.dreambreakerScore || 21,
            dreambreakerFormat: d.dreambreakerFormat || 'singles',
            hasBracket: Boolean(d.bracket),
            updatedAt: d.updatedAt || null,
            source: 'cloud',
          });
        }
      });
    } catch (err) {
      // ignore if collectionGroup index or permissions not configured
    }
  }

  const roomsList = Array.from(roomsById.values()).sort((a, b) => {
    const tA = a.updatedAt ? new Date(a.updatedAt).getTime() : 0;
    const tB = b.updatedAt ? new Date(b.updatedAt).getTime() : 0;
    if (tB !== tA) return tB - tA;
    return a.roomId.localeCompare(b.roomId);
  });

  return { rooms: roomsList, cloudPermissionError };
}

export async function fetchSingleRoomForAdmin(roomId) {
  const cleanId = String(roomId || '').trim().toUpperCase();
  if (!cleanId) return null;

  let found = null;

  // Check local first
  try {
    const raw = localStorage.getItem(`neep_tourn_${cleanId}_v1`);
    const playersRaw = localStorage.getItem(`neep_players_${cleanId}_v1`);
    const pList = playersRaw ? JSON.parse(playersRaw) : [];
    if (raw) {
      const tData = JSON.parse(raw);
      found = {
        roomId: cleanId,
        adminPin: tData.adminPin || '1234',
        view: tData.view || 'setup',
        playerCount: Array.isArray(tData.playerPool) ? tData.playerPool.length : 0,
        directoryCount: Array.isArray(pList) ? pList.length : 0,
        numTeams: tData.numTeams || 4,
        goalScore: tData.goalScore || 11,
        dreambreakerScore: tData.dreambreakerScore || 21,
        dreambreakerFormat: tData.dreambreakerFormat || 'singles',
        hasBracket: Boolean(tData.bracket),
        updatedAt: tData.updatedAt || null,
        source: 'local',
      };
    }
  } catch (e) {}

  // Check cloud
  const db = getDb();
  if (db) {
    try {
      const snap = await getDoc(doc(db, 'clubs', cleanId, 'tournaments', 'active'));
      if (snap.exists()) {
        const d = decodeStateFromFirestore(snap.data());
        let dirCount = found?.directoryCount || 0;
        try {
          const pSnap = await getDoc(doc(db, 'clubs', cleanId, 'data', 'players'));
          if (pSnap.exists() && Array.isArray(pSnap.data()?.roster)) {
            dirCount = pSnap.data().roster.length;
          }
        } catch (e) {}

        found = {
          roomId: cleanId,
          adminPin: d.adminPin || found?.adminPin || '1234',
          view: d.view || 'setup',
          playerCount: Array.isArray(d.playerPool) ? d.playerPool.length : 0,
          directoryCount: dirCount,
          numTeams: d.numTeams || 4,
          goalScore: d.goalScore || 11,
          dreambreakerScore: d.dreambreakerScore || 21,
          dreambreakerFormat: d.dreambreakerFormat || 'singles',
          hasBracket: Boolean(d.bracket),
          updatedAt: d.updatedAt || null,
          source: found ? 'both' : 'cloud',
        };
      }
    } catch (e) {}
  }

  return found;
}

export async function adminResetRoomPin(roomId, newPin) {
  const cleanId = String(roomId || '').trim().toUpperCase();
  const cleanPin = String(newPin || '').replace(/\D/g, '').slice(0, 8);
  if (!cleanId || !cleanPin) return false;

  const now = new Date().toISOString();

  // 1. Update local tournament storage
  try {
    const key = `neep_tourn_${cleanId}_v1`;
    const raw = localStorage.getItem(key);
    const parsed = raw ? JSON.parse(raw) : { roomId: cleanId, view: 'setup' };
    parsed.adminPin = cleanPin;
    parsed.updatedAt = now;
    localStorage.setItem(key, JSON.stringify(parsed));
  } catch (e) {}

  // 2. Update saved rooms history on this device
  try {
    const histKey = 'neep_saved_rooms_v1';
    const rawHist = localStorage.getItem(histKey);
    const list = rawHist ? JSON.parse(rawHist) : [];
    if (Array.isArray(list)) {
      const idx = list.findIndex((r) => r.roomId === cleanId);
      if (idx >= 0) {
        list[idx] = { ...list[idx], adminPin: cleanPin, isAdmin: true, updatedAt: Date.now() };
      } else {
        list.unshift({ roomId: cleanId, adminPin: cleanPin, isAdmin: true, updatedAt: Date.now() });
      }
      localStorage.setItem(histKey, JSON.stringify(list));
    }
  } catch (e) {}

  // 3. Update Firestore cloud documents
  const db = getDb();
  if (db) {
    try {
      await setDoc(
        doc(db, 'clubs', cleanId, 'tournaments', 'active'),
        { roomId: cleanId, adminPin: cleanPin, updatedAt: now },
        { merge: true }
      );
    } catch (e) {}
    try {
      await setDoc(
        doc(db, 'clubs', cleanId),
        { roomId: cleanId, adminPin: cleanPin, updatedAt: now },
        { merge: true }
      );
    } catch (e) {}
    try {
      await setDoc(
        doc(db, 'clubs', '_admin_registry', 'data', 'rooms'),
        { rooms: { [cleanId]: { roomId: cleanId, adminPin: cleanPin, updatedAt: now } }, updatedAt: now },
        { merge: true }
      );
    } catch (e) {}
  }

  return true;
}

export async function adminResetRoomBracket(roomId) {
  const cleanId = String(roomId || '').trim().toUpperCase();
  if (!cleanId) return false;
  const now = new Date().toISOString();

  try {
    const key = `neep_tourn_${cleanId}_v1`;
    const raw = localStorage.getItem(key);
    if (raw) {
      const parsed = JSON.parse(raw);
      const resetState = {
        ...parsed,
        view: 'setup',
        teams: [],
        playersById: {},
        remainingPool: [],
        pickSequence: [],
        pickPointer: 0,
        sittingOut: [],
        bracket: null,
        activePath: null,
        updatedAt: now,
      };
      localStorage.setItem(key, JSON.stringify(resetState));
    }
  } catch (e) {}

  const db = getDb();
  if (db) {
    try {
      await setDoc(
        doc(db, 'clubs', cleanId, 'tournaments', 'active'),
        {
          view: 'setup',
          teams: [],
          playersById: {},
          remainingPool: [],
          pickSequence: [],
          pickPointer: 0,
          sittingOut: [],
          bracket: null,
          activePath: null,
          updatedAt: now,
        },
        { merge: true }
      );
      await setDoc(
        doc(db, 'clubs', cleanId),
        { view: 'setup', hasBracket: false, updatedAt: now },
        { merge: true }
      );
      await setDoc(
        doc(db, 'clubs', '_admin_registry', 'data', 'rooms'),
        { rooms: { [cleanId]: { roomId: cleanId, view: 'setup', hasBracket: false, updatedAt: now } }, updatedAt: now },
        { merge: true }
      );
    } catch (e) {}
  }

  return true;
}

export async function adminDeleteRoom(roomId) {
  const cleanId = String(roomId || '').trim().toUpperCase();
  if (!cleanId) return false;

  // 1. Remove local keys
  try {
    localStorage.removeItem(`neep_tourn_${cleanId}_v1`);
    localStorage.removeItem(`neep_stats_${cleanId}_v1`);
    localStorage.removeItem(`neep_pairs_${cleanId}_v1`);
    localStorage.removeItem(`neep_players_${cleanId}_v1`);
    localStorage.removeItem(`neep_config_${cleanId}_v1`);

    const histKey = 'neep_saved_rooms_v1';
    const rawHist = localStorage.getItem(histKey);
    if (rawHist) {
      const parsed = JSON.parse(rawHist);
      if (Array.isArray(parsed)) {
        localStorage.setItem(
          histKey,
          JSON.stringify(parsed.filter((r) => r.roomId !== cleanId))
        );
      }
    }
    if (localStorage.getItem('neep_current_room') === cleanId) {
      localStorage.removeItem('neep_current_room');
    }
  } catch (e) {}

  // 2. Remove Firestore docs
  const db = getDb();
  if (db) {
    try { await deleteDoc(doc(db, 'clubs', cleanId, 'tournaments', 'active')); } catch (e) {}
    try { await deleteDoc(doc(db, 'clubs', cleanId, 'data', 'players')); } catch (e) {}
    try { await deleteDoc(doc(db, 'clubs', cleanId, 'data', 'stats')); } catch (e) {}
    try { await deleteDoc(doc(db, 'clubs', cleanId, 'data', 'config')); } catch (e) {}
    try { await deleteDoc(doc(db, 'clubs', cleanId)); } catch (e) {}
    try {
      const regRef = doc(db, 'clubs', '_admin_registry', 'data', 'rooms');
      const regSnap = await getDoc(regRef);
      if (regSnap.exists()) {
        const roomsMap = { ...(regSnap.data()?.rooms || {}) };
        delete roomsMap[cleanId];
        await setDoc(regRef, { rooms: roomsMap, updatedAt: new Date().toISOString() });
      }
    } catch (e) {}
  }

  return true;
}
