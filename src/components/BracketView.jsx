import React from 'react';
import { Trophy, Swords, Zap, Download } from 'lucide-react';
import { roundName, generateMatchScoresCSV, triggerCsvDownload } from '../utils/tournament';

function TeamDot({ color, className = '' }) {
  return <span className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${className}`} style={{ backgroundColor: color?.accent || '#64748b' }} />;
}

function MatchCard({ match, teams, onOpen }) {
  const teamA = teams.find((t) => t.id === match.teamAId);
  const teamB = teams.find((t) => t.id === match.teamBId);
  const clickable = match.status !== 'pending' && !match.isBye;
  const isComplete = match.status === 'complete';

  return (
    <button
      onClick={() => clickable && onOpen()}
      disabled={!clickable}
      className={`w-full text-left bg-slate-900 border rounded-2xl p-3.5 mb-3 transition shadow-lg ${
        clickable
          ? 'border-slate-800 hover:border-slate-700 active:scale-[0.98] cursor-pointer'
          : 'border-slate-850 opacity-60 cursor-default'
      }`}
    >
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
              Array.from(new Set(match.games.filter((g) => !g.saved && g.court).map((g) => g.court)))
                .sort((a, b) => a - b)
                .map((ct) => (
                  <span
                    key={ct}
                    className="text-[#d7f24c] text-[10px] font-mono font-bold bg-[#d7f24c]/10 border border-[#d7f24c]/30 px-1.5 py-0.5 rounded-full"
                  >
                    Ct {ct}
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
    </button>
  );
}

export function BracketView({ bracket, teams, playersById = {}, roomId = '', onOpenMatch, onOpenRosterModal }) {
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
        <div className="flex items-center gap-2">
          {hasAnyGames && (
            <button
              type="button"
              onClick={handleExportScoresCsv}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[#d7f24c] hover:text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
              title="Export all match & game scores as CSV"
            >
              <Download size={13} /> Export Scores CSV
            </button>
          )}
          {onOpenRosterModal && (
            <button
              onClick={onOpenRosterModal}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold transition flex items-center gap-1.5 shadow-sm"
            >
              Manage Rosters & Subs
            </button>
          )}
        </div>
      </div>

      <div className="flex gap-4 overflow-x-auto pb-6 -mx-4 px-4 sm:mx-0 sm:px-0">
        {bracket.rounds.map((round, ri) => (
          <div key={ri} className="min-w-[270px] flex-1">
            <p className="text-slate-400 text-xs font-bold uppercase tracking-widest mb-3.5 px-1">
              {roundName(totalRounds, ri)}
            </p>
            {round.map((match, mi) => (
              <MatchCard key={match.id} match={match} teams={teams} onOpen={() => onOpenMatch(ri, mi)} />
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}
