import React, { useEffect } from 'react';
import { ArrowLeft, Trophy, Zap, Shuffle } from 'lucide-react';
import confetti from 'canvas-confetti';
import { getActiveDreambreakerPlayers } from '../utils/tournament';

function TeamDot({ color, className = '' }) {
  return <span className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${className}`} style={{ backgroundColor: color?.accent || '#64748b' }} />;
}

export function DreambreakerPlayView({
  match,
  teamA,
  teamB,
  playersById,
  dreambreakerScore,
  dreambreakerFormat = 'singles',
  showRotateBanner,
  onScore,
  onBack,
  isAdmin,
}) {
  const db = match.dreambreaker;
  if (!db) return null;

  const activeFormat = db.format || dreambreakerFormat || 'singles';
  const activeAIds = getActiveDreambreakerPlayers(db.lineupA, db.rotationIndex, activeFormat);
  const activeBIds = getActiveDreambreakerPlayers(db.lineupB, db.rotationIndex, activeFormat);
  const nextAIds = getActiveDreambreakerPlayers(db.lineupA, db.rotationIndex + 1, activeFormat);
  const nextBIds = getActiveDreambreakerPlayers(db.lineupB, db.rotationIndex + 1, activeFormat);
  const targetScore = db.goalScore || dreambreakerScore || 21;
  const combinedPoints = (db.scoreA || 0) + (db.scoreB || 0);
  const pointsUntilRotate = 4 - (combinedPoints % 4);

  useEffect(() => {
    if (db.completed) {
      confetti({
        particleCount: 100,
        spread: 70,
        origin: { y: 0.6 },
      });
    }
  }, [db.completed]);

  if (db.completed) {
    const winner = db.winnerId === teamA.id ? teamA : teamB;
    return (
      <div className="max-w-lg mx-auto px-4 py-12 text-center animate-in fade-in duration-200">
        <Trophy size={54} className="mx-auto text-amber-400 mb-3 animate-bounce" />
        <p className="text-amber-300 text-xs uppercase tracking-widest font-bold">
          {activeFormat === 'doubles' ? 'Doubles Dreambreaker Complete' : 'Singles Dreambreaker Complete'}
        </p>
        <p className="text-white text-3xl sm:text-4xl font-black mb-2">{winner.name} wins!</p>
        <p className="text-slate-400 font-mono text-2xl mb-8 font-bold">{db.scoreA} - {db.scoreB}</p>
        <button
          onClick={onBack}
          className="w-full py-4 rounded-2xl font-extrabold text-lg bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 active:scale-95 transition shadow-xl shadow-[#d7f24c]/20"
        >
          Back to Bracket
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 relative animate-in fade-in duration-200">
      <button onClick={onBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm font-semibold mb-4 transition">
        <ArrowLeft size={16} /> Back to Bracket
      </button>

      {showRotateBanner && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-amber-500 text-slate-950 font-extrabold px-6 py-3 rounded-2xl shadow-2xl flex items-center gap-2 animate-bounce border-2 border-white">
          <Shuffle size={20} /> ROTATE {activeFormat === 'doubles' ? 'PAIRS!' : 'PLAYERS!'}
        </div>
      )}

      {/* Current Matchup Header Card */}
      <div className="bg-gradient-to-br from-amber-500/10 via-slate-900 to-slate-900 border border-amber-500/30 rounded-3xl p-5 mb-6 text-center shadow-xl">
        <p className="text-amber-400 text-xs uppercase tracking-widest font-bold mb-1.5 flex items-center justify-center gap-1.5">
          <Zap size={14} /> {activeFormat === 'doubles' ? 'Doubles Dreambreaker' : 'Singles Dreambreaker'} &mdash; to {targetScore}, win by 2
        </p>
        <p className="text-slate-400 text-xs mb-1 font-medium">
          {activeFormat === 'doubles' ? 'Active Doubles Matchup (2v2)' : 'Active Singles Matchup (1v1)'}
        </p>
        <p className="text-white text-xl font-bold tracking-wide">
          <span>{activeAIds.map((id) => playersById[id]).join(' & ')}</span>
          <span className="text-slate-500 font-normal mx-2">vs</span>
          <span>{activeBIds.map((id) => playersById[id]).join(' & ')}</span>
        </p>
        <div className="mt-3 pt-2.5 border-t border-slate-800/80 flex items-center justify-between text-[11px] text-slate-400">
          <span>
            Up Next: <strong className="text-slate-300">{nextAIds.map((id) => playersById[id]).join(' & ')}</strong> vs <strong className="text-slate-300">{nextBIds.map((id) => playersById[id]).join(' & ')}</strong>
          </span>
          <span className="font-mono text-amber-400 font-bold shrink-0 ml-2">
            Rotate in {pointsUntilRotate} pt{pointsUntilRotate === 1 ? '' : 's'}
          </span>
        </div>
      </div>

      {/* Scoring Controls */}
      <div className="grid grid-cols-2 gap-4 mb-4">
        {/* Team A */}
        <div className="text-center bg-slate-900/60 border border-slate-800 rounded-3xl p-4">
          <p className="text-sm font-bold mb-2 flex items-center justify-center gap-1.5 text-white truncate">
            <TeamDot color={teamA.color} />
            <span className="truncate">{teamA.name}</span>
          </p>
          <p className="text-6xl sm:text-8xl font-display font-black text-white mb-3 sm:mb-4 tabular-nums">
            {db.scoreA}
          </p>
          {isAdmin ? (
            <button
              onClick={() => onScore('A')}
              className="w-full aspect-square rounded-3xl text-4xl sm:text-5xl font-black text-slate-950 active:scale-95 transition shadow-2xl flex items-center justify-center hover:opacity-90"
              style={{ backgroundColor: teamA.color.accent }}
            >
              +1
            </button>
          ) : (
            <div className="w-full aspect-square rounded-3xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-500 text-sm font-semibold">
              Live Spectating
            </div>
          )}
        </div>

        {/* Team B */}
        <div className="text-center bg-slate-900/60 border border-slate-800 rounded-3xl p-4">
          <p className="text-sm font-bold mb-2 flex items-center justify-center gap-1.5 text-white truncate">
            <TeamDot color={teamB.color} />
            <span className="truncate">{teamB.name}</span>
          </p>
          <p className="text-6xl sm:text-8xl font-display font-black text-white mb-3 sm:mb-4 tabular-nums">
            {db.scoreB}
          </p>
          {isAdmin ? (
            <button
              onClick={() => onScore('B')}
              className="w-full aspect-square rounded-3xl text-4xl sm:text-5xl font-black text-slate-950 active:scale-95 transition shadow-2xl flex items-center justify-center hover:opacity-90"
              style={{ backgroundColor: teamB.color.accent }}
            >
              +1
            </button>
          ) : (
            <div className="w-full aspect-square rounded-3xl bg-slate-800/60 border border-slate-700 flex items-center justify-center text-slate-500 text-sm font-semibold">
              Live Spectating
            </div>
          )}
        </div>
      </div>

      <p className="text-slate-500 text-xs text-center">
        Rotation advances automatically every 4 combined points.
      </p>
    </div>
  );
}
