import React, { useState, useEffect } from 'react';
import { X, Flame, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { buildPoolCourtSuggestions, getEntryDisplayName } from '../utils/poolTournament';
import { getBusyMlpPlayerIds, getMlpGamePlayerIds, hasMlpPlayerConflict } from '../utils/tournament';
import { LiveTimer } from './LiveTimer';

export function PoolCourtAssignModal({
  isOpen,
  onClose,
  tournament,
  numCourts = 2,
  onApply,
}) {
  const [selections, setSelections] = useState({});

  const info = isOpen && tournament ? buildPoolCourtSuggestions(tournament, numCourts) : null;

  useEffect(() => {
    if (isOpen && info) {
      setSelections(info.suggestions || {});
    }
  }, [isOpen, tournament, numCourts]);

  if (!isOpen || !info) return null;

  const { totalCourts, liveByCourt, busyEntryIds, freeCourts, eligibleMatches, suggestions } = info;
  const entryMap = new Map((tournament?.entries || []).map((e) => [e.id, e]));
  const matchByKey = new Map(eligibleMatches.map((m) => [m.key, m]));

  // Count how many assignments have a selected match
  const selectedEntries = Object.entries(selections)
    .filter(([, key]) => Boolean(key) && matchByKey.has(key))
    .map(([courtStr, key]) => ({
      court: Number(courtStr),
      ...matchByKey.get(key),
    }));

  // Detect duplicate match selections or player conflicts
  const seenMatchKeys = new Set();
  const seenEntrants = new Set(busyEntryIds);
  const conflictWarnings = [];
  selectedEntries.forEach((item) => {
    if (seenMatchKeys.has(item.key)) {
      conflictWarnings.push(`"${item.shortLabel}" is selected for more than one court.`);
    }
    seenMatchKeys.add(item.key);
    if (seenEntrants.has(item.entryAId) || seenEntrants.has(item.entryBId)) {
      conflictWarnings.push(
        `Court ${item.court}: "${item.shortLabel}" includes a player/team already on another court.`
      );
    }
    seenEntrants.add(item.entryAId);
    seenEntrants.add(item.entryBId);
  });

  function handleAutoFill() {
    setSelections(suggestions || {});
  }

  function handleSubmit() {
    if (selectedEntries.length === 0) return;
    onApply(selectedEntries);
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Flame size={18} className="text-amber-400" />
              Assign Courts &amp; Mark Live
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalCourts} court{totalCourts === 1 ? '' : 's'} configured &bull;{' '}
              {freeCourts.length} available, {liveByCourt.size} currently live
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {/* Live Courts Summary */}
          {liveByCourt.size > 0 && (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 block">
                Currently On Court (Live)
              </span>
              {Array.from(liveByCourt.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([courtNum, { match, stage }]) => {
                  const nA = getEntryDisplayName(entryMap.get(match.entryAId));
                  const nB = getEntryDisplayName(entryMap.get(match.entryBId));
                  return (
                    <div
                      key={courtNum}
                      className="flex items-center justify-between gap-2 text-xs bg-slate-950/60 border border-amber-500/20 rounded-xl px-2.5 py-1.5"
                    >
                      <span className="font-mono font-bold text-amber-300 shrink-0">
                        Court {courtNum}
                      </span>
                      <span className="text-slate-200 truncate flex-1">
                        {nA} vs {nB}
                      </span>
                      {match.liveStartedAt && (
                        <LiveTimer
                          startedAt={match.liveStartedAt}
                          className="text-[10px] text-amber-300 bg-amber-500/10 border border-amber-500/20 px-1.5 py-0.5 rounded-full shrink-0"
                        />
                      )}
                      <span className="text-[10px] text-slate-400 shrink-0">{stage}</span>
                    </div>
                  );
                })}
            </div>
          )}

          {/* Available Courts Assignment */}
          {freeCourts.length === 0 ? (
            <div className="text-center py-6 bg-slate-950/50 border border-slate-800 rounded-2xl text-xs text-slate-400">
              All {totalCourts} courts already have live matches in progress. Save or pause a live match to free a court.
            </div>
          ) : eligibleMatches.length === 0 ? (
            <div className="text-center py-6 bg-slate-950/50 border border-slate-800 rounded-2xl text-xs text-slate-400">
              No pending ready-to-play matchups available right now.
            </div>
          ) : (
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">
                  Available Courts ({freeCourts.length})
                </span>
                <button
                  type="button"
                  onClick={handleAutoFill}
                  className="text-[11px] font-bold text-[#d7f24c] hover:text-white flex items-center gap-1 transition"
                >
                  <RefreshCw size={11} /> Auto-Fill Next Matches
                </button>
              </div>

              {freeCourts.map((courtNum) => {
                const designatedPool = (tournament?.pools || []).find((p) =>
                  (p.assignedCourts || []).includes(courtNum)
                );
                const otherSelectedKeys = new Set();
                const otherBusyEntryIds = new Set(busyEntryIds);
                Object.entries(selections).forEach(([cStr, k]) => {
                  if (Number(cStr) === courtNum || !k) return;
                  otherSelectedKeys.add(k);
                  const om = matchByKey.get(k);
                  if (om) {
                    if (om.entryAId) otherBusyEntryIds.add(om.entryAId);
                    if (om.entryBId) otherBusyEntryIds.add(om.entryBId);
                  }
                });
                return (
                  <div
                    key={courtNum}
                    className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 space-y-1.5"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-mono font-bold text-[#d7f24c]">
                        Court {courtNum}
                      </span>
                      {designatedPool && (
                        <span className="text-[10px] font-semibold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                          Default: {designatedPool.name}
                        </span>
                      )}
                    </div>
                    <select
                      value={selections[courtNum] || ''}
                      onChange={(e) =>
                        setSelections((prev) => ({
                          ...prev,
                          [courtNum]: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                    >
                      <option value="">— Leave Unassigned —</option>
                      {eligibleMatches.map((m) => {
                        const isSelectedElsewhere = otherSelectedKeys.has(m.key);
                        const hasBusyEntrant =
                          otherBusyEntryIds.has(m.entryAId) || otherBusyEntryIds.has(m.entryBId);
                        const isBlocked = isSelectedElsewhere || hasBusyEntrant;
                        const suffix = isSelectedElsewhere
                          ? ' (Selected on another court)'
                          : hasBusyEntrant
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
                );
              })}
            </div>
          )}

          {conflictWarnings.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 space-y-1">
              {conflictWarnings.map((w, i) => (
                <p key={i} className="text-[11px] text-rose-300 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedEntries.length === 0 || conflictWarnings.length > 0}
            onClick={handleSubmit}
            className="flex-[2] py-2.5 rounded-xl bg-[#d7f24c] hover:bg-[#c6e140] disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Check size={14} /> Assign Courts &amp; Mark Live ({selectedEntries.length})
          </button>
        </div>
      </div>
    </div>
  );
}

export function MlpCourtAssignModal({
  isOpen,
  onClose,
  games = [],
  bracket = null,
  teams = [],
  numCourts = 2,
  playersById = {},
  showAllBracketGames = false,
  onApply,
}) {
  const [selections, setSelections] = useState({});

  function getPlayerName(id) {
    const val = playersById[id];
    if (typeof val === 'string' && val.trim()) return val;
    if (val && typeof val === 'object' && val.name) return val.name;
    return `Player ${id}`;
  }

  const totalCourts = Math.max(1, Number(numCourts) || 2);
  const liveByCourt = new Map();
  const teamMap = new Map((teams || []).map((t) => [t.id, t.name]));
  const busyPlayerIds = bracket
    ? getBusyMlpPlayerIds(bracket)
    : (() => {
        const s = new Set();
        (games || []).forEach((g) => {
          if (g.inProgress && !g.saved) getMlpGamePlayerIds(g).forEach((pid) => s.add(pid));
        });
        return s;
      })();

  // Scan ALL matches in bracket (if provided) so courts live in any match are marked occupied
  if (bracket && Array.isArray(bracket.rounds)) {
    bracket.rounds.forEach((round) => {
      round.forEach((m) => {
        (m.games || []).forEach((g, gIdx) => {
          if (g.inProgress && !g.saved && g.court) {
            const ct = Number(g.court);
            const tA = teamMap.get(m.teamAId) || 'Team A';
            const tB = teamMap.get(m.teamBId) || 'Team B';
            const nA = (g.pairA || []).map(getPlayerName).join(' & ');
            const nB = (g.pairB || []).map(getPlayerName).join(' & ');
            liveByCourt.set(ct, {
              game: g,
              label: `G${gIdx + 1}: ${nA} vs ${nB}`,
              sublabel: `${tA} vs ${tB}`,
            });
          }
        });
      });
    });
  } else {
    games.forEach((g, idx) => {
      if (g.inProgress && !g.saved && g.court) {
        const nA = (g.pairA || []).map(getPlayerName).join(' & ');
        const nB = (g.pairB || []).map(getPlayerName).join(' & ');
        liveByCourt.set(Number(g.court), {
          game: g,
          label: `Game ${idx + 1}: ${nA} vs ${nB}`,
          sublabel: 'Active Match',
        });
      }
    });
  }

  const freeCourts = [];
  for (let c = 1; c <= totalCourts; c++) {
    if (!liveByCourt.has(c)) freeCourts.push(c);
  }

  let eligibleGames = [];
  if (showAllBracketGames && bracket && Array.isArray(bracket.rounds)) {
    bracket.rounds.forEach((round, rIdx) => {
      round.forEach((m, mIdx) => {
        if (m.isBye || !m.games || m.status === 'complete') return;
        const tA = teamMap.get(m.teamAId) || 'Team A';
        const tB = teamMap.get(m.teamBId) || 'Team B';
        const matchLabel = `${m.matchNumber ? `#${m.matchNumber} ` : ''}${tA} vs ${tB}`;
        m.games.forEach((g, gIdx) => {
          if (!g.saved && !g.inProgress) {
            eligibleGames.push({
              key: `${rIdx}:${mIdx}:${g.id}`,
              round: rIdx,
              idx: mIdx,
              game: g,
              index: gIdx,
              matchLabel,
              assignedCourts: m.assignedCourts || [],
            });
          }
        });
      });
    });
  } else {
    eligibleGames = games
      .map((g, idx) => ({
        key: g.id,
        game: g,
        index: idx,
        assignedCourts: [],
      }))
      .filter(({ game }) => !game.saved && !game.inProgress);
  }

  function gameLabel(item) {
    const namesA = (item.game.pairA || []).map(getPlayerName).join(' & ');
    const namesB = (item.game.pairB || []).map(getPlayerName).join(' & ');
    const prefix = item.matchLabel ? `${item.matchLabel} • G${item.index + 1}` : `Game ${item.index + 1}`;
    return `${prefix}: ${namesA} vs ${namesB}`;
  }

  function buildSuggestions() {
    const next = {};
    const usedKeys = new Set();
    const plannedBusyPlayers = new Set(busyPlayerIds);
    const isFreeOfConflict = (item) =>
      !usedKeys.has(item.key) && !hasMlpPlayerConflict(item.game, plannedBusyPlayers);
    const reserveItem = (item) => {
      usedKeys.add(item.key);
      getMlpGamePlayerIds(item.game).forEach((pid) => plannedBusyPlayers.add(pid));
    };

    // Pass 1: pre-assigned court or matchup's designated courts
    freeCourts.forEach((c) => {
      const exactPre = eligibleGames.find(
        (item) => Number(item.game.court) === c && isFreeOfConflict(item)
      );
      const matchPref =
        exactPre ||
        eligibleGames.find(
          (item) => (item.assignedCourts || []).includes(c) && isFreeOfConflict(item)
        );
      if (matchPref) {
        next[c] = matchPref.key;
        reserveItem(matchPref);
      }
    });
    // Pass 2: remaining games in order
    freeCourts.forEach((c) => {
      if (next[c]) return;
      const cand = eligibleGames.find((item) => isFreeOfConflict(item));
      if (cand) {
        next[c] = cand.key;
        reserveItem(cand);
      } else {
        next[c] = '';
      }
    });
    return next;
  }

  useEffect(() => {
    if (isOpen) {
      setSelections(buildSuggestions());
    }
  }, [isOpen, games, bracket, numCourts, showAllBracketGames]);

  if (!isOpen) return null;

  const eligibleByKey = new Map(eligibleGames.map((item) => [item.key, item]));
  const selectedList = Object.entries(selections)
    .filter(([, key]) => Boolean(key) && eligibleByKey.has(key))
    .map(([courtStr, key]) => {
      const item = eligibleByKey.get(key);
      return {
        court: Number(courtStr),
        key,
        item,
        gameId: item.game.id,
        round: item.round,
        idx: item.idx,
      };
    });

  const seenGameKeys = new Set();
  const seenPlayerIds = new Set(busyPlayerIds);
  const conflictWarnings = [];
  selectedList.forEach(({ court, key, item }) => {
    if (seenGameKeys.has(key)) {
      conflictWarnings.push(`"${gameLabel(item)}" is selected for more than one court.`);
    }
    seenGameKeys.add(key);
    const pIds = getMlpGamePlayerIds(item.game);
    if (pIds.some((pid) => seenPlayerIds.has(pid))) {
      conflictWarnings.push(
        `Court ${court}: "${gameLabel(item)}" includes a player already playing on another court.`
      );
    }
    pIds.forEach((pid) => seenPlayerIds.add(pid));
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl max-h-[90vh] flex flex-col">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h3 className="text-lg font-extrabold text-white flex items-center gap-2">
              <Flame size={18} className="text-cyan-400" />
              Assign Courts &amp; Mark Live
            </h3>
            <p className="text-xs text-slate-400 mt-0.5">
              {totalCourts} court{totalCourts === 1 ? '' : 's'} configured &bull;{' '}
              {freeCourts.length} available, {liveByCourt.size} currently live
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        <div className="overflow-y-auto space-y-4 pr-1 flex-1">
          {liveByCourt.size > 0 && (
            <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-3 space-y-1.5">
              <span className="text-[11px] font-bold uppercase tracking-wider text-cyan-300 block">
                Currently On Court (Live)
              </span>
              {Array.from(liveByCourt.entries())
                .sort((a, b) => a[0] - b[0])
                .map(([courtNum, { game, label, sublabel }]) => (
                  <div
                    key={courtNum}
                    className="flex items-center justify-between gap-2 text-xs bg-slate-950/60 border border-cyan-500/20 rounded-xl px-2.5 py-1.5"
                  >
                    <span className="font-mono font-bold text-cyan-300 shrink-0">
                      Court {courtNum}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="text-slate-200 truncate">{label}</div>
                      {sublabel && <div className="text-[10px] text-slate-500 truncate">{sublabel}</div>}
                    </div>
                    {game.liveStartedAt && (
                      <LiveTimer
                        startedAt={game.liveStartedAt}
                        className="text-[10px] text-cyan-300 bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full shrink-0"
                      />
                    )}
                  </div>
                ))}
            </div>
          )}

          {freeCourts.length === 0 ? (
            <div className="text-center py-6 bg-slate-950/50 border border-slate-800 rounded-2xl text-xs text-slate-400">
              All {totalCourts} courts already have live games in progress.
            </div>
          ) : eligibleGames.length === 0 ? (
            <div className="text-center py-6 bg-slate-950/50 border border-slate-800 rounded-2xl text-xs text-slate-400">
              No upcoming games left to assign.
            </div>
          ) : (
            <div className="space-y-2.5">
              {freeCourts.map((courtNum) => {
                const otherSelectedKeys = new Set();
                const otherBusyPlayers = new Set(busyPlayerIds);
                Object.entries(selections).forEach(([cStr, k]) => {
                  if (Number(cStr) === courtNum || !k) return;
                  otherSelectedKeys.add(k);
                  const oi = eligibleByKey.get(k);
                  if (oi) {
                    getMlpGamePlayerIds(oi.game).forEach((pid) => otherBusyPlayers.add(pid));
                  }
                });
                return (
                  <div
                    key={courtNum}
                    className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 space-y-1.5"
                  >
                    <span className="text-xs font-mono font-bold text-[#d7f24c] block">
                      Court {courtNum}
                    </span>
                    <select
                      value={selections[courtNum] || ''}
                      onChange={(e) =>
                        setSelections((prev) => ({
                          ...prev,
                          [courtNum]: e.target.value,
                        }))
                      }
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                    >
                      <option value="">— Leave Unassigned —</option>
                      {eligibleGames.map((item) => {
                        const isSelectedElsewhere = otherSelectedKeys.has(item.key);
                        const hasBusyPlayer = hasMlpPlayerConflict(item.game, otherBusyPlayers);
                        const isBlocked = isSelectedElsewhere || hasBusyPlayer;
                        const suffix = isSelectedElsewhere
                          ? ' (Selected on another court)'
                          : hasBusyPlayer
                            ? ' (Player on court)'
                            : '';
                        return (
                          <option key={item.key} value={item.key} disabled={isBlocked}>
                            {gameLabel(item)}{suffix}
                          </option>
                        );
                      })}
                    </select>
                  </div>
                );
              })}
            </div>
          )}

          {conflictWarnings.length > 0 && (
            <div className="bg-rose-500/10 border border-rose-500/30 rounded-2xl p-3 space-y-1">
              {conflictWarnings.map((w, i) => (
                <p key={i} className="text-[11px] text-rose-300 flex items-start gap-1.5">
                  <AlertTriangle size={13} className="shrink-0 mt-0.5" />
                  <span>{w}</span>
                </p>
              ))}
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 pt-4 mt-4 border-t border-slate-800">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-bold transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={selectedList.length === 0 || conflictWarnings.length > 0}
            onClick={() => {
              onApply(selectedList.map(({ court, gameId, round, idx }) => ({ court, gameId, round, idx })));
              onClose();
            }}
            className="flex-[2] py-2.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 disabled:opacity-40 disabled:cursor-not-allowed text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95"
          >
            <Check size={14} /> Assign Courts &amp; Mark Live ({selectedList.length})
          </button>
        </div>
      </div>
    </div>
  );
}

