import React from 'react';
import { ArrowLeft, ChevronUp, ChevronDown, Lock, Zap, Play, Users } from 'lucide-react';

function TeamDot({ color, className = '' }) {
  return <span className={`inline-block w-3 h-3 rounded-full flex-shrink-0 ${className}`} style={{ backgroundColor: color?.accent || '#64748b' }} />;
}

function LineupBuilder({ team, lineup, locked, playersById, format, onMove, onLock, isAdmin }) {
  const isDoubles = format === 'doubles';

  return (
    <div className={`rounded-3xl border-2 p-4 bg-slate-900 shadow-xl ${team.color.border}`}>
      <div className="flex items-center justify-between mb-3">
        <span className="flex items-center gap-2 font-bold text-white text-sm truncate">
          <TeamDot color={team.color} />
          <span className="truncate">{team.name}</span>
        </span>
        {locked && (
          <span className="flex items-center gap-1 text-[#d7f24c] text-xs font-bold bg-[#d7f24c]/10 border border-[#d7f24c]/20 px-2 py-0.5 rounded-full">
            <Lock size={12} /> LOCKED
          </span>
        )}
      </div>

      {locked ? (
        <p className="text-slate-500 text-xs italic py-4 text-center">
          Lineup locked &mdash; hidden until Dreambreaker starts.
        </p>
      ) : (
        <ol className="space-y-2">
          {lineup.map((pid, i) => {
            const pairNum = Math.floor(i / 2) + 1;
            const isFirstOfPair = isDoubles && i % 2 === 0;
            return (
              <React.Fragment key={pid}>
                {isFirstOfPair && (
                  <div className="flex items-center justify-between pt-1 first:pt-0">
                    <span className="text-[10px] font-mono uppercase tracking-wider font-bold text-amber-400/90 flex items-center gap-1">
                      <Users size={11} /> Rotation Pair {pairNum} (Slots {i + 1}{i + 1 < lineup.length ? ` & ${i + 2}` : ' & 1'})
                    </span>
                  </div>
                )}
                <li className="flex items-center gap-2 bg-slate-800 rounded-xl px-3 py-2 text-slate-200 text-sm">
                  <span className="font-mono text-xs text-slate-400 w-4 font-bold">{i + 1}.</span>
                  <span className="font-medium truncate flex-1">{playersById[pid]}</span>
                  {isAdmin && (
                    <div className="flex gap-1">
                      <button
                        disabled={i === 0}
                        onClick={() => onMove(i, -1)}
                        className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 disabled:opacity-30 disabled:cursor-default"
                      >
                        <ChevronUp size={16} />
                      </button>
                      <button
                        disabled={i === lineup.length - 1}
                        onClick={() => onMove(i, 1)}
                        className="p-1 rounded-lg hover:bg-slate-700 text-slate-400 disabled:opacity-30 disabled:cursor-default"
                      >
                        <ChevronDown size={16} />
                      </button>
                    </div>
                  )}
                </li>
              </React.Fragment>
            );
          })}
        </ol>
      )}

      {isAdmin && !locked && (
        <button
          onClick={onLock}
          className="mt-4 w-full py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs flex items-center justify-center gap-1.5 active:scale-95 transition border border-slate-700"
        >
          <Lock size={13} /> Lock Lineup
        </button>
      )}
    </div>
  );
}

export function DreambreakerSetupView({
  match,
  teamA,
  teamB,
  playersById,
  dreambreakerScore,
  dreambreakerFormat = 'singles',
  onUpdateScoreLimit,
  onUpdateFormat,
  onMove,
  onLock,
  onStart,
  onBack,
  isAdmin,
}) {
  const db = match.dreambreaker;
  if (!db) return null;
  const bothLocked = db.lockedA && db.lockedB;
  const activeLimit = db.goalScore || dreambreakerScore || 21;
  const activeFormat = db.format || dreambreakerFormat || 'singles';

  return (
    <div className="max-w-2xl mx-auto px-4 py-6 pb-24 animate-in fade-in duration-200">
      <button onClick={onBack} className="flex items-center gap-1 text-slate-400 hover:text-white text-sm font-semibold mb-4 transition">
        <ArrowLeft size={16} /> Back to Bracket
      </button>

      <div className="text-center mb-6">
        <p className="text-amber-400 font-extrabold flex items-center justify-center gap-2 mb-1 text-base">
          <Zap size={20} /> Dreambreaker Setup ({activeFormat === 'doubles' ? 'Doubles 2v2' : 'Singles 1v1'})
        </p>
        <p className="text-slate-400 text-xs">
          {activeFormat === 'doubles'
            ? `Set lineup order. Doubles pairs rotate every 4 combined points in games to ${activeLimit}.`
            : `Set lineup order. Players rotate every 4 combined points in singles games to ${activeLimit}.`}
        </p>
      </div>

      {/* Format & Target Score Limit Selector */}
      {isAdmin && (
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-4 mb-5 shadow-xl space-y-4">
          <div>
            <label className="text-slate-300 text-xs font-bold uppercase tracking-wider block mb-2">
              Dreambreaker Format
            </label>
            <div className="grid grid-cols-2 gap-2">
              <button
                type="button"
                onClick={() => onUpdateFormat && onUpdateFormat('singles')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeFormat !== 'doubles'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                Singles (1v1 Rotation)
              </button>
              <button
                type="button"
                onClick={() => onUpdateFormat && onUpdateFormat('doubles')}
                className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  activeFormat === 'doubles'
                    ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                Doubles (2v2 Rotation)
              </button>
            </div>
          </div>

          <div>
            <label className="text-slate-300 text-xs font-bold uppercase tracking-wider block mb-2">
              Dreambreaker Score Limit
            </label>
            <div className="flex gap-2">
              {[11, 15, 21].map((preset) => (
                <button
                  key={preset}
                  type="button"
                  onClick={() => onUpdateScoreLimit(preset)}
                  className={`flex-1 py-2 rounded-xl text-xs font-bold transition ${
                    activeLimit === preset
                      ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                      : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                  }`}
                >
                  {preset} pts
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 mb-6">
        <LineupBuilder
          team={teamA}
          lineup={db.lineupA}
          locked={db.lockedA}
          playersById={playersById}
          format={activeFormat}
          onMove={(i, dir) => onMove('A', i, dir)}
          onLock={() => onLock('A')}
          isAdmin={isAdmin}
        />
        <LineupBuilder
          team={teamB}
          lineup={db.lineupB}
          locked={db.lockedB}
          playersById={playersById}
          format={activeFormat}
          onMove={(i, dir) => onMove('B', i, dir)}
          onLock={() => onLock('B')}
          isAdmin={isAdmin}
        />
      </div>

      {isAdmin && (
        <button
          onClick={onStart}
          disabled={!bothLocked}
          className={`w-full py-4 rounded-2xl font-extrabold text-lg flex items-center justify-center gap-2 transition active:scale-95 shadow-xl ${
            bothLocked
              ? 'bg-amber-500 hover:bg-amber-400 text-slate-950 shadow-amber-500/20'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          <Play size={20} /> Start {activeFormat === 'doubles' ? 'Doubles' : 'Singles'} Dreambreaker
        </button>
      )}
    </div>
  );
}
