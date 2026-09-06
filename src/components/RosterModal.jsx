import React, { useState } from 'react';
import { X, UserCheck, UserPlus, Pencil, Check, Crown, AlertCircle, Sparkles, Users } from 'lucide-react';

export function RosterModal({
  isOpen,
  onClose,
  teams = [],
  playersById = {},
  savedPlayers = [],
  onSubstitutePlayer,
  onRenamePlayer,
  isAdmin,
  initialTeamId = null,
}) {
  const [activeTeamId, setActiveTeamId] = useState(() => initialTeamId ?? (teams[0]?.id ?? 0));
  const [subTarget, setSubTarget] = useState(null); // { teamId, playerId, slotIndex }
  const [subName, setSubName] = useState('');
  const [editingPlayerId, setEditingPlayerId] = useState(null);
  const [editName, setEditName] = useState('');

  if (!isOpen) return null;

  const activeTeam = teams.find((t) => t.id === activeTeamId) || teams[0];

  // List of all active player names in the tournament
  const activeNamesSet = new Set(
    Object.values(playersById).map((n) => String(n).trim().toLowerCase())
  );

  const availableSubs = (savedPlayers || []).filter(
    (name) => !activeNamesSet.has(String(name).trim().toLowerCase())
  );

  function startSub(teamId, playerId, slotIndex) {
    if (!isAdmin) return;
    setSubTarget({ teamId, playerId, slotIndex });
    setSubName('');
    setEditingPlayerId(null);
  }

  function handleConfirmSub() {
    if (!subTarget || !subName.trim()) return;
    onSubstitutePlayer(subTarget.teamId, subTarget.playerId, subName.trim());
    setSubTarget(null);
    setSubName('');
  }

  function startRename(playerId, currentName) {
    if (!isAdmin) return;
    setEditingPlayerId(playerId);
    setEditName(currentName);
    setSubTarget(null);
  }

  function handleConfirmRename(playerId) {
    if (!editName.trim()) return;
    onRenamePlayer(playerId, editName.trim());
    setEditingPlayerId(null);
    setEditName('');
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/85 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-lg p-5 sm:p-6 shadow-2xl relative overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="flex items-center justify-between pb-3 border-b border-slate-800 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-2xl bg-[#d7f24c]/10 border border-[#d7f24c]/30 flex items-center justify-center text-[#d7f24c]">
              <Users size={18} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white font-display">Team Rosters & Subs</h3>
              <p className="text-xs text-slate-400">View team lineups, substitute players, or fix names.</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Team Selector Tabs */}
        {teams.length > 1 && (
          <div className="flex gap-1.5 overflow-x-auto py-3 shrink-0 scrollbar-none border-b border-slate-800/80">
            {teams.map((t) => {
              const isActive = t.id === activeTeamId;
              return (
                <button
                  key={t.id}
                  onClick={() => {
                    setActiveTeamId(t.id);
                    setSubTarget(null);
                    setEditingPlayerId(null);
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold whitespace-nowrap transition flex items-center gap-1.5 ${
                    isActive
                      ? 'bg-slate-800 text-white border border-slate-700 shadow-md ring-1 ring-[#d7f24c]/40'
                      : 'text-slate-400 hover:text-slate-200 hover:bg-slate-850'
                  }`}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full shrink-0"
                    style={{ backgroundColor: t.color?.accent || '#64748b' }}
                  />
                  <span>{t.name}</span>
                </button>
              );
            })}
          </div>
        )}

        {/* Team Content */}
        <div className="overflow-y-auto flex-1 py-4 space-y-3 pr-1">
          {activeTeam && (
            <>
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  <span
                    className="w-3 h-3 rounded-full shrink-0"
                    style={{ backgroundColor: activeTeam.color?.accent || '#64748b' }}
                  />
                  <span className="font-bold text-white text-base">{activeTeam.name}</span>
                  <span className="text-xs text-slate-500 font-medium">({activeTeam.draftOrder.length} players)</span>
                </div>
              </div>

              {/* Player Roster List */}
              <div className="space-y-2">
                {activeTeam.draftOrder.map((playerId, slotIdx) => {
                  const playerName = playersById[playerId] || `Player ${playerId}`;
                  const isCaptain = activeTeam.captainId === playerId;
                  const isSubbingThis = subTarget?.playerId === playerId;
                  const isEditingThis = editingPlayerId === playerId;

                  return (
                    <div
                      key={playerId}
                      className={`border rounded-2xl p-3 transition ${
                        isSubbingThis
                          ? 'bg-amber-500/10 border-amber-500/40 shadow-lg shadow-amber-500/10'
                          : 'bg-slate-950/60 border-slate-800/80 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 min-w-0 flex-1">
                          <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-800 px-2 py-0.5 rounded-lg shrink-0">
                            Slot {slotIdx + 1}
                          </span>
                          {isCaptain && (
                            <span className="text-amber-400 shrink-0" title="Team Captain">
                              <Crown size={14} className="fill-current" />
                            </span>
                          )}

                          {isEditingThis ? (
                            <div className="flex items-center gap-1.5 flex-1 min-w-0">
                              <input
                                autoFocus
                                value={editName}
                                onChange={(e) => setEditName(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === 'Enter') handleConfirmRename(playerId);
                                  if (e.key === 'Escape') setEditingPlayerId(null);
                                }}
                                className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white text-xs font-bold flex-1 focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
                              />
                              <button
                                onClick={() => handleConfirmRename(playerId)}
                                className="p-1 rounded-lg bg-[#d7f24c] text-slate-950 hover:bg-[#c6e140] transition"
                              >
                                <Check size={13} />
                              </button>
                              <button
                                onClick={() => setEditingPlayerId(null)}
                                className="p-1 rounded-lg bg-slate-800 text-slate-400 hover:text-white transition"
                              >
                                <X size={13} />
                              </button>
                            </div>
                          ) : (
                            <span className="font-semibold text-white text-sm truncate">{playerName}</span>
                          )}
                        </div>

                        {isAdmin && !isEditingThis && (
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              onClick={() => startRename(playerId, playerName)}
                              title="Rename player"
                              className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-400 hover:text-white text-xs font-semibold transition"
                            >
                              <Pencil size={12} />
                            </button>
                            <button
                              onClick={() =>
                                isSubbingThis
                                  ? setSubTarget(null)
                                  : startSub(activeTeam.id, playerId, slotIdx)
                              }
                              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition flex items-center gap-1 ${
                                isSubbingThis
                                  ? 'bg-amber-400 text-slate-950 font-extrabold'
                                  : 'bg-slate-800 hover:bg-slate-750 text-amber-400 border border-amber-500/20'
                              }`}
                            >
                              <UserPlus size={12} />
                              <span>{isSubbingThis ? 'Cancel Sub' : 'Sub'}</span>
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Inline Substitution Panel */}
                      {isSubbingThis && (
                        <div className="mt-3 pt-3 border-t border-amber-500/20 text-xs">
                          <p className="text-amber-300/90 font-medium mb-2 flex items-center gap-1">
                            <AlertCircle size={13} />
                            Replacing <strong className="text-white">{playerName}</strong> for remaining games:
                          </p>

                          <div className="flex gap-2 mb-2">
                            <input
                              autoFocus
                              value={subName}
                              onChange={(e) => setSubName(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleConfirmSub();
                              }}
                              placeholder="Substitute player name"
                              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-medium text-xs focus:outline-none focus:ring-2 focus:ring-amber-400"
                            />
                            <button
                              disabled={!subName.trim()}
                              onClick={handleConfirmSub}
                              className="px-3 py-2 rounded-xl bg-amber-400 hover:bg-amber-300 disabled:opacity-50 text-slate-950 font-bold transition flex items-center gap-1"
                            >
                              <Check size={14} />
                              Apply Sub
                            </button>
                          </div>

                          {/* Quick fill from saved player pool */}
                          {availableSubs.length > 0 && (
                            <div className="pt-1">
                              <span className="text-[10px] text-slate-400 block mb-1 font-semibold uppercase tracking-wider">
                                Or choose from saved players:
                              </span>
                              <div className="flex flex-wrap gap-1">
                                {availableSubs.slice(0, 6).map((name) => (
                                  <button
                                    key={name}
                                    type="button"
                                    onClick={() => setSubName(name)}
                                    className="px-2 py-0.5 rounded-full bg-slate-800 hover:bg-slate-750 border border-slate-700 text-slate-300 text-[11px] font-medium transition active:scale-95"
                                  >
                                    + {name}
                                  </button>
                                ))}
                              </div>
                            </div>
                          )}

                          <p className="text-slate-500 text-[11px] mt-2 italic">
                            * Completed games and stats will remain attributed to {playerName}. All future games and tiebreaker rotations will feature the substitute.
                          </p>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Modal Footer */}
        <div className="pt-3 border-t border-slate-800 shrink-0 flex justify-end">
          <button
            onClick={onClose}
            className="w-full sm:w-auto px-6 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-sm transition"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
