import React, { useState } from 'react';
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
} from 'lucide-react';
import {
  getEntryDisplayName,
  computePoolStandings,
  evaluatePoolOrKnockoutMatch,
  getKnockoutRoundLabel,
  generatePoolStandingsCSV,
  generatePoolAndKnockoutMatchesCSV,
} from '../utils/poolTournament';
import { triggerCsvDownload } from '../utils/tournament';

function MatchScoreEditor({ match, entryA, entryB, bestOf, pointsTo, onSave, onToggleLive, isAdmin }) {
  const [games, setGames] = useState(() =>
    (match.games && match.games.length > 0
      ? match.games
      : Array.from({ length: bestOf === 3 ? 3 : 1 }, (_, i) => ({ gameNum: i + 1, scoreA: '', scoreB: '' }))
    ).map((g) => ({ ...g }))
  );

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
        <div className="flex items-center gap-2 min-w-0">
          {match.round && (
            <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-400 px-2 py-0.5 rounded-md">
              R{match.round}
            </span>
          )}
          {match.seedLabelA && match.seedLabelB && (
            <span className="text-[10px] font-mono font-bold bg-slate-800 text-[#d7f24c] px-2 py-0.5 rounded-md">
              {match.seedLabelA} vs {match.seedLabelB}
            </span>
          )}
          {match.inProgress && !match.saved && (
            <span className="text-[10px] font-bold bg-amber-400 text-slate-950 px-2 py-0.5 rounded-full flex items-center gap-1 animate-pulse">
              <Flame size={10} /> LIVE
            </span>
          )}
          {match.saved && (
            <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
              <Check size={10} /> Final
            </span>
          )}
        </div>

        {isAdmin && !match.saved && entryA && entryB && onToggleLive && (
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
          {bestOf === 3 && (
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
          {bestOf === 3 && (
            <span className="text-xs font-mono font-bold text-slate-400">
              {evalRes.gamesWonB}G
            </span>
          )}
        </div>
      </div>

      {/* Game Score Inputs */}
      {entryA && entryB && (
        <div className="space-y-2">
          <div className={`grid gap-2 ${bestOf === 3 ? 'grid-cols-1 sm:grid-cols-3' : 'grid-cols-1'}`}>
            {games.map((g, gIdx) => (
              <div
                key={gIdx}
                className="flex items-center justify-between gap-2 bg-slate-950/80 border border-slate-800 rounded-xl px-2.5 py-1.5"
              >
                <span className="text-[10px] font-mono font-bold text-slate-500 shrink-0">
                  {bestOf === 3 ? `G${gIdx + 1}` : `to ${pointsTo}`}
                </span>
                <div className="flex items-center gap-1.5">
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!isAdmin}
                    value={g.scoreA === '' ? '' : g.scoreA}
                    onChange={(e) => updateScore(gIdx, 'A', e.target.value)}
                    placeholder="0"
                    className="w-11 bg-slate-800 border border-slate-700 rounded-lg py-1 text-center text-white font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#d7f24c] disabled:opacity-70"
                  />
                  <span className="text-slate-500 font-bold text-xs">-</span>
                  <input
                    type="text"
                    inputMode="numeric"
                    disabled={!isAdmin}
                    value={g.scoreB === '' ? '' : g.scoreB}
                    onChange={(e) => updateScore(gIdx, 'B', e.target.value)}
                    placeholder="0"
                    className="w-11 bg-slate-800 border border-slate-700 rounded-lg py-1 text-center text-white font-mono font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#d7f24c] disabled:opacity-70"
                  />
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
  roomId,
  onSavePoolMatch,
  onTogglePoolMatchLive,
  onGenerateKnockout,
  onSaveKnockoutMatch,
  onToggleKnockoutMatchLive,
  isAdmin,
}) {
  const [activeTab, setActiveTab] = useState(tournament?.knockout ? 'knockout' : 'pools');
  const [selectedPoolId, setSelectedPoolId] = useState('all');

  if (!tournament) return null;

  const {
    discipline = 'doubles',
    entries = [],
    pools = [],
    poolFormat = { bestOf: 1, pointsTo: 15 },
    knockoutFormat = { bestOf: 3, pointsTo: 11 },
    advancePerPool = 2,
    knockout = null,
  } = tournament;

  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const totalPoolMatches = pools.reduce((sum, p) => sum + (p.matches?.length || 0), 0);
  const completedPoolMatches = pools.reduce(
    (sum, p) => sum + (p.matches?.filter((m) => m.saved).length || 0),
    0
  );
  const allPoolsComplete = totalPoolMatches > 0 && completedPoolMatches === totalPoolMatches;

  const visiblePools =
    selectedPoolId === 'all' ? pools : pools.filter((p) => p.id === selectedPoolId);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-24 animate-in fade-in duration-200">
      {/* Header & CSV Exports */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-white text-2xl sm:text-3xl font-display uppercase tracking-wide font-semibold">
              {discipline === 'doubles' ? 'Doubles' : 'Singles'} Tournament
            </h2>
            <span className="text-[10px] font-mono font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
              {completedPoolMatches}/{totalPoolMatches} Pool Matches
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            Pool Play: {poolFormat.bestOf === 3 ? 'Best of 3' : '1 Game'} to {poolFormat.pointsTo} &bull; Knockout:{' '}
            {knockoutFormat.bestOf === 3 ? 'Best of 3' : '1 Game'} to {knockoutFormat.pointsTo} &bull; Top {advancePerPool}/pool advance
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
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
        </div>
      </div>

      {/* Main Stage Tabs: Pools vs Knockout */}
      <div className="flex items-center justify-between gap-3 mb-6 flex-wrap">
        <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 w-full max-w-sm shadow-lg">
          <button
            type="button"
            onClick={() => setActiveTab('pools')}
            className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              activeTab === 'pools'
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
              activeTab === 'knockout'
                ? 'bg-amber-400 text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            <Trophy size={14} /> Knockout Bracket
          </button>
        </div>

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
            <span>{knockout ? 'Re-Seed Knockout from Standings' : 'Advance to Knockout Bracket'}</span>
            <ArrowRight size={14} />
          </button>
        )}
      </div>

      {/* POOLS TAB */}
      {activeTab === 'pools' && (
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
            const standings = computePoolStandings(pool, entries, poolFormat.bestOf);
            return (
              <div
                key={pool.id}
                className="bg-slate-900 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl space-y-5"
              >
                <div className="flex items-center justify-between">
                  <h3 className="text-lg font-black text-white font-display uppercase tracking-wide">
                    {pool.name}
                  </h3>
                  <span className="text-xs text-slate-400 font-semibold">
                    Top {advancePerPool} qualify for Knockout
                  </span>
                </div>

                {/* Standings Table */}
                <div className="overflow-x-auto bg-slate-950/60 border border-slate-800/80 rounded-2xl">
                  <table className="w-full text-xs sm:text-sm">
                    <thead>
                      <tr className="text-slate-500 text-[11px] uppercase tracking-wider border-b border-slate-800">
                        <th className="text-left py-2.5 px-3">Pos</th>
                        <th className="text-left py-2.5 px-3">Entry</th>
                        <th className="text-right py-2.5 px-2.5">W - L</th>
                        {poolFormat.bestOf === 3 && (
                          <th className="text-right py-2.5 px-2.5">Games</th>
                        )}
                        <th className="text-right py-2.5 px-2.5">PF</th>
                        <th className="text-right py-2.5 px-2.5">PA</th>
                        <th className="text-right py-2.5 px-3">Diff (+/-)</th>
                      </tr>
                    </thead>
                    <tbody>
                      {standings.map((row, idx) => {
                        const qualifies = idx < advancePerPool;
                        return (
                          <tr
                            key={row.entryId}
                            className={`border-b border-slate-800/50 last:border-0 ${
                              qualifies ? 'bg-emerald-500/5' : ''
                            }`}
                          >
                            <td className="py-2.5 px-3 font-mono font-bold">
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
                            <td className="py-2.5 px-3 font-semibold text-white">
                              {row.name}
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono text-slate-200 font-bold">
                              {row.wins} - {row.losses}
                            </td>
                            {poolFormat.bestOf === 3 && (
                              <td className="py-2.5 px-2.5 text-right font-mono text-slate-400">
                                {row.gamesWon}-{row.gamesLost}
                              </td>
                            )}
                            <td className="py-2.5 px-2.5 text-right font-mono text-slate-400">
                              {row.pointsFor}
                            </td>
                            <td className="py-2.5 px-2.5 text-right font-mono text-slate-400">
                              {row.pointsAgainst}
                            </td>
                            <td
                              className={`py-2.5 px-3 text-right font-mono font-bold ${
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
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Pool Matches Grid */}
                <div>
                  <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2.5">
                    {pool.name} Match Schedule ({pool.matches.length} Matches)
                  </span>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {pool.matches.map((match) => (
                      <MatchScoreEditor
                        key={match.id}
                        match={match}
                        entryA={entryMap.get(match.entryAId)}
                        entryB={entryMap.get(match.entryBId)}
                        bestOf={poolFormat.bestOf}
                        pointsTo={poolFormat.pointsTo}
                        isAdmin={isAdmin}
                        onToggleLive={() => onTogglePoolMatchLive(pool.id, match.id)}
                        onSave={(games, winnerId) =>
                          onSavePoolMatch(pool.id, match.id, games, winnerId)
                        }
                      />
                    ))}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* KNOCKOUT BRACKET TAB */}
      {activeTab === 'knockout' && (
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

              {/* Knockout Rounds */}
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {knockout.rounds.map((round, rIdx) => (
                  <div key={rIdx} className="space-y-3">
                    <h3 className="text-xs font-black uppercase tracking-widest text-amber-400 px-1">
                      {getKnockoutRoundLabel(knockout.rounds.length, rIdx)}
                    </h3>
                    {round.map((m) =>
                      m.isBye ? (
                        <div
                          key={m.id}
                          className="rounded-2xl border border-slate-800/60 bg-slate-900/40 p-3 text-xs text-slate-400"
                        >
                          <span className="font-bold text-white">
                            {getEntryDisplayName(entryMap.get(m.winnerId))}
                          </span>{' '}
                          <span className="text-slate-500">(BYE &mdash; Advances)</span>
                        </div>
                      ) : (
                        <MatchScoreEditor
                          key={m.id}
                          match={m}
                          entryA={entryMap.get(m.entryAId)}
                          entryB={entryMap.get(m.entryBId)}
                          bestOf={knockoutFormat.bestOf}
                          pointsTo={knockoutFormat.pointsTo}
                          isAdmin={isAdmin}
                          onToggleLive={() => onToggleKnockoutMatchLive(rIdx, m.matchIdx, false)}
                          onSave={(games, winnerId) =>
                            onSaveKnockoutMatch(rIdx, m.matchIdx, games, winnerId, false)
                          }
                        />
                      )
                    )}
                  </div>
                ))}
              </div>

              {/* Bronze Medal Match */}
              {knockout.bronzeMatch && (
                <div className="max-w-md">
                  <h3 className="text-xs font-black uppercase tracking-widest text-orange-400 px-1 mb-2.5 flex items-center gap-1.5">
                    <Award size={14} /> Bronze Medal Match (3rd Place)
                  </h3>
                  <MatchScoreEditor
                    match={knockout.bronzeMatch}
                    entryA={entryMap.get(knockout.bronzeMatch.entryAId)}
                    entryB={entryMap.get(knockout.bronzeMatch.entryBId)}
                    bestOf={knockoutFormat.bestOf}
                    pointsTo={knockoutFormat.pointsTo}
                    isAdmin={isAdmin}
                    onToggleLive={() => onToggleKnockoutMatchLive(0, 0, true)}
                    onSave={(games, winnerId) =>
                      onSaveKnockoutMatch(0, 0, games, winnerId, true)
                    }
                  />
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
