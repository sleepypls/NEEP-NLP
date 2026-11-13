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
import { AdminPortalView } from './components/AdminPortalView';
import { PoolSetupView } from './components/PoolSetupView';
import { PoolPlayView } from './components/PoolPlayView';
import { ScorekeeperDashboardView } from './components/ScorekeeperDashboardView';
import { PlayerLoginModal } from './components/PlayerLoginModal';
import { PlayerPortalBanner } from './components/PlayerPortalBanner';
import {
  generatePoolsAndSchedule,
  generateKnockoutBracket,
  advanceKnockoutWinner,
  getEffectiveMatchFormat,
  resizeGamesForBestOf,
  distributeCourtsToPools,
  getBusyPoolEntryIds,
  DEFAULT_TIEBREAKER_RULES,
} from './utils/poolTournament';

import {
  generateGames,
  initializeDraftState,
  generateBracket,
  advanceWinner,
  distributeCourtsToMatches,
  redistributeFreedCourtsToOngoingMatches,
  getBusyMlpPlayerIds,
  getMlpGamePlayerIds,
  hasMlpPlayerConflict,
  computeAllStats,
  randomizePendingMatchups,
  revertPendingMatchups,
  revertSingleMatchup,
  substitutePlayerInTournament,
  renamePlayerInTournament,
  reorderTeamDraftPosition,
  getActiveDreambreakerPlayers,
} from './utils/tournament';

import {
  isCloudEnabled,
  subscribeToActiveTournament,
  subscribeToStats,
  subscribeToKnownPlayers,
  subscribeToSavedConfigs,
  saveTournamentToCloud,
  saveStatsToCloud,
  saveKnownPlayersToCloud,
  saveConfigsToCloud,
  checkRoomExistsInCloud,
  wipeAllDatabaseData,
} from './services/firebase';
import { RoomModal } from './components/RoomModal';
import {
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
  return `neep_tourn_${rid}_v1`;
}
function getStatsStorageKey(rid) {
  return `neep_stats_${rid}_v1`;
}
function getPairsStorageKey(rid) {
  return `neep_pairs_${rid}_v1`;
}
function getKnownPlayersStorageKey(rid) {
  return `neep_players_${rid}_v1`;
}
function getConfigStorageKey(rid) {
  return `neep_config_${rid}_v1`;
}
const GLOBAL_DEFAULT_CONFIG_KEY = 'neep_default_config_v1';
const GLOBAL_PRESETS_KEY = 'neep_config_presets_v1';

const SYSTEM_DEFAULT_CONFIG = {
  numTeams: 4,
  numCourts: 2,
  goalScore: 11,
  dreambreakerScore: 21,
  dreambreakerFormat: 'singles',
  allowUneven: true,
  captainMode: 'random',
  matchupConfig: { preset: 'adjacent', customSlotPairs: [] },
};

function sanitizeConfigObject(cfg = {}) {
  return {
    numTeams: Number(cfg.numTeams) >= 2 && Number(cfg.numTeams) <= 8 ? Number(cfg.numTeams) : 4,
    numCourts: Number(cfg.numCourts) >= 1 && Number(cfg.numCourts) <= 50 ? Number(cfg.numCourts) : 2,
    goalScore: Number(cfg.goalScore) >= 1 ? Number(cfg.goalScore) : 11,
    dreambreakerScore: Number(cfg.dreambreakerScore) >= 1 ? Number(cfg.dreambreakerScore) : 21,
    dreambreakerFormat: cfg.dreambreakerFormat === 'doubles' ? 'doubles' : 'singles',
    allowUneven: cfg.allowUneven !== undefined ? Boolean(cfg.allowUneven) : true,
    captainMode: cfg.captainMode === 'manual' ? 'manual' : 'random',
    matchupConfig:
      cfg.matchupConfig && typeof cfg.matchupConfig === 'object'
        ? {
            preset: ['adjacent', 'balanced', 'custom'].includes(cfg.matchupConfig.preset)
              ? cfg.matchupConfig.preset
              : 'adjacent',
            customSlotPairs: Array.isArray(cfg.matchupConfig.customSlotPairs)
              ? cfg.matchupConfig.customSlotPairs
              : [],
          }
        : { preset: 'adjacent', customSlotPairs: [] },
  };
}

function loadSavedConfigs(rid) {
  let defaultConfig = null;
  let presets = [];
  try {
    const globalDefRaw = localStorage.getItem(GLOBAL_DEFAULT_CONFIG_KEY);
    if (globalDefRaw) defaultConfig = sanitizeConfigObject(JSON.parse(globalDefRaw));
  } catch (e) {}

  try {
    const globalPresetsRaw = localStorage.getItem(GLOBAL_PRESETS_KEY);
    if (globalPresetsRaw) {
      const parsed = JSON.parse(globalPresetsRaw);
      if (Array.isArray(parsed)) presets = parsed;
    }
  } catch (e) {}

  if (rid) {
    try {
      const roomRaw = localStorage.getItem(getConfigStorageKey(rid));
      if (roomRaw) {
        const parsedRoom = JSON.parse(roomRaw);
        if (parsedRoom?.defaultConfig) {
          defaultConfig = sanitizeConfigObject(parsedRoom.defaultConfig);
        }
        if (Array.isArray(parsedRoom?.presets) && parsedRoom.presets.length > 0) {
          const byId = new Map(presets.map((p) => [p.id || p.name, p]));
          parsedRoom.presets.forEach((p) => {
            if (p && p.name) byId.set(p.id || p.name, p);
          });
          presets = Array.from(byId.values());
        }
      }
    } catch (e) {}
  }

  return { defaultConfig, presets };
}

function getEffectiveDefaultConfig(rid) {
  const { defaultConfig } = loadSavedConfigs(rid);
  return defaultConfig || SYSTEM_DEFAULT_CONFIG;
}

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
  const initialConfigs = loadSavedConfigs(initialRoomId);
  const initialDefaultCfg = initialConfigs.defaultConfig || SYSTEM_DEFAULT_CONFIG;

  const [roomId, setRoomId] = useState(initialRoomId);
  const [savedDefaultConfig, setSavedDefaultConfig] = useState(() => initialConfigs.defaultConfig);
  const [configPresets, setConfigPresets] = useState(() => initialConfigs.presets || []);
  const [adminPin, setAdminPin] = useState(() => initialSaved?.adminPin || DEFAULT_ADMIN_PIN);
  const [isAdmin, setIsAdmin] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const mode = params.get('mode');
      const pin = params.get('pin');
      if (mode === 'spectator' || mode === 'player') return false;
      if (mode === 'admin') {
        const expectedPin = initialSaved?.adminPin || DEFAULT_ADMIN_PIN;
        return !pin || pin === expectedPin;
      }
    } catch (e) {}
    return true;
  });

  const [loggedInPlayerName, setLoggedInPlayerName] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      const urlPlayer = params.get('player');
      if (urlPlayer && urlPlayer.trim()) return urlPlayer.trim();
      return localStorage.getItem(`neep_player_login_${initialRoomId || 'default'}`) || '';
    } catch (e) {
      return '';
    }
  });
  const [isPlayerLoginOpen, setIsPlayerLoginOpen] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      return params.get('mode') === 'player' && !params.get('player');
    } catch (e) {
      return false;
    }
  });
  const [notifPermission, setNotifPermission] = useState(() =>
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  );

  const [view, setView] = useState(() => {
    try {
      const params = new URLSearchParams(window.location.search);
      if (params.get('view') === 'admin' || params.get('admin') === '1') {
        return 'adminPortal';
      }
      if (!initialRoomId) return 'landing';
      const mode = params.get('mode');
      if (mode === 'spectator' && initialSaved?.tournamentStyle === 'tournament' && initialSaved?.poolTournament) {
        return 'poolPlay';
      }
      if (mode === 'spectator' && initialSaved?.bracket) {
        return 'bracket';
      }
    } catch (e) {
      if (!initialRoomId) return 'landing';
    }
    return initialSaved?.view || (initialSaved?.tournamentStyle === 'tournament' ? 'poolSetup' : 'setup');
  });
  const [tournamentStyle, setTournamentStyle] = useState(() => initialSaved?.tournamentStyle || 'mlp');
  const [poolDiscipline, setPoolDiscipline] = useState(() => initialSaved?.poolDiscipline || 'doubles');
  const [poolStructure, setPoolStructure] = useState(() => initialSaved?.poolStructure || 'pools_knockout');
  const [poolEntries, setPoolEntries] = useState(() => initialSaved?.poolEntries || []);
  const [poolNumPools, setPoolNumPools] = useState(() => initialSaved?.poolNumPools || 2);
  const [poolAdvancePerPool, setPoolAdvancePerPool] = useState(() => initialSaved?.poolAdvancePerPool || 2);
  const [poolKnockoutFillMode, setPoolKnockoutFillMode] = useState(() => initialSaved?.poolKnockoutFillMode || 'byes');
  const [poolTargetBracketSize, setPoolTargetBracketSize] = useState(() => initialSaved?.poolTargetBracketSize || 'auto');
  const [poolSeedingMode, setPoolSeedingMode] = useState(() => initialSaved?.poolSeedingMode || 'snake');
  const [poolTiebreakerRules, setPoolTiebreakerRules] = useState(() => initialSaved?.poolTiebreakerRules || DEFAULT_TIEBREAKER_RULES);
  const [poolMatchFormat, setPoolMatchFormat] = useState(() => initialSaved?.poolMatchFormat || { bestOf: 1, pointsTo: 11 });
  const [knockoutMatchFormat, setKnockoutMatchFormat] = useState(() => initialSaved?.knockoutMatchFormat || { bestOf: 3, pointsTo: 11 });
  const [poolIncludeBronze, setPoolIncludeBronze] = useState(() => (initialSaved?.poolIncludeBronze !== undefined ? initialSaved.poolIncludeBronze : true));
  const [poolNumCourts, setPoolNumCourts] = useState(() => initialSaved?.poolNumCourts || 2);
  const [poolTournament, setPoolTournament] = useState(() => initialSaved?.poolTournament || null);
  const [playerPool, setPlayerPool] = useState(() => initialSaved?.playerPool || []);
  const [nextPlayerId, setNextPlayerId] = useState(() => initialSaved?.nextPlayerId || (initialSaved?.playerPool?.length ? Math.max(...initialSaved.playerPool.map((p) => p.id)) + 1 : 1));
  const [numTeams, setNumTeams] = useState(() => initialSaved?.numTeams || initialDefaultCfg.numTeams || 4);
  const [numCourts, setNumCourts] = useState(() => initialSaved?.numCourts || initialDefaultCfg.numCourts || 2);
  const [goalScore, setGoalScore] = useState(() => initialSaved?.goalScore || initialDefaultCfg.goalScore || 11);
  const [dreambreakerScore, setDreambreakerScore] = useState(() => initialSaved?.dreambreakerScore || initialDefaultCfg.dreambreakerScore || 21);
  const [dreambreakerFormat, setDreambreakerFormat] = useState(() => initialSaved?.dreambreakerFormat || initialDefaultCfg.dreambreakerFormat || 'singles');
  const [allowUneven, setAllowUneven] = useState(() => (initialSaved?.allowUneven !== undefined ? initialSaved.allowUneven : initialDefaultCfg.allowUneven));
  const [captainMode, setCaptainMode] = useState(() => initialSaved?.captainMode || initialDefaultCfg.captainMode || 'random');
  const [selectedCaptainIds, setSelectedCaptainIds] = useState(() => initialSaved?.selectedCaptainIds || []);
  const [customTeamNames, setCustomTeamNames] = useState(() => initialSaved?.customTeamNames || []);
  const [matchupCourtsConfig, setMatchupCourtsConfig] = useState(() => initialSaved?.matchupCourtsConfig || {});
  const [matchupConfig, setMatchupConfig] = useState(() => initialSaved?.matchupConfig || initialDefaultCfg.matchupConfig || { preset: 'adjacent', customSlotPairs: [] });

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

  // One-time database reset migration for v0.27 Beta to clear legacy tournaments & names
  useEffect(() => {
    const RESET_FLAG_KEY = 'neep_db_reset_v027_done';
    try {
      if (!localStorage.getItem(RESET_FLAG_KEY)) {
        localStorage.setItem(RESET_FLAG_KEY, 'true');
        wipeAllDatabaseData(roomId ? [roomId] : []).then(() => {
          localStorage.setItem(RESET_FLAG_KEY, 'true');
          setSavedPlayers([]);
          setPlayerPool([]);
          setTeams([]);
          setPlayersById({});
          setRemainingPool([]);
          setPickSequence([]);
          setPickPointer(0);
          setSittingOut([]);
          setBracket(null);
          setActivePath(null);
          setGlobalStats({});
          setPartnershipStats({});
          setPriorStats({});
          setPriorPartnershipStats({});
          setSavedRoomsHistory([]);
          setRoomId(null);
          setView('landing');
        });
      }
    } catch (e) {}
  }, []);
  useEffect(() => {
    try {
      if (view === 'adminPortal') {
        const url = new URL(window.location.href);
        url.searchParams.delete('room');
        url.searchParams.delete('pin');
        url.searchParams.delete('mode');
        url.searchParams.set('view', 'admin');
        window.history.replaceState({}, '', url.toString());
        return;
      }
      if (view === 'landing' || !roomId) {
        const url = new URL(window.location.href);
        let changed = false;
        if (url.searchParams.has('room') || url.searchParams.has('view') || url.searchParams.has('admin')) {
          url.searchParams.delete('room');
          url.searchParams.delete('pin');
          url.searchParams.delete('mode');
          url.searchParams.delete('view');
          url.searchParams.delete('admin');
          changed = true;
        }
        if (changed) {
          window.history.replaceState({}, '', url.toString());
        }
        return;
      }
      const url = new URL(window.location.href);
      let changed = false;
      if (url.searchParams.has('view') || url.searchParams.has('admin')) {
        url.searchParams.delete('view');
        url.searchParams.delete('admin');
        changed = true;
      }
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
    if (!roomId || view === 'landing' || view === 'adminPortal') return;

    try {
      localStorage.setItem('neep_current_room', roomId);
      setSavedRoomsHistory(upsertSavedRoomHistory(roomId, isAdmin ? adminPin : null, isAdmin, tournamentStyle));
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

      const loadedCfgs = loadSavedConfigs(roomId);
      setSavedDefaultConfig(loadedCfgs.defaultConfig);
      setConfigPresets(loadedCfgs.presets || []);
    } catch (e) {
      console.warn('Error loading room stats & players:', e);
    }

    // Connect Firebase Realtime listeners for this roomId
    let unsubTourn = () => {};
    let unsubStats = () => {};
    let unsubPlayers = () => {};
    let unsubConfigs = () => {};

    if (isCloudEnabled()) {
      unsubTourn = subscribeToActiveTournament(roomId, (cloudTourn) => {
        if (cloudTourn) {
          if (cloudTourn.tournamentStyle) setTournamentStyle(cloudTourn.tournamentStyle);
          if (cloudTourn.poolDiscipline) setPoolDiscipline(cloudTourn.poolDiscipline);
          if (cloudTourn.poolStructure) setPoolStructure(cloudTourn.poolStructure);
          if (cloudTourn.poolEntries !== undefined) setPoolEntries(cloudTourn.poolEntries);
          if (cloudTourn.poolNumPools) setPoolNumPools(cloudTourn.poolNumPools);
          if (cloudTourn.poolAdvancePerPool) setPoolAdvancePerPool(cloudTourn.poolAdvancePerPool);
          if (cloudTourn.poolKnockoutFillMode) setPoolKnockoutFillMode(cloudTourn.poolKnockoutFillMode);
          if (cloudTourn.poolTargetBracketSize !== undefined) setPoolTargetBracketSize(cloudTourn.poolTargetBracketSize);
          if (cloudTourn.poolSeedingMode) setPoolSeedingMode(cloudTourn.poolSeedingMode);
          if (cloudTourn.poolTiebreakerRules) setPoolTiebreakerRules(cloudTourn.poolTiebreakerRules);
          if (cloudTourn.poolMatchFormat) setPoolMatchFormat(cloudTourn.poolMatchFormat);
          if (cloudTourn.knockoutMatchFormat) setKnockoutMatchFormat(cloudTourn.knockoutMatchFormat);
          if (cloudTourn.poolIncludeBronze !== undefined) setPoolIncludeBronze(cloudTourn.poolIncludeBronze);
          if (cloudTourn.poolNumCourts) setPoolNumCourts(cloudTourn.poolNumCourts);
          if (cloudTourn.poolTournament !== undefined) {
            setPoolTournament(cloudTourn.poolTournament);
            if (cloudTourn.poolTournament) {
              setView((curr) => (curr === 'poolSetup' || curr === 'setup' ? 'poolPlay' : curr));
            }
          }
          if (cloudTourn.tournamentStyle === 'tournament' && !cloudTourn.poolTournament) {
            setView((curr) => (curr === 'setup' ? 'poolSetup' : curr));
          }
          if (cloudTourn.playerPool) setPlayerPool(cloudTourn.playerPool);
          if (cloudTourn.nextPlayerId) setNextPlayerId(cloudTourn.nextPlayerId);
          if (cloudTourn.numTeams) setNumTeams(cloudTourn.numTeams);
          if (cloudTourn.numCourts) setNumCourts(cloudTourn.numCourts);
          if (cloudTourn.goalScore) setGoalScore(cloudTourn.goalScore);
          if (cloudTourn.dreambreakerScore) setDreambreakerScore(cloudTourn.dreambreakerScore);
          if (cloudTourn.dreambreakerFormat) setDreambreakerFormat(cloudTourn.dreambreakerFormat);
          if (cloudTourn.allowUneven !== undefined) setAllowUneven(cloudTourn.allowUneven);
          if (cloudTourn.captainMode !== undefined) setCaptainMode(cloudTourn.captainMode);
          if (cloudTourn.selectedCaptainIds !== undefined) setSelectedCaptainIds(cloudTourn.selectedCaptainIds);
          if (cloudTourn.customTeamNames !== undefined) setCustomTeamNames(cloudTourn.customTeamNames);
          if (cloudTourn.matchupCourtsConfig !== undefined) setMatchupCourtsConfig(cloudTourn.matchupCourtsConfig);
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

      unsubConfigs = subscribeToSavedConfigs(roomId, ({ defaultConfig: cloudDef, presets: cloudPresets }) => {
        if (cloudDef) {
          const cleanDef = sanitizeConfigObject(cloudDef);
          setSavedDefaultConfig(cleanDef);
          try {
            localStorage.setItem(GLOBAL_DEFAULT_CONFIG_KEY, JSON.stringify(cleanDef));
          } catch (e) {}
        }
        if (Array.isArray(cloudPresets)) {
          setConfigPresets((prev) => {
            const byId = new Map(prev.map((p) => [p.id || p.name, p]));
            cloudPresets.forEach((p) => {
              if (p && p.name) {
                byId.set(p.id || p.name, { ...sanitizeConfigObject(p), id: p.id || p.name, name: p.name, updatedAt: p.updatedAt });
              }
            });
            const merged = Array.from(byId.values());
            try {
              localStorage.setItem(GLOBAL_PRESETS_KEY, JSON.stringify(merged));
              localStorage.setItem(
                getConfigStorageKey(roomId),
                JSON.stringify({ defaultConfig: cloudDef ? sanitizeConfigObject(cloudDef) : savedDefaultConfig, presets: merged })
              );
            } catch (e) {}
            return merged;
          });
        }
      });
    }

    return () => {
      unsubTourn();
      unsubStats();
      unsubPlayers();
      unsubConfigs();
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
          tournamentStyle,
          poolDiscipline,
          poolStructure,
          poolEntries,
          poolNumPools,
          poolAdvancePerPool,
          poolKnockoutFillMode,
          poolTargetBracketSize,
          poolSeedingMode,
          poolTiebreakerRules,
          poolMatchFormat,
          knockoutMatchFormat,
          poolIncludeBronze,
          poolNumCourts,
          poolTournament,
          view, playerPool, nextPlayerId, numTeams, numCourts, goalScore, dreambreakerScore, dreambreakerFormat, allowUneven,
          captainMode, selectedCaptainIds, customTeamNames, matchupCourtsConfig, matchupConfig,
          teams, playersById, remainingPool, pickSequence, pickPointer, sittingOut, bracket, activePath,
        })
      );
    } catch (e) {
      // ignore
    }
  }, [roomId, adminPin, tournamentStyle, poolDiscipline, poolStructure, poolEntries, poolNumPools, poolAdvancePerPool, poolKnockoutFillMode, poolTargetBracketSize, poolSeedingMode, poolTiebreakerRules, poolMatchFormat, knockoutMatchFormat, poolIncludeBronze, poolNumCourts, poolTournament, view, playerPool, nextPlayerId, numTeams, numCourts, goalScore, dreambreakerScore, dreambreakerFormat, allowUneven, captainMode, selectedCaptainIds, customTeamNames, matchupCourtsConfig, matchupConfig, teams, playersById, remainingPool, pickSequence, pickPointer, sittingOut, bracket, activePath]);


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
        tournamentStyle,
        poolDiscipline,
        poolStructure,
        poolEntries,
        poolNumPools,
        poolAdvancePerPool,
        poolKnockoutFillMode,
        poolTargetBracketSize,
        poolSeedingMode,
        poolTiebreakerRules,
        poolMatchFormat,
        knockoutMatchFormat,
        poolIncludeBronze,
        poolNumCourts,
        poolTournament,
        view, playerPool, nextPlayerId, numTeams, numCourts, goalScore, dreambreakerScore, dreambreakerFormat, allowUneven,
        captainMode, selectedCaptainIds, customTeamNames, matchupCourtsConfig, matchupConfig,
        teams, playersById, remainingPool, pickSequence, pickPointer, sittingOut, bracket, activePath,
        ...updates,
      });
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

    // 3. Also update Tournament Style poolEntries if present
    const hasInPoolEntries = poolEntries.some((entry) =>
      (entry.players || []).some((p) => p.trim().toLowerCase() === cleanOld.toLowerCase())
    );
    if (hasInPoolEntries) {
      const updatedEntries = poolEntries.map((entry) => {
        const players = (entry.players || []).map((p) =>
          p.trim().toLowerCase() === cleanOld.toLowerCase() ? cleanNew : p
        );
        return {
          ...entry,
          players,
          name: players.length > 1 ? players.join(' / ') : players[0] || entry.name,
        };
      });
      setPoolEntries(updatedEntries);
      broadcastTournamentChange({ poolEntries: updatedEntries });
    }
  }

  function handleInitializeDraft() {
    const captainsToUse = captainMode === 'manual' ? selectedCaptainIds : [];
    const result = initializeDraftState(
      playerPool,
      numTeams,
      allowUneven,
      captainsToUse,
      customTeamNames
    );
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

  function handleRenameTeam(teamId, newName) {
    const clean = String(newName || '').trim();
    if (!clean) return;
    const updatedTeams = teams.map((t) => (t.id === teamId ? { ...t, name: clean } : t));
    setTeams(updatedTeams);
    broadcastTournamentChange({ teams: updatedTeams });
  }

  function handleGenerateBracket() {
    const rawBracket = generateBracket(teams);
    const newBracket = distributeCourtsToMatches(
      rawBracket,
      teams,
      numCourts,
      goalScore,
      matchupConfig,
      matchupCourtsConfig
    );
    setBracket(newBracket);
    setView('bracket');
    broadcastTournamentChange({ bracket: newBracket, view: 'bracket' });
  }

  function handleSetMlpMatchAssignedCourts(roundIdx, matchIdx, courts) {
    if (!bracket || !bracket.rounds[roundIdx]?.[matchIdx]) return;
    const nb = JSON.parse(JSON.stringify(bracket));
    const m = nb.rounds[roundIdx][matchIdx];
    const cleanCourts = (courts || []).map((c) => Number(c)).filter(Boolean);
    m.assignedCourts = cleanCourts;

    // Ensure games exist for this matchup if it has both teams
    if (!m.games && m.teamAId !== null && m.teamBId !== null) {
      const teamA = teams.find((t) => t.id === m.teamAId);
      const teamB = teams.find((t) => t.id === m.teamBId);
      if (teamA && teamB) {
        m.games = generateGames(teamA, teamB, goalScore, matchupConfig);
      }
    }

    // Re-align upcoming unsaved/non-live games' default courts to match assignedCourts
    if (Array.isArray(m.games)) {
      let cIdx = 0;
      m.games = m.games.map((g) => {
        if (g.saved || g.inProgress) return g;
        if (cleanCourts.length === 0) return { ...g, court: null };
        if (cIdx < cleanCourts.length) {
          return { ...g, court: cleanCourts[cIdx++] };
        }
        return g;
      });
    }

    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
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
    if (!activePath) return;
    handleSaveGameAt(activePath.round, activePath.idx, gameId, scoreA, scoreB);
  }

  function handleSaveGameAt(round, idx, gameId, scoreA, scoreB) {
    const match = bracket.rounds[round][idx];
    const teamA = teams.find((t) => t.id === match.teamAId);
    const teamB = teams.find((t) => t.id === match.teamBId);
    const now = Date.now();
    const updatedGames = match.games.map((g) =>
      g.id === gameId
        ? {
            ...g,
            scoreA: Number(scoreA),
            scoreB: Number(scoreB),
            saved: true,
            inProgress: false,
            durationMs: g.liveStartedAt ? Math.max(0, now - Number(g.liveStartedAt)) : g.durationMs || null,
            completedAt: now,
            liveStartedAt: null,
            pendingScore: null,
          }
        : g
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
            format: dreambreakerFormat || 'singles',
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
        nb = redistributeFreedCourtsToOngoingMatches(
          distributeCourtsToMatches(
            advanceWinner(nb, round, idx, winnerId),
            teams,
            numCourts,
            goalScore,
            matchupConfig,
            matchupCourtsConfig
          ),
          numCourts
        );
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
    if (!activePath) return;
    handleToggleGameInProgressAt(activePath.round, activePath.idx, gameId);
  }

  function handleToggleGameInProgressAt(round, idx, gameId) {
    if (!bracket) return;
    const match = bracket.rounds[round]?.[idx];
    if (!match?.games) return;
    const targetGame = match.games.find((g) => g.id === gameId);
    if (!targetGame || targetGame.saved) return;
    if (!targetGame.inProgress) {
      const busyPlayers = getBusyMlpPlayerIds(bracket, gameId);
      if (hasMlpPlayerConflict(targetGame, busyPlayers)) {
        alert('Cannot mark live: one or more players in this game are already playing in another live game.');
        return;
      }
    }
    const updatedGames = match.games.map((g) => {
      if (g.id !== gameId || g.saved) return g;
      const nextLive = !g.inProgress;
      return {
        ...g,
        inProgress: nextLive,
        liveStartedAt: nextLive ? (g.liveStartedAt || Date.now()) : null,
      };
    });
    const nb = JSON.parse(JSON.stringify(bracket));
    nb.rounds[round][idx].games = updatedGames;
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function handleSetGameCourt(gameId, court) {
    if (!activePath || !bracket) return;
    const { round, idx } = activePath;
    const match = bracket.rounds[round][idx];
    if (!match.games) return;
    const cleanCourt = court ? Number(court) : null;
    const updatedGames = match.games.map((g) =>
      g.id === gameId ? { ...g, court: cleanCourt } : g
    );
    const nb = JSON.parse(JSON.stringify(bracket));
    nb.rounds[round][idx].games = updatedGames;
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function handleBatchAssignMlpCourtsAndLive(assignments) {
    if (!bracket || !Array.isArray(assignments) || assignments.length === 0) return;
    const nb = JSON.parse(JSON.stringify(bracket));
    const now = Date.now();
    const busyPlayers = getBusyMlpPlayerIds(nb);
    let anyApplied = false;
    assignments.forEach((a) => {
      const r = a.round !== undefined ? a.round : activePath?.round;
      const i = a.idx !== undefined ? a.idx : activePath?.idx;
      if (r === undefined || i === undefined) return;
      const match = nb.rounds[r]?.[i];
      if (!match?.games) return;
      const targetGame = match.games.find((g) => g.id === a.gameId);
      if (!targetGame || targetGame.saved || targetGame.inProgress) return;
      if (hasMlpPlayerConflict(targetGame, busyPlayers)) return;
      getMlpGamePlayerIds(targetGame).forEach((pid) => busyPlayers.add(pid));
      anyApplied = true;
      match.games = match.games.map((g) =>
        g.id === a.gameId
          ? {
              ...g,
              court: Number(a.court),
              inProgress: true,
              liveStartedAt: g.liveStartedAt || now,
            }
          : g
      );
    });
    if (!anyApplied) return;
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
    if (activePath && bracket) {
      const { round, idx } = activePath;
      const nb = JSON.parse(JSON.stringify(bracket));
      if (nb.rounds[round][idx].dreambreaker) {
        nb.rounds[round][idx].dreambreaker.goalScore = newScore;
        setBracket(nb);
        setDreambreakerScore(newScore);
        broadcastTournamentChange({ bracket: nb, dreambreakerScore: newScore });
        return;
      }
    }
    setDreambreakerScore(newScore);
    broadcastTournamentChange({ dreambreakerScore: newScore });
  }

  function handleUpdateDreambreakerFormat(newFormat) {
    const cleanFormat = newFormat === 'doubles' ? 'doubles' : 'singles';
    setDreambreakerFormat(cleanFormat);
    if (activePath && bracket) {
      const { round, idx } = activePath;
      const nb = JSON.parse(JSON.stringify(bracket));
      if (nb.rounds[round][idx].dreambreaker) {
        nb.rounds[round][idx].dreambreaker.format = cleanFormat;
        setBracket(nb);
        broadcastTournamentChange({ bracket: nb, dreambreakerFormat: cleanFormat });
        return;
      }
    }
    broadcastTournamentChange({ dreambreakerFormat: cleanFormat });
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
    const db = match.dreambreaker;
    const activeFormat = db.format || dreambreakerFormat || 'singles';
    const activeAIds = getActiveDreambreakerPlayers(db.lineupA, db.rotationIndex, activeFormat);
    const activeBIds = getActiveDreambreakerPlayers(db.lineupB, db.rotationIndex, activeFormat);
    const newScoreA = db.scoreA + (scoringTeam === 'A' ? 1 : 0);
    const newScoreB = db.scoreB + (scoringTeam === 'B' ? 1 : 0);
    const combined = newScoreA + newScoreB;
    const willRotate = combined > 0 && combined % 4 === 0 && combined !== db.lastRotationTrigger;
    const newRotationIndex = willRotate ? db.rotationIndex + 1 : db.rotationIndex;

    let nb = JSON.parse(JSON.stringify(bracket));
    const m = nb.rounds[round][idx];
    const ps = m.dreambreaker.playerStats;
    function bump(id, field) {
      if (id === undefined || id === null) return;
      const key = String(id);
      if (!ps[key]) ps[key] = { pointsWon: 0, pointsLost: 0 };
      ps[key][field] += 1;
    }
    if (scoringTeam === 'A') {
      activeAIds.forEach((id) => bump(id, 'pointsWon'));
      activeBIds.forEach((id) => bump(id, 'pointsLost'));
    } else {
      activeBIds.forEach((id) => bump(id, 'pointsWon'));
      activeAIds.forEach((id) => bump(id, 'pointsLost'));
    }

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
      nb = redistributeFreedCourtsToOngoingMatches(
        distributeCourtsToMatches(
          advanceWinner(nb, round, idx, winnerId),
          teams,
          numCourts,
          goalScore,
          matchupConfig,
          matchupCourtsConfig
        ),
        numCourts
      );
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
  function handleUpdateNumCourts(val) {
    setNumCourts(val);
    broadcastTournamentChange({ numCourts: val });
  }
  function handleUpdateGoalScore(val) {
    setGoalScore(val);
    broadcastTournamentChange({ goalScore: val });
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

  function persistSavedConfigs(nextDefault, nextPresets) {
    try {
      if (nextDefault) {
        localStorage.setItem(GLOBAL_DEFAULT_CONFIG_KEY, JSON.stringify(nextDefault));
      } else {
        localStorage.removeItem(GLOBAL_DEFAULT_CONFIG_KEY);
      }
      localStorage.setItem(GLOBAL_PRESETS_KEY, JSON.stringify(nextPresets));
      if (roomId) {
        localStorage.setItem(
          getConfigStorageKey(roomId),
          JSON.stringify({ defaultConfig: nextDefault, presets: nextPresets })
        );
      }
    } catch (e) {}
    if (roomId && isCloudEnabled()) {
      saveConfigsToCloud(roomId, { defaultConfig: nextDefault, presets: nextPresets });
    }
  }

  function getCurrentConfigSnapshot() {
    return sanitizeConfigObject({
      numTeams,
      numCourts,
      goalScore,
      dreambreakerScore,
      dreambreakerFormat,
      allowUneven,
      captainMode,
      matchupConfig,
    });
  }

  function handleSaveDefaultConfig() {
    const snap = getCurrentConfigSnapshot();
    setSavedDefaultConfig(snap);
    persistSavedConfigs(snap, configPresets);
  }

  function handleSaveConfigPreset(name) {
    const cleanName = String(name || '').trim();
    if (!cleanName) return false;
    const snap = getCurrentConfigSnapshot();
    const id = cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-');
    const newPreset = {
      id,
      name: cleanName,
      updatedAt: new Date().toISOString(),
      ...snap,
    };
    const existingIdx = configPresets.findIndex(
      (p) => (p.id && p.id === id) || p.name.trim().toLowerCase() === cleanName.toLowerCase()
    );
    let nextPresets;
    if (existingIdx >= 0) {
      nextPresets = [...configPresets];
      nextPresets[existingIdx] = newPreset;
    } else {
      nextPresets = [newPreset, ...configPresets];
    }
    setConfigPresets(nextPresets);
    persistSavedConfigs(savedDefaultConfig, nextPresets);
    return true;
  }

  function handleDeleteConfigPreset(presetIdOrName) {
    const nextPresets = configPresets.filter(
      (p) => p.id !== presetIdOrName && p.name !== presetIdOrName
    );
    setConfigPresets(nextPresets);
    persistSavedConfigs(savedDefaultConfig, nextPresets);
  }

  function handleApplyConfig(cfg) {
    if (!cfg) return;
    const clean = sanitizeConfigObject(cfg);
    setNumTeams(clean.numTeams);
    setNumCourts(clean.numCourts);
    setGoalScore(clean.goalScore);
    setDreambreakerScore(clean.dreambreakerScore);
    setDreambreakerFormat(clean.dreambreakerFormat);
    setAllowUneven(clean.allowUneven);
    setCaptainMode(clean.captainMode);
    setMatchupConfig(clean.matchupConfig);
    broadcastTournamentChange({
      numTeams: clean.numTeams,
      numCourts: clean.numCourts,
      goalScore: clean.goalScore,
      dreambreakerScore: clean.dreambreakerScore,
      dreambreakerFormat: clean.dreambreakerFormat,
      allowUneven: clean.allowUneven,
      captainMode: clean.captainMode,
      matchupConfig: clean.matchupConfig,
    });
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
      const style = saved.tournamentStyle || 'mlp';
      setTournamentStyle(style);
      setPoolDiscipline(saved.poolDiscipline || 'doubles');
      setPoolStructure(saved.poolStructure || 'pools_knockout');
      setPoolEntries(saved.poolEntries || []);
      setPoolNumPools(saved.poolNumPools || 2);
      setPoolAdvancePerPool(saved.poolAdvancePerPool || 2);
      setPoolKnockoutFillMode(saved.poolKnockoutFillMode || 'byes');
      setPoolTargetBracketSize(saved.poolTargetBracketSize || 'auto');
      setPoolSeedingMode(saved.poolSeedingMode || 'snake');
      setPoolMatchFormat(saved.poolMatchFormat || { bestOf: 1, pointsTo: 11 });
      setKnockoutMatchFormat(saved.knockoutMatchFormat || { bestOf: 3, pointsTo: 11 });
      setPoolIncludeBronze(saved.poolIncludeBronze !== undefined ? saved.poolIncludeBronze : true);
      setPoolTournament(saved.poolTournament || null);
      setView(saved.view || (style === 'tournament' ? 'poolSetup' : 'setup'));
      setPlayerPool(saved.playerPool || []);
      setNextPlayerId(saved.nextPlayerId || (saved.playerPool?.length ? Math.max(...saved.playerPool.map((p) => p.id)) + 1 : 1));
      setNumTeams(saved.numTeams || 4);
      setGoalScore(saved.goalScore || 11);
      setDreambreakerScore(saved.dreambreakerScore || 21);
      setDreambreakerFormat(saved.dreambreakerFormat || 'singles');
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
      const defCfg = getEffectiveDefaultConfig(cleanRoom);
      setTournamentStyle('mlp');
      setPoolDiscipline('doubles');
      setPoolStructure('pools_knockout');
      setPoolEntries([]);
      setPoolNumPools(2);
      setPoolAdvancePerPool(2);
      setPoolKnockoutFillMode('byes');
      setPoolTargetBracketSize('auto');
      setPoolSeedingMode('snake');
      setPoolMatchFormat({ bestOf: 1, pointsTo: 11 });
      setKnockoutMatchFormat({ bestOf: 3, pointsTo: 11 });
      setPoolIncludeBronze(true);
      setPoolTournament(null);
      setView('setup');
      setPlayerPool([]);
      setNextPlayerId(1);
      setNumTeams(defCfg.numTeams);
      setGoalScore(defCfg.goalScore);
      setDreambreakerScore(defCfg.dreambreakerScore);
      setDreambreakerFormat(defCfg.dreambreakerFormat);
      setAllowUneven(defCfg.allowUneven);
      setCaptainMode(defCfg.captainMode);
      setSelectedCaptainIds([]);
      setMatchupConfig(defCfg.matchupConfig);
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
    const roomStyle = saved?.tournamentStyle || historyEntry?.tournamentStyle || 'mlp';

    if (effectivePin && effectivePin === expectedAdminPin) {
      setIsAdmin(true);
      setSavedRoomsHistory(upsertSavedRoomHistory(cleanRoom, effectivePin, true, roomStyle));
    } else {
      setIsAdmin(false);
      setSavedRoomsHistory(upsertSavedRoomHistory(cleanRoom, null, false, roomStyle));
    }
  }

  function handleCreatePrivateRoom(customNewRoomId, customNewPin, chosenStyle = 'mlp') {
    const newRoomId = customNewRoomId || generateRoomId(chosenStyle === 'tournament' ? 'TRN' : 'NLP');
    const newPin = customNewPin || generatePin();
    const cleanRoom = sanitizeRoomId(newRoomId);
    const style = chosenStyle === 'tournament' ? 'tournament' : 'mlp';
    const initialView = style === 'tournament' ? 'poolSetup' : 'setup';
    setRoomId(cleanRoom);
    setAdminPin(newPin);
    setIsAdmin(true);
    setTournamentStyle(style);
    try {
      localStorage.setItem('neep_current_room', cleanRoom);
      setSavedRoomsHistory(upsertSavedRoomHistory(cleanRoom, newPin, true, style));
    } catch (e) {}

    const defCfg = getEffectiveDefaultConfig(cleanRoom);
    setView(initialView);
    setPoolDiscipline('doubles');
    setPoolStructure('pools_knockout');
    setPoolEntries([]);
    setPoolNumPools(2);
    setPoolAdvancePerPool(2);
    setPoolKnockoutFillMode('byes');
    setPoolTargetBracketSize('auto');
    setPoolSeedingMode('snake');
    setPoolMatchFormat({ bestOf: 1, pointsTo: 11 });
    setKnockoutMatchFormat({ bestOf: 3, pointsTo: 11 });
    setPoolIncludeBronze(true);
    setPoolTournament(null);
    setPlayerPool([]);
    setNextPlayerId(1);
    setNumTeams(defCfg.numTeams);
    setGoalScore(defCfg.goalScore);
    setDreambreakerScore(defCfg.dreambreakerScore);
    setDreambreakerFormat(defCfg.dreambreakerFormat);
    setAllowUneven(defCfg.allowUneven);
    setCaptainMode(defCfg.captainMode);
    setSelectedCaptainIds([]);
    setMatchupConfig(defCfg.matchupConfig);
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
        tournamentStyle: style,
        poolDiscipline: 'doubles',
        poolStructure: 'pools_knockout',
        poolEntries: [],
        poolNumPools: 2,
        poolAdvancePerPool: 2,
        poolKnockoutFillMode: 'byes',
        poolTargetBracketSize: 'auto',
        poolSeedingMode: 'snake',
        poolMatchFormat: { bestOf: 1, pointsTo: 11 },
        knockoutMatchFormat: { bestOf: 3, pointsTo: 11 },
        poolIncludeBronze: true,
        poolTournament: null,
        view: initialView,
        playerPool: [],
        nextPlayerId: 1,
        numTeams: defCfg.numTeams,
        goalScore: defCfg.goalScore,
        dreambreakerScore: defCfg.dreambreakerScore,
        dreambreakerFormat: defCfg.dreambreakerFormat,
        allowUneven: defCfg.allowUneven,
        captainMode: defCfg.captainMode,
        selectedCaptainIds: [],
        matchupConfig: defCfg.matchupConfig,
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

  // ---------------- Pool + Knockout Tournament Handlers ----------------

  function syncDirectoryNames(names) {
    if (!names || names.length === 0) return;
    const clean = names.map((n) => String(n || '').trim()).filter(Boolean);
    if (clean.length === 0) return;
    setSavedPlayers((prev) => {
      const lower = new Set(prev.map((p) => p.trim().toLowerCase()));
      const additions = [];
      clean.forEach((n) => {
        if (!lower.has(n.toLowerCase())) {
          lower.add(n.toLowerCase());
          additions.push(n);
        }
      });
      if (additions.length === 0) return prev;
      const updated = [...prev, ...additions];
      try {
        localStorage.setItem(getKnownPlayersStorageKey(roomId), JSON.stringify(updated));
      } catch (e) {}
      if (isCloudEnabled()) {
        saveKnownPlayersToCloud(roomId, updated);
      }
      return updated;
    });
  }

  function normalizeEntryInput(entryOrPlayers) {
    const rawPlayers = Array.isArray(entryOrPlayers)
      ? entryOrPlayers
      : entryOrPlayers?.players || (entryOrPlayers?.name ? [entryOrPlayers.name] : []);
    const clean = rawPlayers.map((p) => String(p || '').trim()).filter(Boolean);
    if (clean.length === 0) return null;
    const explicitName = !Array.isArray(entryOrPlayers) ? String(entryOrPlayers?.name || '').trim() : '';
    const displayName = explicitName || (clean.length > 1 ? clean.join(' / ') : clean[0]);
    return { name: displayName, players: clean };
  }

  function handleAddPoolEntry(entryOrPlayers) {
    const normalized = normalizeEntryInput(entryOrPlayers);
    if (!normalized) return;
    const newEntry = {
      id: `entry_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      name: normalized.name,
      players: normalized.players,
    };
    const updated = [...poolEntries, newEntry];
    setPoolEntries(updated);
    syncDirectoryNames(normalized.players);
    broadcastTournamentChange({ poolEntries: updated });
  }

  function handleAddMultiplePoolEntries(entriesList) {
    if (!Array.isArray(entriesList) || entriesList.length === 0) return 0;
    const additions = [];
    const allNames = [];
    entriesList.forEach((item, idx) => {
      const normalized = normalizeEntryInput(item);
      if (normalized) {
        additions.push({
          id: `entry_${Date.now()}_${idx}_${Math.random().toString(36).slice(2, 6)}`,
          name: normalized.name,
          players: normalized.players,
        });
        allNames.push(...normalized.players);
      }
    });
    if (additions.length === 0) return 0;
    const updated = [...poolEntries, ...additions];
    setPoolEntries(updated);
    syncDirectoryNames(allNames);
    broadcastTournamentChange({ poolEntries: updated });
    return additions.length;
  }

  function handleAddAllDirectoryToPool(mode = poolDiscipline) {
    const activeNames = new Set(
      poolEntries.flatMap((e) => (e.players || []).map((p) => p.trim().toLowerCase()))
    );
    const available = savedPlayers.filter((n) => !activeNames.has(n.trim().toLowerCase()));
    if (available.length === 0) return;

    if (mode === 'singles') {
      handleAddMultiplePoolEntries(available.map((n) => ({ name: n, players: [n] })));
    } else {
      const pairs = [];
      for (let i = 0; i + 1 < available.length; i += 2) {
        pairs.push({
          name: `${available[i]} / ${available[i + 1]}`,
          players: [available[i], available[i + 1]],
        });
      }
      if (pairs.length > 0) {
        handleAddMultiplePoolEntries(pairs);
      }
    }
  }

  function handleRemovePoolEntry(entryId) {
    const updated = poolEntries.filter((e) => e.id !== entryId);
    setPoolEntries(updated);
    broadcastTournamentChange({ poolEntries: updated });
  }

  function handleClearPoolEntries() {
    if (poolEntries.length === 0) return;
    setPoolEntries([]);
    broadcastTournamentChange({ poolEntries: [] });
  }

  function handleMovePoolEntry(fromIdx, toIdx) {
    if (
      fromIdx < 0 ||
      toIdx < 0 ||
      fromIdx >= poolEntries.length ||
      toIdx >= poolEntries.length ||
      fromIdx === toIdx
    ) {
      return;
    }
    const updated = [...poolEntries];
    const [moved] = updated.splice(fromIdx, 1);
    updated.splice(toIdx, 0, moved);
    setPoolEntries(updated);
    broadcastTournamentChange({ poolEntries: updated });
  }

  function handleStartPoolTournament() {
    if (poolEntries.length < 2) return;
    const built = generatePoolsAndSchedule({
      entries: poolEntries,
      discipline: poolDiscipline,
      structure: poolStructure,
      numPools: poolNumPools,
      numCourts: poolNumCourts,
      poolFormat: poolMatchFormat,
      knockoutFormat: knockoutMatchFormat,
      advancePerPool: poolAdvancePerPool,
      knockoutFillMode: poolKnockoutFillMode,
      targetBracketSize: poolTargetBracketSize,
      includeBronze: poolIncludeBronze,
      seedingMode: poolSeedingMode,
      tiebreakerRules: poolTiebreakerRules,
    });
    setPoolTournament(built);
    setView('poolPlay');
    broadcastTournamentChange({
      tournamentStyle: 'tournament',
      poolStructure,
      poolTournament: built,
      view: 'poolPlay',
    });
  }

  function handleUpdatePoolTournamentSettings() {
    if (!poolTournament) return;
    const courtBuckets = distributeCourtsToPools(
      (poolTournament.pools || []).length,
      poolNumCourts
    );
    const nextPools = (poolTournament.pools || []).map((pool, pIdx) => ({
      ...pool,
      assignedCourts: courtBuckets[pIdx] || [1],
      matches: (pool.matches || []).map((m) => {
        const bestOf = m.customFormat?.bestOf || poolMatchFormat.bestOf || 1;
        return {
          ...m,
          games: resizeGamesForBestOf(m.games, bestOf),
        };
      }),
    }));

    let nextKnockout = poolTournament.knockout ? JSON.parse(JSON.stringify(poolTournament.knockout)) : null;
    if (nextKnockout && Array.isArray(nextKnockout.rounds)) {
      const totalRounds = nextKnockout.rounds.length;
      nextKnockout.rounds = nextKnockout.rounds.map((round, rIdx) =>
        round.map((m) => {
          const fmt = getEffectiveMatchFormat(
            { knockoutFormat: knockoutMatchFormat },
            m,
            { isKnockout: true, totalRounds, roundIdx: rIdx, isBronze: false }
          );
          return {
            ...m,
            games: resizeGamesForBestOf(m.games, fmt.bestOf),
          };
        })
      );
      if (nextKnockout.bronzeMatch) {
        const bFmt = getEffectiveMatchFormat(
          { knockoutFormat: knockoutMatchFormat },
          nextKnockout.bronzeMatch,
          { isKnockout: true, totalRounds, roundIdx: totalRounds - 1, isBronze: true }
        );
        nextKnockout.bronzeMatch = {
          ...nextKnockout.bronzeMatch,
          games: resizeGamesForBestOf(nextKnockout.bronzeMatch.games, bFmt.bestOf),
        };
      }
    }

    const updated = {
      ...poolTournament,
      discipline: poolDiscipline,
      poolFormat: poolMatchFormat,
      knockoutFormat: knockoutMatchFormat,
      advancePerPool: poolAdvancePerPool,
      knockoutFillMode: poolKnockoutFillMode,
      targetBracketSize: poolTargetBracketSize,
      includeBronze: poolIncludeBronze,
      seedingMode: poolSeedingMode,
      tiebreakerRules: poolTiebreakerRules,
      numCourts: poolNumCourts,
      pools: nextPools,
      knockout: nextKnockout,
    };
    setPoolTournament(updated);
    setView('poolPlay');
    broadcastTournamentChange({
      poolTournament: updated,
      view: 'poolPlay',
    });
  }

  function handleSavePoolMatch(poolId, matchId, games, winnerId) {
    if (!poolTournament) return;
    const now = Date.now();
    const updated = {
      ...poolTournament,
      pools: poolTournament.pools.map((pool) => {
        if (pool.id !== poolId) return pool;
        return {
          ...pool,
          matches: pool.matches.map((m) =>
            m.id === matchId
              ? {
                  ...m,
                  games,
                  winnerId: winnerId || null,
                  saved: Boolean(winnerId),
                  inProgress: false,
                  durationMs:
                    winnerId && m.liveStartedAt
                      ? Math.max(0, now - Number(m.liveStartedAt))
                      : m.durationMs || null,
                  completedAt: winnerId ? now : null,
                  liveStartedAt: null,
                  pendingScore: null,
                }
              : m
          ),
        };
      }),
    };
    setPoolTournament(updated);
    broadcastTournamentChange({ poolTournament: updated });
  }

  function handleTogglePoolMatchLive(poolId, matchId) {
    if (!poolTournament) return;
    const pool = (poolTournament.pools || []).find((p) => p.id === poolId);
    const target = pool?.matches?.find((m) => m.id === matchId);
    if (!target || target.saved) return;
    if (!target.inProgress) {
      const busy = getBusyPoolEntryIds(poolTournament, `pool:${poolId}:${matchId}`);
      if ((target.entryAId && busy.has(target.entryAId)) || (target.entryBId && busy.has(target.entryBId))) {
        alert('Cannot mark live: one or more players/teams in this match are already playing on another court.');
        return;
      }
    }
    const updated = {
      ...poolTournament,
      pools: poolTournament.pools.map((p) => {
        if (p.id !== poolId) return p;
        return {
          ...p,
          matches: p.matches.map((m) => {
            if (m.id !== matchId || m.saved) return m;
            const nextLive = !m.inProgress;
            return {
              ...m,
              inProgress: nextLive,
              liveStartedAt: nextLive ? (m.liveStartedAt || Date.now()) : null,
            };
          }),
        };
      }),
    };
    setPoolTournament(updated);
    broadcastTournamentChange({ poolTournament: updated });
  }

  function handleSetPoolMatchCourt(poolId, matchId, court) {
    if (!poolTournament) return;
    const cleanCourt = court ? Number(court) : null;
    const updated = {
      ...poolTournament,
      pools: poolTournament.pools.map((pool) => {
        if (pool.id !== poolId) return pool;
        return {
          ...pool,
          matches: pool.matches.map((m) =>
            m.id === matchId ? { ...m, court: cleanCourt } : m
          ),
        };
      }),
    };
    setPoolTournament(updated);
    broadcastTournamentChange({ poolTournament: updated });
  }

  function handleEditPoolMatch(poolId, matchId, { entryAId, entryBId, customFormat, court }) {
    if (!poolTournament) return;
    const updated = {
      ...poolTournament,
      pools: poolTournament.pools.map((pool) => {
        if (pool.id !== poolId) return pool;
        return {
          ...pool,
          matches: pool.matches.map((m) => {
            if (m.id !== matchId) return m;
            const nextBestOf = customFormat?.bestOf || poolTournament.poolFormat?.bestOf || 1;
            const entrantsChanged = m.entryAId !== entryAId || m.entryBId !== entryBId;
            return {
              ...m,
              entryAId,
              entryBId,
              customFormat: customFormat || null,
              court: court !== undefined ? (court ? Number(court) : null) : (m.court || null),
              games: entrantsChanged
                ? resizeGamesForBestOf([], nextBestOf)
                : resizeGamesForBestOf(m.games, nextBestOf),
              saved: entrantsChanged ? false : m.saved,
              winnerId: entrantsChanged ? null : m.winnerId,
              inProgress: entrantsChanged ? false : m.inProgress,
            };
          }),
        };
      }),
    };
    setPoolTournament(updated);
    broadcastTournamentChange({ poolTournament: updated });
  }

  function handleGeneratePoolKnockout() {
    if (!poolTournament) return;
    const knockout = generateKnockoutBracket(poolTournament);
    const updated = {
      ...poolTournament,
      knockout,
    };
    setPoolTournament(updated);
    broadcastTournamentChange({ poolTournament: updated });
  }

  function handleSaveKnockoutMatch(roundIdx, matchIdx, games, winnerId, isBronze = false) {
    if (!poolTournament || !poolTournament.knockout) return;
    const now = Date.now();
    let updatedKnockout = { ...poolTournament.knockout };
    if (isBronze) {
      const bm = updatedKnockout.bronzeMatch;
      updatedKnockout = {
        ...updatedKnockout,
        bronzeMatch: {
          ...bm,
          games,
          winnerId: winnerId || null,
          saved: Boolean(winnerId),
          inProgress: false,
          durationMs:
            winnerId && bm?.liveStartedAt
              ? Math.max(0, now - Number(bm.liveStartedAt))
              : bm?.durationMs || null,
          completedAt: winnerId ? now : null,
          liveStartedAt: null,
          pendingScore: null,
        },
        bronzeId: winnerId || null,
      };
    } else {
      updatedKnockout = {
        ...updatedKnockout,
        rounds: updatedKnockout.rounds.map((r, rI) =>
          rI !== roundIdx
            ? r
            : r.map((m, mI) =>
                mI !== matchIdx
                  ? m
                  : {
                      ...m,
                      games,
                      winnerId: winnerId || null,
                      saved: Boolean(winnerId),
                      inProgress: false,
                      durationMs:
                        winnerId && m.liveStartedAt
                          ? Math.max(0, now - Number(m.liveStartedAt))
                          : m.durationMs || null,
                      completedAt: winnerId ? now : null,
                      liveStartedAt: null,
                      pendingScore: null,
                    }
              )
        ),
      };
      if (winnerId) {
        updatedKnockout = advanceKnockoutWinner(updatedKnockout, roundIdx, matchIdx, winnerId);
      }
    }
    const updated = { ...poolTournament, knockout: updatedKnockout };
    setPoolTournament(updated);
    broadcastTournamentChange({ poolTournament: updated });
  }

  function handleToggleKnockoutMatchLive(roundIdx, matchIdx, isBronze = false) {
    if (!poolTournament || !poolTournament.knockout) return;
    let updatedKnockout = { ...poolTournament.knockout };
    if (isBronze && updatedKnockout.bronzeMatch && !updatedKnockout.bronzeMatch.saved) {
      const bm = updatedKnockout.bronzeMatch;
      const nextLive = !bm.inProgress;
      if (nextLive) {
        const busy = getBusyPoolEntryIds(poolTournament, 'ko:bronze');
        if ((bm.entryAId && busy.has(bm.entryAId)) || (bm.entryBId && busy.has(bm.entryBId))) {
          alert('Cannot mark live: one or more players/teams in this match are already playing on another court.');
          return;
        }
      }
      updatedKnockout = {
        ...updatedKnockout,
        bronzeMatch: {
          ...bm,
          inProgress: nextLive,
          liveStartedAt: nextLive ? (bm.liveStartedAt || Date.now()) : null,
        },
      };
    } else if (!isBronze) {
      const targetMatch = updatedKnockout.rounds[roundIdx]?.[matchIdx];
      if (!targetMatch || targetMatch.saved) return;
      if (!targetMatch.inProgress) {
        const busy = getBusyPoolEntryIds(poolTournament, `ko:${roundIdx}:${targetMatch.matchIdx}`);
        if (
          (targetMatch.entryAId && busy.has(targetMatch.entryAId)) ||
          (targetMatch.entryBId && busy.has(targetMatch.entryBId))
        ) {
          alert('Cannot mark live: one or more players/teams in this match are already playing on another court.');
          return;
        }
      }
      updatedKnockout = {
        ...updatedKnockout,
        rounds: updatedKnockout.rounds.map((r, rI) =>
          rI !== roundIdx
            ? r
            : r.map((m, mI) => {
                if (mI !== matchIdx || m.saved) return m;
                const nextLive = !m.inProgress;
                return {
                  ...m,
                  inProgress: nextLive,
                  liveStartedAt: nextLive ? (m.liveStartedAt || Date.now()) : null,
                };
              })
        ),
      };
    }
    const updated = { ...poolTournament, knockout: updatedKnockout };
    setPoolTournament(updated);
    broadcastTournamentChange({ poolTournament: updated });
  }

  function handleSetKnockoutMatchCourt(roundIdx, matchIdx, isBronze, court) {
    if (!poolTournament || !poolTournament.knockout) return;
    const cleanCourt = court ? Number(court) : null;
    const updatedKnockout = JSON.parse(JSON.stringify(poolTournament.knockout));
    if (isBronze && updatedKnockout.bronzeMatch) {
      updatedKnockout.bronzeMatch.court = cleanCourt;
    } else if (updatedKnockout.rounds[roundIdx]?.[matchIdx]) {
      updatedKnockout.rounds[roundIdx][matchIdx].court = cleanCourt;
    }
    const updated = { ...poolTournament, knockout: updatedKnockout };
    setPoolTournament(updated);
    broadcastTournamentChange({ poolTournament: updated });
  }

  function handleBatchAssignPoolCourtsAndLive(assignments) {
    if (!poolTournament || !Array.isArray(assignments) || assignments.length === 0) return;
    const now = Date.now();
    const busyEntries = getBusyPoolEntryIds(poolTournament);
    const poolAssignMap = new Map();
    const koAssignMap = new Map();
    let bronzeAssign = null;

    assignments.forEach((a) => {
      let eA = a.entryAId;
      let eB = a.entryBId;
      if (!eA || !eB) {
        if (a.type === 'pool') {
          const pm = (poolTournament.pools || [])
            .find((p) => p.id === a.poolId)
            ?.matches?.find((m) => m.id === a.matchId);
          eA = pm?.entryAId;
          eB = pm?.entryBId;
        } else if (a.type === 'knockout') {
          const km = a.isBronze
            ? poolTournament.knockout?.bronzeMatch
            : poolTournament.knockout?.rounds?.[a.roundIdx]?.[a.matchIdx];
          eA = km?.entryAId;
          eB = km?.entryBId;
        }
      }
      if ((eA && busyEntries.has(eA)) || (eB && busyEntries.has(eB))) return;
      if (eA) busyEntries.add(eA);
      if (eB) busyEntries.add(eB);

      if (a.type === 'pool') {
        poolAssignMap.set(`${a.poolId}:${a.matchId}`, a.court);
      } else if (a.type === 'knockout') {
        if (a.isBronze) bronzeAssign = a.court;
        else koAssignMap.set(`${a.roundIdx}:${a.matchIdx}`, a.court);
      }
    });
    if (poolAssignMap.size === 0 && koAssignMap.size === 0 && bronzeAssign === null) return;

    const nextPools = (poolTournament.pools || []).map((pool) => ({
      ...pool,
      matches: (pool.matches || []).map((m) => {
        const key = `${pool.id}:${m.id}`;
        if (!poolAssignMap.has(key)) return m;
        return {
          ...m,
          court: Number(poolAssignMap.get(key)),
          inProgress: true,
          liveStartedAt: m.liveStartedAt || now,
        };
      }),
    }));

    let nextKnockout = poolTournament.knockout
      ? JSON.parse(JSON.stringify(poolTournament.knockout))
      : null;
    if (nextKnockout) {
      if (Array.isArray(nextKnockout.rounds)) {
        nextKnockout.rounds = nextKnockout.rounds.map((r, rIdx) =>
          r.map((m, mIdx) => {
            const key = `${rIdx}:${mIdx}`;
            if (!koAssignMap.has(key)) return m;
            return {
              ...m,
              court: Number(koAssignMap.get(key)),
              inProgress: true,
              liveStartedAt: m.liveStartedAt || now,
            };
          })
        );
      }
      if (bronzeAssign !== null && nextKnockout.bronzeMatch) {
        nextKnockout.bronzeMatch = {
          ...nextKnockout.bronzeMatch,
          court: Number(bronzeAssign),
          inProgress: true,
          liveStartedAt: nextKnockout.bronzeMatch.liveStartedAt || now,
        };
      }
    }

    const updated = { ...poolTournament, pools: nextPools, knockout: nextKnockout };
    setPoolTournament(updated);
    broadcastTournamentChange({ poolTournament: updated });
  }

  function handleLoginPlayer(name) {
    const clean = String(name || '').trim();
    setLoggedInPlayerName(clean);
    try {
      localStorage.setItem(`neep_player_login_${roomId || 'default'}`, clean);
    } catch (e) {}
    if (!isAdmin && clean) {
      setView(tournamentStyle === 'tournament' ? 'poolPlay' : (bracket ? 'bracket' : 'draft'));
    }
  }

  function handleLogoutPlayer() {
    setLoggedInPlayerName('');
    try {
      localStorage.removeItem(`neep_player_login_${roomId || 'default'}`);
    } catch (e) {}
  }

  useEffect(() => {
    if (!isAdmin && loggedInPlayerName && ['setup', 'poolSetup', 'leaderboard'].includes(view)) {
      setView(tournamentStyle === 'tournament' ? 'poolPlay' : (bracket ? 'bracket' : 'draft'));
    }
  }, [isAdmin, loggedInPlayerName, view, tournamentStyle, bracket]);

  async function handleRequestNotifPermission() {
    if (typeof Notification === 'undefined') return;
    try {
      const res = await Notification.requestPermission();
      setNotifPermission(res);
    } catch (e) {
      // ignore
    }
  }

  function updatePoolMatchPendingScore(item, pendingScore) {
    if (!poolTournament) return;
    let updated = poolTournament;
    if (item.type === 'pool') {
      updated = {
        ...poolTournament,
        pools: (poolTournament.pools || []).map((p) =>
          p.id !== item.poolId
            ? p
            : {
                ...p,
                matches: (p.matches || []).map((m) =>
                  m.id === item.match.id ? { ...m, pendingScore } : m
                ),
              }
        ),
      };
    } else if (item.type === 'knockout' && poolTournament.knockout) {
      const ko = JSON.parse(JSON.stringify(poolTournament.knockout));
      if (item.isBronze && ko.bronzeMatch) {
        ko.bronzeMatch = { ...ko.bronzeMatch, pendingScore };
      } else if (ko.rounds?.[item.roundIdx]?.[item.matchIdx]) {
        ko.rounds[item.roundIdx][item.matchIdx] = {
          ...ko.rounds[item.roundIdx][item.matchIdx],
          pendingScore,
        };
      }
      updated = { ...poolTournament, knockout: ko };
    }
    setPoolTournament(updated);
    broadcastTournamentChange({ poolTournament: updated });
  }

  function handleApprovePoolPendingScore(item) {
    const pending = item?.match?.pendingScore;
    if (!pending) return;
    if (item.type === 'pool') {
      handleSavePoolMatch(item.poolId, item.match.id, pending.games, pending.winnerId);
    } else if (item.type === 'knockout') {
      handleSaveKnockoutMatch(item.roundIdx, item.matchIdx, pending.games, pending.winnerId, item.isBronze);
    }
  }

  function updateMlpGamePendingScore(item, pendingScore) {
    if (!bracket) return;
    const nb = JSON.parse(JSON.stringify(bracket));
    const match = nb.rounds[item.round]?.[item.idx];
    if (!match?.games) return;
    match.games = match.games.map((g) =>
      g.id === item.game.id ? { ...g, pendingScore } : g
    );
    setBracket(nb);
    broadcastTournamentChange({ bracket: nb });
  }

  function handleApproveMlpPendingScore(item) {
    const pending = item?.game?.pendingScore;
    if (!pending) return;
    handleSaveGameAt(item.round, item.idx, item.game.id, pending.scoreA, pending.scoreB);
  }

  function handleEditKnockoutMatch(roundIdx, matchIdx, isBronze, { entryAId, entryBId, customFormat, court }) {
    if (!poolTournament || !poolTournament.knockout) return;
    let updatedKnockout = JSON.parse(JSON.stringify(poolTournament.knockout));
    const totalRounds = updatedKnockout.rounds.length;

    if (isBronze && updatedKnockout.bronzeMatch) {
      const bm = updatedKnockout.bronzeMatch;
      const fmt = getEffectiveMatchFormat(poolTournament, { customFormat }, {
        isKnockout: true,
        totalRounds,
        roundIdx: totalRounds - 1,
        isBronze: true,
      });
      const entrantsChanged = bm.entryAId !== entryAId || bm.entryBId !== entryBId;
      updatedKnockout.bronzeMatch = {
        ...bm,
        entryAId: entryAId || null,
        entryBId: entryBId || null,
        customFormat: customFormat || null,
        court: court !== undefined ? (court ? Number(court) : null) : (bm.court || null),
        games: entrantsChanged
          ? resizeGamesForBestOf([], fmt.bestOf)
          : resizeGamesForBestOf(bm.games, fmt.bestOf),
        saved: entrantsChanged ? false : bm.saved,
        winnerId: entrantsChanged ? null : bm.winnerId,
        inProgress: entrantsChanged ? false : bm.inProgress,
      };
      if (entrantsChanged) {
        updatedKnockout.bronzeId = null;
      }
    } else {
      const m = updatedKnockout.rounds[roundIdx]?.[matchIdx];
      if (!m) return;
      const fmt = getEffectiveMatchFormat(poolTournament, { customFormat }, {
        isKnockout: true,
        totalRounds,
        roundIdx,
        isBronze: false,
      });
      const entrantsChanged = m.entryAId !== entryAId || m.entryBId !== entryBId;
      const isNowBye = roundIdx === 0 && Boolean((entryAId && !entryBId) || (!entryAId && entryBId));

      const nextMatch = {
        ...m,
        entryAId: entryAId || null,
        entryBId: entryBId || null,
        isBye: isNowBye,
        customFormat: customFormat || null,
        court: court !== undefined ? (court ? Number(court) : null) : (m.court || null),
        games: entrantsChanged
          ? resizeGamesForBestOf([], fmt.bestOf)
          : resizeGamesForBestOf(m.games, fmt.bestOf),
        saved: isNowBye ? true : (entrantsChanged ? false : m.saved),
        winnerId: isNowBye ? (entryAId || entryBId) : (entrantsChanged ? null : m.winnerId),
        inProgress: entrantsChanged ? false : m.inProgress,
      };
      updatedKnockout.rounds[roundIdx][matchIdx] = nextMatch;

      if (isNowBye && nextMatch.winnerId) {
        updatedKnockout = advanceKnockoutWinner(updatedKnockout, roundIdx, matchIdx, nextMatch.winnerId);
      } else if (entrantsChanged && roundIdx + 1 < totalRounds) {
        const nextIdx = Math.floor(matchIdx / 2);
        const slot = matchIdx % 2 === 0 ? 'entryAId' : 'entryBId';
        updatedKnockout.rounds[roundIdx + 1][nextIdx][slot] = null;
      }
    }

    const updated = { ...poolTournament, knockout: updatedKnockout };
    setPoolTournament(updated);
    broadcastTournamentChange({ poolTournament: updated });
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
    const isPoolStyle = tournamentStyle === 'tournament';
    setModal({
      title: 'New Tournament or Reset?',
      message: 'Choose whether to start a new tournament keeping your current players/entries, or clear everything and reset. All stats remain permanently saved in the leaderboard.',
      secondaryConfirm: {
        label: 'Start New (Keep Same Players)',
        onAction: () => {
          setPriorStats(globalStats);
          setPriorPartnershipStats(partnershipStats);
          if (isPoolStyle) {
            setPoolTournament(null);
            setView('poolSetup');
            broadcastTournamentChange({
              poolTournament: null,
              view: 'poolSetup',
            });
          } else {
            setTeams([]);
            setPlayersById({});
            setRemainingPool([]);
            setPickSequence([]);
            setPickPointer(0);
            setSittingOut([]);
            setBracket(null);
            setActivePath(null);
            setView('setup');
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
          }
          setModal(null);
        },
      },
      confirmLabel: 'Clear All',
      onConfirm: () => {
        const defCfg = getEffectiveDefaultConfig(roomId);
        const nextView = isPoolStyle ? 'poolSetup' : 'setup';
        setPriorStats(globalStats);
        setPriorPartnershipStats(partnershipStats);
        setPlayerPool([]);
        setNextPlayerId(1);
        setNumTeams(defCfg.numTeams);
        setNumCourts(defCfg.numCourts || 2);
        setGoalScore(defCfg.goalScore);
        setDreambreakerScore(defCfg.dreambreakerScore);
        setDreambreakerFormat(defCfg.dreambreakerFormat);
        setAllowUneven(defCfg.allowUneven);
        setCaptainMode(defCfg.captainMode);
        setSelectedCaptainIds([]);
        setCustomTeamNames([]);
        setMatchupCourtsConfig({});
        setMatchupConfig(defCfg.matchupConfig);
        setTeams([]);
        setPlayersById({});
        setRemainingPool([]);
        setPickSequence([]);
        setPickPointer(0);
        setSittingOut([]);
        setBracket(null);
        setActivePath(null);
        setPoolEntries([]);
        setPoolTournament(null);
        setView(nextView);
        try {
          localStorage.removeItem(getTournStorageKey(roomId));
        } catch (e) {}
        broadcastTournamentChange({
          playerPool: [],
          nextPlayerId: 1,
          numTeams: defCfg.numTeams,
          numCourts: defCfg.numCourts || 2,
          goalScore: defCfg.goalScore,
          dreambreakerScore: defCfg.dreambreakerScore,
          dreambreakerFormat: defCfg.dreambreakerFormat,
          allowUneven: defCfg.allowUneven,
          captainMode: defCfg.captainMode,
          selectedCaptainIds: [],
          customTeamNames: [],
          matchupCourtsConfig: {},
          matchupConfig: defCfg.matchupConfig,
          teams: [],
          playersById: {},
          remainingPool: [],
          pickSequence: [],
          pickPointer: 0,
          sittingOut: [],
          bracket: null,
          activePath: null,
          poolEntries: [],
          poolTournament: null,
          view: nextView,
        });
        setModal(null);
      },
    });
  }

  function requestWipeStats() {
    setModal({
      title: 'Wipe Stats or Full Database?',
      message: 'Choose whether to wipe only the leaderboard stats for this room, or completely clear all tournaments, rooms, and player names from the database.',
      secondaryConfirm: {
        label: 'Wipe All Tournaments & Names',
        onAction: async () => {
          await wipeAllDatabaseData(roomId ? [roomId] : []);
          setGlobalStats({});
          setPartnershipStats({});
          setPriorStats({});
          setPriorPartnershipStats({});
          setSavedPlayers([]);
          setPlayerPool([]);
          setTeams([]);
          setPlayersById({});
          setRemainingPool([]);
          setPickSequence([]);
          setPickPointer(0);
          setSittingOut([]);
          setBracket(null);
          setActivePath(null);
          setSavedRoomsHistory([]);
          setRoomId(null);
          setView('landing');
          setModal(null);
        },
      },
      confirmLabel: 'Wipe Leaderboard Only',
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

  if (view === 'adminPortal') {
    return (
      <>
        <AdminPortalView
          onBackToLanding={() => {
            setView('landing');
            setRoomId(null);
          }}
          onOpenRoomAsAdmin={(targetRoomId, targetPin) => {
            handleSwitchRoom(targetRoomId, targetPin);
          }}
          onOpenRoomAsSpectator={(targetRoomId) => {
            handleSwitchRoom(targetRoomId, '');
          }}
          onCreateCustomRoom={(customId, customPin) => {
            handleCreatePrivateRoom(customId, customPin);
          }}
          onPinUpdatedForRoom={(updatedRoomId, updatedPin) => {
            if (roomId === updatedRoomId) {
              setAdminPin(updatedPin);
            }
            setSavedRoomsHistory(loadSavedRoomsHistory());
          }}
          onRoomDeleted={(deletedRoomId) => {
            if (roomId === deletedRoomId) {
              setRoomId(null);
            }
            setSavedRoomsHistory(loadSavedRoomsHistory());
          }}
          onWipeAllDatabase={async () => {
            await wipeAllDatabaseData(roomId ? [roomId] : []);
            setGlobalStats({});
            setPartnershipStats({});
            setPriorStats({});
            setPriorPartnershipStats({});
            setSavedPlayers([]);
            setPlayerPool([]);
            setTeams([]);
            setPlayersById({});
            setRemainingPool([]);
            setPickSequence([]);
            setPickPointer(0);
            setSittingOut([]);
            setBracket(null);
            setActivePath(null);
            setSavedRoomsHistory([]);
            setRoomId(null);
          }}
          isCloudActive={isCloudEnabled()}
          onOpenCloudConfig={() => setIsCloudConfigOpen(true)}
        />
        <CloudConfigModal
          isOpen={isCloudConfigOpen}
          onClose={() => setIsCloudConfigOpen(false)}
          currentRoomId={roomId}
        />
      </>
    );
  }

  if (view === 'landing' || !roomId) {
    return (
      <>
        <LandingView
          onCreatePrivateRoom={(style) => handleCreatePrivateRoom(undefined, undefined, style)}
          onJoinRoom={handleJoinExistingRoom}
          recentRoomId={recentRoomId}
          savedRooms={savedRoomsHistory}
          onResumeRecentRoom={handleResumeRecentRoom}
          onRemoveSavedRoom={handleRemoveSavedRoom}
          onOpenCloudConfig={() => setIsCloudConfigOpen(true)}
          onOpenAdminPortal={() => setView('adminPortal')}
          isCloudActive={isCloudEnabled()}
        />
        <CloudConfigModal
          isOpen={isCloudConfigOpen}
          onClose={() => setIsCloudConfigOpen(false)}
          currentRoomId={roomId}
        />
      </>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      <Header
        tournamentStyle={tournamentStyle}
        hasTournament={tournamentStyle === 'tournament' ? Boolean(poolTournament || poolEntries.length > 0) : teams.length > 0}
        view={view}
        setView={setView}
        onBracketTab={() =>
          setView(
            tournamentStyle === 'tournament'
              ? (poolTournament ? 'poolPlay' : 'poolSetup')
              : (bracket ? 'bracket' : 'draft')
          )
        }
        onClear={requestClearTournament}
        onWipeStats={requestWipeStats}
        onOpenShare={() => setIsShareOpen(true)}
        onOpenCloudConfig={() => setIsCloudConfigOpen(true)}
        roomId={roomId}
        onOpenRoomModal={() => setIsRoomModalOpen(true)}
        isAdmin={isAdmin}
        onUnlockAdmin={handleUnlockAdmin}
        loggedInPlayerName={loggedInPlayerName}
        onOpenPlayerLogin={() => setIsPlayerLoginOpen(true)}
        onOpenRosterModal={() => {
          setRosterModalTeamId(null);
          setIsRosterModalOpen(true);
        }}
        onExitToLanding={handleExitToLanding}
      />

      {!isAdmin && loggedInPlayerName && (poolTournament || bracket) && (
        <PlayerPortalBanner
          loggedInPlayerName={loggedInPlayerName}
          onOpenPlayerLogin={() => setIsPlayerLoginOpen(true)}
          tournamentStyle={tournamentStyle}
          poolTournament={poolTournament}
          bracket={bracket}
          teams={teams}
          playersById={playersById}
          notifPermission={notifPermission}
          onRequestNotifPermission={handleRequestNotifPermission}
          onSubmitPoolPendingScore={updatePoolMatchPendingScore}
          onApprovePoolPendingScore={handleApprovePoolPendingScore}
          onRejectPoolPendingScore={(item) => updatePoolMatchPendingScore(item, null)}
          onSubmitMlpPendingScore={updateMlpGamePendingScore}
          onApproveMlpPendingScore={handleApproveMlpPendingScore}
          onRejectMlpPendingScore={(item) => updateMlpGamePendingScore(item, null)}
        />
      )}

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
            numTeams={numTeams}
            setNumTeams={handleUpdateNumTeams}
            numCourts={numCourts}
            setNumCourts={handleUpdateNumCourts}
            goalScore={goalScore}
            setGoalScore={handleUpdateGoalScore}
            dreambreakerScore={dreambreakerScore}
            setDreambreakerScore={handleUpdateDreambreakerScore}
            dreambreakerFormat={dreambreakerFormat}
            setDreambreakerFormat={handleUpdateDreambreakerFormat}
            allowUneven={allowUneven}
            setAllowUneven={handleUpdateAllowUneven}
            captainMode={captainMode}
            setCaptainMode={handleUpdateCaptainMode}
            selectedCaptainIds={selectedCaptainIds}
            setSelectedCaptainIds={handleUpdateSelectedCaptainIds}
            customTeamNames={customTeamNames}
            setCustomTeamNames={(val) => {
              setCustomTeamNames(val);
              broadcastTournamentChange({ customTeamNames: val });
            }}
            matchupCourtsConfig={matchupCourtsConfig}
            setMatchupCourtsConfig={(val) => {
              setMatchupCourtsConfig(val);
              broadcastTournamentChange({ matchupCourtsConfig: val });
            }}
            matchupConfig={matchupConfig}
            setMatchupConfig={handleUpdateMatchupConfig}
            savedDefaultConfig={savedDefaultConfig}
            configPresets={configPresets}
            onSaveDefaultConfig={handleSaveDefaultConfig}
            onSaveConfigPreset={handleSaveConfigPreset}
            onDeleteConfigPreset={handleDeleteConfigPreset}
            onApplyConfig={handleApplyConfig}
            roomId={roomId}
            setRoomId={(newId) => handleSwitchRoom(newId, adminPin)}
            adminPin={adminPin}
            setAdminPin={setAdminPin}
            onInitializeDraft={handleInitializeDraft}
            hasExistingTournament={teams.length > 0 || Boolean(bracket)}
            onReturnToEvent={() => setView(bracket ? 'bracket' : 'draft')}
            onUpdateLiveSettings={() => {
              let nextTeams = teams;
              if (Array.isArray(customTeamNames) && customTeamNames.length > 0 && teams.length > 0) {
                nextTeams = teams.map((t, idx) => {
                  const custom = (customTeamNames[idx] || '').trim();
                  return custom ? { ...t, name: custom } : t;
                });
                setTeams(nextTeams);
              }
              const nextView = bracket ? 'bracket' : 'draft';
              setView(nextView);
              broadcastTournamentChange({
                teams: nextTeams,
                numCourts,
                goalScore,
                dreambreakerScore,
                dreambreakerFormat,
                customTeamNames,
                matchupCourtsConfig,
                adminPin,
                view: nextView,
              });
            }}
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
            onRenameTeam={handleRenameTeam}
            onGenerateBracket={handleGenerateBracket}
            isAdmin={isAdmin}
          />
        )}

        {view === 'bracket' && bracket && (
          <BracketView
            bracket={bracket}
            teams={teams}
            playersById={playersById}
            roomId={roomId}
            numCourts={numCourts}
            isAdmin={isAdmin}
            onOpenMatch={openMatch}
            onBatchAssignCourtsLive={handleBatchAssignMlpCourtsAndLive}
            onSetMatchAssignedCourts={handleSetMlpMatchAssignedCourts}
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
            bracket={bracket}
            teams={teams}
            roomId={roomId}
            onSaveGame={handleSaveGame}
            onToggleInProgress={handleToggleGameInProgress}
            numCourts={numCourts}
            onSetGameCourt={handleSetGameCourt}
            onBatchAssignCourtsLive={handleBatchAssignMlpCourtsAndLive}
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
            dreambreakerFormat={dreambreakerFormat}
            onUpdateScoreLimit={handleUpdateDreambreakerScore}
            onUpdateFormat={handleUpdateDreambreakerFormat}
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
            dreambreakerFormat={dreambreakerFormat}
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
            bracket={bracket}
            teams={teams}
            playersById={playersById}
            roomId={roomId}
          />
        )}

        {view === 'poolSetup' && (
          <PoolSetupView
            discipline={poolDiscipline}
            onChangeDiscipline={(val) => {
              if (val === poolDiscipline) return;
              setPoolDiscipline(val);
              setPoolEntries([]);
              broadcastTournamentChange({ poolDiscipline: val, poolEntries: [] });
            }}
            structure={poolStructure}
            setStructure={(val) => {
              setPoolStructure(val);
              broadcastTournamentChange({ poolStructure: val });
            }}
            entries={poolEntries}
            onAddEntry={handleAddPoolEntry}
            onAddMultipleEntries={handleAddMultiplePoolEntries}
            onRemoveEntry={handleRemovePoolEntry}
            onClearEntries={handleClearPoolEntries}
            onMoveEntry={handleMovePoolEntry}
            savedPlayers={savedPlayers}
            onAddAllSavedPlayers={() => handleAddAllDirectoryToPool(poolDiscipline)}
            onRemoveSavedPlayer={handleRemoveSavedPlayer}
            onAddDirectoryPlayer={handleAddPlayerToDirectory}
            onRenameDirectoryPlayer={handleRenameDirectoryPlayer}
            onImportDirectoryNames={(names, addToPool = true) => {
              const clean = (names || []).map((n) => String(n || '').trim()).filter(Boolean);
              if (clean.length === 0) return 0;
              syncDirectoryNames(clean);
              if (!addToPool) return clean.length;
              if (poolDiscipline === 'singles') {
                const existingLower = new Set(
                  poolEntries.flatMap((e) => (e.players || []).map((p) => p.trim().toLowerCase()))
                );
                const toAdd = clean.filter((n) => !existingLower.has(n.toLowerCase()));
                return handleAddMultiplePoolEntries(toAdd.map((n) => ({ name: n, players: [n] })));
              }
              if (clean.length >= 2) {
                const pairs = [];
                for (let i = 0; i + 1 < clean.length; i += 2) {
                  pairs.push({ name: `${clean[i]} / ${clean[i + 1]}`, players: [clean[i], clean[i + 1]] });
                }
                return handleAddMultiplePoolEntries(pairs);
              }
              return clean.length;
            }}
            numPools={poolNumPools}
            setNumPools={(v) => {
              setPoolNumPools(v);
              broadcastTournamentChange({ poolNumPools: v });
            }}
            advancePerPool={poolAdvancePerPool}
            setAdvancePerPool={(v) => {
              setPoolAdvancePerPool(v);
              broadcastTournamentChange({ poolAdvancePerPool: v });
            }}
            knockoutFillMode={poolKnockoutFillMode}
            setKnockoutFillMode={(v) => {
              setPoolKnockoutFillMode(v);
              broadcastTournamentChange({ poolKnockoutFillMode: v });
            }}
            targetBracketSize={poolTargetBracketSize}
            setTargetBracketSize={(v) => {
              setPoolTargetBracketSize(v);
              broadcastTournamentChange({ poolTargetBracketSize: v });
            }}
            seedingMode={poolSeedingMode}
            setSeedingMode={(v) => {
              setPoolSeedingMode(v);
              broadcastTournamentChange({ poolSeedingMode: v });
            }}
            tiebreakerRules={poolTiebreakerRules}
            setTiebreakerRules={(v) => {
              setPoolTiebreakerRules(v);
              broadcastTournamentChange({ poolTiebreakerRules: v });
            }}
            poolFormat={poolMatchFormat}
            setPoolFormat={(v) => {
              setPoolMatchFormat(v);
              broadcastTournamentChange({ poolMatchFormat: v });
            }}
            knockoutFormat={knockoutMatchFormat}
            setKnockoutFormat={(v) => {
              setKnockoutMatchFormat(v);
              broadcastTournamentChange({ knockoutMatchFormat: v });
            }}
            includeBronze={poolIncludeBronze}
            setIncludeBronze={(v) => {
              setPoolIncludeBronze(v);
              broadcastTournamentChange({ poolIncludeBronze: v });
            }}
            numCourts={poolNumCourts}
            setNumCourts={(v) => {
              setPoolNumCourts(v);
              broadcastTournamentChange({ poolNumCourts: v });
            }}
            roomId={roomId}
            setRoomId={(newId) => handleSwitchRoom(newId, adminPin)}
            adminPin={adminPin}
            setAdminPin={setAdminPin}
            hasExistingTournament={Boolean(poolTournament)}
            onUpdateTournamentSettings={handleUpdatePoolTournamentSettings}
            onStartPoolTournament={handleStartPoolTournament}
            isAdmin={isAdmin}
          />
        )}

        {view === 'poolPlay' && (
          <PoolPlayView
            tournament={poolTournament}
            numCourts={poolTournament?.numCourts || poolNumCourts}
            roomId={roomId}
            onSavePoolMatch={handleSavePoolMatch}
            onTogglePoolMatchLive={handleTogglePoolMatchLive}
            onSetPoolMatchCourt={handleSetPoolMatchCourt}
            onEditPoolMatch={handleEditPoolMatch}
            onGenerateKnockout={handleGeneratePoolKnockout}
            onSaveKnockoutMatch={handleSaveKnockoutMatch}
            onToggleKnockoutMatchLive={handleToggleKnockoutMatchLive}
            onSetKnockoutMatchCourt={handleSetKnockoutMatchCourt}
            onEditKnockoutMatch={handleEditKnockoutMatch}
            onBatchAssignCourtsLive={handleBatchAssignPoolCourtsAndLive}
            onOpenSetup={() => setView('poolSetup')}
            isAdmin={isAdmin}
          />
        )}

        {view === 'scorekeeper' && (
          <ScorekeeperDashboardView
            isAdmin={isAdmin}
            tournamentStyle={tournamentStyle}
            numCourts={
              tournamentStyle === 'tournament'
                ? poolTournament?.numCourts || poolNumCourts
                : numCourts
            }
            poolTournament={poolTournament}
            onSavePoolMatch={handleSavePoolMatch}
            onTogglePoolMatchLive={handleTogglePoolMatchLive}
            onSaveKnockoutMatch={handleSaveKnockoutMatch}
            onToggleKnockoutMatchLive={handleToggleKnockoutMatchLive}
            onGenerateKnockout={handleGeneratePoolKnockout}
            onEditKnockoutMatch={handleEditKnockoutMatch}
            onBatchAssignPoolCourtsLive={handleBatchAssignPoolCourtsAndLive}
            bracket={bracket}
            teams={teams}
            playersById={playersById}
            onSaveMlpGameAt={handleSaveGameAt}
            onToggleMlpGameLiveAt={handleToggleGameInProgressAt}
            onBatchAssignMlpCourtsLive={handleBatchAssignMlpCourtsAndLive}
            onBack={() =>
              setView(tournamentStyle === 'tournament' ? 'poolPlay' : 'bracket')
            }
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
        onOpenAdminPortal={() => {
          setIsRoomModalOpen(false);
          setView('adminPortal');
        }}
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
        onRenameTeam={handleRenameTeam}
        onReorderDraftPosition={handleReorderDraftPosition}
        isAdmin={isAdmin}
        initialTeamId={rosterModalTeamId}
      />
      <PlayerLoginModal
        isOpen={isPlayerLoginOpen}
        onClose={() => setIsPlayerLoginOpen(false)}
        playerNames={
          tournamentStyle === 'tournament'
            ? [
                ...((poolTournament?.entries || poolEntries || []).flatMap((e) =>
                  Array.isArray(e.players) && e.players.length > 0 ? e.players : [e.name]
                )),
                ...savedPlayers,
              ]
            : [
                ...Object.values(playersById || {}).map((p) =>
                  typeof p === 'string' ? p : p?.name
                ),
                ...playerPool.map((p) => p?.name),
                ...savedPlayers,
              ]
        }
        loggedInPlayerName={loggedInPlayerName}
        onLoginPlayer={handleLoginPlayer}
        onLogoutPlayer={handleLogoutPlayer}
        roomId={roomId}
        notifPermission={notifPermission}
        onRequestNotifPermission={handleRequestNotifPermission}
      />
    </div>
  );
}
