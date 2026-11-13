import React, { useState } from 'react';
import { Trophy, Swords, Zap, Download, Play, Archive } from 'lucide-react';
import { roundName, generateMatchScoresCSV, triggerCsvDownload } from '../utils/tournament';
import { MlpCourtAssignModal } from './CourtAssignModal';
import { LiveTimer } from './LiveTimer';
import { getCourtDisplayName } from '../utils/courtNames';

function TeamDot({ color, className = '' }) {
  return <span className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${className}`} style={{ backgroundColor: color?.accent || '#64748b' }} />;
}

function MatchCard({
  match,
  teams,
  numCourts = 2,
  courtNames = {},
  isAdmin = false,
  onToggleCourt,
  onOpen,
}) {
  const teamA = teams.find((t) => t.id === match.teamAId);
  const teamB = teams.find((t) => t.id === match.teamBId);
  const clickable = match.status !== 'pending' && !match.isBye;
  const isComplete = match.status === 'complete';
  const assignedCourts = Array.isArray(match.assignedCourts) ? match.assignedCourts : [];

  return (
    <div
      onClick={() => clickable && onOpen()}
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      onKeyDown={(e) => {
        if (clickable && (e.key === 'Enter' || e.key === ' ')) {
          e.preventDefault();
          onOpen();
        }
      }}
      className={`w-full text-left bg-slate-900 border rounded-2xl p-3.5 transition shadow-lg ${
        clickable
          ? 'border-slate-800 hover:border-slate-700 active:scale-[0.99] cursor-pointer'
          : 'border-slate-850 opacity-60 cursor-default'
      }`}
    >
      {match.matchNumber && (
        <div className="flex items-center justify-between px-2 mb-1.5">
          <span className="text-[10px] font-mono font-bold uppercase tracking-wider text-slate-400 bg-slate-800/80 border border-slate-700/70 px-2 py-0.5 rounded-md">
            Matchup #{match.matchNumber}
          </span>
          {assignedCourts.length > 0 && !isComplete && (
            <span className="text-[10px] font-mono font-bold text-[#d7f24c]">
              {assignedCourts.map((c) => `Ct ${c}`).join(', ')}
            </span>
          )}
        </div>
      )}
      {[
        { team: teamA, score: match.gamesWonA, id: match.teamAId },
        { team: teamB, score: match.gamesWonB, id: match.teamBId, isByeRow: match.isBye && !teamB },
      ].map((row, i) => (
        <div
          key={i}
          className={`flex items-center justify-between py-1.5 px-2 rounded-xl transition ${
            isComplete && match.winnerId === row.id ? 'bg-slate-800/80 font-bold' : ''
          }`}
        >
          <span className="flex items-center gap-2 text-sm truncate">
            {row.team ? <TeamDot color={row.team.color} /> : <span className="w-3 h-3 rounded-full bg-slate-800 flex-shrink-0" />}
            <span
              className={
                row.team
                  ? isComplete && match.winnerId === row.id
                    ? 'text-white font-bold'
                    : 'text-slate-300'
                  : row.isByeRow
                  ? 'text-amber-400/80 italic font-mono text-xs'
                  : 'text-slate-600 italic'
              }
            >
              {row.team ? row.team.name : row.isByeRow ? 'BYE (Advances)' : 'TBD'}
            </span>
            {isComplete && match.winnerId === row.id && <Trophy size={13} className="text-amber-400 flex-shrink-0" />}
          </span>
          {match.games && <span className="text-slate-300 font-mono text-sm tabular-nums ml-2">{row.score}</span>}
        </div>
      ))}

      {match.isBye && <p className="text-amber-400/80 text-[10px] font-bold mt-1 uppercase tracking-wider px-2">First-Round Bye</p>}
      {match.status === 'tied' && (
        <p className="text-amber-400 text-[10px] font-bold mt-1.5 flex items-center gap-1 px-2">
          <Zap size={12} /> DREAMBREAKER REQUIRED
        </p>
      )}
      {match.status === 'in_progress' && (
        <div className="flex items-center justify-between px-2 mt-1 gap-1.5 flex-wrap">
          <p className="text-cyan-400 text-[10px] font-bold flex items-center gap-1">
            <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse" />
            MATCH IN PROGRESS
          </p>
          <div className="flex items-center gap-1 flex-wrap">
            {match.games &&
              match.games
                .filter((g) => g.inProgress && !g.saved && g.court)
                .sort((a, b) => Number(a.court) - Number(b.court))
                .map((g) => (
                  <span
                    key={g.id}
                    className="inline-flex items-center gap-1 text-[#d7f24c] text-[10px] font-mono font-bold bg-[#d7f24c]/10 border border-[#d7f24c]/30 px-1.5 py-0.5 rounded-full"
                  >
                    Ct {g.court}
                    {g.liveStartedAt && <LiveTimer startedAt={g.liveStartedAt} className="text-[9px]" />}
                  </span>
                ))}
            {match.games && match.games.filter((g) => g.inProgress).length > 0 && (
              <span className="text-cyan-300 text-[10px] font-mono bg-cyan-500/10 border border-cyan-500/20 px-1.5 py-0.5 rounded-full">
                {match.games.filter((g) => g.inProgress).length} active
              </span>
            )}
          </div>
        </div>
      )}

      {/* Designated Courts per Matchup (both sides of the bracket) */}
      {!match.isBye && teamA && teamB && !isComplete && (
        <div
          className="mt-2 pt-2 border-t border-slate-800/80 px-2 flex items-center justify-between gap-2 flex-wrap"
          onClick={(e) => e.stopPropagation()}
        >
          <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
            Courts:
          </span>
          {isAdmin && onToggleCourt ? (
            <div className="flex items-center gap-1 flex-wrap">
              {Array.from({ length: Math.max(1, Number(numCourts) || 2) }, (_, i) => i + 1).map((c) => {
                const selected = assignedCourts.includes(c);
                return (
                  <button
                    key={c}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggleCourt(c);
                    }}
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-mono font-bold border transition ${
                      selected
                        ? 'bg-[#d7f24c] text-slate-950 border-[#d7f24c]'
                        : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                    }`}
                    title={`Toggle ${getCourtDisplayName(c, courtNames)} for this matchup`}
                  >
                    {courtNames?.[String(c)]?.trim() ? getCourtDisplayName(c, courtNames) : `C${c}`}
                  </button>
                );
              })}
            </div>
          ) : assignedCourts.length > 0 ? (
            <span className="text-[10px] font-mono font-bold text-[#d7f24c]">
              {assignedCourts.map((c) => getCourtDisplayName(c, courtNames)).join(', ')}
            </span>
          ) : (
            <span className="text-[10px] text-slate-500 italic">Unassigned</span>
          )}
        </div>
      )}
    </div>
  );
}

export function BracketView({
  bracket,
  teams,
  playersById = {},
  roomId = '',
  numCourts = 2,
  courtNames = {},
  isAdmin = false,
  onOpenMatch,
  onOpenRosterModal,
  onBatchAssignCourtsLive,
  onSetMatchAssignedCourts,
  onSaveToArchive,
}) {
  const [isCourtAssignOpen, setIsCourtAssignOpen] = useState(false);

  if (!bracket || !bracket.rounds) return null;
  const totalRounds = bracket.rounds.length;
  const champion = bracket.championId !== null ? teams.find((t) => t.id === bracket.championId) : null;
  const hasAnyGames = bracket.rounds.some((r) => r.some((m) => Array.isArray(m.games) && m.games.length > 0));

  function handleExportScoresCsv() {
    const csv = generateMatchScoresCSV({ bracket, teams, playersById, roomId });
    triggerCsvDownload(`${roomId || 'room'}-match-scores.csv`, csv);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 animate-in fade-in duration-200">
      {champion && (
        <div className="mb-8 rounded-3xl p-6 bg-gradient-to-br from-amber-500/20 via-slate-900 to-amber-900/10 border border-amber-500/40 text-center shadow-2xl">
          <Trophy size={42} className="mx-auto text-amber-400 mb-2 animate-bounce" />
          <p className="text-amber-300 text-xs uppercase tracking-widest font-bold">Tournament Champion</p>
          <p className="text-white text-3xl font-display uppercase tracking-wide font-black mt-0.5">{champion.name}</p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 mb-6 flex-wrap">
        <h2 className="text-white text-2xl sm:text-3xl font-display uppercase tracking-wide font-semibold flex items-center gap-2">
          <Swords size={24} className="text-[#d7f24c]" /> Tournament Bracket
        </h2>
        <div className="flex items-center gap-2 flex-wrap">
          {isAdmin && onBatchAssignCourtsLive && (
            <button
              type="button"
              onClick={() => setIsCourtAssignOpen(true)}
              className="px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 border border-cyan-500/40 text-cyan-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Assign upcoming games across all bracket matchups to courts and mark live"
            >
              <Play size={12} className="fill-current" /> Assign Courts &amp; Live
            </button>
          )}
          {isAdmin && hasAnyGames && (
            <button
              type="button"
              onClick={handleExportScoresCsv}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[#d7f24c] hover:text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Export all match & game scores as CSV"
            >
              <Download size={13} /> Export Scores CSV
            </button>
          )}
          {isAdmin && onSaveToArchive && (
            <button
              type="button"
              onClick={onSaveToArchive}
              className="px-3 py-1.5 rounded-xl bg-emerald-500/15 hover:bg-emerald-500/25 border border-emerald-500/40 text-emerald-300 text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Save this tournament to Completed Archive & get a read-only link"
            >
              <Archive size={13} /> Save Tournament
            </button>
          )}
          {isAdmin && onOpenRosterModal && (
            <button
              onClick={onOpenRosterModal}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              Manage Rosters & Subs
            </button>
          )}
        </div>
      </div>

      <div className="flex items-stretch overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        {bracket.rounds.map((round, ri) => {
          const hasNextRound = ri < totalRounds - 1;
          const nextRoundLen = hasNextRound ? bracket.rounds[ri + 1].length : 0;
          return (
            <React.Fragment key={ri}>
              <div className="min-w-[270px] flex-1 flex flex-col">
                <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3.5 px-1 shrink-0">
                  {roundName(totalRounds, ri)}
                </p>
                <div className="flex-1 flex flex-col justify-around gap-3">
                  {round.map((match, mi) => (
                    <MatchCard
                      key={match.id}
                      match={match}
                      teams={teams}
                      numCourts={numCourts}
                      courtNames={courtNames}
                      isAdmin={isAdmin}
                      onToggleCourt={
                        onSetMatchAssignedCourts
                          ? (courtNum) => {
                              const curr = Array.isArray(match.assignedCourts) ? match.assignedCourts : [];
                              const next = curr.includes(courtNum)
                                ? curr.filter((c) => c !== courtNum)
                                : [...curr, courtNum].sort((a, b) => a - b);
                              onSetMatchAssignedCourts(ri, mi, next);
                            }
                          : undefined
                      }
                      onOpen={() => onOpenMatch(ri, mi)}
                    />
                  ))}
                </div>
              </div>
              {hasNextRound && (
                <div className="w-7 sm:w-9 shrink-0 flex flex-col pt-8">
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

      <MlpCourtAssignModal
        isOpen={isCourtAssignOpen}
        onClose={() => setIsCourtAssignOpen(false)}
        bracket={bracket}
        teams={teams}
        numCourts={numCourts}
        courtNames={courtNames}
        playersById={playersById}
        showAllBracketGames={true}
        onApply={(assignments) => onBatchAssignCourtsLive && onBatchAssignCourtsLive(assignments)}
      />
    </div>
  );
}
