import React, { useState, useEffect } from 'react';
import {
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Shuffle,
  Trophy,
  Zap,
  Pencil,
  Play,
  Pause,
  ArrowRightLeft,
  UserPlus,
  Users,
  ShieldAlert,
  Lock,
  RotateCcw,
  Download,
} from 'lucide-react';
import { generateMatchScoresCSV, triggerCsvDownload } from '../utils/tournament';
import { MlpCourtAssignModal } from './CourtAssignModal';

function TeamDot({ color, className = '' }) {
  return (
    <span
      className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${className}`}
      style={{ backgroundColor: color?.accent || '#64748b' }}
    />
  );
}

function GameRow({
  game,
  index,
  teamA,
  teamB,
  playersById,
  expanded,
  onToggle,
  onSave,
  onToggleInProgress,
  numCourts = 2,
  onSetGameCourt,
  onOpenEditMatchup,
  onShuffleGame,
  onRevertGame,
  isAdmin,
}) {
  const [scoreA, setScoreA] = useState(game.saved ? String(game.scoreA) : (game.scoreA === 0 ? '' : String(game.scoreA)));
  const [scoreB, setScoreB] = useState(game.saved ? String(game.scoreB) : (game.scoreB === 0 ? '' : String(game.scoreB)));
  const [isEditing, setIsEditing] = useState(false);

  useEffect(() => {
    setScoreA(game.saved ? String(game.scoreA) : (game.scoreA === 0 ? '' : String(game.scoreA)));
    setScoreB(game.saved ? String(game.scoreB) : (game.scoreB === 0 ? '' : String(game.scoreB)));
  }, [game.scoreA, game.scoreB, game.saved]);

  const label = (ids) => (ids || []).map((id) => playersById[id] || `Player ${id}`).join(' & ');
  const aWon = game.saved && game.scoreA > game.scoreB;
  const bWon = game.saved && game.scoreB > game.scoreA;

  function parseScore(val) {
    if (val === '' || val === null || val === undefined) return 0;
    const num = Number(val);
    return isNaN(num) ? 0 : Math.max(0, num);
  }

  function handleScoreChange(val, setter) {
    if (val === '') {
      setter('');
    } else {
      const digitsOnly = val.replace(/\D/g, '');
      if (digitsOnly === '') {
        setter('');
      } else {
        const stripped = digitsOnly.replace(/^0+(?=\d)/, '');
        setter(stripped);
      }
    }
  }

  function handleSaveClick() {
    onSave(parseScore(scoreA), parseScore(scoreB));
    setIsEditing(false);
  }

  function handleCancelClick() {
    setScoreA(game.saved ? String(game.scoreA) : (game.scoreA === 0 ? '' : String(game.scoreA)));
    setScoreB(game.saved ? String(game.scoreB) : (game.scoreB === 0 ? '' : String(game.scoreB)));
    setIsEditing(false);
  }

  return (
    <div
      className={`border rounded-2xl mb-3 overflow-hidden shadow-lg transition ${
        game.inProgress
          ? 'bg-slate-900 border-cyan-500/50 ring-1 ring-cyan-500/30 shadow-cyan-500/10'
          : 'bg-slate-900 border-slate-800'
      }`}
    >
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between gap-3 px-3.5 sm:px-4 py-3 sm:py-3.5 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            <p className="text-slate-500 text-[11px] font-bold uppercase tracking-wider">
              Game {index + 1}
            </p>

            {game.court && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#d7f24c]/15 text-[#d7f24c] border border-[#d7f24c]/30">
                Court {game.court}
              </span>
            )}

            {game.inProgress && (
              <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-extrabold bg-cyan-500/20 text-cyan-300 border border-cyan-500/40 animate-pulse">
                <Play size={10} className="fill-current" /> IN PROGRESS
              </span>
            )}

            {game.isExtra && (
              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30">
                <Shuffle size={10} /> Extra &bull; Randomized
              </span>
            )}
          </div>
          <p className="text-white text-xs sm:text-sm font-semibold truncate">
            <span className={aWon ? 'text-[#d7f24c] font-bold' : ''}>{label(game.pairA)}</span>
            <span className="text-slate-500 font-normal"> vs </span>
            <span className={bWon ? 'text-[#d7f24c] font-bold' : ''}>{label(game.pairB)}</span>
          </p>
        </div>

        <div className="flex items-center gap-2 sm:gap-2.5 shrink-0">
          {game.saved && (
            <span className="font-mono text-slate-200 font-bold text-xs sm:text-sm bg-slate-800 px-2 sm:px-2.5 py-1 rounded-lg whitespace-nowrap">
              {game.scoreA} &ndash; {game.scoreB}
            </span>
          )}

          {game.saved ? (
            <Check size={18} className="text-[#d7f24c] shrink-0" />
          ) : game.inProgress ? (
            <span className="w-2.5 h-2.5 rounded-full bg-cyan-400 animate-ping shrink-0" />
          ) : (
            <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          )}

          {expanded ? (
            <ChevronUp size={18} className="text-slate-500 shrink-0" />
          ) : (
            <ChevronDown size={18} className="text-slate-500 shrink-0" />
          )}
        </div>
      </button>

      {expanded && (
        <div className="px-4 pb-4 border-t border-slate-800 pt-3.5 bg-slate-950/40">
          {/* Game Management Controls (In Progress, Edit Matchup, Shuffle) */}
          {isAdmin && !game.saved && (
            <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-slate-800/80 flex-wrap">
              {/* In Progress Toggle + Court Selector */}
              <div className="flex items-center gap-1.5 flex-wrap">
                <button
                  type="button"
                  onClick={() => onToggleInProgress(game.id)}
                  className={`py-1.5 px-3 rounded-xl text-xs font-bold transition flex items-center gap-1.5 active:scale-95 ${
                    game.inProgress
                      ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20 font-black'
                      : 'bg-slate-800 hover:bg-slate-750 text-cyan-400 border border-cyan-500/30'
                  }`}
                >
                  {game.inProgress ? <Pause size={13} /> : <Play size={13} className="fill-current" />}
                  <span>{game.inProgress ? 'Pause / Finish In-Progress' : 'Mark In Progress'}</span>
                </button>
                {onSetGameCourt && (
                  <select
                    value={game.court || ''}
                    onChange={(e) => onSetGameCourt(game.id, e.target.value ? Number(e.target.value) : null)}
                    aria-label="Assign Court"
                    className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-xs font-bold text-[#d7f24c] focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
                  >
                    <option value="">Court —</option>
                    {Array.from({ length: Math.max(1, Number(numCourts) || 2) }, (_, i) => i + 1).map((c) => (
                      <option key={c} value={c}>
                        Court {c}
                      </option>
                    ))}
                  </select>
                )}
              </div>

              {/* Matchup Actions */}
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  disabled={game.inProgress}
                  onClick={() => onOpenEditMatchup(game)}
                  title={game.inProgress ? 'Game is in progress on court' : 'Edit player matchup'}
                  className={`py-1.5 px-2.5 rounded-xl text-xs font-bold transition flex items-center gap-1 border ${
                    game.inProgress
                      ? 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white border-slate-700'
                  }`}
                >
                  <ArrowRightLeft size={12} className={game.inProgress ? 'text-slate-600' : 'text-[#d7f24c]'} />
                  <span>Edit Matchup</span>
                </button>

                <button
                  type="button"
                  disabled={game.inProgress}
                  onClick={() => onShuffleGame(game.id)}
                  title={game.inProgress ? 'Game is in progress on court' : 'Randomize pairing'}
                  className={`p-1.5 rounded-xl text-xs font-bold transition border ${
                    game.inProgress
                      ? 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed'
                      : 'bg-slate-800 hover:bg-slate-750 text-amber-400 border-amber-500/30 hover:border-amber-500/60'
                  }`}
                >
                  <Shuffle size={13} />
                </button>

                {onRevertGame && (
                  <button
                    type="button"
                    disabled={game.inProgress}
                    onClick={() => onRevertGame(game.id, index)}
                    title={game.inProgress ? 'Game is in progress on court' : 'Revert to original matchup'}
                    className={`p-1.5 rounded-xl text-xs font-bold transition border ${
                      game.inProgress
                        ? 'bg-slate-800/50 text-slate-600 border-slate-800 cursor-not-allowed'
                        : 'bg-slate-800 hover:bg-slate-750 text-[#d7f24c] border-[#d7f24c]/30 hover:border-[#d7f24c]/60'
                    }`}
                  >
                    <RotateCcw size={13} />
                  </button>
                )}
              </div>
            </div>
          )}

          {/* Scores Inputs */}
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-slate-400 text-xs font-semibold block mb-1 truncate">{teamA.name}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                disabled={(!isEditing && game.saved) || !isAdmin}
                value={scoreA}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleScoreChange(e.target.value, setScoreA)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xl font-bold text-center disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#d7f24c] placeholder:text-slate-600"
              />
            </div>
            <div>
              <label className="text-slate-400 text-xs font-semibold block mb-1 truncate">{teamB.name}</label>
              <input
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                placeholder="0"
                disabled={(!isEditing && game.saved) || !isAdmin}
                value={scoreB}
                onFocus={(e) => e.target.select()}
                onChange={(e) => handleScoreChange(e.target.value, setScoreB)}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white text-xl font-bold text-center disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-[#d7f24c] placeholder:text-slate-600"
              />
            </div>
          </div>

          {isAdmin && (
            <>
              {!game.saved && (
                <button
                  onClick={handleSaveClick}
                  className="w-full py-3 rounded-xl bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 font-bold active:scale-95 transition shadow-lg shadow-[#d7f24c]/20"
                >
                  Save Game Score
                </button>
              )}
              {game.saved && !isEditing && (
                <button
                  onClick={() => setIsEditing(true)}
                  className="w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 font-bold flex items-center justify-center gap-2 active:scale-95 transition border border-slate-700 hover:border-slate-600"
                >
                  <Pencil size={14} className="text-[#d7f24c]" /> Edit Game Score
                </button>
              )}
              {game.saved && isEditing && (
                <div className="flex gap-2">
                  <button
                    onClick={handleCancelClick}
                    className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold active:scale-95 transition border border-slate-700"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={handleSaveClick}
                    className="flex-1 py-2.5 rounded-xl bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 font-bold active:scale-95 transition shadow-lg shadow-[#d7f24c]/20"
                  >
                    Update Score
                  </button>
                </div>
              )}
            </>
          )}

          {!isAdmin && (
            <p className="text-center text-xs text-slate-500 italic mt-1">
              Spectator view &bull; Scores are recorded by scorekeeper.
            </p>
          )}
        </div>
      )}
    </div>
  );
}

export function MatchDashboard({
  match,
  teamA,
  teamB,
  playersById,
  bracket = null,
  teams = [],
  roomId = '',
  onSaveGame,
  onToggleInProgress,
  numCourts = 2,
  onSetGameCourt,
  onBatchAssignCourtsLive,
  onOpenEditMatchup,
  onShuffleGame,
  onRandomizeUpcoming,
  onRevertUpcoming,
  onRevertGame,
  onOpenRoster,
  onBack,
  onGoToDreambreaker,
  onGoToBracket,
  isAdmin,
}) {
  const [expandedId, setExpandedId] = useState(null);
  const [isCourtAssignOpen, setIsCourtAssignOpen] = useState(false);

  if (!match.games) return null;
  const isTie = match.status === 'tied';
  const isDone = match.status === 'complete';
  const hasUpcomingGames = match.games.some((g) => !g.inProgress && !g.saved);

  function handleExportScoresCsv() {
    const csv = generateMatchScoresCSV({ bracket, teams, playersById, roomId });
    triggerCsvDownload(`${roomId || 'room'}-match-scores.csv`, csv);
  }

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 animate-in fade-in duration-200">
      {/* Top Action Bar */}
      <div className="flex items-center justify-between gap-2 mb-4">
        <button
          onClick={onBack}
          className="flex items-center gap-1 text-slate-400 hover:text-white text-xs sm:text-sm font-semibold transition shrink-0"
        >
          <ArrowLeft size={16} /> Back to Bracket
        </button>

        <div className="flex items-center gap-1.5 shrink-0 flex-wrap justify-end">
          {isAdmin && hasUpcomingGames && onBatchAssignCourtsLive && (
            <button
              type="button"
              onClick={() => setIsCourtAssignOpen(true)}
              title="Assign upcoming games to available courts and mark them live"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-cyan-500/15 hover:bg-cyan-500/25 text-cyan-300 text-xs font-bold border border-cyan-500/40 active:scale-95 transition shadow-sm"
            >
              <Play size={12} className="fill-current shrink-0" />
              <span className="hidden xs:inline">Assign Courts &amp; Live</span>
              <span className="xs:hidden">Courts</span>
            </button>
          )}
          {isAdmin && hasUpcomingGames && (
            <button
              onClick={onRandomizeUpcoming}
              title="Randomize matchups for all upcoming games not in progress"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-amber-400 text-xs font-bold border border-amber-500/30 active:scale-95 transition shadow-sm"
            >
              <Shuffle size={13} className="shrink-0" />
              <span className="hidden xs:inline">Randomize Upcoming</span>
              <span className="xs:hidden">Shuffle</span>
            </button>
          )}

          {isAdmin && onRevertUpcoming && (
            <button
              onClick={onRevertUpcoming}
              title="Revert randomized or customized matchups back to original setup configuration"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-[#d7f24c] text-xs font-bold border border-[#d7f24c]/30 active:scale-95 transition shadow-sm"
            >
              <RotateCcw size={13} className="shrink-0" />
              <span className="hidden xs:inline">Revert Matchups</span>
              <span className="xs:hidden">Revert</span>
            </button>
          )}

          {bracket && (
            <button
              type="button"
              onClick={handleExportScoresCsv}
              title="Export all tournament match & game scores as CSV"
              className="flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white text-xs font-bold border border-slate-700 active:scale-95 transition shadow-sm"
            >
              <Download size={13} className="text-[#d7f24c] shrink-0" />
              <span className="hidden sm:inline">Export Scores CSV</span>
              <span className="sm:hidden">CSV</span>
            </button>
          )}
        </div>
      </div>

      {/* Main Match Header Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-3xl p-3.5 sm:p-5 mb-5 shadow-2xl">
        <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 sm:gap-4 mb-2">
          {/* Team A */}
          <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
            <TeamDot color={teamA.color} />
            <div className="min-w-0">
              <div className="flex items-center gap-1">
                <span className="font-bold text-white text-xs sm:text-base truncate">{teamA.name}</span>
                {isAdmin && (
                  <button
                    onClick={() => onOpenRoster(teamA.id)}
                    title={`Manage ${teamA.name} roster & subs`}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition shrink-0"
                  >
                    <UserPlus size={13} />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Centered Score Badge */}
          <div className="px-3 sm:px-4 py-1.5 rounded-2xl bg-slate-950 border border-slate-800 shrink-0 text-center shadow-inner">
            <span className="text-2xl sm:text-4xl font-display font-black text-white tabular-nums tracking-wider whitespace-nowrap">
              {match.gamesWonA} &ndash; {match.gamesWonB}
            </span>
          </div>

          {/* Team B */}
          <div className="flex items-center justify-end gap-1.5 sm:gap-2 min-w-0 text-right">
            <div className="min-w-0">
              <div className="flex items-center justify-end gap-1">
                {isAdmin && (
                  <button
                    onClick={() => onOpenRoster(teamB.id)}
                    title={`Manage ${teamB.name} roster & subs`}
                    className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition shrink-0"
                  >
                    <UserPlus size={13} />
                  </button>
                )}
                <span className="font-bold text-white text-xs sm:text-base truncate">{teamB.name}</span>
              </div>
            </div>
            <TeamDot color={teamB.color} />
          </div>
        </div>
        <p className="text-slate-500 text-[11px] sm:text-xs text-center">
          Regulation &mdash; first to win the most of {match.games.length} games
        </p>
      </div>

      {/* Match Tied Banner */}
      {isTie && (
        <div className="bg-amber-500/10 border border-amber-500/40 rounded-3xl p-5 mb-5 text-center shadow-xl">
          <p className="text-amber-400 font-extrabold text-base flex items-center justify-center gap-2 mb-1">
            <Zap size={20} /> Match Tied! Dreambreaker Required.
          </p>
          <p className="text-slate-400 text-xs mb-3">
            Regulation finished in a tie ({match.gamesWonA}-{match.gamesWonB}). The match will be decided by singles rotation.
          </p>
          <button
            onClick={onGoToDreambreaker}
            className="w-full py-3.5 rounded-2xl bg-amber-500 hover:bg-amber-400 text-slate-950 font-black text-base active:scale-95 transition shadow-lg shadow-amber-500/20"
          >
            {isAdmin ? 'Set Up Dreambreaker' : 'View Dreambreaker'}
          </button>
        </div>
      )}

      {/* Match Won Banner */}
      {isDone && !isTie && (
        <div className="bg-[#d7f24c]/10 border border-[#d7f24c]/40 rounded-3xl p-5 mb-5 text-center shadow-xl">
          <p className="text-[#d7f24c] font-extrabold text-lg flex items-center justify-center gap-2 mb-1">
            <Trophy size={22} /> {match.winnerId === teamA.id ? teamA.name : teamB.name} wins the match!
          </p>
          <button
            onClick={onGoToBracket}
            className="mt-2 w-full py-3.5 rounded-2xl bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 font-black text-base active:scale-95 transition shadow-lg shadow-[#d7f24c]/20"
          >
            Back to Bracket
          </button>
        </div>
      )}

      {/* Regulation Games List */}
      {match.games.map((g, i) => (
        <GameRow
          key={g.id}
          game={g}
          index={i}
          teamA={teamA}
          teamB={teamB}
          playersById={playersById}
          expanded={expandedId === g.id}
          onToggle={() => setExpandedId(expandedId === g.id ? null : g.id)}
          onSave={(a, b) => onSaveGame(g.id, a, b)}
          onToggleInProgress={onToggleInProgress}
          numCourts={numCourts}
          onSetGameCourt={onSetGameCourt}
          onOpenEditMatchup={onOpenEditMatchup}
          onShuffleGame={onShuffleGame}
          onRevertGame={onRevertGame}
          isAdmin={isAdmin}
        />
      ))}

      <MlpCourtAssignModal
        isOpen={isCourtAssignOpen}
        onClose={() => setIsCourtAssignOpen(false)}
        games={match.games}
        numCourts={numCourts}
        playersById={playersById}
        onApply={(assignments) => onBatchAssignCourtsLive && onBatchAssignCourtsLive(assignments)}
      />
    </div>
  );
}
