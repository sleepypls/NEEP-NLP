import React, { useState } from 'react';
import { UserPlus, Users, X, Shuffle, Zap, ShieldAlert, Crown, Check, Lock, Sparkles, KeyRound, ArrowRightLeft, Plus, Trash2, Pencil } from 'lucide-react';
import { generateRoomId, generatePin, sanitizeRoomId } from '../utils/room';
import { getDefaultSlotPairs } from '../utils/tournament';

export function SetupView({
  playerPool,
  addPlayer,
  removePlayer,
  savedPlayers = [],
  onAddSavedPlayer,
  onAddAllSavedPlayers,
  onRemoveSavedPlayer,
  onAddDirectoryPlayer,
  onRenameDirectoryPlayer,
  onImportFromMainDirectory,
  numTeams,
  setNumTeams,
  goalScore,
  setGoalScore,
  dreambreakerScore,
  setDreambreakerScore,
  allowUneven,
  setAllowUneven,
  captainMode = 'random',
  setCaptainMode,
  selectedCaptainIds = [],
  setSelectedCaptainIds,
  matchupConfig = { preset: 'adjacent', customSlotPairs: [] },
  setMatchupConfig,
  roomId,
  setRoomId,
  adminPin,
  setAdminPin,
  onInitializeDraft,
  isAdmin,
}) {
  const [nameInput, setNameInput] = useState('');
  const [directoryNameInput, setDirectoryNameInput] = useState('');
  const [editingDirectoryName, setEditingDirectoryName] = useState(null);
  const [editDirectoryValue, setEditDirectoryValue] = useState('');

  function toggleCaptain(id) {
    if (!isAdmin) return;
    if (selectedCaptainIds.includes(id)) {
      setSelectedCaptainIds(selectedCaptainIds.filter((cid) => cid !== id));
    } else {
      if (selectedCaptainIds.length >= numTeams) {
        setSelectedCaptainIds([...selectedCaptainIds.slice(1), id]);
      } else {
        setSelectedCaptainIds([...selectedCaptainIds, id]);
      }
    }
  }

  function handleAutoFillCaptains() {
    if (!isAdmin) return;
    const currentSet = new Set(selectedCaptainIds);
    const unpicked = playerPool.filter((p) => !currentSet.has(p.id));
    const shuffled = [...unpicked].sort(() => Math.random() - 0.5);
    const needed = Math.max(0, numTeams - selectedCaptainIds.length);
    const toAdd = shuffled.slice(0, needed).map((p) => p.id);
    setSelectedCaptainIds([...selectedCaptainIds, ...toAdd]);
  }

  const baseTeamSize = numTeams ? Math.floor(playerPool.length / numTeams) : 0;
  const extraPlayers = numTeams ? playerPool.length % numTeams : 0;
  const meetsMinimum = playerPool.length >= numTeams * 2;
  const canInitialize = meetsMinimum && baseTeamSize >= 2;

  const availableSaved = (savedPlayers || []).filter(
    (name) => !playerPool.some((p) => p.name.trim().toLowerCase() === name.trim().toLowerCase())
  );

  function handleAdd() {
    const trimmed = nameInput.trim();
    if (!trimmed) return;
    addPlayer(trimmed);
    setNameInput('');
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 animate-in fade-in duration-200">
      {/* Club Hero Card */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-slate-900 via-slate-900/95 to-blue-950/40 border border-slate-800 rounded-3xl p-4 mb-6 shadow-xl relative overflow-hidden">
        <div className="w-14 h-16 flex-shrink-0 flex items-center justify-center filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
          <img src="/logo.png" alt="NEEP-NLP Score Tracker Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span className="font-display font-black tracking-wider text-white text-xl">NEEP-NLP</span>
            <span className="text-[10px] font-mono text-[#d7f24c] bg-[#d7f24c]/10 border border-[#d7f24c]/30 px-2 py-0.5 rounded-full font-bold">SCORE TRACKER</span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">Tournament Score Tracker & Live Scoring</p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-1">
        <h2 className="text-white text-2xl font-display uppercase tracking-wide font-semibold">Tournament Setup</h2>
        {!isAdmin && (
          <span className="text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldAlert size={12} /> Spectator Mode
          </span>
        )}
      </div>
      <p className="text-slate-400 text-sm mb-6 text-balance">
        {isAdmin
          ? 'Add your player pool, pick team count, set score limits, and draft.'
          : 'Viewing tournament setup. Unlock Scorekeeper mode with PIN to make changes.'}
      </p>

      {/* Player Pool Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
        <label className="text-slate-300 text-sm font-semibold mb-2 block">
          Player Pool ({playerPool.length})
        </label>
        {isAdmin && (
          <div className="flex gap-2 mb-3">
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') handleAdd(); }}
              placeholder="Player name"
              className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white placeholder-slate-500 text-base focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
            />
            <button
              onClick={handleAdd}
              className="bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 rounded-xl px-4 py-3 font-bold active:scale-95 transition flex items-center gap-1 shadow-lg shadow-[#d7f24c]/10"
            >
              <UserPlus size={20} />
            </button>
          </div>
        )}

        {playerPool.length === 0 ? (
          <p className="text-slate-600 text-sm italic py-2">
            No players yet. Add at least {numTeams * 2} to start a draft.
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {playerPool.map((p) => {
              const isCaptain = captainMode === 'manual' && selectedCaptainIds.includes(p.id);
              return (
                <span
                  key={p.id}
                  className={`flex items-center gap-1.5 border rounded-full pl-3 pr-1.5 py-1.5 text-sm font-medium transition ${
                    isCaptain
                      ? 'bg-amber-500/15 border-amber-500/50 text-amber-300 font-semibold shadow-sm shadow-amber-500/10'
                      : 'bg-slate-800 border-slate-700 text-slate-200'
                  }`}
                >
                  {isCaptain && <Crown size={13} className="text-amber-400 fill-current" />}
                  <span>{p.name}</span>
                  {isAdmin && (
                    <button onClick={() => removePlayer(p.id)} className="p-1 rounded-full hover:bg-slate-700 text-slate-400 hover:text-red-400 transition">
                      <X size={14} />
                    </button>
                  )}
                </span>
              );
            })}
          </div>
        )}

        {/* Saved Players Tray (Per-Room Directory) */}
        {isAdmin && (
          <div className="mt-4 pt-3.5 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <Users size={13} className="text-[#d7f24c] shrink-0" />
                <span className="text-slate-300 text-xs font-bold uppercase tracking-wider truncate">
                  Directory ({savedPlayers.length})
                </span>
                <span className="text-[10px] font-mono font-bold bg-slate-850 text-[#d7f24c] border border-slate-700 px-1.5 py-0.5 rounded-md truncate max-w-[120px]">
                  {roomId || 'Main'}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {availableSaved.length > 0 && (
                  <button
                    onClick={onAddAllSavedPlayers}
                    className="text-xs font-bold text-[#d7f24c] hover:underline flex items-center gap-1 active:scale-95 transition"
                  >
                    <UserPlus size={13} /> + Add All ({availableSaved.length})
                  </button>
                )}
                {onImportFromMainDirectory && roomId && roomId !== 'neep-main' && savedPlayers.length === 0 && (
                  <button
                    onClick={onImportFromMainDirectory}
                    title="Copy player names from the main room directory into this room"
                    className="text-[11px] font-bold text-cyan-400 hover:text-cyan-300 flex items-center gap-1 active:scale-95 transition"
                  >
                    <Plus size={12} /> Import from Main
                  </button>
                )}
              </div>
            </div>

            {/* Quick add to this room's directory */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = directoryNameInput.trim();
                if (trimmed && onAddDirectoryPlayer) {
                  onAddDirectoryPlayer(trimmed);
                  setDirectoryNameInput('');
                }
              }}
              className="flex items-center gap-1.5 mb-2.5"
            >
              <input
                type="text"
                value={directoryNameInput}
                onChange={(e) => setDirectoryNameInput(e.target.value)}
                placeholder={`Save name to ${roomId || 'room'} directory...`}
                className="flex-1 bg-slate-950/70 border border-slate-800 rounded-xl px-2.5 py-1 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
              />
              <button
                type="submit"
                disabled={!directoryNameInput.trim()}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-[#d7f24c] font-bold text-xs border border-slate-700 disabled:opacity-40 transition shrink-0"
              >
                + Save
              </button>
            </form>

            {/* List of saved names in this room */}
            {savedPlayers.length > 0 ? (
              <>
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {[...savedPlayers]
                    .sort((a, b) => {
                      const aIn = playerPool.some((p) => p.name.trim().toLowerCase() === a.trim().toLowerCase());
                      const bIn = playerPool.some((p) => p.name.trim().toLowerCase() === b.trim().toLowerCase());
                      if (aIn === bIn) return a.localeCompare(b);
                      return aIn ? 1 : -1;
                    })
                    .map((name) => {
                      const isInPool = playerPool.some(
                        (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
                      );

                      if (editingDirectoryName === name) {
                        return (
                          <form
                            key={name}
                            onSubmit={(e) => {
                              e.preventDefault();
                              const trimmed = editDirectoryValue.trim();
                              if (trimmed && trimmed.toLowerCase() !== name.toLowerCase() && onRenameDirectoryPlayer) {
                                onRenameDirectoryPlayer(name, trimmed);
                              }
                              setEditingDirectoryName(null);
                            }}
                            className="inline-flex items-center gap-1 bg-slate-900 border border-[#d7f24c] rounded-full pl-2.5 pr-1 py-0.5 text-xs shadow-lg ring-1 ring-[#d7f24c]/40 animate-in fade-in duration-100"
                          >
                            <input
                              autoFocus
                              type="text"
                              value={editDirectoryValue}
                              onChange={(e) => setEditDirectoryValue(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Escape') setEditingDirectoryName(null);
                              }}
                              className="bg-transparent text-white text-xs font-semibold focus:outline-none w-20 sm:w-28 px-0.5"
                              placeholder="Name"
                            />
                            <button
                              type="submit"
                              disabled={!editDirectoryValue.trim()}
                              className="text-emerald-400 hover:text-emerald-300 p-0.5 rounded-full transition disabled:opacity-40"
                              title="Save renamed player"
                            >
                              <Check size={12} className="stroke-[3]" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingDirectoryName(null)}
                              className="text-slate-400 hover:text-slate-200 p-0.5 rounded-full transition"
                              title="Cancel"
                            >
                              <X size={12} />
                            </button>
                          </form>
                        );
                      }

                      return (
                        <span
                          key={name}
                          className={`group inline-flex items-center gap-1.5 border rounded-full pl-2.5 pr-1 py-0.5 text-xs transition ${
                            isInPool
                              ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 shadow-sm'
                              : 'bg-slate-800/80 hover:bg-slate-750 border-slate-700/70 text-slate-300'
                          }`}
                        >
                          {isInPool ? (
                            <span
                              onDoubleClick={() => {
                                if (isAdmin) {
                                  setEditingDirectoryName(name);
                                  setEditDirectoryValue(name);
                                }
                              }}
                              className="font-medium flex items-center gap-1 text-emerald-300 cursor-default"
                              title={`${name} is in tournament (double-click to rename)`}
                            >
                              <Check size={11} className="stroke-[3] text-emerald-400" />
                              <span>{name}</span>
                            </span>
                          ) : (
                            <button
                              onClick={() => onAddSavedPlayer(name)}
                              onDoubleClick={() => {
                                if (isAdmin) {
                                  setEditingDirectoryName(name);
                                  setEditDirectoryValue(name);
                                }
                              }}
                              className="font-medium hover:text-white flex items-center gap-1"
                              title={`Add ${name} to tournament pool (double-click to rename)`}
                            >
                              <span>{name}</span>
                              <span className="text-[#d7f24c] font-bold text-sm leading-none">+</span>
                            </button>
                          )}
                          {isAdmin && (
                            <div className="flex items-center gap-0.5 opacity-70 group-hover:opacity-100 transition">
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditingDirectoryName(name);
                                  setEditDirectoryValue(name);
                                }}
                                className="text-slate-400 hover:text-[#d7f24c] p-0.5 rounded-full transition"
                                title={`Rename ${name} in directory`}
                              >
                                <Pencil size={10} />
                              </button>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onRemoveSavedPlayer(name);
                                }}
                                className="text-slate-500 hover:text-red-400 p-0.5 rounded-full transition"
                                title={`Remove ${name} from room directory`}
                              >
                                <X size={11} />
                              </button>
                            </div>
                          )}
                        </span>
                      );
                    })}
                </div>
                {availableSaved.length === 0 ? (
                  <div className="text-[11px] text-emerald-400/90 font-medium flex items-center gap-1.5 mt-2">
                    <Check size={12} className="stroke-[3]" /> All {savedPlayers.length} directory players are in the tournament pool
                  </div>
                ) : (
                  <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-2">
                    <Users size={11} className="text-[#d7f24c]" /> {savedPlayers.length - availableSaved.length} in tournament • {availableSaved.length} available to add
                  </div>
                )}
              </>
            ) : (
              <p className="text-[11px] text-slate-500 italic">
                No saved players in this room directory yet. Players added above or saved here will appear in this directory.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Session & Privacy Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <label className="text-slate-200 text-sm font-bold flex items-center gap-1.5">
            <Lock size={15} className="text-amber-400" /> Private Session & PIN
          </label>
          <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full">
            Isolated Tournament
          </span>
        </div>
        <p className="text-slate-400 text-xs mb-3">
          Share your Room ID and Spectator link with players. Only users with this Admin PIN can record scores.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Room ID</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setRoomId(generateRoomId('NLP'))}
                  className="text-[11px] text-[#d7f24c] hover:underline font-semibold flex items-center gap-0.5"
                >
                  <Sparkles size={11} /> New ID
                </button>
              )}
            </div>
            <input
              type="text"
              disabled={!isAdmin}
              value={roomId || ''}
              onChange={(e) => setRoomId(sanitizeRoomId(e.target.value))}
              placeholder="e.g. NLP-8492"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm uppercase focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Scorekeeper PIN</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => setAdminPin(generatePin())}
                  className="text-[11px] text-amber-400 hover:underline font-semibold flex items-center gap-0.5"
                >
                  <KeyRound size={11} /> New PIN
                </button>
              )}
            </div>
            <input
              type="text"
              maxLength={8}
              disabled={!isAdmin}
              value={adminPin || ''}
              onChange={(e) => setAdminPin(e.target.value.replace(/\D/g, ''))}
              placeholder="4-digit PIN"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* Number of Teams */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
        <label className="text-slate-300 text-sm font-semibold mb-2 block">Number of Teams</label>
        <select
          disabled={!isAdmin}
          value={numTeams}
          onChange={(e) => setNumTeams(Number(e.target.value))}
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-3 text-white text-base focus:outline-none focus:ring-2 focus:ring-[#d7f24c] disabled:opacity-60"
        >
          <option value={2}>2 Teams (Final only)</option>
          <option value={3}>3 Teams (Semis + Final, with Bye)</option>
          <option value={4}>4 Teams (Semis + Final)</option>
          <option value={5}>5 Teams (Quarters, Semis, Final, with Byes)</option>
          <option value={6}>6 Teams (Quarters, Semis, Final, with Byes)</option>
          <option value={7}>7 Teams (Quarters, Semis, Final, with Byes)</option>
          <option value={8}>8 Teams (Quarters, Semis, Final)</option>
        </select>
      </div>

      {/* Captain Selection Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
        <div className="flex items-center justify-between mb-2">
          <label className="text-slate-200 text-sm font-bold flex items-center gap-1.5">
            <Crown size={16} className="text-amber-400" /> Captain Selection
          </label>
          {captainMode === 'manual' && (
            <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
              selectedCaptainIds.length === numTeams
                ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                : 'bg-amber-500/20 text-amber-400 border-amber-500/30'
            }`}>
              {selectedCaptainIds.length} / {numTeams} Selected
            </span>
          )}
        </div>

        {/* Mode Toggle Buttons */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => setCaptainMode('random')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              captainMode === 'random'
                ? 'bg-[#d7f24c] text-slate-950 shadow-md shadow-[#d7f24c]/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
            }`}
          >
            <Shuffle size={13} />
            Random Captains
          </button>
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => setCaptainMode('manual')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              captainMode === 'manual'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
            }`}
          >
            <Crown size={13} className={captainMode === 'manual' ? 'fill-current' : ''} />
            Choose Captains
          </button>
        </div>

        {captainMode === 'random' ? (
          <p className="text-slate-500 text-xs">
            {numTeams} team captains will be chosen randomly when the draft begins.
          </p>
        ) : (
          <div className="space-y-3 pt-1">
            <p className="text-slate-400 text-xs">
              Click players below to designate them as team captains ({numTeams} needed):
            </p>

            {playerPool.length === 0 ? (
              <p className="text-slate-600 text-xs italic py-1">Add players to the player pool above first.</p>
            ) : (
              <div className="flex flex-wrap gap-2">
                {playerPool.map((p) => {
                  const isCaptain = selectedCaptainIds.includes(p.id);
                  return (
                    <button
                      key={p.id}
                      type="button"
                      disabled={!isAdmin}
                      onClick={() => toggleCaptain(p.id)}
                      className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-bold transition active:scale-95 ${
                        isCaptain
                          ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20 ring-2 ring-amber-300'
                          : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
                      }`}
                    >
                      <Crown size={12} className={isCaptain ? 'text-slate-950 fill-current' : 'text-slate-500'} />
                      <span>{p.name}</span>
                      {isCaptain && <Check size={13} />}
                    </button>
                  );
                })}
              </div>
            )}

            {/* Helper actions for manual mode */}
            {isAdmin && playerPool.length >= numTeams && (
              <div className="flex items-center justify-between pt-2 border-t border-slate-800 text-xs">
                <span className="text-slate-500">
                  {selectedCaptainIds.length < numTeams
                    ? `Need ${numTeams - selectedCaptainIds.length} more (unselected will be random)`
                    : 'All team captain slots filled!'}
                </span>
                <div className="flex gap-2">
                  {selectedCaptainIds.length > 0 && (
                    <button
                      type="button"
                      onClick={() => setSelectedCaptainIds([])}
                      className="text-slate-400 hover:text-white transition"
                    >
                      Clear
                    </button>
                  )}
                  {selectedCaptainIds.length < numTeams && (
                    <button
                      type="button"
                      onClick={handleAutoFillCaptains}
                      className="text-amber-400 hover:text-amber-300 font-semibold transition flex items-center gap-1"
                    >
                      <Shuffle size={12} /> Auto-fill
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Goal Score Limit */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
        <label className="text-slate-300 text-sm font-semibold mb-2 block">Regulation Goal Score Limit</label>
        <div className="flex gap-2 mb-2">
          {[11, 15, 21].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={!isAdmin}
              onClick={() => setGoalScore(preset)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${
                goalScore === preset
                  ? 'bg-[#d7f24c] text-slate-950 shadow-md shadow-[#d7f24c]/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {preset} pts
            </button>
          ))}
        </div>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={!isAdmin}
          value={goalScore === '' ? '' : goalScore}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            setGoalScore(val === '' ? '' : Number(val));
          }}
          onBlur={() => {
            if (!goalScore || Number(goalScore) < 1) setGoalScore(11);
          }}
          placeholder="Custom score limit (e.g. 11)"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#d7f24c] disabled:opacity-60"
        />
      </div>

      {/* Dreambreaker Score Limit */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
        <label className="text-slate-300 text-sm font-semibold mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Zap size={14} className="text-amber-400" /> Dreambreaker Score Limit</span>
          <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">Tiebreaker</span>
        </label>
        <p className="text-slate-500 text-xs mb-3">Singles rotation target when regulation match ties.</p>
        <div className="flex gap-2 mb-2">
          {[11, 15, 21].map((preset) => (
            <button
              key={preset}
              type="button"
              disabled={!isAdmin}
              onClick={() => setDreambreakerScore(preset)}
              className={`flex-1 py-2 rounded-xl text-sm font-bold transition ${
                dreambreakerScore === preset
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
              }`}
            >
              {preset} pts
            </button>
          ))}
        </div>
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          disabled={!isAdmin}
          value={dreambreakerScore === '' ? '' : dreambreakerScore}
          onFocus={(e) => e.target.select()}
          onChange={(e) => {
            const val = e.target.value.replace(/\D/g, '');
            setDreambreakerScore(val === '' ? '' : Number(val));
          }}
          onBlur={() => {
            if (!dreambreakerScore || Number(dreambreakerScore) < 1) setDreambreakerScore(21);
          }}
          placeholder="Custom Dreambreaker limit (e.g. 21)"
          className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
        />
      </div>

      {/* Partner Matchup Configuration Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
        <div className="flex items-center justify-between mb-1">
          <label className="text-slate-200 text-sm font-bold flex items-center gap-1.5">
            <ArrowRightLeft size={16} className="text-[#d7f24c]" /> Partner Matchup Configuration
          </label>
          <span className="text-[10px] font-mono font-bold bg-[#d7f24c]/10 text-[#d7f24c] border border-[#d7f24c]/30 px-2 py-0.5 rounded-full">
            Mirrored Draft Order
          </span>
        </div>
        <p className="text-slate-400 text-xs mb-3">
          Configure how partners are paired based on draft order. Opponents always mirror the same draft slots (e.g. 1 & 2 vs 1 & 2).
        </p>

        {/* Preset Selector */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => {
              const defaultPairs = getDefaultSlotPairs(baseTeamSize >= 2 ? baseTeamSize : 4, 'adjacent');
              setMatchupConfig({ preset: 'adjacent', customSlotPairs: defaultPairs });
            }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition text-center ${
              (matchupConfig?.preset || 'adjacent') === 'adjacent'
                ? 'bg-[#d7f24c] text-slate-950 shadow-md shadow-[#d7f24c]/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
            }`}
          >
            Adjacent Slots
            <span className="block text-[10px] font-normal opacity-80 mt-0.5">1&2, 3&4, 5&6</span>
          </button>
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => {
              const defaultPairs = getDefaultSlotPairs(baseTeamSize >= 2 ? baseTeamSize : 4, 'balanced');
              setMatchupConfig({ preset: 'balanced', customSlotPairs: defaultPairs });
            }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition text-center ${
              matchupConfig?.preset === 'balanced'
                ? 'bg-[#d7f24c] text-slate-950 shadow-md shadow-[#d7f24c]/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
            }`}
          >
            Balanced / MLP
            <span className="block text-[10px] font-normal opacity-80 mt-0.5">1&4, 2&3</span>
          </button>
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => {
              const defaultPairs = (matchupConfig?.customSlotPairs && matchupConfig.customSlotPairs.length > 0)
                ? matchupConfig.customSlotPairs
                : getDefaultSlotPairs(baseTeamSize >= 2 ? baseTeamSize : 4, 'adjacent');
              setMatchupConfig({ preset: 'custom', customSlotPairs: defaultPairs });
            }}
            className={`py-2 px-2.5 rounded-xl text-xs font-bold transition text-center ${
              matchupConfig?.preset === 'custom'
                ? 'bg-[#d7f24c] text-slate-950 shadow-md shadow-[#d7f24c]/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
            }`}
          >
            Custom Pairs
            <span className="block text-[10px] font-normal opacity-80 mt-0.5">Game-by-Game</span>
          </button>
        </div>

        {/* Custom Game-by-Game Slot Editor */}
        {matchupConfig?.preset === 'custom' ? (
          <div className="space-y-2 pt-1 border-t border-slate-800/80">
            <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
              <span>Regulation Games ({matchupConfig?.customSlotPairs?.length || 0})</span>
              {isAdmin && (
                <button
                  type="button"
                  onClick={() => {
                    const existing = matchupConfig?.customSlotPairs || [];
                    setMatchupConfig({
                      preset: 'custom',
                      customSlotPairs: [...existing, [1, 2]],
                    });
                  }}
                  className="text-[#d7f24c] hover:underline font-bold flex items-center gap-1 text-[11px]"
                >
                  <Plus size={12} /> Add Game
                </button>
              )}
            </div>

            <div className="space-y-2 max-h-52 overflow-y-auto pr-1">
              {(matchupConfig?.customSlotPairs || []).map((pair, idx) => (
                <div key={idx} className="flex items-center gap-2 bg-slate-950/60 border border-slate-800 rounded-xl p-2 text-xs">
                  <span className="font-mono text-slate-500 font-bold w-14 shrink-0">Game {idx + 1}</span>
                  <div className="flex items-center gap-1.5 flex-1">
                    <select
                      disabled={!isAdmin}
                      value={pair[0]}
                      onChange={(e) => {
                        const updated = [...(matchupConfig?.customSlotPairs || [])];
                        updated[idx] = [Number(e.target.value), pair[1]];
                        setMatchupConfig({ preset: 'custom', customSlotPairs: updated });
                      }}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
                    >
                      {Array.from({ length: Math.max(4, baseTeamSize) }, (_, i) => i + 1).map((s) => (
                        <option key={s} value={s}>Slot {s} {s === 1 ? '(Capt)' : ''}</option>
                      ))}
                    </select>
                    <span className="text-slate-500 font-bold">&</span>
                    <select
                      disabled={!isAdmin}
                      value={pair[1]}
                      onChange={(e) => {
                        const updated = [...(matchupConfig?.customSlotPairs || [])];
                        updated[idx] = [pair[0], Number(e.target.value)];
                        setMatchupConfig({ preset: 'custom', customSlotPairs: updated });
                      }}
                      className="bg-slate-800 border border-slate-700 rounded-lg px-2 py-1 text-white font-bold text-xs focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
                    >
                      {Array.from({ length: Math.max(4, baseTeamSize) }, (_, i) => i + 1).map((s) => (
                        <option key={s} value={s}>Slot {s} {s === 1 ? '(Capt)' : ''}</option>
                      ))}
                    </select>
                  </div>
                  <span className="text-[11px] text-slate-400 font-mono hidden xs:inline shrink-0">vs identical</span>
                  {isAdmin && (matchupConfig?.customSlotPairs?.length || 0) > 1 && (
                    <button
                      type="button"
                      onClick={() => {
                        const updated = (matchupConfig?.customSlotPairs || []).filter((_, i) => i !== idx);
                        setMatchupConfig({ preset: 'custom', customSlotPairs: updated });
                      }}
                      className="text-slate-500 hover:text-red-400 p-1 rounded-lg transition shrink-0"
                    >
                      <Trash2 size={13} />
                    </button>
                  )}
                </div>
              ))}
            </div>
          </div>
        ) : (
          /* Preset Games Preview */
          <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl p-3 text-xs">
            <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
              Scheduled Regulation Matchups Preview:
            </span>
            <div className="grid grid-cols-2 gap-1.5 font-mono text-[11px] text-slate-300">
              {getDefaultSlotPairs(baseTeamSize >= 2 ? baseTeamSize : 4, matchupConfig?.preset || 'adjacent').slice(0, 6).map((pair, idx) => (
                <div key={idx} className="bg-slate-800/60 border border-slate-700/40 rounded-lg px-2 py-1 flex items-center justify-between">
                  <span className="text-slate-400">G{idx + 1}:</span>
                  <span className="text-[#d7f24c] font-bold">Slot {pair[0]} & {pair[1]}</span>
                  <span className="text-slate-500 text-[10px]">mirrored</span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Uneven Teams Toggle */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
        <label className="flex items-start gap-3 cursor-pointer select-none">
          <input
            type="checkbox"
            disabled={!isAdmin}
            checked={allowUneven}
            onChange={(e) => setAllowUneven(e.target.checked)}
            className="mt-1 w-4 h-4 rounded text-[#d7f24c] bg-slate-800 border-slate-700 focus:ring-[#d7f24c]"
          />
          <div>
            <span className="text-slate-200 text-sm font-bold block flex items-center gap-1.5">
              <Shuffle size={14} className="text-[#d7f24c]" /> Allow Uneven Teams
            </span>
            <span className="text-slate-400 text-xs">
              Draft all players without forcing anyone to sit out. Extra regulation games are automatically scheduled with randomized matchups.
            </span>
          </div>
        </label>
      </div>

      {/* Dynamic Sizing Summary Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-6 shadow-xl text-sm text-slate-400">
        <p className="font-semibold text-slate-300 mb-1">
          Roster Split: {numTeams} teams with{' '}
          <span className="text-white font-bold">
            {allowUneven && extraPlayers > 0 ? `${baseTeamSize}–${baseTeamSize + 1}` : baseTeamSize}
          </span>{' '}
          player{baseTeamSize === 1 ? '' : 's'} each.
        </p>
        {allowUneven && extraPlayers > 0 && (
          <p className="text-xs text-amber-400/90 mt-1">
            &bull; {extraPlayers} team{extraPlayers === 1 ? '' : 's'} will have {baseTeamSize + 1} players. Additional games will be automatically scheduled with randomized matchups so everyone plays!
          </p>
        )}
        {!allowUneven && extraPlayers > 0 && (
          <p className="text-xs text-amber-400/90 mt-1">
            &bull; {extraPlayers} player{extraPlayers === 1 ? '' : 's'} will sit out (uneven split).
          </p>
        )}
      </div>

      {/* Initialize Draft Button */}
      {isAdmin && (
        <button
          onClick={onInitializeDraft}
          disabled={!canInitialize}
          className={`w-full py-4 rounded-2xl font-extrabold text-lg flex items-center justify-center gap-2 transition active:scale-95 ${
            canInitialize
              ? 'bg-[#d7f24c] text-slate-950 shadow-xl shadow-[#d7f24c]/20 hover:bg-[#c6e140]'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          Initialize Draft
        </button>
      )}
    </div>
  );
}
