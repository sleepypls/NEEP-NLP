import React, { useState, useEffect } from 'react';
import {
  Trophy,
  Swords,
  Check,
  Download,
  Play,
  Award,
  Flame,
  ArrowRight,
  RefreshCw,
  Pencil,
  Settings,
  BarChart3,
  Plus,
  Minus,
  ChevronDown,
  ChevronUp,
} from 'lucide-react';
import {
  getEntryDisplayName,
  computePoolStandings,
  evaluatePoolOrKnockoutMatch,
  getKnockoutRoundLabel,
  getEffectiveMatchFormat,
  resizeGamesForBestOf,
  generatePoolStandingsCSV,
  generatePoolAndKnockoutMatchesCSV,
  computeTournamentPlayerStats,
  generateTournamentLeaderboardCSV,
  TIEBREAKER_CRITERIA_LABELS,
  DEFAULT_TIEBREAKER_RULES,
} from '../utils/poolTournament';
import { triggerCsvDownload } from '../utils/tournament';
import { getCourtDisplayName } from '../utils/courtNames';
import { EditPoolMatchModal } from './EditPoolMatchModal';
import { PoolCourtAssignModal } from './CourtAssignModal';
import { LiveTimer } from './LiveTimer';

function MatchScoreEditor({
  match,
  entryA,
  entryB,
  bestOf,
  pointsTo,
  isCustomFormat,
  numCourts = 2,
  courtNames = {},
  onSetCourt,
  onSave,
  onToggleLive,
  onEditMatchup,
  isAdmin,
}) {
  const [games, setGames] = useState(() => resizeGamesForBestOf(match.games || [], bestOf));

  useEffect(() => {
    setGames(resizeGamesForBestOf(match.games || [], bestOf));
  }, [match.id, match.games, bestOf]);

  const evalRes = evaluatePoolOrKnockoutMatch(games, bestOf);
  const nameA = getEntryDisplayName(entryA);
  const nameB = getEntryDisplayName(entryB);

  function updateScore(gameIdx, side, val) {
    const clean = val.replace(/\D/g, '');
    setGames((prev) =>
      prev.map((g, idx) =>
        idx === gameIdx ? { ...g, [side === 'A' ? 'scoreA' : 'scoreB']: clean === '' ? '' : Number(clean) } : g
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

  return (
    <div
      className={`rounded-2xl border p-3.5 transition ${
        match.saved
          ? 'bg-slate-900/70 border-slate-800'
          : match.inProgress
          ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
          : 'bg-slate-950/60 border-slate-800/90'
      }`}
    >
      <div className="flex items-center justify-between gap-2 mb-2.5">
        <div className="flex items-center gap-1.5 min-w-0 flex-wrap">
          {match.round && (
            <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
              R{match.round}
            </span>
          )}
          {(match.seedLabelA || match.seedLabelB) && (
            <span className="text-[10px] font-mono font-bold bg-slate-800 text-[#d7f24c] px-2 py-0.5 rounded-md">
              {match.seedLabelA || 'TBD'} vs {match.seedLabelB || 'TBD'}
            </span>
          )}
          {match.court && (
            <span className="text-[10px] font-mono font-bold bg-[#d7f24c]/15 text-[#d7f24c] border border-[#d7f24c]/30 px-2 py-0.5 rounded-md">
              {getCourtDisplayName(match.court, courtNames)}
            </span>
          )}
          {isCustomFormat && (
            <span className="text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-md">
              {bestOf > 1 ? `Bo${bestOf}` : '1G'} &bull; {pointsTo}pts
            </span>
          )}
          {match.inProgress && !match.saved && (
            <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <Flame size={10} /> LIVE
              {match.liveStartedAt && <LiveTimer startedAt={match.liveStartedAt} className="text-[10px] text-slate-950 font-black" />}
            </span>
          )}
          {match.saved && (
            <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check size={10} /> Final
            </span>
          )}
        </div>

        {isAdmin && (
          <div className="flex items-center gap-1.5 shrink-0">
            {onSetCourt && entryA && entryB && (
              <select
                value={match.court || ''}
                onChange={(e) => onSetCourt(e.target.value ? Number(e.target.value) : null)}
                aria-label="Assign Court"
                className="bg-slate-800 border border-slate-700 rounded-lg px-1.5 py-1 text-[11px] font-bold text-[#d7f24c] focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
              >
                <option value="">Ct —</option>
                {Array.from(
                  { length: Math.max(Number(numCourts) || 2, Number(match.court) || 0, 1) },
                  (_, i) => i + 1
                ).map((c) => (
                  <option key={c} value={c}>
                    {getCourtDisplayName(c, courtNames)}
                  </option>
                ))}
              </select>
            )}
            {onEditMatchup && (
              <button
                type="button"
                onClick={onEditMatchup}
                title="Edit matchup or scoring format"
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-[#d7f24c] border border-slate-700 transition"
              >
                <Pencil size={12} />
              </button>
            )}
            {!match.saved && entryA && entryB && onToggleLive && (
              <button
                type="button"
                onClick={onToggleLive}
                className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition ${
                  match.inProgress
                    ? 'bg-amber-400/20 text-amber-300 border-amber-400/40'
                    : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                }`}
              >
                {match.inProgress ? 'On Court' : 'Mark Live'}
              </button>
            )}
          </div>
        )}
      </div>

      {/* Matchup Teams */}
      <div className="space-y-1.5 mb-3">
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm font-bold truncate ${
              match.winnerId && match.winnerId === entryA?.id
                ? 'text-[#d7f24c]'
                : entryA
                ? 'text-white'
                : 'text-slate-500 italic'
            }`}
          >
            {nameA} {match.winnerId && match.winnerId === entryA?.id && '✓'}
          </span>
          {bestOf > 1 && (
            <span className="text-xs font-mono font-bold text-slate-400">
              {evalRes.gamesWonA}G
            </span>
          )}
        </div>
        <div className="flex items-center justify-between gap-2">
          <span
            className={`text-sm font-bold truncate ${
              match.winnerId && match.winnerId === entryB?.id
                ? 'text-[#d7f24c]'
                : entryB
                ? 'text-white'
                : 'text-slate-500 italic'
            }`}
          >
            {nameB} {match.winnerId && match.winnerId === entryB?.id && '✓'}
          </span>
          {bestOf > 1 && (
            <span className="text-xs font-mono font-bold text-slate-400">
              {evalRes.gamesWonB}G
            </span>
          )}
        </div>
      </div>

      {/* Game Score Inputs */}
      {entryA && entryB && (
        <div className="space-y-2">
          <div className="grid grid-cols-1 gap-2">
            {games.map((g, gIdx) => (
              <div
                key={gIdx}
                className="flex items-center justify-between gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5"
              >
                <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0">
                  {bestOf > 1 ? `G${gIdx + 1}` : `to ${pointsTo}`}
                </span>
                <div className="flex items-center gap-1.5">
                  {isAdmin && match.inProgress && !match.saved && (
                    <button
                      type="button"
                      onClick={() => stepScore(gIdx, 'A', -1)}
                      className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center active:scale-90 transition"
                      aria-label="Decrease Side A score"
                    >
                      <Minus size={11} />
                    </button>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!isAdmin}
                    value={g.scoreA === '' ? '' : g.scoreA}
                    onChange={(e) => updateScore(gIdx, 'A', e.target.value)}
                    placeholder="0"
                    className="w-11 bg-slate-800 border border-slate-700 rounded-lg py-1 text-center text-white font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#d7f24c] disabled:opacity-70"
                  />
                  {isAdmin && match.inProgress && !match.saved && (
                    <button
                      type="button"
                      onClick={() => stepScore(gIdx, 'A', 1)}
                      className="w-6 h-7 rounded-lg bg-[#d7f24c]/15 hover:bg-[#d7f24c]/25 border border-[#d7f24c]/40 text-[#d7f24c] flex items-center justify-center active:scale-90 transition"
                      aria-label="Increase Side A score"
                    >
                      <Plus size={11} />
                    </button>
                  )}
                  <span className="text-slate-500 font-bold text-xs">-</span>
                  {isAdmin && match.inProgress && !match.saved && (
                    <button
                      type="button"
                      onClick={() => stepScore(gIdx, 'B', -1)}
                      className="w-6 h-7 rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 text-slate-300 flex items-center justify-center active:scale-90 transition"
                      aria-label="Decrease Side B score"
                    >
                      <Minus size={11} />
                    </button>
                  )}
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!isAdmin}
                    value={g.scoreB === '' ? '' : g.scoreB}
                    onChange={(e) => updateScore(gIdx, 'B', e.target.value)}
                    placeholder="0"
                    className="w-11 bg-slate-800 border border-slate-700 rounded-lg py-1 text-center text-white font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#d7f24c] disabled:opacity-70"
                  />
                  {isAdmin && match.inProgress && !match.saved && (
                    <button
                      type="button"
                      onClick={() => stepScore(gIdx, 'B', 1)}
                      className="w-6 h-7 rounded-lg bg-[#d7f24c]/15 hover:bg-[#d7f24c]/25 border border-[#d7f24c]/40 text-[#d7f24c] flex items-center justify-center active:scale-90 transition"
                      aria-label="Increase Side B score"
                    >
                      <Plus size={11} />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {isAdmin && (
            <button
              type="button"
              disabled={!evalRes.isComplete}
              onClick={() => onSave(games, evalRes.winnerSide === 'A' ? entryA.id : entryB.id)}
              className={`w-full py-2 rounded-xl text-xs font-black transition active:scale-95 ${
                evalRes.isComplete
                  ? match.saved
                    ? 'bg-slate-800 hover:bg-slate-750 text-[#d7f24c] border border-[#d7f24c]/30'
                    : 'bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 shadow-md shadow-[#d7f24c]/15'
                  : 'bg-slate-800/60 text-slate-500 cursor-not-allowed'
              }`}
            >
              {match.saved ? 'Update Score' : 'Save Match Score'}
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export function PoolPlayView({
  tournament,
  numCourts = 2,
  courtNames = {},
  roomId,
  onSavePoolMatch,
  onTogglePoolMatchLive,
  onSetPoolMatchCourt,
  onEditPoolMatch,
  onGenerateKnockout,
  onSaveKnockoutMatch,
  onToggleKnockoutMatchLive,
  onSetKnockoutMatchCourt,
  onEditKnockoutMatch,
  onBatchAssignCourtsLive,
  onOpenSetup,
  isAdmin,
  forcedTab = null,
  hideStageTabs = false,
}) {
  const hasPools = Boolean(tournament?.pools && tournament.pools.length > 0 && tournament?.structure !== 'knockout_only');
  const [activeTab, setActiveTab] = useState(!hasPools || tournament?.knockout ? 'knockout' : 'pools');
  const [selectedPoolId, setSelectedPoolId] = useState('all');
  const [expandedPoolIds, setExpandedPoolIds] = useState(() => new Set());
  const [editingMatchCtx, setEditingMatchCtx] = useState(null);

  function togglePoolSchedule(poolId) {
    setExpandedPoolIds((prev) => {
      const next = new Set(prev);
      if (next.has(poolId)) next.delete(poolId);
      else next.add(poolId);
      return next;
    });
  }
  const [leaderboardMode, setLeaderboardMode] = useState('entries');
  const [isCourtAssignOpen, setIsCourtAssignOpen] = useState(false);

  useEffect(() => {
    if (!hasPools) {
      setActiveTab('knockout');
    }
  }, [hasPools]);

  if (!tournament) return null;

  const {
    structure = 'pools_knockout',
    discipline = 'doubles',
    entries = [],
    pools = [],
    poolFormat = { bestOf: 1, pointsTo: 15 },
    knockoutFormat = { bestOf: 3, pointsTo: 11 },
    advancePerPool = 2,
    knockoutFillMode = 'byes',
    knockout = null,
  } = tournament;

  const isKnockoutOnly = structure === 'knockout_only' || pools.length === 0;
  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const totalPoolMatches = pools.reduce((sum, p) => sum + (p.matches?.length || 0), 0);
  const completedPoolMatches = pools.reduce(
    (sum, p) => sum + (p.matches?.filter((m) => m.saved).length || 0),
    0
  );
  const allPoolsComplete = totalPoolMatches > 0 && completedPoolMatches === totalPoolMatches;

  const visiblePools =
    selectedPoolId === 'all' ? pools : pools.filter((p) => p.id === selectedPoolId);

  const resolvedTab = forcedTab || activeTab;
  const effectiveTab = isKnockoutOnly && resolvedTab === 'pools' ? 'knockout' : resolvedTab;
  const { entryStats, playerStats } = computeTournamentPlayerStats(tournament);
  const activeLeaderboardRows =
    discipline === 'doubles' && leaderboardMode === 'players' ? playerStats : entryStats;

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24 animate-in fade-in duration-200">
      {/* Header & CSV Exports */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-white text-2xl sm:text-3xl font-display uppercase tracking-wide font-semibold">
              {discipline === 'doubles' ? 'Doubles' : 'Singles'} Tournament
            </h2>
            {isKnockoutOnly ? (
              <span className="text-[10px] font-mono font-bold bg-amber-500/15 text-amber-300 border border-amber-500/30 px-2.5 py-0.5 rounded-full">
                Knockout Only
              </span>
            ) : (
              <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                {completedPoolMatches}/{totalPoolMatches} Pool Matches
              </span>
            )}
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {!isKnockoutOnly && (
              <>
                Pool Play: {poolFormat.bestOf > 1 ? `Best of ${poolFormat.bestOf}` : '1 Game'} to {poolFormat.pointsTo} &bull;{' '}
              </>
            )}
            Knockout:{' '}
            {knockoutFormat.useRoundFormats
              ? 'Custom Per-Round Formats'
              : `${knockoutFormat.bestOf > 1 ? `Best of ${knockoutFormat.bestOf}` : '1 Game'} to ${knockoutFormat.pointsTo}`}
            {!isKnockoutOnly && (
              <>
                {' '}
                &bull; Top {advancePerPool}/pool advance
                {knockoutFillMode === 'wildcards' ? ' + Wildcards' : ' (Top Seeds BYE)'}
              </>
            )}
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && onBatchAssignCourtsLive && (
            <button
              type="button"
              onClick={() => setIsCourtAssignOpen(true)}
              className="px-3 py-2 rounded-xl bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow-lg shadow-[#d7f24c]/15"
              title="Assign next matchups to available courts and mark them live"
            >
              <Flame size={13} /> Assign Courts &amp; Mark Live
            </button>
          )}
          {isAdmin && onOpenSetup && (
            <button
              type="button"
              onClick={onOpenSetup}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-700 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
              title="Edit tournament rules, formats, or entries"
            >
              <Settings size={13} className="text-[#d7f24c]" /> Edit Settings
            </button>
          )}
          {isAdmin && !isKnockoutOnly && (
            <button
              type="button"
              onClick={() => {
                const csv = generatePoolStandingsCSV(tournament, roomId);
                triggerCsvDownload(`${roomId || 'room'}-pool-standings.csv`, csv);
              }}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[#d7f24c] text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <Download size={13} /> Standings CSV
            </button>
          )}
          {isAdmin && (
            <button
              type="button"
              onClick={() => {
                const csv = generatePoolAndKnockoutMatchesCSV(tournament, roomId);
                triggerCsvDownload(`${roomId || 'room'}-tournament-matches.csv`, csv);
              }}
              className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <Download size={13} className="text-[#d7f24c]" /> Matches CSV
            </button>
          )}
        </div>
      </div>

      {/* Live On Court Banner (with Live Timer) */}
      {(() => {
        const liveNow = [];
        (pools || []).forEach((pool) => {
          (pool.matches || []).forEach((m) => {
            if (m.inProgress && !m.saved) {
              liveNow.push({
                key: `pool-${pool.id}-${m.id}`,
                court: m.court,
                stage: `${pool.name} • R${m.round || 1}`,
                nameA: getEntryDisplayName(entryMap.get(m.entryAId)),
                nameB: getEntryDisplayName(entryMap.get(m.entryBId)),
                liveStartedAt: m.liveStartedAt,
              });
            }
          });
        });
        if (knockout?.rounds) {
          const totalR = knockout.rounds.length;
          knockout.rounds.forEach((round, rIdx) => {
            const rLabel = getKnockoutRoundLabel(totalR, rIdx);
            round.forEach((m, mIdx) => {
              if (!m.isBye && m.inProgress && !m.saved) {
                liveNow.push({
                  key: `ko-${rIdx}-${mIdx}`,
                  court: m.court,
                  stage: rLabel,
                  nameA: getEntryDisplayName(entryMap.get(m.entryAId)),
                  nameB: getEntryDisplayName(entryMap.get(m.entryBId)),
                  liveStartedAt: m.liveStartedAt,
                });
              }
            });
          });
        }
        if (knockout?.bronzeMatch && knockout.bronzeMatch.inProgress && !knockout.bronzeMatch.saved) {
          const bm = knockout.bronzeMatch;
          liveNow.push({
            key: 'ko-bronze',
            court: bm.court,
            stage: 'Bronze Medal',
            nameA: getEntryDisplayName(entryMap.get(bm.entryAId)),
            nameB: getEntryDisplayName(entryMap.get(bm.entryBId)),
            liveStartedAt: bm.liveStartedAt,
          });
        }
        if (liveNow.length === 0) return null;
        liveNow.sort((a, b) => (a.court || 999) - (b.court || 999));
        return (
          <div className="mb-5 bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-amber-300 flex items-center gap-1.5">
                <Flame size={13} className="animate-pulse" /> Live On Court ({liveNow.length})
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {liveNow.map((item) => (
                <div
                  key={item.key}
                  className="bg-slate-950/70 border border-amber-500/25 rounded-xl px-3 py-2 flex items-center justify-between gap-2 text-xs"
                >
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-1.5 mb-0.5">
                      {item.court && (
                        <span className="text-[10px] font-mono font-black bg-[#d7f24c] text-slate-950 px-1.5 py-0.5 rounded">
                          {getCourtDisplayName(item.court, courtNames)}
                        </span>
                      )}
                      <span className="text-[10px] text-slate-400 font-semibold truncate">
                        {item.stage}
                      </span>
                    </div>
                    <div className="text-white font-semibold truncate">
                      {item.nameA} <span className="text-slate-500">vs</span> {item.nameB}
                    </div>
                  </div>
                  {item.liveStartedAt && (
                    <LiveTimer
                      startedAt={item.liveStartedAt}
                      className="text-[11px] font-black text-amber-300 bg-amber-500/15 border border-amber-500/30 px-2 py-0.5 rounded-full shrink-0"
                    />
                  )}
                </div>
              ))}
            </div>
          </div>
        );
      })()}

      {/* Main Stage Tabs: Pools vs Knockout vs Leaderboard */}
      {!hideStageTabs && (
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        {!isKnockoutOnly ? (
          <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 w-full max-w-lg shadow-lg">
            <button
              type="button"
              onClick={() => setActiveTab('pools')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                effectiveTab === 'pools'
                  ? 'bg-[#d7f24c] text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Swords size={14} /> Pool Play ({pools.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('knockout')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                effectiveTab === 'knockout'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy size={14} /> Knockout Bracket
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                effectiveTab === 'leaderboard'
                  ? 'bg-emerald-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 size={14} /> Leaderboard
            </button>
          </div>
        ) : (
          <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 w-full max-w-sm shadow-lg">
            <button
              type="button"
              onClick={() => setActiveTab('knockout')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                effectiveTab === 'knockout'
                  ? 'bg-amber-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Trophy size={14} /> Knockout Bracket
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('leaderboard')}
              className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                effectiveTab === 'leaderboard'
                  ? 'bg-emerald-400 text-slate-950 shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <BarChart3 size={14} /> Leaderboard
            </button>
          </div>
        )}

        {isAdmin && (
          <button
            type="button"
            onClick={() => {
              onGenerateKnockout();
              setActiveTab('knockout');
            }}
            className={`px-4 py-2.5 rounded-2xl text-xs font-black flex items-center gap-1.5 transition active:scale-95 shadow-lg ${
              allPoolsComplete
                ? 'bg-amber-400 hover:bg-amber-300 text-slate-950 shadow-amber-400/20'
                : 'bg-slate-800 hover:bg-slate-750 text-amber-300 border border-amber-500/30'
            }`}
          >
            {knockout ? <RefreshCw size={14} /> : <Play size={14} />}
            <span>
              {isKnockoutOnly
                ? 'Re-Seed Knockout Bracket'
                : knockout
                  ? 'Re-Seed Knockout from Standings'
                  : 'Advance to Knockout Bracket'}
            </span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>
      )}

      {/* POOLS TAB */}
      {effectiveTab === 'pools' && (
        <div className="space-y-6">
          {pools.length > 1 && (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1">
              <button
                type="button"
                onClick={() => setSelectedPoolId('all')}
                className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                  selectedPoolId === 'all'
                    ? 'bg-slate-800 text-white border border-slate-700'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                All Pools
              </button>
              {pools.map((p) => (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => setSelectedPoolId(p.id)}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold transition whitespace-nowrap ${
                    selectedPoolId === p.id
                      ? 'bg-slate-800 text-[#d7f24c] border border-[#d7f24c]/40'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {p.name}
                </button>
              ))}
            </div>
          )}

          {visiblePools.map((pool) => {
            const standings = computePoolStandings(
              pool,
              entries,
              poolFormat.bestOf,
              tournament?.tiebreakerRules
            );
            const isScheduleExpanded = expandedPoolIds.has(pool.id);
            return (
              <div
                key={pool.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-4"
              >
                <div
                  role="button"
                  tabIndex={0}
                  onClick={() => togglePoolSchedule(pool.id)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      togglePoolSchedule(pool.id);
                    }
                  }}
                  className="cursor-pointer select-none space-y-4 group"
                  title={isScheduleExpanded ? 'Click to hide pool schedule' : 'Click to show pool schedule'}
                >
                  <div className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-lg font-black text-white font-display uppercase tracking-wide group-hover:text-[#d7f24c] transition">
                        {pool.name}
                      </h3>
                      {Array.isArray(pool.assignedCourts) && pool.assignedCourts.length > 0 && (
                        <span className="text-[10px] font-mono font-bold bg-[#d7f24c]/15 text-[#d7f24c] border border-[#d7f24c]/30 px-2 py-0.5 rounded-full">
                          {pool.assignedCourts.map((c) => getCourtDisplayName(c, courtNames)).join(', ')}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs text-slate-400 font-semibold">
                        Top {advancePerPool} qualify
                      </span>
                      <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2.5 py-1 rounded-xl bg-slate-800/90 group-hover:bg-slate-800 text-slate-200 border border-slate-700 transition">
                        {isScheduleExpanded ? (
                          <>
                            <ChevronUp size={13} className="text-[#d7f24c]" /> Hide Schedule
                          </>
                        ) : (
                          <>
                            <ChevronDown size={13} className="text-[#d7f24c]" /> Schedule ({pool.matches.length})
                          </>
                        )}
                      </span>
                    </div>
                  </div>

                  {/* Standings Table */}
                  <div className="overflow-x-auto bg-slate-950/60 border border-slate-800/80 rounded-2xl">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-slate-500 text-[10px] uppercase tracking-wider border-b border-slate-800">
                        <th className="text-left py-2 px-2.5">Pos</th>
                        <th className="text-left py-2 px-2.5">Entry</th>
                        <th className="text-right py-2 px-2">W - L</th>
                        <th className="text-right py-2 px-2" title="Win Percentage">Win%</th>
                        <th className="text-right py-2 px-2" title="Head-to-Head vs tied teams">H2H</th>
                        <th className="text-right py-2 px-2" title="Games Won - Games Lost">G (W-L)</th>
                        <th className="text-right py-2 px-2" title="Game Differential (GW − GL)">G+/-</th>
                        <th className="text-right py-2 px-2" title="Points For (Scored)">PF</th>
                        <th className="text-right py-2 px-2" title="Points Against (Allowed)">PA</th>
                        <th className="text-right py-2 px-2" title="Point Differential (PF − PA)">Pt+/-</th>
                        <th className="text-right py-2 px-2" title="Point Differential per Match">Pt/M</th>
                        <th className="text-right py-2 px-2.5" title="Points For per Match">PF/M</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row, idx) => {
                        const qualifies = idx < advancePerPool;
                        const winPct =
                          row.matchesPlayed > 0
                            ? `${Math.round((row.wins / row.matchesPlayed) * 100)}%`
                            : '0%';
                        const ptDiffPerM =
                          row.matchesPlayed > 0
                            ? (row.pointDiff / row.matchesPlayed).toFixed(1)
                            : '0.0';
                        const pfPerM =
                          row.matchesPlayed > 0
                            ? (row.pointsFor / row.matchesPlayed).toFixed(1)
                            : '0.0';
                        return (
                          <tr
                            key={row.entryId}
                            className={`border-b border-slate-800/50 last:border-0 ${
                              qualifies ? 'bg-emerald-500/5' : ''
                            }`}
                          >
                            <td className="py-2 px-2.5 font-mono font-bold">
                              <span
                                className={`inline-flex items-center justify-center w-5 h-5 rounded-full text-[11px] ${
                                  qualifies
                                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                    : 'bg-slate-800 text-slate-400'
                                }`}
                              >
                                {idx + 1}
                              </span>
                            </td>
                            <td className="py-2 px-2.5 font-semibold text-white whitespace-nowrap">
                              {row.name}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-slate-200 font-bold whitespace-nowrap">
                              {row.wins}-{row.losses}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-slate-300">
                              {winPct}
                            </td>
                            <td
                              className={`py-2 px-2 text-right font-mono font-semibold whitespace-nowrap ${
                                row.h2hTiedPlayed > 0
                                  ? row.h2hTiedWins > row.h2hTiedLosses
                                    ? 'text-emerald-300'
                                    : row.h2hTiedWins < row.h2hTiedLosses
                                    ? 'text-red-400'
                                    : 'text-slate-300'
                                  : 'text-slate-600'
                              }`}
                              title={row.h2hTiedTooltip || 'Head-to-Head vs tied teams'}
                            >
                              {row.h2hTiedPlayed > 0
                                ? `${row.h2hTiedWins}-${row.h2hTiedLosses}`
                                : '—'}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-slate-400 whitespace-nowrap">
                              {row.gamesWon}-{row.gamesLost}
                            </td>
                            <td
                              className={`py-2 px-2 text-right font-mono font-semibold ${
                                row.gameDiff > 0
                                  ? 'text-emerald-300'
                                  : row.gameDiff < 0
                                  ? 'text-red-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {row.gameDiff > 0 ? '+' : ''}
                              {row.gameDiff}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-slate-400">
                              {row.pointsFor}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-slate-400">
                              {row.pointsAgainst}
                            </td>
                            <td
                              className={`py-2 px-2 text-right font-mono font-bold ${
                                row.pointDiff > 0
                                  ? 'text-[#d7f24c]'
                                  : row.pointDiff < 0
                                  ? 'text-red-400'
                                  : 'text-slate-400'
                              }`}
                            >
                              {row.pointDiff > 0 ? '+' : ''}
                              {row.pointDiff}
                            </td>
                            <td className="py-2 px-2 text-right font-mono text-slate-300">
                              {row.pointDiff > 0 ? '+' : ''}
                              {ptDiffPerM}
                            </td>
                            <td className="py-2 px-2.5 text-right font-mono text-slate-400">
                              {pfPerM}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                  <div className="px-3 py-1.5 border-t border-slate-800/80 text-[10px] text-slate-500 flex items-center gap-1.5 flex-wrap">
                    <span className="font-bold uppercase tracking-wider text-slate-400">Tiebreakers:</span>
                    <span>
                      {(tournament?.tiebreakerRules?.rankByWinPct ? 'Win % → ' : 'Wins → ') +
                        (tournament?.tiebreakerRules?.order || DEFAULT_TIEBREAKER_RULES.order)
                          .map((k) => TIEBREAKER_CRITERIA_LABELS[k] || k)
                          .join(' → ')}
                    </span>
                  </div>
                </div>
                </div>

                {/* Pool Matches Grid (hidden until user clicks/touches pool) */}
                {isScheduleExpanded && (() => {
                  const matchesByRound = new Map();
                  pool.matches.forEach((m) => {
                    const r = Number(m.round) || 1;
                    if (!matchesByRound.has(r)) matchesByRound.set(r, []);
                    matchesByRound.get(r).push(m);
                  });
                  const sortedRounds = Array.from(matchesByRound.entries()).sort((a, b) => a[0] - b[0]);

                  return (
                    <div className="pt-2 border-t border-slate-800/80 space-y-4">
                      <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
                        {pool.name} Match Schedule ({pool.matches.length} Matches)
                      </span>
                      {sortedRounds.map(([roundNum, roundMatches]) => (
                        <div key={roundNum} className="space-y-2">
                          <div className="flex items-center gap-2">
                            <span className="text-[11px] font-black uppercase tracking-wider text-[#d7f24c] bg-[#d7f24c]/10 border border-[#d7f24c]/25 px-2.5 py-0.5 rounded-full">
                              Round {roundNum}
                            </span>
                            <span className="text-[10px] font-mono text-slate-500">
                              {roundMatches.length} {roundMatches.length === 1 ? 'match' : 'matches'}
                            </span>
                          </div>
                          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                            {roundMatches.map((match) => {
                              const fmt = getEffectiveMatchFormat(tournament, match, { isKnockout: false });
                              return (
                                <MatchScoreEditor
                                  key={match.id}
                                  match={match}
                                  entryA={entryMap.get(match.entryAId)}
                                  entryB={entryMap.get(match.entryBId)}
                                  bestOf={fmt.bestOf}
                                  pointsTo={fmt.pointsTo}
                                  isCustomFormat={fmt.isCustom}
                                  numCourts={numCourts}
                                  courtNames={courtNames}
                                  onSetCourt={
                                    onSetPoolMatchCourt
                                      ? (ct) => onSetPoolMatchCourt(pool.id, match.id, ct)
                                      : undefined
                                  }
                                  isAdmin={isAdmin}
                                  onToggleLive={() => onTogglePoolMatchLive(pool.id, match.id)}
                                  onEditMatchup={() =>
                                    setEditingMatchCtx({
                                      type: 'pool',
                                      poolId: pool.id,
                                      match,
                                      stageLabel: `${pool.name} \u2022 R${match.round}`,
                                      defaultFormat: getEffectiveMatchFormat(tournament, null, { isKnockout: false }),
                                      allowBye: false,
                                    })
                                  }
                                  onSave={(games, winnerId) =>
                                    onSavePoolMatch(pool.id, match.id, games, winnerId)
                                  }
                                />
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  );
                })()}
              </div>
            );
          })}
        </div>
      )}

      {/* KNOCKOUT BRACKET TAB */}
      {effectiveTab === 'knockout' && (
        <div className="space-y-6">
          {!knockout ? (
            <div className="bg-slate-900 border border-slate-800 rounded-3xl p-8 text-center shadow-xl">
              <Trophy size={40} className="mx-auto text-amber-400 mb-3 opacity-80" />
              <h3 className="text-lg font-bold text-white mb-1">Knockout Bracket Not Seeded Yet</h3>
              <p className="text-xs text-slate-400 max-w-md mx-auto mb-5">
                Complete your Pool Play matches and click &ldquo;Advance to Knockout Bracket&rdquo; to seed the top {advancePerPool} qualifiers from each pool.
              </p>
              {isAdmin && (
                <button
                  type="button"
                  onClick={onGenerateKnockout}
                  className="px-5 py-3 rounded-2xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs inline-flex items-center gap-2 transition active:scale-95"
                >
                  <Play size={14} /> Seed Knockout Bracket Now
                </button>
              )}
            </div>
          ) : (
            <>
              {/* Podium Banner */}
              {(knockout.championId || knockout.bronzeId) && (
                <div className="bg-gradient-to-br from-amber-500/15 via-slate-900 to-slate-900 border border-amber-400/40 rounded-3xl p-5 shadow-xl">
                  <p className="text-amber-400 text-xs font-extrabold uppercase tracking-widest mb-3 flex items-center gap-1.5">
                    <Award size={16} /> Tournament Medalists
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                    {knockout.championId && (
                      <div className="bg-amber-400/15 border border-amber-400/40 rounded-2xl p-3">
                        <span className="text-[10px] font-bold uppercase text-amber-300 block">
                          Gold Medal (1st)
                        </span>
                        <span className="text-white font-black text-base">
                          {getEntryDisplayName(entryMap.get(knockout.championId))}
                        </span>
                      </div>
                    )}
                    {knockout.silverId && (
                      <div className="bg-slate-800/80 border border-slate-600 rounded-2xl p-3">
                        <span className="text-[10px] font-bold uppercase text-slate-300 block">
                          Silver Medal (2nd)
                        </span>
                        <span className="text-white font-bold text-base">
                          {getEntryDisplayName(entryMap.get(knockout.silverId))}
                        </span>
                      </div>
                    )}
                    {knockout.bronzeId && (
                      <div className="bg-orange-500/15 border border-orange-500/35 rounded-2xl p-3">
                        <span className="text-[10px] font-bold uppercase text-orange-300 block">
                          Bronze Medal (3rd)
                        </span>
                        <span className="text-white font-bold text-base">
                          {getEntryDisplayName(entryMap.get(knockout.bronzeId))}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Knockout Rounds (Tree with Connector Lines) */}
              <div className="flex items-stretch overflow-x-auto pb-4 -mx-2 px-2 sm:mx-0 sm:px-0">
                {knockout.rounds.map((round, rIdx) => {
                  const roundFmt = getEffectiveMatchFormat(tournament, null, {
                    isKnockout: true,
                    totalRounds: knockout.rounds.length,
                    roundIdx: rIdx,
                    isBronze: false,
                  });
                  const roundTitle = getKnockoutRoundLabel(knockout.rounds.length, rIdx);
                  const hasNextRound = rIdx < knockout.rounds.length - 1;
                  const nextRoundLen = hasNextRound ? knockout.rounds[rIdx + 1].length : 0;
                  return (
                    <React.Fragment key={rIdx}>
                      <div className="min-w-[290px] sm:min-w-[310px] flex-1 flex flex-col">
                        <div className="flex items-center justify-between gap-2 px-1 mb-3 shrink-0">
                          <h3 className="text-xs font-black uppercase tracking-widest text-amber-400">
                            {roundTitle}
                          </h3>
                          <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                            {roundFmt.bestOf > 1 ? `Bo${roundFmt.bestOf}` : '1G'} to {roundFmt.pointsTo}
                          </span>
                        </div>
                        <div className="flex-1 flex flex-col justify-around gap-3">
                          {round.map((m) => {
                            const matchFmt = getEffectiveMatchFormat(tournament, m, {
                              isKnockout: true,
                              totalRounds: knockout.rounds.length,
                              roundIdx: rIdx,
                              isBronze: false,
                            });
                            if (m.isBye) {
                              return (
                                <div
                                  key={m.id}
                                  className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3 text-xs text-slate-400 flex items-center justify-between gap-2"
                                >
                                  <div className="min-w-0 truncate">
                                    <span className="font-bold text-white">
                                      {getEntryDisplayName(entryMap.get(m.winnerId || m.entryAId || m.entryBId))}
                                    </span>{' '}
                                    <span className="text-slate-500">(BYE &mdash; Advances)</span>
                                  </div>
                                  {isAdmin && onEditKnockoutMatch && (
                                    <button
                                      type="button"
                                      onClick={() =>
                                        setEditingMatchCtx({
                                          type: 'knockout',
                                          roundIdx: rIdx,
                                          matchIdx: m.matchIdx,
                                          isBronze: false,
                                          match: m,
                                          stageLabel: roundTitle,
                                          defaultFormat: roundFmt,
                                          allowBye: true,
                                        })
                                      }
                                      title="Edit matchup or assign opponent"
                                      className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-[#d7f24c] border border-slate-700 transition shrink-0"
                                    >
                                      <Pencil size={12} />
                                    </button>
                                  )}
                                </div>
                              );
                            }
                            return (
                              <MatchScoreEditor
                                key={m.id}
                                match={m}
                                entryA={entryMap.get(m.entryAId)}
                                entryB={entryMap.get(m.entryBId)}
                                bestOf={matchFmt.bestOf}
                                pointsTo={matchFmt.pointsTo}
                                isCustomFormat={matchFmt.isCustom}
                                numCourts={numCourts}
                                courtNames={courtNames}
                                onSetCourt={
                                  onSetKnockoutMatchCourt
                                    ? (ct) => onSetKnockoutMatchCourt(rIdx, m.matchIdx, false, ct)
                                    : undefined
                                }
                                isAdmin={isAdmin}
                                onToggleLive={() => onToggleKnockoutMatchLive(rIdx, m.matchIdx, false)}
                                onEditMatchup={() =>
                                  setEditingMatchCtx({
                                    type: 'knockout',
                                    roundIdx: rIdx,
                                    matchIdx: m.matchIdx,
                                    isBronze: false,
                                    match: m,
                                    stageLabel: roundTitle,
                                    defaultFormat: roundFmt,
                                    allowBye: rIdx === 0,
                                  })
                                }
                                onSave={(games, winnerId) =>
                                  onSaveKnockoutMatch(rIdx, m.matchIdx, games, winnerId, false)
                                }
                              />
                            );
                          })}
                        </div>
                      </div>
                      {hasNextRound && (
                        <div className="w-7 sm:w-9 shrink-0 flex flex-col pt-7">
                          <div className="flex-1 flex flex-col justify-around">
                            {Array.from({ length: Math.max(1, nextRoundLen) }, (_, pairIdx) => {
                              const hasPair = round.length >= (pairIdx + 1) * 2;
                              return (
                                <div key={pairIdx} className="flex-1 flex items-center">
                                  {hasPair ? (
                                    <>
                                      <div className="w-1/2 h-1/2 border-t-2 border-b-2 border-r-2 border-slate-600/80 rounded-r-lg" />
                                      <div className="w-1/2 h-0.5 bg-slate-600/80" />
                                    </>
                                  ) : (
                                    <div className="w-full h-0.5 bg-slate-600/80" />
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      )}
                    </React.Fragment>
                  );
                })}
              </div>

              {/* Bronze Medal Match */}
              {knockout.bronzeMatch && (() => {
                const bronzeRoundDefault = getEffectiveMatchFormat(tournament, null, {
                  isKnockout: true,
                  totalRounds: knockout.rounds.length,
                  roundIdx: knockout.rounds.length - 1,
                  isBronze: true,
                });
                const bronzeFmt = getEffectiveMatchFormat(tournament, knockout.bronzeMatch, {
                  isKnockout: true,
                  totalRounds: knockout.rounds.length,
                  roundIdx: knockout.rounds.length - 1,
                  isBronze: true,
                });
                return (
                  <div className="max-w-md">
                    <div className="flex items-center justify-between gap-2 px-1 mb-2.5">
                      <h3 className="text-xs font-black uppercase tracking-widest text-orange-400 flex items-center gap-1.5">
                        <Award size={14} /> Bronze Medal Match (3rd Place)
                      </h3>
                      <span className="text-[10px] font-mono font-bold text-slate-400 bg-slate-900 border border-slate-800 px-2 py-0.5 rounded-full">
                        {bronzeFmt.bestOf > 1 ? `Bo${bronzeFmt.bestOf}` : '1G'} to {bronzeFmt.pointsTo}
                      </span>
                    </div>
                    <MatchScoreEditor
                      match={knockout.bronzeMatch}
                      entryA={entryMap.get(knockout.bronzeMatch.entryAId)}
                      entryB={entryMap.get(knockout.bronzeMatch.entryBId)}
                      bestOf={bronzeFmt.bestOf}
                      pointsTo={bronzeFmt.pointsTo}
                      isCustomFormat={bronzeFmt.isCustom}
                      numCourts={numCourts}
                      courtNames={courtNames}
                      onSetCourt={
                        onSetKnockoutMatchCourt
                          ? (ct) => onSetKnockoutMatchCourt(0, 0, true, ct)
                          : undefined
                      }
                      isAdmin={isAdmin}
                      onToggleLive={() => onToggleKnockoutMatchLive(0, 0, true)}
                      onEditMatchup={() =>
                        setEditingMatchCtx({
                          type: 'knockout',
                          roundIdx: 0,
                          matchIdx: 0,
                          isBronze: true,
                          match: knockout.bronzeMatch,
                          stageLabel: 'Bronze Medal Match',
                          defaultFormat: bronzeRoundDefault,
                          allowBye: false,
                        })
                      }
                      onSave={(games, winnerId) =>
                        onSaveKnockoutMatch(0, 0, games, winnerId, true)
                      }
                    />
                  </div>
                );
              })()}
            </>
          )}
        </div>
      )}

      {/* Leaderboard Tab */}
      {effectiveTab === 'leaderboard' && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-lg font-extrabold text-white flex items-center gap-2">
                <BarChart3 size={18} className="text-emerald-400" />
                Tournament Leaderboard
              </h2>
              <p className="text-slate-400 text-xs mt-0.5">
                Combined stats across all saved Pool Play &amp; Knockout matches.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              {discipline === 'doubles' && (
                <div className="flex bg-slate-950 border border-slate-800 rounded-xl p-1">
                  <button
                    type="button"
                    onClick={() => setLeaderboardMode('entries')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      leaderboardMode === 'entries'
                        ? 'bg-[#d7f24c] text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Teams / Pairs
                  </button>
                  <button
                    type="button"
                    onClick={() => setLeaderboardMode('players')}
                    className={`px-3 py-1.5 rounded-lg text-xs font-bold transition ${
                      leaderboardMode === 'players'
                        ? 'bg-[#d7f24c] text-slate-950'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Individual Players
                  </button>
                </div>
              )}

              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const label =
                      discipline === 'doubles' && leaderboardMode === 'players'
                        ? 'Player'
                        : discipline === 'doubles'
                        ? 'Team'
                        : 'Player';
                    const csv = generateTournamentLeaderboardCSV(
                      activeLeaderboardRows,
                      roomId,
                      label
                    );
                    triggerCsvDownload(
                      `${roomId || 'room'}-${label.toLowerCase()}-leaderboard.csv`,
                      csv
                    );
                  }}
                  className="px-3 py-2 rounded-xl bg-slate-950 hover:bg-slate-800 border border-slate-800 text-emerald-400 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
                >
                  <Download size={13} /> Leaderboard CSV
                </button>
              )}
            </div>
          </div>

          {activeLeaderboardRows.length === 0 ? (
            <div className="text-center py-10 text-slate-500 text-sm">
              No entries or match stats recorded yet.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-slate-800 text-[11px] uppercase tracking-wider text-slate-400">
                    <th className="py-2.5 px-3 font-bold">#</th>
                    <th className="py-2.5 px-3 font-bold">
                      {discipline === 'doubles' && leaderboardMode === 'entries'
                        ? 'Team / Pair'
                        : 'Player'}
                    </th>
                    <th className="py-2.5 px-3 font-bold text-center">Matches</th>
                    <th className="py-2.5 px-3 font-bold text-center">W - L</th>
                    <th className="py-2.5 px-3 font-bold text-center">Win %</th>
                    <th className="py-2.5 px-3 font-bold text-center">Games</th>
                    <th className="py-2.5 px-3 font-bold text-center">PF / PA</th>
                    <th className="py-2.5 px-3 font-bold text-right">Diff</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/70 text-xs">
                  {activeLeaderboardRows.map((row, idx) => (
                    <tr
                      key={row.name || idx}
                      className="hover:bg-slate-950/60 transition"
                    >
                      <td className="py-2.5 px-3 font-mono font-bold text-slate-400">
                        {idx === 0 ? (
                          <span className="text-amber-400">1</span>
                        ) : (
                          idx + 1
                        )}
                      </td>
                      <td className="py-2.5 px-3 font-bold text-white">{row.name}</td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                        {row.matchesPlayed}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono font-bold">
                        <span className="text-emerald-400">{row.wins}</span>
                        <span className="text-slate-500"> - </span>
                        <span className="text-rose-400">{row.losses}</span>
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-200">
                        {row.winPct}%
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-300">
                        {row.gamesWon}-{row.gamesLost}
                      </td>
                      <td className="py-2.5 px-3 text-center font-mono text-slate-400">
                        {row.pointsFor}/{row.pointsAgainst}
                      </td>
                      <td
                        className={`py-2.5 px-3 text-right font-mono font-bold ${
                          row.pointDiff > 0
                            ? 'text-emerald-400'
                            : row.pointDiff < 0
                            ? 'text-rose-400'
                            : 'text-slate-400'
                        }`}
                      >
                        {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      <PoolCourtAssignModal
        isOpen={isCourtAssignOpen}
        onClose={() => setIsCourtAssignOpen(false)}
        tournament={tournament}
        numCourts={numCourts}
        courtNames={courtNames}
        onApply={(assignments) => onBatchAssignCourtsLive && onBatchAssignCourtsLive(assignments)}
      />

      {/* Edit Matchup & Format Modal */}
      <EditPoolMatchModal
        isOpen={Boolean(editingMatchCtx)}
        onClose={() => setEditingMatchCtx(null)}
        match={editingMatchCtx?.match}
        entries={entries}
        stageLabel={editingMatchCtx?.stageLabel}
        defaultFormat={editingMatchCtx?.defaultFormat || { bestOf: 1, pointsTo: 11 }}
        allowBye={Boolean(editingMatchCtx?.allowBye)}
        numCourts={numCourts}
        isAdmin={isAdmin}
        onSave={(payload) => {
          if (!editingMatchCtx) return;
          if (editingMatchCtx.type === 'pool' && onEditPoolMatch) {
            onEditPoolMatch(editingMatchCtx.poolId, editingMatchCtx.match.id, payload);
          } else if (editingMatchCtx.type === 'knockout' && onEditKnockoutMatch) {
            onEditKnockoutMatch(
              editingMatchCtx.roundIdx,
              editingMatchCtx.matchIdx,
              editingMatchCtx.isBronze,
              payload
            );
          }
        }}
      />
    </div>
  );
}

