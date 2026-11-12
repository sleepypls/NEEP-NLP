import React, { useState, useEffect, useRef } from 'react';
import { Header } from './components/Header';
import { SetupView } from './components/SetupView';
import { DraftView } from './components/DraftView';
import { BracketView } from './components/BracketView';
import { MatchDashboard } from './components/MatchDashboard';
import { DreambreakerSetupView } from './components/DreambreakerSetupView';
import { DreambreakerPlayView } from './components/DreambreakerPlayView';
import { LeaderboardView } from './components/LeaderboardView';
import { ConfirmModal } from './components/ConfirmModal';
import { ShareModal } from './components/ShareModal';
import { CloudConfigModal } from './components/CloudConfigModal';
import { EditMatchupModal } from './components/EditMatchupModal';
import { RosterModal } from './components/RosterModal';
import { LandingView } from './components/LandingView';
import { RoomCreatedModal } from './components/RoomCreatedModal';

import {
  generateGames,
  initializeDraftState,
  generateBracket,
  advanceWinner,
  computeAllStats,
  randomizePendingMatchups,
  revertPendingMatchups,
  revertSingleMatchup,
  substitutePlayerInTournament,
  renamePlayerInTournament,
  reorderTeamDraftPosition,
} from './utils/tournament';

import {
  isCloudEnabled,
  subscribeToActiveTournament,
  subscribeToStats,
  subscribeToKnownPlayers,
  saveTournamentToCloud,
  saveStatsToCloud,
  saveKnownPlayersToCloud,
  checkRoomExistsInCloud,
} from './services/firebase';
import { RoomModal } from './components/RoomModal';
import {
  DEFAULT_ROOM_ID,
  DEFAULT_ADMIN_PIN,
  generateRoomId,
  generatePin,
  sanitizeRoomId,
  checkLocalRoomExists,
  loadSavedRoomsHistory,
  upsertSavedRoomHistory,
  removeSavedRoomHistory,
} from './utils/room';

function getTournStorageKey(rid) {
  return rid === DEFAULT_ROOM_ID ? 'neep-pickleball-tournament-state-v1' : `neep_tourn_${rid}_v1`;
}
function getStatsStorageKey(rid) {
  return rid === DEFAULT_ROOM_ID ? 'neep-pickleball-global-stats-v1' : `neep_stats_${rid}_v1`;
}
function getPairsStorageKey(rid) {
  return rid === DEFAULT_ROOM_ID ? 'neep-pickleball-partnerships-v1' : `neep_pairs_${rid}_v1`;
}
function getKnownPlayersStorageKey(rid) {
  return rid === DEFAULT_ROOM_ID ? 'neep-pickleball-known-players-v1' : `neep_players_${rid}_v1`;
}
const DEFAULT_STORAGE_KEY_KNOWN_PLAYERS = 'neep-pickleball-known-players-v1';

function getInitialRoomId() {
  try {
    const params = new URLSearchParams(window.location.search);
    const urlRoom = params.get('room');
    if (urlRoom) return sanitizeRoomId(urlRoom);
  } catch (e) {}
  return null;
}

function loadSavedTournament(rid) {
  if (!rid) return null;
  try {
    const raw = localStorage.getItem(getTournStorageKey(rid));
    if (raw) return JSON.parse(raw);
  } catch (e) {
    console.warn('Error reading saved tournament from storage:', e);
  }
  return null;
}

function loadKnownPlayers(rid, fallbackPool = []) {
  if (!rid) return [];
  let list = [];
  try {
    const raw = localStorage.getItem(getKnownPlayersStorageKey(rid));
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed)) list = parsed;
    }
  } catch (e) {
    console.warn('Error reading known players for room:', rid, e);
  }

  // Automatically merge any players already present in the tournament pool
  if (Array.isArray(fallbackPool) && fallbackPool.length > 0) {
    const poolNames = fallbackPool.map((p) => (p?.name || '').trim()).filter(Boolean);
    const existingLower = new Set(list.map((n) => n.trim().toLowerCase()));
    let changed = false;
    for (const name of poolNames) {
      if (!existingLower.has(name.toLowerCase())) {
        list.push(name);
        existingLower.add(name.toLowerCase());
        changed = true;
      }
    }
    if (changed) {
      try {
        localStorage.setItem(getKnownPlayersStorageKey(rid), JSON.stringify(list));
      } catch (e) {}
    }
  }

  return list;
}

export default function App() {
  const initialRoomId = getInitialRoomId();
  const initialSaved = initialRoomId ? loadSavedTournament(initialRoomId) : null;

  const [roomId, setRoomId] = useState(initialRoomId);
  const [adminPin, setAdminPin] = useState(() => initialSaved?.adminPin || DEFAULT_ADMIN_PIN);
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const pin = params.get('pin');
      if (mode === 'spectator') return false;
      if (mode === 'admin') {
        const expectedPin = initialSaved?.adminPin || DEFAULT_ADMIN_PIN;
        return !pin || pin === expectedPin;
      }
    } catch (e) {}
    return true;
  });

  const [view, setView] = useState(() => {
    if (!initialRoomId) return 'landing';
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      if (mode === 'spectator' && initialSaved?.bracket) {
        return 'bracket';
      }
    } catch (e) {}
    return initialSaved?.view || 'setup';
  });
  const [playerPool, setPlayerPool] = useState(() => initialSaved?.playerPool || []);
  const [nextPlayerId, setNextPlayerId] = useState(() => initialSaved?.nextPlayerId || (initialSaved?.playerPool?.length ? Math.max(...initialSaved.playerPool.map((p) => p.id)) + 1 : 1));
  const [numTeams, setNumTeams] = useState(() => initialSaved?.numTeams || 4);
  const [goalScore, setGoalScore] = useState(() => initialSaved?.goalScore || 11);
  const [dreambreakerScore, setDreambreakerScore] = useState(() => initialSaved?.dreambreakerScore || 21);
  const [allowUneven, setAllowUneven] = useState(() => (initialSaved?.allowUneven !== undefined ? initialSaved.allowUneven : true));
  const [captainMode, setCaptainMode] = useState(() => initialSaved?.captainMode || 'random');
  const [selectedCaptainIds, setSelectedCaptainIds] = useState(() => initialSaved?.selectedCaptainIds || []);
  const [matchupConfig, setMatchupConfig] = useState(() => initialSaved?.matchupConfig || { preset: 'adjacent', customSlotPairs: [] });

  const [teams, setTeams] = useState(() => initialSaved?.teams || []);
  const [playersById, setPlayersById] = useState(() => initialSaved?.playersById || {});
  const [remainingPool, setRemainingPool] = useState(() => initialSaved?.remainingPool || []);
  const [pickSequence, setPickSequence] = useState(() => initialSaved?.pickSequence || []);
  const [pickPointer, setPickPointer] = useState(() => initialSaved?.pickPointer || 0);
  const [sittingOut, setSittingOut] = useState(() => initialSaved?.sittingOut || []);

  const [bracket, setBracket] = useState(() => initialSaved?.bracket || null);
  const [activePath, setActivePath] = useState(() => initialSaved?.activePath || null);

  const [globalStats, setGlobalStats] = useState(() => {
    if (!initialRoomId) return {};
    try {
      const raw = localStorage.getItem(getStatsStorageKey(initialRoomId));
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  });
  const [partnershipStats, setPartnershipStats] = useState(() => {
    if (!initialRoomId) return {};
    try {
      const raw = localStorage.getItem(getPairsStorageKey(initialRoomId));
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  });
  const [priorStats, setPriorStats] = useState(() => {
    if (!initialRoomId) return {};
    try {
      const raw = localStorage.getItem(getStatsStorageKey(initialRoomId));
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  });
  const [priorPartnershipStats, setPriorPartnershipStats] = useState(() => {
    if (!initialRoomId) return {};
    try {
      const raw = localStorage.getItem(getPairsStorageKey(initialRoomId));
      return raw ? JSON.parse(raw) : {};
    } catch (e) { return {}; }
  });
  const [savedPlayers, setSavedPlayers] = useState(() => initialRoomId ? loadKnownPlayers(initialRoomId, initialSaved?.playerPool) : []);

  const [newlyCreatedRoomInfo, setNewlyCreatedRoomInfo] = useState(null);
  const [savedRoomsHistory, setSavedRoomsHistory] = useState(() => loadSavedRoomsHistory());

  const recentRoomId = (() => {
    if (savedRoomsHistory.length > 0) return savedRoomsHistory[0].roomId;
    try {
      const saved = localStorage.getItem('neep_current_room');
      return saved ? sanitizeRoomId(saved) : null;
    } catch (e) {
      return null;
    }
  })();

  // Modals
  const [modal, setModal] = useState(null);
  const [isShareOpen, setIsShareOpen] = useState(false);
  const [isRoomModalOpen, setIsRoomModalOpen] = useState(false);
  const [isCloudConfigOpen, setIsCloudConfigOpen] = useState(false);
  const [isRosterModalOpen, setIsRosterModalOpen] = useState(false);
  const [rosterModalTeamId, setRosterModalTeamId] = useState(null);
  const [editingMatchupGame, setEditingMatchupGame] = useState(null);
  const [showRotateBanner, setShowRotateBanner] = useState(false);
  const rotateTimeoutRef = useRef(null);

  // 1. Keep active room and mode in URL bar so refresh preserves it
  useEffect(() => {
    try {
      if (view === 'landing' || !roomId) {
        const url = new URL(window.location.href);
        if (url.searchParams.has('room')) {
          url.searchParams.delete('room');
          url.searchParams.delete('pin');
          url.searchParams.delete('mode');
          window.history.replaceState({}, '', url.toString());
        }
        return;
      }
      const url = new URL(window.location.href);
      let changed = false;
      if (url.searchParams.get('room') !== roomId) {
        url.searchParams.set('room', roomId);
        changed = true;
      }
      if (!isAdmin && url.searchParams.get('mode') !== 'spectator') {
        url.searchParams.set('mode', 'spectator');
        changed = true;
      }
      if (changed) {
        window.history.replaceState({}, '', url.toString());
      }
    } catch (e) {}
  }, [roomId, isAdmin, view]);

  // 2. Load Stats & Setup Cloud Listeners for Active Room
  useEffect(() => {
    if (!roomId || view === 'landing') return;

    try {
      localStorage.setItem('neep_current_room', roomId);
      setSavedRoomsHistory(upsertSavedRoomHistory(roomId, isAdmin ? adminPin : null, isAdmin));
      const statsKey = getStatsStorageKey(roomId);
      const pairsKey = getPairsStorageKey(roomId);

      const rawStats = localStorage.getItem(statsKey);
      const pStats = rawStats ? JSON.parse(rawStats) : {};
      const rawPairs = localStorage.getItem(pairsKey);
      const pairStats = rawPairs ? JSON.parse(rawPairs) : {};
      setGlobalStats(pStats);
      setPartnershipStats(pairStats);
      setPriorStats(pStats);
      setPriorPartnershipStats(pairStats);

      const roomKnown = loadKnownPlayers(roomId, playerPool);
      setSavedPlayers(roomKnown);
    } catch (e) {
      console.warn('Error loading room stats & players:', e);
    }

    // Connect Firebase Realtime listeners for this roomId
    let unsubTourn = () => {};
    let unsubStats = () => {};
    let unsubPlayers = () => {};

    if (isCloudEnabled()) {
      unsubTourn = subscribeToActiveTournament(roomId, (cloudTourn) => {
        if (cloudTourn) {
          if (cloudTourn.playerPool) setPlayerPool(cloudTourn.playerPool);
          if (cloudTourn.nextPlayerId) setNextPlayerId(cloudTourn.nextPlayerId);
          if (cloudTourn.numTeams) setNumTeams(cloudTourn.numTeams);
          if (cloudTourn.goalScore) setGoalScore(cloudTourn.goalScore);
          if (cloudTourn.dreambreakerScore) setDreambreakerScore(cloudTourn.dreambreakerScore);
          if (cloudTourn.allowUneven !== undefined) setAllowUneven(cloudTourn.allowUneven);
          if (cloudTourn.captainMode !== undefined) setCaptainMode(cloudTourn.captainMode);
          if (cloudTourn.selectedCaptainIds !== undefined) setSelectedCaptainIds(cloudTourn.selectedCaptainIds);
          if (cloudTourn.matchupConfig !== undefined) setMatchupConfig(cloudTourn.matchupConfig);
          if (cloudTourn.teams) setTeams(cloudTourn.teams);
          if (cloudTourn.playersById) setPlayersById(cloudTourn.playersById);
          if (cloudTourn.remainingPool) setRemainingPool(cloudTourn.remainingPool);
          if (cloudTourn.pickSequence) setPickSequence(cloudTourn.pickSequence);
          if (cloudTourn.pickPointer !== undefined) setPickPointer(cloudTourn.pickPointer);
          if (cloudTourn.sittingOut) setSittingOut(cloudTourn.sittingOut);
          if (cloudTourn.bracket) {
            setBracket(cloudTourn.bracket);
            // Spectator smart routing: if spectator arrives and bracket exists while still on setup, route to bracket!
            setView((curr) => (curr === 'setup' ? 'bracket' : curr));
          }
          if (cloudTourn.adminPin) setAdminPin(cloudTourn.adminPin);

          // If admin, sync view if cloud had a progression
          if (isAdmin && cloudTourn.view) {
            setView((curr) => (curr === 'setup' && cloudTourn.bracket ? 'bracket' : curr));
          }
        }
      });

      unsubStats = subscribeToStats(roomId, ({ playerStats, partnershipStats }) => {
        if (playerStats) setGlobalStats(playerStats);
        if (partnershipStats) setPartnershipStats(partnershipStats);
      });

      unsubPlayers = subscribeToKnownPlayers(roomId, (cloudPlayers) => {
        if (cloudPlayers && Array.isArray(cloudPlayers)) {
          setSavedPlayers(cloudPlayers);
          try {
            localStorage.setItem(getKnownPlayersStorageKey(roomId), JSON.stringify(cloudPlayers));
          } catch (e) {}
        }
      });
    }

    return () => {
      unsubTourn();
      unsubStats();
      unsubPlayers();
      if (rotateTimeoutRef.current) clearTimeout(rotateTimeoutRef.current);
    };
  }, [roomId, isAdmin, view]);

  // Automatically ensure any newly added tournament players are saved to the active room directory
  const prevPoolRef = useRef(playerPool);
  useEffect(() => {
    if (!roomId || view === 'landing') return;

    const prevNames = new Set(
      (prevPoolRef.current || [])
        .map((p) => (p?.name || '').trim().toLowerCase())
        .filter(Boolean)
    );
    prevPoolRef.current = playerPool;

    const newlyAdded = (playerPool || [])
      .map((p) => (p?.name || '').trim())
      .filter(Boolean)
      .filter((name) => !prevNames.has(name.toLowerCase()));

    if (newlyAdded.length > 0) {
      setSavedPlayers((currentSaved) => {
        const currentLower = new Set(currentSaved.map((n) => n.trim().toLowerCase()));
        const toAdd = newlyAdded.filter((name) => !currentLower.has(name.toLowerCase()));
        if (toAdd.length === 0) return currentSaved;

        const uniqueToAdd = Array.from(new Set(toAdd));
        const updated = [...currentSaved, ...uniqueToAdd];
        try {
          localStorage.setItem(getKnownPlayersStorageKey(roomId), JSON.stringify(updated));
        } catch (e) {}
        if (isCloudEnabled()) {
          saveKnownPlayersToCloud(roomId, updated);
        }
        return updated;
      });
    }
  }, [playerPool, roomId, view]);

  // 3. LocalStorage persistence on change
  useEffect(() => {
    if (!roomId || view === 'landing') return;

    try {
      localStorage.setItem(
        getTournStorageKey(roomId),
        JSON.stringify({
          roomId,
          adminPin,
          view, playerPool, nextPlayerId, numTeams, goalScore, dreambreakerScore, allowUneven,
          captainMode, selectedCaptainIds, matchupConfig,
          teams, playersById, remainingPool, pickSequence, pickPointer, sittingOut, bracket, activePath,
        })
      );
    } catch (e) {
      // ignore
    }
  }, [roomId, adminPin, view, playerPool, nextPlayerId, numTeams, goalScore, dreambreakerScore, allowUneven, captainMode, selectedCaptainIds, matchupConfig, teams, playersById, remainingPool, pickSequence, pickPointer, sittingOut, bracket, activePath]);


  function syncTournamentStats(currentBracket, currentTeams, currentPlayers) {
    const computed = computeAllStats(priorStats, priorPartnershipStats, currentBracket, currentTeams, currentPlayers);
    setGlobalStats(computed.playerStats);
    setPartnershipStats(computed.partnershipStats);

    try {
      localStorage.setItem(getStatsStorageKey(roomId), JSON.stringify(computed.playerStats));
      localStorage.setItem(getPairsStorageKey(roomId), JSON.stringify(computed.partnershipStats));
    } catch (e) {
      // ignore
    }

    if (isCloudEnabled()) {
      saveStatsToCloud(roomId, computed.playerStats, computed.partnershipStats);
    }
  }

  function broadcastTournamentChange(updates) {
    if (isCloudEnabled()) {
      saveTournamentToCloud(roomId, {
        roomId,
        adminPin,
        view, playerPool, nextPlayerId, numTeams, goalScore, dreambreakerScore, allowUneven,
        captainMode, selectedCaptainIds, matchupConfig,
        teams, playersById, remainingPool, pickSequence, pickPointer, sittingOut, bracket, activePath,
        ...updates,
      });
    }
  }

  function handleImportFromMainDirectory() {
    try {
      const mainRaw = localStorage.getItem(DEFAULT_STORAGE_KEY_KNOWN_PLAYERS);
      const mainPlayers = mainRaw ? JSON.parse(mainRaw) : [];
      if (!Array.isArray(mainPlayers) || mainPlayers.length === 0) return;
      const merged = Array.from(new Set([...savedPlayers, ...mainPlayers]));
      setSavedPlayers(merged);
      localStorage.setItem(getKnownPlayersStorageKey(roomId), JSON.stringify(merged));
      if (isCloudEnabled()) {
        saveKnownPlayersToCloud(roomId, merged);
      }
    } catch (e) {
      console.warn('Error importing from main directory:', e);
    }
  }

  function handleAddPlayerToDirectory(name) {
    const trimmed = String(name).trim();
    if (!trimmed) return;
    if (!savedPlayers.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) {
      const updated = [...savedPlayers, trimmed];
      setSavedPlayers(updated);
      try {
        localStorage.setItem(getKnownPlayersStorageKey(roomId), JSON.stringify(updated));
      } catch (e) {}
      if (isCloudEnabled()) {
        saveKnownPlayersToCloud(roomId, updated);
      }
    }
  }

  function addPlayer(name) {
    const trimmed = String(name).trim();
    if (!trimmed) return;
    const updatedPool = [...playerPool, { id: nextPlayerId, name: trimmed }];
    setPlayerPool(updatedPool);
    setNextPlayerId((n) => n + 1);

    if (!savedPlayers.some((n) => n.trim().toLowerCase() === trimmed.toLowerCase())) {
      const updatedKnown = [...savedPlayers, trimmed];
      setSavedPlayers(updatedKnown);
      try {
        localStorage.setItem(getKnownPlayersStorageKey(roomId), JSON.stringify(updatedKnown));
      } catch (e) {}
      if (isCloudEnabled()) {
        saveKnownPlayersToCloud(roomId, updatedKnown);
      }
    }
    broadcastTournamentChange({ playerPool: updatedPool, nextPlayerId: nextPlayerId + 1 });
  }

  function removePlayer(id) {
    const updatedPool = playerPool.filter((p) => p.id !== id);
    const updatedCaptains = selectedCaptainIds.filter((cid) => cid !== id);
    setPlayerPool(updatedPool);
    setSelectedCaptainIds(updatedCaptains);
    broadcastTournamentChange({ playerPool: updatedPool, selectedCaptainIds: updatedCaptains });
  }

  function handleAddSavedPlayer(name) {
    addPlayer(name);
  }

  function handleAddMultiplePlayers(namesArray, addToPool = true) {
    if (!Array.isArray(namesArray) || namesArray.length === 0) return 0;
    const cleanNames = namesArray
      .map((n) => String(n || '').trim())
      .filter(Boolean);
    if (cleanNames.length === 0) return 0;

    // 1. Update directory (savedPlayers)
    const existingSavedLower = new Set(savedPlayers.map((n) => n.trim().toLowerCase()));
    const newForDirectory = [];
    for (const name of cleanNames) {
      const lower = name.toLowerCase();
      if (!existingSavedLower.has(lower)) {
        existingSavedLower.add(lower);
        newForDirectory.push(name);
      }
    }
    if (newForDirectory.length > 0) {
      const updatedSaved = [...savedPlayers, ...newForDirectory];
      setSavedPlayers(updatedSaved);
      try {
        localStorage.setItem(getKnownPlayersStorageKey(roomId), JSON.stringify(updatedSaved));
      } catch (e) {}
      if (isCloudEnabled()) {
        saveKnownPlayersToCloud(roomId, updatedSaved);
      }
    }

    // 2. Optionally add to active tournament playerPool
    if (!addToPool) return newForDirectory.length;

    const existingPoolLower = new Set(playerPool.map((p) => p.name.trim().toLowerCase()));
    const toAddPool = [];
    for (const name of cleanNames) {
      const lower = name.toLowerCase();
      if (!existingPoolLower.has(lower)) {
        existingPoolLower.add(lower);
        toAddPool.push(name);
      }
    }
    if (toAddPool.length === 0) return 0;

    let nextId = nextPlayerId;
    const newPoolItems = toAddPool.map((name) => ({ id: nextId++, name }));
    const updatedPool = [...playerPool, ...newPoolItems];
    setPlayerPool(updatedPool);
    setNextPlayerId(nextId);
    broadcastTournamentChange({ playerPool: updatedPool, nextPlayerId: nextId });
    return toAddPool.length;
  }

  function handleAddAllSavedPlayers() {
    const existingNames = new Set(playerPool.map((p) => p.name.trim().toLowerCase()));
    const toAdd = savedPlayers.filter((n) => !existingNames.has(n.trim().toLowerCase()));
    if (toAdd.length === 0) return;
    let nextId = nextPlayerId;
    const newItems = toAdd.map((name) => ({ id: nextId++, name }));
    const updatedPool = [...playerPool, ...newItems];
    setPlayerPool(updatedPool);
    setNextPlayerId(nextId);
    broadcastTournamentChange({ playerPool: updatedPool, nextPlayerId: nextId });
  }

  function handleRemoveSavedPlayer(name) {
    const updated = savedPlayers.filter((n) => n.trim().toLowerCase() !== name.trim().toLowerCase());
    setSavedPlayers(updated);
    try {
      localStorage.setItem(getKnownPlayersStorageKey(roomId), JSON.stringify(updated));
    } catch (e) {}
    if (isCloudEnabled()) {
      saveKnownPlayersToCloud(roomId, updated);
    }
  }

  function handleRenameDirectoryPlayer(oldName, newName) {
    const cleanOld = String(oldName || '').trim();
    const cleanNew = String(newName || '').trim();
    if (!cleanOld || !cleanNew || cleanOld.toLowerCase() === cleanNew.toLowerCase()) return;

    // 1. Update savedPlayers in active room directory
    const updatedKnown = Array.from(
      new Set(
        savedPlayers.map((n) => (n.trim().toLowerCase() === cleanOld.toLowerCase() ? cleanNew : n))
      )
    );
    setSavedPlayers(updatedKnown);
    try {
      localStorage.setItem(getKnownPlayersStorageKey(roomId), JSON.stringify(updatedKnown));
    } catch (e) {}
    if (isCloudEnabled()) {
      saveKnownPlayersToCloud(roomId, updatedKnown);
    }

    // 2. If this player is currently in the active tournament pool, rename them in tournament as well
    const poolPlayer = playerPool.find((p) => p.name.trim().toLowerCase() === cleanOld.toLowerCase());
    if (poolPlayer) {
      const updatedPool = playerPool.map((p) =>
        p.id === poolPlayer.id ? { ...p, name: cleanNew } : p
      );
      setPlayerPool(updatedPool);

      const updatedPlayersById = { ...playersById, [poolPlayer.id]: cleanNew };
      setPlayersById(updatedPlayersById);

      if (bracket) {
        syncTournamentStats(bracket, teams, updatedPlayersById);
      }

      broadcastTournamentChange({
        playerPool: updatedPool,
        playersById: updatedPlayersById,
      });
    }
  }

  function handleInitializeDraft() {
    const captainsToUse = captainMode === 'manual' ? selectedCaptainIds : [];
    const result = initializeDraftState(playerPool, numTeams, allowUneven, captainsToUse);
    setTeams(result.teams);
    setRemainingPool(result.remainingPool);
    setPickSequence(result.pickSequence);
    setPickPointer(0);
    setPlayersById(result.playersById);
    setSittingOut(result.sittingOut);
    setView('draft');

    broadcastTournamentChange({
      teams: result.teams,
      remainingPool: result.remainingPool,
      pickSequence: result.pickSequence,
      pickPointer: 0,
      playersById: result.playersById,
      sittingOut: result.sittingOut,
      view: 'draft',
    });
  }

  function draftPlayer(playerId) {
    if (pickPointer >= pickSequence.length) return;
    const teamIdx = pickSequence[pickPointer];
    const updatedTeams = teams.map((t, i) =>
      i === teamIdx ? { ...t, draftOrder: [...t.draftOrder, playerId] } : t
    );
    const updatedPool = remainingPool.filter((p) => p.id !== playerId);
    const nextPointer = pickPointer + 1;

    setTeams(updatedTeams);
    setRemainingPool(updatedPool);
    setPickPointer(nextPointer);

    broadcastTournamentChange({
      teams: updatedTeams,
      remainingPool: updatedPool,
      pickPointer: nextPointer,
    });
  }

  function handleGenerateBracket() {
    const newBracket = generateBracket(teams);
    setBracket(newBracket);
    setView('bracket');
    broadcastTournamentChange({ bracket: newBracket, view: 'bracket' });
  }

  function getActiveMatch() {
    if (!activePath || !bracket) return null;
    return bracket.rounds[activePath.round][activePath.idx];
  }

  function openMatch(roundIdx, matchIdx) {
    const match = bracket.rounds[roundIdx][matchIdx];
    if (match.teamAId === null || match.teamBId === null) return;
    setActivePath({ round: roundIdx, idx: matchIdx });

    let workingBracket = bracket;
    if (!match.games) {
      const teamA = teams.find((t) => t.id === match.teamAId);
      const teamB = teams.find((t) => t.id === match.teamBId);
      const games = generateGames(teamA, teamB, goalScore, matchupConfig);
      const nb = JSON.parse(JSON.stringify(bracket));
      nb.rounds[roundIdx][matchIdx].games = games;
      nb.rounds[roundIdx][matchIdx].status = 'in_progress';
      workingBracket = nb;
      setBracket(nb);
      broadcastTournamentChange({ bracket: nb, activePath: { round: roundIdx, idx: matchIdx } });
    }

    const current = workingBracket.rounds[roundIdx][matchIdx];
    if (current.status === 'complete') { setView('match'); return; }
    if (current.status === 'tied') {
      setView(current.dreambreaker && current.dreambreaker.started ? 'dreambreakerPlay' : 'dreambreakerSetup');
      return;
    }
    setView('match');
  }

  function handleSaveGame(gameId, scoreA, scoreB) {
    const { round, idx } = activePath;
    const match = bracket.rounds[round][idx];
    const teamA = teams.find((t) => t.id === match.teamAId);
    const teamB = teams.find((t) => t.id === match.teamBId);
    const updatedGames = match.games.map((g) =>
      g.id === gameId ? { ...g, scoreA: Number(scoreA), scoreB: Number(scoreB), saved: true, inProgress: false } : g
    );
    const gamesWonA = updatedGames.filter((g) => g.saved && g.scoreA > g.scoreB).length;
    const gamesWonB = updatedGames.filter((g) => g.saved && g.scoreB > g.scoreA).length;
    const allSaved = updatedGames.every((g) => g.saved);

    let nb = JSON.parse(JSON.stringify(bracket));
    const m = nb.rounds[round][idx];
    m.games = updatedGames;
    m.gamesWonA = gamesWonA;
    m.gamesWonB = gamesWonB;

    if (allSaved) {
      if (gamesWonA === gamesWonB) {
        m.status = 'tied';
        if (!m.dreambreaker || m.winnerId !== null) {
          m.dreambreaker = {
            lineupA: [...teamA.draftOrder],
            lineupB: [...teamB.draftOrder],
            lockedA: false,
            lockedB: false,
            started: false,
            scoreA: 0,
            scoreB: 0,
            goalScore: dreambreakerScore,
            rotationIndex: 0,
            lastRotationTrigger: 0,
            playerStats: {},
            completed: false,
            winnerId: null,
          };
        }
        m.winnerId = null;
        if (round + 1 < nb.rounds.length) {
          const nextIdx = Math.floor(idx / 2);
          const slot = idx % 2 === 0 ? 'teamAId' : 'teamBId';
          nb.rounds[round + 1][nextIdx][slot] = null;
          nb.rounds[round + 1][nextIdx].status = 'pending';
        }
      } else {
        const winnerId = gamesWonA > gamesWonB ? match.teamAId : match.teamBId;
        m.status = 'complete';
        m.winnerId = winnerId;
        nb = advanceWinner(nb, round, idx, winnerId);
      }
    } else {
      m.status = 'in_progress';
      m.winnerId = null;
      if (round + 1 < nb.rounds.length) {
        const nextIdx = Math.floor(idx / 2);
        const slot = idx % 2 === 0 ? 'teamAId' : 'teamBId';
        nb.rounds[round + 1][nextIdx][slot] = null;
        nb.rounds[round + 1][nextIdx].status = 'pending';
      }
    }
    setBracket(nb);
    syncTournamentStats(nb, teams, playersById);
    broadcastTournamentChange({ bracket: nb });
  }

  function handleToggleGameInProgress(gameId) {
    if (!activePath || !bracket) return;
    const { round, idx } = activePath;
    const match = bracket.rounds[round][idx];
    if (!match.games) return;
    const updatedGames = match.games.map((g) =>
      g.id === gameId ? { ...g, inProgress: !g.inProgress } : g
    );
    const nb = JSON.parse(JSON.stringify(bracket));
    nb.rounds[round][idx].games = updatedGames;
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function handleUpdateGameMatchup(gameId, pairA, pairB, slotPair) {
    if (!activePath || !bracket) return;
    const { round, idx } = activePath;
    const match = bracket.rounds[round][idx];
    if (!match.games) return;
    const updatedGames = match.games.map((g) =>
      g.id === gameId
        ? { ...g, pairA, pairB, slotPair: slotPair || null, inProgress: false }
        : g
    );
    const nb = JSON.parse(JSON.stringify(bracket));
    nb.rounds[round][idx].games = updatedGames;
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function handleShuffleSingleGame(gameId) {
    if (!activePath || !bracket) return;
    const { round, idx } = activePath;
    const match = bracket.rounds[round][idx];
    if (!match.games) return;
    const teamA = teams.find((t) => t.id === match.teamAId);
    const teamB = teams.find((t) => t.id === match.teamBId);
    if (!teamA || !teamB) return;

    const gameToShuffle = match.games.find((g) => g.id === gameId);
    if (!gameToShuffle || gameToShuffle.inProgress || gameToShuffle.saved) return;

    const randomized = randomizePendingMatchups([gameToShuffle], teamA, teamB, 'mirror')[0];
    const updatedGames = match.games.map((g) => (g.id === gameId ? randomized : g));
    const nb = JSON.parse(JSON.stringify(bracket));
    nb.rounds[round][idx].games = updatedGames;
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function handleRandomizeUpcomingGames() {
    if (!activePath || !bracket) return;
    const { round, idx } = activePath;
    const match = bracket.rounds[round][idx];
    if (!match.games || match.status === 'complete') return;
    const teamA = teams.find((t) => t.id === match.teamAId);
    const teamB = teams.find((t) => t.id === match.teamBId);
    if (!teamA || !teamB) return;

    const updatedGames = randomizePendingMatchups(match.games, teamA, teamB, 'mirror');
    const nb = JSON.parse(JSON.stringify(bracket));
    nb.rounds[round][idx].games = updatedGames;
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function handleRevertSingleGame(gameId, gameIdx) {
    if (!activePath || !bracket) return;
    const { round, idx } = activePath;
    const match = bracket.rounds[round][idx];
    if (!match.games) return;
    const teamA = teams.find((t) => t.id === match.teamAId);
    const teamB = teams.find((t) => t.id === match.teamBId);
    if (!teamA || !teamB) return;

    const actualIdx = gameIdx !== undefined ? gameIdx : match.games.findIndex((g) => g.id === gameId);
    if (actualIdx === -1) return;
    const gameToRevert = match.games[actualIdx];
    if (!gameToRevert || gameToRevert.inProgress || gameToRevert.saved) return;

    const reverted = revertSingleMatchup(gameToRevert, actualIdx, teamA, teamB, goalScore, matchupConfig);
    const updatedGames = match.games.map((g) => (g.id === gameId ? reverted : g));
    const nb = JSON.parse(JSON.stringify(bracket));
    nb.rounds[round][idx].games = updatedGames;
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function handleRevertUpcomingGames() {
    if (!activePath || !bracket) return;
    const { round, idx } = activePath;
    const match = bracket.rounds[round][idx];
    if (!match.games || match.status === 'complete') return;
    const teamA = teams.find((t) => t.id === match.teamAId);
    const teamB = teams.find((t) => t.id === match.teamBId);
    if (!teamA || !teamB) return;

    const updatedGames = revertPendingMatchups(match.games, teamA, teamB, goalScore, matchupConfig);
    const nb = JSON.parse(JSON.stringify(bracket));
    nb.rounds[round][idx].games = updatedGames;
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function handleSubstitutePlayer(teamId, oldPlayerId, newPlayerName) {
    const result = substitutePlayerInTournament({
      bracket,
      teams,
      playersById,
      playerPool,
      teamId,
      oldPlayerId,
      newPlayerName,
    });
    if (!result) return;

    setBracket(result.bracket);
    setTeams(result.teams);
    setPlayersById(result.playersById);
    setPlayerPool(result.playerPool);

    const updatedKnown = Array.from(new Set([...savedPlayers, newPlayerName.trim()]));
    setSavedPlayers(updatedKnown);
    try {
      localStorage.setItem(getKnownPlayersStorageKey(roomId), JSON.stringify(updatedKnown));
    } catch (e) {}
    if (isCloudEnabled()) saveKnownPlayersToCloud(roomId, updatedKnown);

    syncTournamentStats(result.bracket, result.teams, result.playersById);
    broadcastTournamentChange({
      bracket: result.bracket,
      teams: result.teams,
      playersById: result.playersById,
      playerPool: result.playerPool,
    });
  }

  function handleRenamePlayer(playerId, newName) {
    const result = renamePlayerInTournament({
      playersById,
      playerPool,
      playerId,
      newName,
    });
    if (!result) return;

    setPlayersById(result.playersById);
    setPlayerPool(result.playerPool);

    const updatedKnown = Array.from(new Set([...savedPlayers, newName.trim()]));
    setSavedPlayers(updatedKnown);
    try {
      localStorage.setItem(getKnownPlayersStorageKey(roomId), JSON.stringify(updatedKnown));
    } catch (e) {}
    if (isCloudEnabled()) saveKnownPlayersToCloud(roomId, updatedKnown);

    syncTournamentStats(bracket, teams, result.playersById);
    broadcastTournamentChange({
      playersById: result.playersById,
      playerPool: result.playerPool,
    });
  }

  function handleReorderDraftPosition(teamId, fromIndex, toIndex) {
    const result = reorderTeamDraftPosition({
      bracket,
      teams,
      teamId,
      fromIndex,
      toIndex,
    });
    if (!result) return;

    setTeams(result.teams);
    if (result.bracket) {
      setBracket(result.bracket);
    }
    broadcastTournamentChange({
      teams: result.teams,
      bracket: result.bracket,
    });
  }

  function handleReRandomizeExtraGames() {
    if (!activePath || !bracket) return;
    const { round, idx } = activePath;
    const match = bracket.rounds[round][idx];
    if (!match.games || match.status === 'complete') return;
    const teamA = teams.find((t) => t.id === match.teamAId);
    const teamB = teams.find((t) => t.id === match.teamBId);
    const newGames = generateGames(teamA, teamB, goalScore, matchupConfig);
    const merged = newGames.map((g, i) => {
      const existing = match.games[i];
      if (existing && existing.saved) return existing;
      return g;
    });
    const nb = JSON.parse(JSON.stringify(bracket));
    nb.rounds[round][idx].games = merged;
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function handleUpdateDreambreakerScore(newScore) {
    if (!activePath || !bracket) return;
    const { round, idx } = activePath;
    const nb = JSON.parse(JSON.stringify(bracket));
    if (nb.rounds[round][idx].dreambreaker) {
      nb.rounds[round][idx].dreambreaker.goalScore = newScore;
      setBracket(nb);
      broadcastTournamentChange({ bracket: nb });
    }
    setDreambreakerScore(newScore);
  }

  function moveLineup(team, index, dir) {
    const { round, idx } = activePath;
    const nb = JSON.parse(JSON.stringify(bracket));
    const arr = nb.rounds[round][idx].dreambreaker[team === 'A' ? 'lineupA' : 'lineupB'];
    const to = index + dir;
    if (to < 0 || to >= arr.length) return;
    [arr[index], arr[to]] = [arr[to], arr[index]];
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function lockLineup(team) {
    const { round, idx } = activePath;
    const nb = JSON.parse(JSON.stringify(bracket));
    nb.rounds[round][idx].dreambreaker[team === 'A' ? 'lockedA' : 'lockedB'] = true;
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function startDreambreaker() {
    const { round, idx } = activePath;
    const nb = JSON.parse(JSON.stringify(bracket));
    nb.rounds[round][idx].dreambreaker.started = true;
    setBracket(nb);
    setView('dreambreakerPlay');
    broadcastTournamentChange({ bracket: nb, view: 'dreambreakerPlay' });
  }

  function triggerRotateBanner() {
    setShowRotateBanner(true);
    if (rotateTimeoutRef.current) clearTimeout(rotateTimeoutRef.current);
    rotateTimeoutRef.current = setTimeout(() => setShowRotateBanner(false), 2500);
  }

  function scoreDreambreakerPoint(scoringTeam) {
    const { round, idx } = activePath;
    const match = bracket.rounds[round][idx];
    const teamA = teams.find((t) => t.id === match.teamAId);
    const teamB = teams.find((t) => t.id === match.teamBId);
    const db = match.dreambreaker;
    const lenA = db.lineupA.length;
    const lenB = db.lineupB.length;
    const activeAId = db.lineupA[db.rotationIndex % lenA];
    const activeBId = db.lineupB[db.rotationIndex % lenB];
    const newScoreA = db.scoreA + (scoringTeam === 'A' ? 1 : 0);
    const newScoreB = db.scoreB + (scoringTeam === 'B' ? 1 : 0);
    const combined = newScoreA + newScoreB;
    const willRotate = combined > 0 && combined % 4 === 0 && combined !== db.lastRotationTrigger;
    const newRotationIndex = willRotate ? db.rotationIndex + 1 : db.rotationIndex;

    let nb = JSON.parse(JSON.stringify(bracket));
    const m = nb.rounds[round][idx];
    const ps = m.dreambreaker.playerStats;
    function bump(id, field) {
      const key = String(id);
      if (!ps[key]) ps[key] = { pointsWon: 0, pointsLost: 0 };
      ps[key][field] += 1;
    }
    if (scoringTeam === 'A') { bump(activeAId, 'pointsWon'); bump(activeBId, 'pointsLost'); }
    else { bump(activeBId, 'pointsWon'); bump(activeAId, 'pointsLost'); }

    m.dreambreaker.scoreA = newScoreA;
    m.dreambreaker.scoreB = newScoreB;
    m.dreambreaker.rotationIndex = newRotationIndex;
    if (willRotate) m.dreambreaker.lastRotationTrigger = combined;

    const targetScore = m.dreambreaker.goalScore || dreambreakerScore || 21;
    const isWin = (newScoreA >= targetScore || newScoreB >= targetScore) && Math.abs(newScoreA - newScoreB) >= 2;

    if (isWin) {
      const winnerId = newScoreA > newScoreB ? match.teamAId : match.teamBId;
      m.dreambreaker.completed = true;
      m.dreambreaker.winnerId = winnerId;
      nb = advanceWinner(nb, round, idx, winnerId);
    }

    setBracket(nb);
    syncTournamentStats(nb, teams, playersById);
    broadcastTournamentChange({ bracket: nb });
    if (willRotate && !isWin) triggerRotateBanner();
  }

  function handleUpdateNumTeams(val) {
    setNumTeams(val);
    broadcastTournamentChange({ numTeams: val });
  }
  function handleUpdateGoalScore(val) {
    setGoalScore(val);
    broadcastTournamentChange({ goalScore: val });
  }
  function handleUpdateDreambreakerScore(val) {
    setDreambreakerScore(val);
    broadcastTournamentChange({ dreambreakerScore: val });
  }
  function handleUpdateAllowUneven(val) {
    setAllowUneven(val);
    broadcastTournamentChange({ allowUneven: val });
  }
  function handleUpdateCaptainMode(val) {
    setCaptainMode(val);
    broadcastTournamentChange({ captainMode: val });
  }
  function handleUpdateSelectedCaptainIds(val) {
    setSelectedCaptainIds(val);
    broadcastTournamentChange({ selectedCaptainIds: val });
  }
  function handleUpdateMatchupConfig(val) {
    setMatchupConfig(val);
    broadcastTournamentChange({ matchupConfig: val });
  }

  function handleSwitchRoom(newRoomId, pin) {
    const cleanRoom = sanitizeRoomId(newRoomId);
    if (!cleanRoom) return;

    const url = new URL(window.location.href);
    url.searchParams.set('room', cleanRoom);
    if (pin) {
      url.searchParams.set('pin', pin);
    } else {
      url.searchParams.delete('pin');
    }
    window.history.replaceState({}, '', url.toString());

    setRoomId(cleanRoom);
    try {
      localStorage.setItem('neep_current_room', cleanRoom);
    } catch (e) {}

    const saved = loadSavedTournament(cleanRoom);
    if (saved) {
      setView(saved.view || 'setup');
      setPlayerPool(saved.playerPool || []);
      setNextPlayerId(saved.nextPlayerId || (saved.playerPool?.length ? Math.max(...saved.playerPool.map((p) => p.id)) + 1 : 1));
      setNumTeams(saved.numTeams || 4);
      setGoalScore(saved.goalScore || 11);
      setDreambreakerScore(saved.dreambreakerScore || 21);
      setAllowUneven(saved.allowUneven !== undefined ? saved.allowUneven : true);
      setCaptainMode(saved.captainMode || 'random');
      setSelectedCaptainIds(saved.selectedCaptainIds || []);
      setMatchupConfig(saved.matchupConfig || { preset: 'adjacent', customSlotPairs: [] });
      setTeams(saved.teams || []);
      setPlayersById(saved.playersById || {});
      setRemainingPool(saved.remainingPool || []);
      setPickSequence(saved.pickSequence || []);
      setPickPointer(saved.pickPointer || 0);
      setSittingOut(saved.sittingOut || []);
      setBracket(saved.bracket || null);
      setActivePath(saved.activePath || null);
      if (saved.adminPin) setAdminPin(saved.adminPin);
    } else {
      setView('setup');
      setPlayerPool([]);
      setNextPlayerId(1);
      setNumTeams(4);
      setGoalScore(11);
      setDreambreakerScore(21);
      setAllowUneven(true);
      setCaptainMode('random');
      setSelectedCaptainIds([]);
      setMatchupConfig({ preset: 'adjacent', customSlotPairs: [] });
      setTeams([]);
      setPlayersById({});
      setRemainingPool([]);
      setPickSequence([]);
      setPickPointer(0);
      setSittingOut([]);
      setBracket(null);
      setActivePath(null);
    }

    setSavedPlayers(loadKnownPlayers(cleanRoom, saved?.playerPool));

    const expectedAdminPin = saved?.adminPin || DEFAULT_ADMIN_PIN;
    const historyEntry = loadSavedRoomsHistory().find((r) => r.roomId === cleanRoom);
    const effectivePin = pin || (historyEntry?.isAdmin && historyEntry?.adminPin ? historyEntry.adminPin : '');

    if (effectivePin && effectivePin === expectedAdminPin) {
      setIsAdmin(true);
      setSavedRoomsHistory(upsertSavedRoomHistory(cleanRoom, effectivePin, true));
    } else {
      setIsAdmin(false);
      setSavedRoomsHistory(upsertSavedRoomHistory(cleanRoom, null, false));
    }
  }

  function handleCreatePrivateRoom(customNewRoomId, customNewPin) {
    const newRoomId = customNewRoomId || generateRoomId('NLP');
    const newPin = customNewPin || generatePin();
    const cleanRoom = sanitizeRoomId(newRoomId);
    setRoomId(cleanRoom);
    setAdminPin(newPin);
    setIsAdmin(true);
    try {
      localStorage.setItem('neep_current_room', cleanRoom);
      setSavedRoomsHistory(upsertSavedRoomHistory(cleanRoom, newPin, true));
    } catch (e) {}

    setView('setup');
    setPlayerPool([]);
    setNextPlayerId(1);
    setNumTeams(4);
    setGoalScore(11);
    setDreambreakerScore(21);
    setAllowUneven(true);
    setCaptainMode('random');
    setSelectedCaptainIds([]);
    setMatchupConfig({ preset: 'adjacent', customSlotPairs: [] });
    setTeams([]);
    setPlayersById({});
    setRemainingPool([]);
    setPickSequence([]);
    setPickPointer(0);
    setSittingOut([]);
    setBracket(null);
    setActivePath(null);
    setSavedPlayers(loadKnownPlayers(cleanRoom));

    const url = new URL(window.location.href);
    url.searchParams.set('room', cleanRoom);
    url.searchParams.set('mode', 'admin');
    url.searchParams.set('pin', newPin);
    window.history.replaceState({}, '', url.toString());

    if (isCloudEnabled()) {
      saveTournamentToCloud(cleanRoom, {
        roomId: cleanRoom,
        adminPin: newPin,
        view: 'setup',
        playerPool: [],
        nextPlayerId: 1,
        numTeams: 4,
        goalScore: 11,
        dreambreakerScore: 21,
        allowUneven: true,
        captainMode: 'random',
        selectedCaptainIds: [],
        matchupConfig: { preset: 'adjacent', customSlotPairs: [] },
        teams: [],
        playersById: {},
        remainingPool: [],
        pickSequence: [],
        pickPointer: 0,
        sittingOut: [],
        bracket: null,
        activePath: null,
      });
    }

    setNewlyCreatedRoomInfo({ roomId: cleanRoom, adminPin: newPin });
  }

  async function handleJoinExistingRoom(targetRoomId, pin) {
    const cleanRoom = sanitizeRoomId(targetRoomId);
    if (!cleanRoom) {
      return { error: 'Please enter a valid Room ID.' };
    }

    const existsLocally = checkLocalRoomExists(cleanRoom);
    let existsInCloud = false;

    if (isCloudEnabled()) {
      try {
        existsInCloud = await checkRoomExistsInCloud(cleanRoom);
      } catch (e) {
        console.warn('Error checking cloud room existence:', e);
      }
    }

    if (isCloudEnabled() && !existsLocally && !existsInCloud) {
      return { error: `Room "${cleanRoom}" was not found. Please verify the code or generate a new room.` };
    }

    if (!isCloudEnabled() && !existsLocally) {
      return { error: `Room "${cleanRoom}" was not found in local storage.` };
    }

    handleSwitchRoom(cleanRoom, pin);
    return { success: true };
  }

  function handleExitToLanding() {
    setView('landing');
    setRoomId(null);
    try {
      const url = new URL(window.location.href);
      url.searchParams.delete('room');
      url.searchParams.delete('pin');
      url.searchParams.delete('mode');
      window.history.replaceState({}, '', url.toString());
    } catch (e) {}
  }

  function handleResumeRecentRoom(recRoomId, savedPin) {
    const clean = sanitizeRoomId(recRoomId);
    if (clean) {
      const historyEntry = savedRoomsHistory.find((r) => r.roomId === clean);
      const pinToUse = savedPin || (historyEntry?.isAdmin ? historyEntry?.adminPin : '');
      handleSwitchRoom(clean, pinToUse);
    }
  }

  function handleRemoveSavedRoom(targetRoomId) {
    setSavedRoomsHistory(removeSavedRoomHistory(targetRoomId));
  }

  function handleUnlockAdmin(pin) {
    if (pin === adminPin) {
      setIsAdmin(true);
      setSavedRoomsHistory(upsertSavedRoomHistory(roomId, pin, true));
      return true;
    }
    return false;
  }

  function requestClearTournament() {
    setModal({
      title: 'New Tournament or Reset?',
      message: 'Choose whether to start a new tournament keeping your current player pool, or clear the active pool. All stats remain permanently saved in the leaderboard.',
      secondaryConfirm: {
        label: 'Start New (Keep Same Players)',
        onAction: () => {
          setPriorStats(globalStats);
          setPriorPartnershipStats(partnershipStats);
          setTeams([]);
          setPlayersById({});
          setRemainingPool([]);
          setPickSequence([]);
          setPickPointer(0);
          setSittingOut([]);
          setBracket(null);
          setActivePath(null);
          setView('setup');
          try {
            localStorage.removeItem(getTournStorageKey(roomId));
          } catch (e) {}
          broadcastTournamentChange({
            teams: [],
            playersById: {},
            remainingPool: [],
            pickSequence: [],
            pickPointer: 0,
            sittingOut: [],
            bracket: null,
            activePath: null,
            view: 'setup',
          });
          setModal(null);
        },
      },
      confirmLabel: 'Clear All',
      onConfirm: () => {
        setPriorStats(globalStats);
        setPriorPartnershipStats(partnershipStats);
        setPlayerPool([]);
        setNextPlayerId(1);
        setNumTeams(4);
        setGoalScore(11);
        setDreambreakerScore(21);
        setAllowUneven(true);
        setTeams([]);
        setPlayersById({});
        setRemainingPool([]);
        setPickSequence([]);
        setPickPointer(0);
        setSittingOut([]);
        setBracket(null);
        setActivePath(null);
        setView('setup');
        try {
          localStorage.removeItem(getTournStorageKey(roomId));
        } catch (e) {}
        broadcastTournamentChange({
          playerPool: [],
          nextPlayerId: 1,
          teams: [],
          playersById: {},
          remainingPool: [],
          pickSequence: [],
          pickPointer: 0,
          sittingOut: [],
          bracket: null,
          activePath: null,
          view: 'setup',
        });
        setModal(null);
      },
    });
  }

  function requestWipeStats() {
    setModal({
      title: 'Wipe All Stats?',
      message: 'This permanently deletes the all-time leaderboard and all partnership records. This cannot be undone.',
      confirmLabel: 'Wipe Stats',
      onConfirm: () => {
        try {
          localStorage.setItem(getStatsStorageKey(roomId), JSON.stringify({}));
          localStorage.setItem(getPairsStorageKey(roomId), JSON.stringify({}));
        } catch (e) {}
        setGlobalStats({});
        setPartnershipStats({});
        setPriorStats({});
        setPriorPartnershipStats({});
        if (isCloudEnabled()) {
          saveStatsToCloud(roomId, {}, {});
        }
        setModal(null);
      },
    });
  }

  const activeMatch = getActiveMatch();
  const activeTeamA = activeMatch ? teams.find((t) => t.id === activeMatch.teamAId) : null;
  const activeTeamB = activeMatch ? teams.find((t) => t.id === activeMatch.teamBId) : null;

  if (view === 'landing' || !roomId) {
    return (
      <>
        <LandingView
          onCreatePrivateRoom={() => handleCreatePrivateRoom()}
          onJoinRoom={handleJoinExistingRoom}
          recentRoomId={recentRoomId}
          savedRooms={savedRoomsHistory}
          onResumeRecentRoom={handleResumeRecentRoom}
          onRemoveSavedRoom={handleRemoveSavedRoom}
          onOpenCloudConfig={() => setIsCloudConfigOpen(true)}
          isCloudActive={isCloudEnabled()}
        />
        <CloudConfigModal
          isOpen={isCloudConfigOpen}
          onClose={() => setIsCloudConfigOpen(false)}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header
        hasTournament={teams.length > 0}
        view={view}
        setView={setView}
        onBracketTab={() => setView(bracket ? 'bracket' : 'draft')}
        onClear={requestClearTournament}
        onWipeStats={requestWipeStats}
        onOpenShare={() => setIsShareOpen(true)}
        onOpenCloudConfig={() => setIsCloudConfigOpen(true)}
        roomId={roomId}
        onOpenRoomModal={() => setIsRoomModalOpen(true)}
        isAdmin={isAdmin}
        onUnlockAdmin={handleUnlockAdmin}
        onOpenRosterModal={() => {
          setRosterModalTeamId(null);
          setIsRosterModalOpen(true);
        }}
        onExitToLanding={handleExitToLanding}
      />

      <main className="flex-1">
        {view === 'setup' && (
          <SetupView
            playerPool={playerPool}
            addPlayer={addPlayer}
            onAddMultiplePlayers={handleAddMultiplePlayers}
            removePlayer={removePlayer}
            savedPlayers={savedPlayers}
            onAddSavedPlayer={handleAddSavedPlayer}
            onAddAllSavedPlayers={handleAddAllSavedPlayers}
            onRemoveSavedPlayer={handleRemoveSavedPlayer}
            onAddDirectoryPlayer={handleAddPlayerToDirectory}
            onRenameDirectoryPlayer={handleRenameDirectoryPlayer}
            onImportFromMainDirectory={handleImportFromMainDirectory}
            numTeams={numTeams}
            setNumTeams={handleUpdateNumTeams}
            goalScore={goalScore}
            setGoalScore={handleUpdateGoalScore}
            dreambreakerScore={dreambreakerScore}
            setDreambreakerScore={handleUpdateDreambreakerScore}
            allowUneven={allowUneven}
            setAllowUneven={handleUpdateAllowUneven}
            captainMode={captainMode}
            setCaptainMode={handleUpdateCaptainMode}
            selectedCaptainIds={selectedCaptainIds}
            setSelectedCaptainIds={handleUpdateSelectedCaptainIds}
            matchupConfig={matchupConfig}
            setMatchupConfig={handleUpdateMatchupConfig}
            roomId={roomId}
            setRoomId={(newId) => handleSwitchRoom(newId, adminPin)}
            adminPin={adminPin}
            setAdminPin={setAdminPin}
            onInitializeDraft={handleInitializeDraft}
            isAdmin={isAdmin}
          />
        )}

        {view === 'draft' && (
          <DraftView
            teams={teams}
            remainingPool={remainingPool}
            pickSequence={pickSequence}
            pickPointer={pickPointer}
            playersById={playersById}
            sittingOut={sittingOut}
            onDraftPlayer={draftPlayer}
            onReorderDraftPosition={handleReorderDraftPosition}
            onGenerateBracket={handleGenerateBracket}
            isAdmin={isAdmin}
          />
        )}

        {view === 'bracket' && bracket && (
          <BracketView
            bracket={bracket}
            teams={teams}
            onOpenMatch={openMatch}
            onOpenRosterModal={() => {
              setRosterModalTeamId(null);
              setIsRosterModalOpen(true);
            }}
          />
        )}

        {view === 'match' && activeMatch && (
          <MatchDashboard
            key={activeMatch.id}
            match={activeMatch}
            teamA={activeTeamA}
            teamB={activeTeamB}
            playersById={playersById}
            onSaveGame={handleSaveGame}
            onToggleInProgress={handleToggleGameInProgress}
            onOpenEditMatchup={(game) => setEditingMatchupGame(game)}
            onShuffleGame={handleShuffleSingleGame}
            onRevertGame={handleRevertSingleGame}
            onRandomizeUpcoming={handleRandomizeUpcomingGames}
            onRevertUpcoming={handleRevertUpcomingGames}
            onOpenRoster={(teamId) => {
              setRosterModalTeamId(teamId);
              setIsRosterModalOpen(true);
            }}
            onBack={() => setView('bracket')}
            onGoToDreambreaker={() => setView('dreambreakerSetup')}
            onGoToBracket={() => setView('bracket')}
            isAdmin={isAdmin}
          />
        )}

        {view === 'dreambreakerSetup' && activeMatch && (
          <DreambreakerSetupView
            match={activeMatch}
            teamA={activeTeamA}
            teamB={activeTeamB}
            playersById={playersById}
            dreambreakerScore={dreambreakerScore}
            onUpdateScoreLimit={handleUpdateDreambreakerScore}
            onMove={moveLineup}
            onLock={lockLineup}
            onStart={startDreambreaker}
            onBack={() => setView('bracket')}
            isAdmin={isAdmin}
          />
        )}

        {view === 'dreambreakerPlay' && activeMatch && (
          <DreambreakerPlayView
            match={activeMatch}
            teamA={activeTeamA}
            teamB={activeTeamB}
            playersById={playersById}
            dreambreakerScore={dreambreakerScore}
            showRotateBanner={showRotateBanner}
            onScore={scoreDreambreakerPoint}
            onBack={() => setView('bracket')}
            isAdmin={isAdmin}
          />
        )}

        {view === 'leaderboard' && (
          <LeaderboardView
            globalStats={globalStats}
            partnershipStats={partnershipStats}
          />
        )}
      </main>

      <ConfirmModal modal={modal} onCancel={() => setModal(null)} />
      <ShareModal
        isOpen={isShareOpen}
        onClose={() => setIsShareOpen(false)}
        isAdmin={isAdmin}
        adminPin={adminPin}
        roomId={roomId}
      />
      <RoomModal
        isOpen={isRoomModalOpen}
        onClose={() => setIsRoomModalOpen(false)}
        currentRoomId={roomId}
        adminPin={adminPin}
        isAdmin={isAdmin}
        savedRooms={savedRoomsHistory}
        onRemoveSavedRoom={handleRemoveSavedRoom}
        onSwitchRoom={handleSwitchRoom}
        onCreatePrivateRoom={handleCreatePrivateRoom}
        onExitToLanding={handleExitToLanding}
      />
      <RoomCreatedModal
        isOpen={Boolean(newlyCreatedRoomInfo)}
        onClose={() => setNewlyCreatedRoomInfo(null)}
        roomId={newlyCreatedRoomInfo?.roomId || ''}
        adminPin={newlyCreatedRoomInfo?.adminPin || ''}
      />
      <CloudConfigModal
        isOpen={isCloudConfigOpen}
        onClose={() => setIsCloudConfigOpen(false)}
      />
      <EditMatchupModal
        isOpen={!!editingMatchupGame}
        onClose={() => setEditingMatchupGame(null)}
        game={editingMatchupGame}
        gameIndex={activeMatch?.games ? activeMatch.games.findIndex((g) => g.id === editingMatchupGame?.id) : 0}
        teamA={activeTeamA}
        teamB={activeTeamB}
        playersById={playersById}
        onSaveMatchup={handleUpdateGameMatchup}
        matchupConfig={matchupConfig}
        isAdmin={isAdmin}
      />
      <RosterModal
        isOpen={isRosterModalOpen}
        onClose={() => setIsRosterModalOpen(false)}
        teams={teams}
        playersById={playersById}
        savedPlayers={savedPlayers}
        onSubstitutePlayer={handleSubstitutePlayer}
        onRenamePlayer={handleRenamePlayer}
        onReorderDraftPosition={handleReorderDraftPosition}
        isAdmin={isAdmin}
        initialTeamId={rosterModalTeamId}
      />
    </div>
  );
}
