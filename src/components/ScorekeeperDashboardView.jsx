import React, { useState, useEffect } from 'react';
import {
  Flame,
  Check,
  Pause,
  Play,
  Plus,
  Minus,
  Zap,
  ShieldAlert,
  ArrowLeft,
  LayoutGrid,
} from 'lucide-react';
import { LiveTimer } from './LiveTimer';
import {
  buildPoolCourtSuggestions,
  getEntryDisplayName,
  getEffectiveMatchFormat,
  evaluatePoolOrKnockoutMatch,
  resizeGamesForBestOf,
} from '../utils/poolTournament';
import { getBusyMlpPlayerIds, getMlpGamePlayerIds } from '../utils/tournament';

function PoolLiveCourtCard({
  courtNum,
  liveItem,
  tournament,
  onSavePoolMatch,
  onSaveKnockoutMatch,
  onPausePoolMatch,
  onPauseKnockoutMatch,
}) {
  const { match, stage, type, poolId, roundIdx, matchIdx, isBronze } = liveItem;
  const entryMap = new Map((tournament?.entries || []).map((e) => [e.id, e]));
  const entryA = entryMap.get(match.entryAId);
  const entryB = entryMap.get(match.entryBId);
  const nameA = getEntryDisplayName(entryA);
  const nameB = getEntryDisplayName(entryB);

  const totalRounds = tournament?.knockout?.rounds?.length || 1;
  const fmt = getEffectiveMatchFormat(tournament, match, {
    isKnockout: type === 'knockout',
    totalRounds,
    roundIdx: roundIdx || 0,
    isBronze: Boolean(isBronze),
  });

  const [games, setGames] = useState(() => resizeGamesForBestOf(match.games || [], fmt.bestOf));

  useEffect(() => {
    setGames(resizeGamesForBestOf(match.games || [], fmt.bestOf));
  }, [match.id, match.games, fmt.bestOf]);

  const evalRes = evaluatePoolOrKnockoutMatch(games, fmt.bestOf);

  function updateScore(gameIdx, side, val) {
    const clean = val.replace(/\D/g, '');
    setGames((prev) =>
      prev.map((g, idx) =>
        idx === gameIdx
          ? { ...g, [side === 'A' ? 'scoreA' : 'scoreB']: clean === '' ? '' : Number(clean) }
          : g
      )
    );
  }

  function stepScore(gameIdx, side, delta) {
    const key = side === 'A' ? 'scoreA' : 'scoreB';
    setGames((prev) =>
      prev.map((g, idx) => {
        if (idx !== gameIdx) return g;
        const curr = g[key] === '' || g[key] == null ? 0 : Number(g[key]);
        return { ...g, [key]: Math.max(0, curr + delta) };
      })
    );
  }

  function handleSave() {
    if (!evalRes.isComplete) return;
    const winnerId = evalRes.winnerSide === 'A' ? entryA?.id : entryB?.id;
    if (type === 'pool') {
      onSavePoolMatch(poolId, match.id, games, winnerId);
    } else {
      onSaveKnockoutMatch(roundIdx, matchIdx, games, winnerId, Boolean(isBronze));
    }
  }

  function handlePause() {
    if (type === 'pool') {
      onPausePoolMatch(poolId, match.id);
    } else {
      onPauseKnockoutMatch(roundIdx, matchIdx, Boolean(isBronze));
    }
  }

  return (
    <div className="bg-slate-900 border border-amber-500/40 rounded-3xl p-4 shadow-xl shadow-amber-500/5 flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono font-black bg-[#d7f24c] text-slate-950 px-2.5 py-0.5 rounded-full">
            Court {courtNum}
          </span>
          <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
            <Flame size={10} /> LIVE
            {match.liveStartedAt && (
              <LiveTimer startedAt={match.liveStartedAt} className="text-[10px] text-slate-950 font-black" />
            )}
          </span>
          <span className="text-[11px] font-bold text-slate-400">{stage}</span>
        </div>
        <button
          type="button"
          onClick={handlePause}
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 transition"
          title="Pause and free this court"
        >
          <Pause size={11} /> Pause
        </button>
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 space-y-1">
        <div className="text-sm font-bold text-white truncate">{nameA}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">vs</div>
        <div className="text-sm font-bold text-white truncate">{nameB}</div>
      </div>

      <div className="space-y-1.5">
        {games.map((g, gIdx) => (
          <div
            key={gIdx}
            className="flex items-center justify-between gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5"
          >
            <span className="text-[10px] font-mono font-bold text-slate-400">
              {fmt.bestOf > 1 ? `G${gIdx + 1}` : `to ${fmt.pointsTo}`}
            </span>
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => stepScore(gIdx, 'A', -1)}
                className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center active:scale-90 transition"
              >
                <Minus size={11} />
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={g.scoreA === '' ? '' : g.scoreA}
                onChange={(e) => updateScore(gIdx, 'A', e.target.value)}
                placeholder="0"
                className="w-10 bg-slate-800 border border-slate-700 rounded-lg py-1 text-center text-white font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
              />
              <button
                type="button"
                onClick={() => stepScore(gIdx, 'A', 1)}
                className="w-6 h-7 rounded-lg bg-[#d7f24c]/15 hover:bg-[#d7f24c]/25 border border-[#d7f24c]/40 text-[#d7f24c] flex items-center justify-center active:scale-90 transition"
              >
                <Plus size={11} />
              </button>
              <span className="text-slate-500 font-bold text-xs px-0.5">-</span>
              <button
                type="button"
                onClick={() => stepScore(gIdx, 'B', -1)}
                className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center active:scale-90 transition"
              >
                <Minus size={11} />
              </button>
              <input
                type="text"
                inputMode="numeric"
                value={g.scoreB === '' ? '' : g.scoreB}
                onChange={(e) => updateScore(gIdx, 'B', e.target.value)}
                placeholder="0"
                className="w-10 bg-slate-800 border border-slate-700 rounded-lg py-1 text-center text-white font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
              />
              <button
                type="button"
                onClick={() => stepScore(gIdx, 'B', 1)}
                className="w-6 h-7 rounded-lg bg-[#d7f24c]/15 hover:bg-[#d7f24c]/25 border border-[#d7f24c]/40 text-[#d7f24c] flex items-center justify-center active:scale-90 transition"
              >
                <Plus size={11} />
              </button>
            </div>
          </div>
        ))}
      </div>

      <button
        type="button"
        disabled={!evalRes.isComplete}
        onClick={handleSave}
        className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 ${
          evalRes.isComplete
            ? 'bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 shadow-lg shadow-[#d7f24c]/15'
            : 'bg-slate-800/70 text-slate-500 cursor-not-allowed'
        }`}
      >
        <Check size={14} /> Save Final Score
      </button>
    </div>
  );
}

function MlpLiveCourtCard({
  courtNum,
  liveItem,
  playersById,
  onSaveGameAt,
  onToggleGameLiveAt,
}) {
  const { round, idx, game, gameIndex, matchLabel } = liveItem;
  const [scoreA, setScoreA] = useState(game.scoreA ? String(game.scoreA) : '');
  const [scoreB, setScoreB] = useState(game.scoreB ? String(game.scoreB) : '');

  useEffect(() => {
    setScoreA(game.scoreA ? String(game.scoreA) : '');
    setScoreB(game.scoreB ? String(game.scoreB) : '');
  }, [game.id, game.scoreA, game.scoreB]);

  function getPlayerName(id) {
    const val = playersById[id];
    if (typeof val === 'string' && val.trim()) return val;
    if (val && typeof val === 'object' && val.name) return val.name;
    return `Player ${id}`;
  }

  const pairALabel = (game.pairA || []).map(getPlayerName).join(' & ');
  const pairBLabel = (game.pairB || []).map(getPlayerName).join(' & ');

  function step(side, delta) {
    if (side === 'A') {
      const next = Math.max(0, (Number(scoreA) || 0) + delta);
      setScoreA(String(next));
    } else {
      const next = Math.max(0, (Number(scoreB) || 0) + delta);
      setScoreB(String(next));
    }
  }

  const numA = Number(scoreA) || 0;
  const numB = Number(scoreB) || 0;
  const canSave = numA !== numB && (numA > 0 || numB > 0);

  return (
    <div className="bg-slate-900 border border-cyan-500/40 rounded-3xl p-4 shadow-xl shadow-cyan-500/5 flex flex-col justify-between gap-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span className="text-xs font-mono font-black bg-[#d7f24c] text-slate-950 px-2.5 py-0.5 rounded-full">
            Court {courtNum}
          </span>
          <span className="text-[10px] font-bold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
            <Play size={10} className="fill-current" /> LIVE
            {game.liveStartedAt && (
              <LiveTimer startedAt={game.liveStartedAt} className="text-[10px] text-cyan-200" />
            )}
          </span>
          <span className="text-[11px] font-bold text-slate-400">
            G{gameIndex + 1} &bull; {matchLabel}
          </span>
        </div>
        <button
          type="button"
          onClick={() => onToggleGameLiveAt(round, idx, game.id)}
          className="text-[11px] font-bold px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 flex items-center gap-1 transition"
        >
          <Pause size={11} /> Pause
        </button>
      </div>

      <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 space-y-1">
        <div className="text-sm font-bold text-white truncate">{pairALabel}</div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-slate-500">vs</div>
        <div className="text-sm font-bold text-white truncate">{pairBLabel}</div>
      </div>

      <div className="flex items-center justify-between gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2">
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step('A', -1)}
            className="w-7 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center active:scale-90"
          >
            <Minus size={12} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={scoreA}
            onChange={(e) => setScoreA(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className="w-12 bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-center text-white font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <button
            type="button"
            onClick={() => step('A', 1)}
            className="w-7 h-8 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 flex items-center justify-center active:scale-90"
          >
            <Plus size={12} />
          </button>
        </div>

        <span className="text-slate-500 font-bold">-</span>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => step('B', -1)}
            className="w-7 h-8 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center active:scale-90"
          >
            <Minus size={12} />
          </button>
          <input
            type="text"
            inputMode="numeric"
            value={scoreB}
            onChange={(e) => setScoreB(e.target.value.replace(/\D/g, ''))}
            placeholder="0"
            className="w-12 bg-slate-800 border border-slate-700 rounded-lg py-1.5 text-center text-white font-mono font-bold text-sm focus:outline-none focus:ring-1 focus:ring-cyan-400"
          />
          <button
            type="button"
            onClick={() => step('B', 1)}
            className="w-7 h-8 rounded-lg bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 flex items-center justify-center active:scale-90"
          >
            <Plus size={12} />
          </button>
        </div>
      </div>

      <button
        type="button"
        disabled={!canSave}
        onClick={() => onSaveGameAt(round, idx, game.id, numA, numB)}
        className={`w-full py-2.5 rounded-xl text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95 ${
          canSave
            ? 'bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-lg shadow-cyan-400/15'
            : 'bg-slate-800/70 text-slate-500 cursor-not-allowed'
        }`}
      >
        <Check size={14} /> Save Game Score
      </button>
    </div>
  );
}

export function ScorekeeperDashboardView({
  isAdmin,
  tournamentStyle = 'mlp',
  numCourts = 2,
  // Pools + Knockout props
  poolTournament = null,
  onSavePoolMatch,
  onTogglePoolMatchLive,
  onSaveKnockoutMatch,
  onToggleKnockoutMatchLive,
  onBatchAssignPoolCourtsLive,
  // MLP props
  bracket = null,
  teams = [],
  playersById = {},
  onSaveMlpGameAt,
  onToggleMlpGameLiveAt,
  onBatchAssignMlpCourtsLive,
  onBack,
}) {
  const [freeCourtChoices, setFreeCourtChoices] = useState({});

  if (!isAdmin) {
    return (
      <div className="max-w-lg mx-auto px-4 py-16 text-center space-y-3">
        <ShieldAlert size={36} className="mx-auto text-amber-400" />
        <h2 className="text-xl font-extrabold text-white">Scorekeeper Access Required</h2>
        <p className="text-sm text-slate-400">
          Unlock Scorekeeper / Admin mode with your Room PIN to use the live court dashboard.
        </p>
      </div>
    );
  }

  const totalCourts = Math.max(1, Number(numCourts) || 2);
  const isPoolsMode = tournamentStyle === 'tournament';

  // --- Pools + Knockout data ---
  let poolInfo = null;
  const poolLiveByCourt = new Map();
  if (isPoolsMode && poolTournament) {
    poolInfo = buildPoolCourtSuggestions(poolTournament, totalCourts);
    (poolTournament.pools || []).forEach((pool) => {
      (pool.matches || []).forEach((m) => {
        if (m.inProgress && !m.saved && m.court) {
          poolLiveByCourt.set(Number(m.court), {
            type: 'pool',
            poolId: pool.id,
            stage: `${pool.name} • R${m.round || 1}`,
            match: m,
          });
        }
      });
    });
    if (poolTournament.knockout?.rounds) {
      poolTournament.knockout.rounds.forEach((round, rIdx) => {
        round.forEach((m) => {
          if (m.inProgress && !m.saved && m.court) {
            poolLiveByCourt.set(Number(m.court), {
              type: 'knockout',
              roundIdx: rIdx,
              matchIdx: m.matchIdx,
              isBronze: false,
              stage: `KO R${rIdx + 1}`,
              match: m,
            });
          }
        });
      });
    }
    if (poolTournament.knockout?.bronzeMatch) {
      const bm = poolTournament.knockout.bronzeMatch;
      if (bm.inProgress && !bm.saved && bm.court) {
        poolLiveByCourt.set(Number(bm.court), {
          type: 'knockout',
          roundIdx: 0,
          matchIdx: 0,
          isBronze: true,
          stage: 'Bronze Medal',
          match: bm,
        });
      }
    }
  }

  // --- MLP data ---
  const mlpLiveByCourt = new Map();
  const mlpEligible = [];
  const mlpSuggestions = {};
  const mlpBusyPlayerIds = !isPoolsMode && bracket ? getBusyMlpPlayerIds(bracket) : new Set();
  if (!isPoolsMode && bracket && Array.isArray(bracket.rounds)) {
    const teamMap = new Map((teams || []).map((t) => [t.id, t.name]));
    const getPlayerName = (id) => {
      const val = playersById[id];
      if (typeof val === 'string' && val.trim()) return val;
      if (val && typeof val === 'object' && val.name) return val.name;
      return `Player ${id}`;
    };

    bracket.rounds.forEach((round, rIdx) => {
      round.forEach((m, mIdx) => {
        if (m.isBye || !m.games) return;
        const matchLabel = `${m.matchNumber ? `#${m.matchNumber} ` : ''}${teamMap.get(m.teamAId) || 'Team A'} vs ${teamMap.get(m.teamBId) || 'Team B'}`;
        m.games.forEach((g, gIdx) => {
          if (g.inProgress && !g.saved && g.court) {
            mlpLiveByCourt.set(Number(g.court), {
              round: rIdx,
              idx: mIdx,
              game: g,
              gameIndex: gIdx,
              matchLabel,
            });
          } else if (!g.saved && !g.inProgress && m.status !== 'complete') {
            const nA = (g.pairA || []).map(getPlayerName).join(' & ');
            const nB = (g.pairB || []).map(getPlayerName).join(' & ');
            mlpEligible.push({
              key: `${rIdx}:${mIdx}:${g.id}`,
              round: rIdx,
              idx: mIdx,
              gameId: g.id,
              gameIndex: gIdx,
              preCourt: g.court ? Number(g.court) : null,
              assignedCourts: m.assignedCourts || [],
              players: getMlpGamePlayerIds(g),
              label: `G${gIdx + 1} (${matchLabel}): ${nA} vs ${nB}`,
            });
          }
        });
      });
    });

    const usedMlpKeys = new Set();
    const plannedBusyPlayers = new Set(mlpBusyPlayerIds);
    const isMlpFreeOfConflict = (e) =>
      !usedMlpKeys.has(e.key) && !(e.players || []).some((pid) => plannedBusyPlayers.has(pid));
    const reserveMlp = (e) => {
      usedMlpKeys.add(e.key);
      (e.players || []).forEach((pid) => plannedBusyPlayers.add(pid));
    };

    for (let c = 1; c <= totalCourts; c++) {
      if (mlpLiveByCourt.has(c)) continue;
      const pre = mlpEligible.find((e) => e.preCourt === c && isMlpFreeOfConflict(e));
      const matchPref =
        pre ||
        mlpEligible.find((e) => (e.assignedCourts || []).includes(c) && isMlpFreeOfConflict(e));
      const next = matchPref || mlpEligible.find((e) => isMlpFreeOfConflict(e));
      if (next) {
        mlpSuggestions[c] = next.key;
        reserveMlp(next);
      }
    }
  }

  const activeSuggestions = isPoolsMode ? poolInfo?.suggestions || {} : mlpSuggestions;
  const activeEligible = isPoolsMode ? poolInfo?.eligibleMatches || [] : mlpEligible;
  const activeLiveMap = isPoolsMode ? poolLiveByCourt : mlpLiveByCourt;
  const liveBusyIds = isPoolsMode ? (poolInfo?.busyEntryIds || new Set()) : mlpBusyPlayerIds;
  const getParticipants = (item) =>
    isPoolsMode ? [item?.entryAId, item?.entryBId].filter(Boolean) : item?.players || [];

  const freeCourtNums = [];
  for (let c = 1; c <= totalCourts; c++) {
    if (!activeLiveMap.has(c)) freeCourtNums.push(c);
  }

  function getSelectedKeyForCourt(courtNum) {
    if (freeCourtChoices[courtNum] !== undefined) return freeCourtChoices[courtNum];
    return activeSuggestions[courtNum] || '';
  }

  function handleStartSingleCourt(courtNum) {
    const key = getSelectedKeyForCourt(courtNum);
    if (!key) return;
    const item = activeEligible.find((x) => x.key === key);
    if (!item) return;
    if (getParticipants(item).some((id) => liveBusyIds.has(id))) return;
    if (isPoolsMode) {
      onBatchAssignPoolCourtsLive([{ court: courtNum, ...item }]);
    } else {
      onBatchAssignMlpCourtsLive([
        { court: courtNum, round: item.round, idx: item.idx, gameId: item.gameId },
      ]);
    }
    setFreeCourtChoices((prev) => {
      const copy = { ...prev };
      delete copy[courtNum];
      return copy;
    });
  }

  function handleAutoStartAllFreeCourts() {
    const assignments = [];
    const batchBusy = new Set(liveBusyIds);
    const batchKeys = new Set();
    freeCourtNums.forEach((courtNum) => {
      const key = getSelectedKeyForCourt(courtNum);
      if (!key || batchKeys.has(key)) return;
      const obj = activeEligible.find((x) => x.key === key);
      if (!obj) return;
      const parts = getParticipants(obj);
      if (parts.some((id) => batchBusy.has(id))) return;
      batchKeys.add(key);
      parts.forEach((id) => batchBusy.add(id));
      if (isPoolsMode) {
        assignments.push({ court: courtNum, ...obj });
      } else {
        assignments.push({ court: courtNum, round: obj.round, idx: obj.idx, gameId: obj.gameId });
      }
    });
    if (assignments.length === 0) return;
    if (isPoolsMode) {
      onBatchAssignPoolCourtsLive(assignments);
    } else {
      onBatchAssignMlpCourtsLive(assignments);
    }
    setFreeCourtChoices({});
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-6">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-white text-2xl font-display uppercase tracking-wide font-extrabold flex items-center gap-2">
              <LayoutGrid size={22} className="text-[#d7f24c]" /> Scorekeeper Dashboard
            </h2>
            <span className="text-[11px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              {activeLiveMap.size}/{totalCourts} Courts Live
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            Assign matchups to open courts, monitor court timers, and enter final scores from one screen.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {freeCourtNums.length > 0 && activeEligible.length > 0 && (
            <button
              type="button"
              onClick={handleAutoStartAllFreeCourts}
              className="px-3.5 py-2 rounded-xl bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow-lg shadow-[#d7f24c]/15"
            >
              <Zap size={14} /> Start All Free Courts ({freeCourtNums.filter((c) => getSelectedKeyForCourt(c)).length})
            </button>
          )}
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition"
            >
              <ArrowLeft size={13} /> Back to Bracket
            </button>
          )}
        </div>
      </div>

      {/* Court Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 mb-8">
        {Array.from({ length: totalCourts }, (_, i) => i + 1).map((courtNum) => {
          const liveItem = activeLiveMap.get(courtNum);
          if (liveItem) {
            return isPoolsMode ? (
              <PoolLiveCourtCard
                key={courtNum}
                courtNum={courtNum}
                liveItem={liveItem}
                tournament={poolTournament}
                onSavePoolMatch={onSavePoolMatch}
                onSaveKnockoutMatch={onSaveKnockoutMatch}
                onPausePoolMatch={onTogglePoolMatchLive}
                onPauseKnockoutMatch={onToggleKnockoutMatchLive}
              />
            ) : (
              <MlpLiveCourtCard
                key={courtNum}
                courtNum={courtNum}
                liveItem={liveItem}
                playersById={playersById}
                onSaveGameAt={onSaveMlpGameAt}
                onToggleGameLiveAt={onToggleMlpGameLiveAt}
              />
            );
          }

          const selectedKey = getSelectedKeyForCourt(courtNum);
          return (
            <div
              key={courtNum}
              className="bg-slate-900/70 border border-slate-800 rounded-3xl p-4 flex flex-col justify-between gap-3"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-mono font-bold bg-slate-800 text-[#d7f24c] border border-slate-700 px-2.5 py-0.5 rounded-full">
                  Court {courtNum}
                </span>
                <span className="text-[11px] font-semibold text-emerald-400 bg-emerald-500/10 border border-emerald-500/20 px-2 py-0.5 rounded-full">
                  Available
                </span>
              </div>

              {activeEligible.length === 0 ? (
                <div className="py-6 text-center text-xs text-slate-500 italic">
                  No pending matchups waiting right now.
                </div>
              ) : (() => {
                const otherKeys = new Set();
                const otherBusy = new Set(liveBusyIds);
                freeCourtNums.forEach((otherC) => {
                  if (otherC === courtNum) return;
                  const ok = getSelectedKeyForCourt(otherC);
                  if (!ok) return;
                  otherKeys.add(ok);
                  const oi = activeEligible.find((x) => x.key === ok);
                  if (oi) getParticipants(oi).forEach((id) => otherBusy.add(id));
                });
                const selectedItem = selectedKey ? activeEligible.find((x) => x.key === selectedKey) : null;
                const selectedHasLiveConflict =
                  selectedItem && getParticipants(selectedItem).some((id) => liveBusyIds.has(id));
                return (
                <>
                  <div>
                    <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                      Select Matchup for Court {courtNum}
                    </label>
                    <select
                      value={selectedKey}
                      onChange={(e) =>
                        setFreeCourtChoices((prev) => ({ ...prev, [courtNum]: e.target.value }))
                      }
                      className="w-full bg-slate-950 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                    >
                      <option value="">— Choose Matchup —</option>
                      {activeEligible.map((m) => {
                        const isSelectedElsewhere = otherKeys.has(m.key);
                        const hasBusyParticipant = getParticipants(m).some((id) => otherBusy.has(id));
                        const isBlocked = isSelectedElsewhere || hasBusyParticipant;
                        const suffix = isSelectedElsewhere
                          ? ' (Selected on another court)'
                          : hasBusyParticipant
                            ? ' (Player on court)'
                            : '';
                        return (
                          <option key={m.key} value={m.key} disabled={isBlocked}>
                            {m.label}{suffix}
                          </option>
                        );
                      })}
                    </select>
                  </div>

                  <button
                    type="button"
                    disabled={!selectedKey || selectedHasLiveConflict}
                    onClick={() => handleStartSingleCourt(courtNum)}
                    className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-[#d7f24c] hover:text-slate-950 text-[#d7f24c] border border-[#d7f24c]/30 disabled:opacity-40 disabled:cursor-not-allowed text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95"
                  >
                    <Play size={13} className="fill-current" /> Start Live on Court {courtNum}
                  </button>
                </>
                );
              })()}
            </div>
          );
        })}
      </div>

      {/* Upcoming / Ready Queue */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
        <div className="flex items-center justify-between gap-2 mb-3">
          <h3 className="text-sm font-extrabold text-white uppercase tracking-wider">
            Ready / Upcoming Queue ({activeEligible.length})
          </h3>
          <span className="text-xs text-slate-400">
            Select a free court above to dispatch
          </span>
        </div>

        {activeEligible.length === 0 ? (
          <p className="text-xs text-slate-500 italic py-4 text-center">
            All available matchups are either live on court or completed.
          </p>
        ) : (
          <div className="overflow-x-auto max-h-72 overflow-y-auto">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-900 border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-2 px-3 font-bold">#</th>
                  <th className="py-2 px-3 font-bold">Matchup</th>
                  <th className="py-2 px-3 font-bold text-right">Pre-Assigned</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {activeEligible.map((item, idx) => (
                  <tr key={item.key} className="hover:bg-slate-950/60 transition">
                    <td className="py-2 px-3 font-mono text-slate-400">{idx + 1}</td>
                    <td className="py-2 px-3 font-semibold text-white">{item.label}</td>
                    <td className="py-2 px-3 text-right font-mono text-[#d7f24c]">
                      {(item.preAssignedCourt || item.preCourt)
                        ? `Court ${item.preAssignedCourt || item.preCourt}`
                        : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

