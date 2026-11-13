import React, { useState, useEffect } from 'react';
import { X, Flame, RefreshCw, AlertTriangle, Check } from 'lucide-react';
import { buildPoolCourtSuggestions, getEntryDisplayName } from '../utils/poolTournament';

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
                      {eligibleMatches.map((m) => (
                        <option key={m.key} value={m.key}>
                          {m.label}
                        </option>
                      ))}
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
            disabled={selectedEntries.length === 0}
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
  numCourts = 2,
  playersById = {},
  onApply,
}) {
  const [selections, setSelections] = useState({});

  const totalCourts = Math.max(1, Number(numCourts) || 2);
  const liveByCourt = new Map();
  games.forEach((g, idx) => {
    if (g.inProgress && !g.saved && g.court) {
      liveByCourt.set(Number(g.court), { game: g, index: idx });
    }
  });

  const freeCourts = [];
  for (let c = 1; c <= totalCourts; c++) {
    if (!liveByCourt.has(c)) freeCourts.push(c);
  }

  const eligibleGames = games
    .map((g, idx) => ({ game: g, index: idx }))
    .filter(({ game }) => !game.saved && !game.inProgress);

  function gameLabel({ game, index }) {
    const namesA = (game.pairA || []).map((id) => playersById[id]?.name || '?').join(' & ');
    const namesB = (game.pairB || []).map((id) => playersById[id]?.name || '?').join(' & ');
    return `Game ${index + 1}: ${namesA} vs ${namesB}`;
  }

  function buildSuggestions() {
    const next = {};
    const usedIds = new Set();
    // Pass 1: pre-assigned court
    freeCourts.forEach((c) => {
      const pre = eligibleGames.find(({ game }) => Number(game.court) === c && !usedIds.has(game.id));
      if (pre) {
        next[c] = pre.game.id;
        usedIds.add(pre.game.id);
      }
    });
    // Pass 2: remaining games in order
    freeCourts.forEach((c) => {
      if (next[c]) return;
      const cand = eligibleGames.find(({ game }) => !usedIds.has(game.id));
      if (cand) {
        next[c] = cand.game.id;
        usedIds.add(cand.game.id);
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
  }, [isOpen, games, numCourts]);

  if (!isOpen) return null;

  const selectedList = Object.entries(selections)
    .filter(([, gameId]) => Boolean(gameId))
    .map(([courtStr, gameId]) => ({ court: Number(courtStr), gameId }));

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
              {freeCourts.map((courtNum) => (
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
                    {eligibleGames.map((item) => (
                      <option key={item.game.id} value={item.game.id}>
                        {gameLabel(item)}
                      </option>
                    ))}
                  </select>
                </div>
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
            disabled={selectedList.length === 0}
            onClick={() => {
              onApply(selectedList);
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
