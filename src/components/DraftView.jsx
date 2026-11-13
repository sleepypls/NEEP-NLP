import React, { useState } from 'react';
import { UserCheck, Swords, ShieldAlert, Crown, ChevronUp, ChevronDown, Pencil, Check } from 'lucide-react';

export function DraftView({
  teams,
  remainingPool,
  pickSequence,
  pickPointer,
  playersById,
  sittingOut,
  onDraftPlayer,
  onReorderDraftPosition,
  onRenameTeam,
  onGenerateBracket,
  isAdmin,
}) {
  const [editingTeamId, setEditingTeamId] = useState(null);
  const [teamNameDraft, setTeamNameDraft] = useState('');
  const currentTeamIdx = pickPointer < pickSequence.length ? pickSequence[pickPointer] : null;
  const currentTeam = currentTeamIdx !== null ? teams[currentTeamIdx] : null;
  const isDraftComplete = pickPointer >= pickSequence.length;

  return (
    <div className="max-w-6xl mx-auto px-4 py-6 pb-24 animate-in fade-in duration-200">
      <div className="flex items-center justify-between mb-1">
        <h2 className="text-white text-3xl font-display uppercase tracking-wide font-semibold">Snake Draft</h2>
        {!isAdmin && (
          <span className="text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldAlert size={12} /> Spectator Mode
          </span>
        )}
      </div>
      <p className="text-slate-400 text-sm mb-6 text-balance">
        {isDraftComplete
          ? 'Draft complete! Generate the bracket to begin matches.'
          : currentTeam
          ? `On the clock: ${currentTeam.name} (Pick ${pickPointer + 1} of ${pickSequence.length})`
          : 'Draft in progress'}
      </p>

      {/* Draft Status Banner */}
      {!isDraftComplete && currentTeam && (
        <div
          className="rounded-2xl p-4 mb-6 border-2 flex items-center justify-between shadow-xl transition"
          style={{ backgroundColor: currentTeam.color.soft, borderColor: currentTeam.color.accent }}
        >
          <div>
            <span className="text-xs uppercase tracking-widest font-bold text-slate-400">Current Turn</span>
            <p className="text-xl font-black text-white">{currentTeam.name}</p>
          </div>
          <span className="font-mono text-sm font-bold px-3 py-1 rounded-full bg-slate-900/80 text-white">
            Pick {pickPointer + 1} / {pickSequence.length}
          </span>
        </div>
      )}

      {/* Available Players Pool */}
      {!isDraftComplete && (
        <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 shadow-xl">
          <label className="text-slate-300 text-sm font-semibold mb-3 block">
            Available Players ({remainingPool.length})
          </label>
          <div className="flex flex-wrap gap-2">
            {remainingPool.map((p) => (
              <button
                key={p.id}
                disabled={!isAdmin}
                onClick={() => onDraftPlayer(p.id)}
                className="group flex items-center gap-1.5 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm font-semibold transition active:scale-95 disabled:opacity-75 disabled:cursor-default"
              >
                <span>{p.name}</span>
                {isAdmin && <UserCheck size={16} className="text-[#d7f24c] opacity-0 group-hover:opacity-100 transition" />}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Team Rosters Board */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        {teams.map((team, idx) => (
          <div
            key={team.id}
            className={`rounded-2xl border-2 p-4 bg-slate-900 shadow-xl transition ${
              currentTeamIdx === idx && !isDraftComplete ? 'ring-2 ring-white/50' : ''
            }`}
            style={{ borderColor: team.color.accent }}
          >
            <div className="flex items-start justify-between gap-2 mb-3">
              {editingTeamId === team.id && isAdmin ? (
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (teamNameDraft.trim() && onRenameTeam) {
                      onRenameTeam(team.id, teamNameDraft.trim());
                    }
                    setEditingTeamId(null);
                  }}
                  className="flex items-center gap-1 flex-1 min-w-0"
                >
                  <input
                    type="text"
                    autoFocus
                    value={teamNameDraft}
                    onChange={(e) => setTeamNameDraft(e.target.value)}
                    onBlur={() => {
                      if (teamNameDraft.trim() && onRenameTeam) {
                        onRenameTeam(team.id, teamNameDraft.trim());
                      }
                      setEditingTeamId(null);
                    }}
                    className="w-full bg-slate-800 border border-[#d7f24c] rounded-lg px-2 py-0.5 text-white text-sm font-bold focus:outline-none"
                  />
                  <button type="submit" className="text-[#d7f24c] p-0.5 shrink-0">
                    <Check size={14} />
                  </button>
                </form>
              ) : (
                <div className="flex items-center gap-1.5 min-w-0 flex-1">
                  <span className="font-bold text-white text-base leading-snug break-words">{team.name}</span>
                  {isAdmin && onRenameTeam && (
                    <button
                      type="button"
                      onClick={() => {
                        setEditingTeamId(team.id);
                        setTeamNameDraft(team.name);
                      }}
                      className="text-slate-500 hover:text-[#d7f24c] p-0.5 rounded transition shrink-0"
                      title="Rename team"
                    >
                      <Pencil size={12} />
                    </button>
                  )}
                </div>
              )}
              <span className="text-xs font-mono font-bold text-slate-300 bg-slate-800 border border-slate-700/70 px-2.5 py-0.5 rounded-full shrink-0 whitespace-nowrap">
                {team.draftOrder.length} {team.draftOrder.length === 1 ? 'player' : 'players'}
              </span>
            </div>
            <ol className="space-y-1.5 text-sm">
              {team.draftOrder.map((pid, i) => {
                const isCaptain = team.captainId === pid;
                const canMoveUp = i > 0;
                const canMoveDown = i < team.draftOrder.length - 1;
                return (
                  <li key={pid} className="flex items-center justify-between gap-2 bg-slate-800/80 rounded-xl px-3 py-2 text-slate-200">
                    <div className="flex items-center gap-2 min-w-0 flex-1">
                      <span className="font-mono text-xs text-slate-500 w-5 shrink-0">{i + 1}.</span>
                      <span className="font-semibold text-white break-words">{playersById[pid]}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      {isCaptain && (
                        <span className="text-[10px] font-bold uppercase tracking-wider bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1 shrink-0">
                          <Crown size={11} className="fill-current" /> Captain
                        </span>
                      )}
                      {isAdmin && onReorderDraftPosition && team.draftOrder.length > 1 && (
                      <div className="flex items-center gap-0.5 shrink-0 ml-1">
                        <button
                          type="button"
                          disabled={!canMoveUp}
                          onClick={() => onReorderDraftPosition(team.id, i, i - 1)}
                          title={`Move ${playersById[pid]} up to Slot ${i}`}
                          className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-[#d7f24c] disabled:opacity-25 disabled:pointer-events-none transition"
                        >
                          <ChevronUp size={14} />
                        </button>
                        <button
                          type="button"
                          disabled={!canMoveDown}
                          onClick={() => onReorderDraftPosition(team.id, i, i + 1)}
                          title={`Move ${playersById[pid]} down to Slot ${i + 2}`}
                          className="p-0.5 rounded hover:bg-slate-700 text-slate-400 hover:text-[#d7f24c] disabled:opacity-25 disabled:pointer-events-none transition"
                        >
                          <ChevronDown size={14} />
                        </button>
                      </div>
                    )}
                    </div>
                  </li>
                );
              })}
            </ol>
          </div>
        ))}
      </div>

      {/* Sitting Out Pool (if any) */}
      {sittingOut.length > 0 && (
        <div className="bg-slate-900/60 border border-slate-800/60 rounded-2xl p-4 mb-6 text-xs text-slate-500">
          <span className="font-bold uppercase tracking-wider block mb-1">Sitting Out (Even Split Option):</span>
          <p>{sittingOut.map((id) => playersById[id]).join(', ')}</p>
        </div>
      )}

      {/* Generate Bracket Button */}
      {isDraftComplete && isAdmin && (
        <button
          onClick={onGenerateBracket}
          className="w-full py-4 rounded-2xl font-extrabold text-lg bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 shadow-xl shadow-[#d7f24c]/20 flex items-center justify-center gap-2 active:scale-95 transition"
        >
          <Swords size={20} /> Generate Tournament Bracket
        </button>
      )}
    </div>
  );
}
