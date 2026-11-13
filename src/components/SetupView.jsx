import React, { useState, useRef } from 'react';
import { UserPlus, Users, X, Shuffle, Zap, ShieldAlert, Crown, Check, Lock, Sparkles, KeyRound, ArrowRightLeft, Plus, Trash2, Pencil, Settings, Upload, Download, Bookmark, Save, RotateCcw, QrCode, Search } from 'lucide-react';
import { generateRoomId, generatePin, sanitizeRoomId } from '../utils/room';
import { getDefaultSlotPairs, parsePlayersFromCSV, generateDirectoryCSV, generateSampleDirectoryCSV, triggerCsvDownload } from '../utils/tournament';
import { APP_VERSION } from '../version';
import { DirectoryModal } from './DirectoryModal';

export function SetupView({
  playerPool,
  addPlayer,
  onAddMultiplePlayers,
  removePlayer,
  savedPlayers = [],
  onAddSavedPlayer,
  onAddAllSavedPlayers,
  onRemoveSavedPlayer,
  onAddDirectoryPlayer,
  onRenameDirectoryPlayer,
  numTeams,
  setNumTeams,
  numCourts = 2,
  setNumCourts,
  goalScore,
  setGoalScore,
  dreambreakerScore,
  setDreambreakerScore,
  dreambreakerFormat = 'singles',
  setDreambreakerFormat,
  allowUneven,
  setAllowUneven,
  captainMode = 'random',
  setCaptainMode,
  selectedCaptainIds = [],
  setSelectedCaptainIds,
  customTeamNames = [],
  setCustomTeamNames,
  matchupCourtsConfig = {},
  setMatchupCourtsConfig,
  matchupConfig = { preset: 'adjacent', customSlotPairs: [] },
  setMatchupConfig,
  savedDefaultConfig = null,
  configPresets = [],
  onSaveDefaultConfig,
  onSaveConfigPreset,
  onDeleteConfigPreset,
  onApplyConfig,
  roomId,
  setRoomId,
  adminPin,
  setAdminPin,
  onInitializeDraft,
  hasExistingTournament = false,
  onReturnToEvent,
  onUpdateLiveSettings,
  isAdmin,
}) {
  const [activeTab, setActiveTab] = useState('players');
  const [nameInput, setNameInput] = useState('');
  const [directoryNameInput, setDirectoryNameInput] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [directoryOpenWithQr, setDirectoryOpenWithQr] = useState(false);
  const [csvFeedback, setCsvFeedback] = useState(null);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [configFeedback, setConfigFeedback] = useState(null);
  const csvFileInputRef = useRef(null);
  const configFileInputRef = useRef(null);

  function showConfigToast(message, type = 'success') {
    setConfigFeedback({ message, type });
    setTimeout(() => setConfigFeedback(null), 3500);
  }

  function handleExportConfigJson() {
    const payload = {
      name: presetNameInput.trim() || `${roomId || 'tournament'}-config`,
      exportedAt: new Date().toISOString(),
      numTeams,
      numCourts,
      goalScore,
      dreambreakerScore,
      dreambreakerFormat,
      allowUneven,
      captainMode,
      matchupConfig,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(roomId || 'neep-nlp').toLowerCase()}-tournament-config.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showConfigToast('Exported tournament configuration JSON');
  }

  function handleImportConfigJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result || '{}');
        if (parsed && (parsed.numTeams || parsed.goalScore || parsed.matchupConfig)) {
          if (onApplyConfig) onApplyConfig(parsed);
          if (parsed.name && onSaveConfigPreset) {
            onSaveConfigPreset(parsed.name);
          }
          showConfigToast(`Applied configuration from ${file.name}`);
        } else {
          showConfigToast('Invalid configuration JSON file.', 'error');
        }
      } catch (err) {
        showConfigToast('Could not parse configuration JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleCsvFileUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const text = evt.target?.result || '';
      const names = parsePlayersFromCSV(text);
      if (names.length === 0) {
        setCsvFeedback({ type: 'error', message: 'No valid player names found in CSV file.' });
      } else if (onAddMultiplePlayers) {
        const addedCount = onAddMultiplePlayers(names, true);
        setCsvFeedback({
          type: 'success',
          message: addedCount > 0
            ? `Imported ${addedCount} player${addedCount === 1 ? '' : 's'} from ${file.name}`
            : `All ${names.length} player${names.length === 1 ? '' : 's'} from ${file.name} are already in the tournament pool`,
        });
      } else {
        names.forEach((n) => addPlayer(n));
        setCsvFeedback({ type: 'success', message: `Imported ${names.length} players from ${file.name}` });
      }
      setTimeout(() => setCsvFeedback(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

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
    <div className="max-w-lg lg:max-w-6xl mx-auto px-4 lg:px-6 py-6 pb-24 animate-in fade-in duration-200">
      {/* Club Hero Card */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-slate-900 via-slate-900/95 to-blue-950/40 border border-slate-800 rounded-3xl p-4 mb-6 shadow-xl relative overflow-hidden">
        <div className="w-14 h-16 flex-shrink-0 flex items-center justify-center filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
          <img src="/logo.png" alt="NEEP-NLP Score Tracker Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-black tracking-wider text-white text-xl">NEEP-NLP</span>
            <span className="text-[10px] font-mono text-[#d7f24c] bg-[#d7f24c]/10 border border-[#d7f24c]/30 px-2 py-0.5 rounded-full font-bold">SCORE TRACKER</span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-950/80 border border-slate-800 px-2 py-0.5 rounded-full font-semibold">
              {APP_VERSION}
            </span>
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
      <p className="text-slate-400 text-sm mb-4 text-balance">
        {isAdmin
          ? 'Configure players, teams, courts, and scoring rules across the tabs below.'
          : 'Viewing tournament setup. Unlock Scorekeeper mode with PIN to make changes.'}
      </p>

      {/* Event In Progress Banner (MLP) */}
      {hasExistingTournament && (
        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded-2xl p-3.5 mb-4 flex items-center justify-between gap-3 flex-wrap">
          <div className="min-w-0">
            <span className="text-xs font-extrabold text-cyan-300 block">
              Event Currently In Progress
            </span>
            <span className="text-[11px] text-slate-300">
              You can update courts, score limits, or PIN and return without losing match progress.
            </span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {onReturnToEvent && (
              <button
                type="button"
                onClick={onReturnToEvent}
                className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold border border-slate-700 transition"
              >
                Back to Event
              </button>
            )}
            {isAdmin && onUpdateLiveSettings && (
              <button
                type="button"
                onClick={onUpdateLiveSettings}
                className="px-3 py-1.5 rounded-xl bg-cyan-400 hover:bg-cyan-300 text-slate-950 text-xs font-black transition active:scale-95"
              >
                Save Settings &amp; Return
              </button>
            )}
          </div>
        </div>
      )}

      {/* Setup Configuration Tabs */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 mb-5 shadow-lg overflow-x-auto">
        {[
          { id: 'players', label: '1. Players & Teams' },
          { id: 'courts', label: '2. Courts & Matchups' },
          { id: 'presets', label: '3. Room & Presets' },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`flex-1 py-2 px-3 rounded-xl text-xs font-bold whitespace-nowrap transition ${
              activeTab === tab.id
                ? 'bg-[#d7f24c] text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-white'
            }`}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <div className="lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start">
        <div className={activeTab === 'courts' ? 'hidden' : activeTab === 'players' ? 'lg:col-span-7' : 'lg:col-span-6'}>
          {/* Player Pool Card */}
      <div className={activeTab === 'players' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <div>
            <label className="text-slate-200 text-sm font-bold block">
              Player Pool ({playerPool.length})
            </label>
            <p className="text-[11px] text-slate-400">
              Type a player name below or tap names in your Room Directory.
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={handleCsvFileUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => csvFileInputRef.current?.click()}
                title="Upload a CSV or text list of player names into this tournament"
                className="text-xs font-bold text-[#d7f24c] hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl px-2.5 py-1 flex items-center gap-1.5 transition active:scale-95 shadow-sm"
              >
                <Upload size={12} className="text-[#d7f24c]" /> Upload CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  const sampleCsv = generateSampleDirectoryCSV();
                  triggerCsvDownload('sample-player-directory.csv', sampleCsv);
                }}
                title="Download a sample CSV template to fill in player names"
                className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl px-2.5 py-1 flex items-center gap-1.5 transition active:scale-95 shadow-sm"
              >
                <Download size={12} className="text-slate-400" /> Sample CSV
              </button>
            </div>
          )}
        </div>
        {csvFeedback && (
          <div
            className={`mb-3 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border ${
              csvFeedback.type === 'error'
                ? 'bg-red-500/10 border-red-500/30 text-red-300'
                : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
            }`}
          >
            <span>{csvFeedback.message}</span>
            <button
              type="button"
              onClick={() => setCsvFeedback(null)}
              className="text-slate-400 hover:text-white ml-2"
            >
              <X size={13} />
            </button>
          </div>
        )}
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
          <div className="max-h-[380px] lg:max-h-[440px] overflow-y-auto bg-slate-950/60 border border-slate-800 rounded-2xl">
            <table className="w-full text-left border-collapse text-xs">
              <thead className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                <tr>
                  <th className="py-1.5 px-3 font-bold w-12">#</th>
                  <th className="py-1.5 px-3 font-bold">Player</th>
                  {captainMode === 'manual' && <th className="py-1.5 px-3 font-bold w-24 text-center">Role</th>}
                  {isAdmin && <th className="py-1.5 px-3 font-bold text-right w-16">Action</th>}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/70">
                {playerPool.map((p, idx) => {
                  const isCaptain = captainMode === 'manual' && selectedCaptainIds.includes(p.id);
                  return (
                    <tr key={p.id} className="hover:bg-slate-900/60 transition">
                      <td className="py-1.5 px-3 font-mono text-slate-400">{idx + 1}</td>
                      <td className="py-1.5 px-3 font-semibold text-white">{p.name}</td>
                      {captainMode === 'manual' && (
                        <td className="py-1.5 px-3 text-center">
                          {isCaptain ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-amber-500/15 text-amber-300 border border-amber-500/40 px-2 py-0.5 rounded-full">
                              <Crown size={10} className="fill-current" /> Captain
                            </span>
                          ) : (
                            <span className="text-[10px] text-slate-500">Player</span>
                          )}
                        </td>
                      )}
                      {isAdmin && (
                        <td className="py-1.5 px-3 text-right">
                          <button
                            type="button"
                            onClick={() => removePlayer(p.id)}
                            className="p-1 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-red-400 transition"
                            title="Remove player"
                          >
                            <X size={14} />
                          </button>
                        </td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Saved Players Tray (Per-Room Directory) */}
        {isAdmin && (
          <div className="mt-4 pt-3.5 border-t border-slate-800/80">
            <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
              <div className="flex items-center gap-1.5 min-w-0">
                <Users size={13} className="text-[#d7f24c] shrink-0" />
                <span className="text-slate-300 text-xs font-bold uppercase tracking-wider truncate">
                  Room Directory ({savedPlayers.length})
                </span>
                <span className="text-[10px] font-mono font-bold bg-slate-850 text-[#d7f24c] border border-slate-700 px-1.5 py-0.5 rounded-md truncate max-w-[120px]">
                  {roomId}
                </span>
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                {availableSaved.length > 0 && (
                  <button
                    onClick={onAddAllSavedPlayers}
                    className="text-xs font-bold text-[#d7f24c] hover:underline flex items-center gap-1 active:scale-95 transition"
                  >
                    <UserPlus size={13} /> + Add All ({availableSaved.length})
                  </button>
                )}
                {savedPlayers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const csv = generateDirectoryCSV(savedPlayers, playerPool);
                      triggerCsvDownload(`${roomId || 'room'}-directory.csv`, csv);
                    }}
                    title="Export this room's player directory as CSV"
                    className="text-xs font-bold text-slate-300 hover:text-[#d7f24c] bg-slate-800 hover:bg-slate-750 border border-slate-700/80 rounded-xl px-2.5 py-1 flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  >
                    <Download size={12} className="text-[#d7f24c]" /> Export CSV
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => {
                    setDirectoryOpenWithQr(true);
                    setIsDirectoryModalOpen(true);
                  }}
                  className="text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-slate-800 hover:bg-slate-750 border border-emerald-500/30 rounded-xl px-2.5 py-1 flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  title="View Player Login URL & QR Code"
                >
                  <QrCode size={12} /> Player QR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDirectoryOpenWithQr(false);
                    setIsDirectoryModalOpen(true);
                  }}
                  className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700/80 rounded-xl px-2.5 py-1 flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  title="Manage room directory players (rename, delete, search, export)"
                >
                  <Settings size={12} className="text-[#d7f24c]" /> Manage Players
                </button>
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

            {/* List of saved names in this room (Table View) */}
            {savedPlayers.length > 0 ? (
              (() => {
                const q = directorySearch.trim().toLowerCase();
                const filteredSaved = [...savedPlayers]
                  .filter((name) => !q || name.toLowerCase().includes(q))
                  .sort((a, b) => {
                    const aIn = playerPool.some((p) => p.name.trim().toLowerCase() === a.trim().toLowerCase());
                    const bIn = playerPool.some((p) => p.name.trim().toLowerCase() === b.trim().toLowerCase());
                    if (aIn === bIn) return a.localeCompare(b);
                    return aIn ? 1 : -1;
                  });
                return (
                  <>
                    <div className="relative mb-2">
                      <Search size={13} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-500 pointer-events-none" />
                      <input
                        type="text"
                        value={directorySearch}
                        onChange={(e) => setDirectorySearch(e.target.value)}
                        placeholder={`Search directory (${savedPlayers.length})...`}
                        className="w-full bg-slate-950/70 border border-slate-800 rounded-xl pl-8 pr-7 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
                      />
                      {directorySearch && (
                        <button
                          type="button"
                          onClick={() => setDirectorySearch('')}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white"
                          title="Clear search"
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>
                    <div className="max-h-[360px] lg:max-h-[420px] overflow-y-auto bg-slate-950/60 border border-slate-800 rounded-2xl">
                      <table className="w-full text-left border-collapse text-xs">
                        <thead className="sticky top-0 bg-slate-900/95 backdrop-blur border-b border-slate-800 text-[10px] uppercase tracking-wider text-slate-400">
                          <tr>
                            <th className="py-1.5 px-3 font-bold">Player</th>
                            <th className="py-1.5 px-3 font-bold text-center w-24">Status</th>
                            <th className="py-1.5 px-3 font-bold text-right w-24">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {filteredSaved.length === 0 ? (
                            <tr>
                              <td colSpan={3} className="py-4 px-3 text-center text-xs text-slate-500 italic">
                                No directory players match &ldquo;{directorySearch}&rdquo;.
                              </td>
                            </tr>
                          ) : (
                            filteredSaved.map((name) => {
                              const isInPool = playerPool.some(
                                (p) => p.name.trim().toLowerCase() === name.trim().toLowerCase()
                              );

                              return (
                                <tr key={name} className="hover:bg-slate-900/60 transition">
                                  <td className="py-1.5 px-3 font-semibold text-white">{name}</td>
                                  <td className="py-1.5 px-3 text-center">
                                    {isInPool ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                        <Check size={10} className="stroke-[3]" /> In Pool
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-medium text-slate-500">Available</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-3 text-right">
                                    {isInPool ? (
                                      <span className="text-[11px] text-slate-500 italic">Added</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => onAddSavedPlayer(name)}
                                        className="px-2.5 py-0.5 rounded-lg text-[11px] font-bold bg-[#d7f24c]/15 hover:bg-[#d7f24c]/25 text-[#d7f24c] border border-[#d7f24c]/40 transition active:scale-95"
                                        title={`Add ${name} to tournament pool`}
                                      >
                                        + Add
                                      </button>
                                    )}
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                      </table>
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
                );
              })()
            ) : (
              <p className="text-[11px] text-slate-500 italic">
                No saved players in this room directory yet. Players added above or saved here will appear in this directory.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Session & Privacy Card */}
      <div className={activeTab === 'presets' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
        <div className="flex items-center justify-between mb-2">
          <label className="text-slate-200 text-sm font-bold flex items-center gap-1.5">
            <Lock size={15} className="text-amber-400" /> Private Session & PIN
          </label>
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

        </div>
        <div className={activeTab === 'courts' ? 'lg:col-span-12 lg:grid lg:grid-cols-2 lg:gap-6 lg:items-start' : activeTab === 'players' ? 'lg:col-span-5' : 'lg:col-span-6'}>
          {/* Number of Teams */}
      <div className={activeTab === 'players' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
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
      <div className={activeTab === 'players' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
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
      <div className={activeTab === 'courts' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
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

      {/* Number of Courts */}
      {setNumCourts && (
        <div className={activeTab === 'courts' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
          <label className="text-slate-300 text-sm font-semibold mb-1 block">
            Number of Courts
          </label>
          <p className="text-slate-500 text-xs mb-2.5">
            Set how many courts are available so scorekeepers can assign court numbers to each game.
          </p>
          <div className="grid grid-cols-6 gap-1.5 mb-2">
            {[1, 2, 3, 4, 6, 8].map((n) => (
              <button
                key={n}
                type="button"
                disabled={!isAdmin}
                onClick={() => setNumCourts(n)}
                className={`py-2 rounded-xl text-xs font-bold transition ${
                  Number(numCourts) === n
                    ? 'bg-[#d7f24c] text-slate-950 shadow-md shadow-[#d7f24c]/20'
                    : 'bg-slate-800 text-slate-300 hover:bg-slate-700 border border-slate-700'
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          <input
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            disabled={!isAdmin}
            value={numCourts === '' ? '' : numCourts}
            onFocus={(e) => e.target.select()}
            onChange={(e) => {
              const val = e.target.value.replace(/\D/g, '');
              setNumCourts(val === '' ? '' : Math.min(50, Number(val)));
            }}
            onBlur={() => {
              if (!numCourts || Number(numCourts) < 1) setNumCourts(2);
            }}
            placeholder="Custom number of courts (e.g. 4)"
            className="w-full bg-slate-800 border border-slate-700 rounded-xl px-4 py-2 text-white text-sm focus:outline-none focus:ring-2 focus:ring-[#d7f24c] disabled:opacity-60"
          />

          {/* Pre-assign courts per Round 1 matchup */}
          {setMatchupCourtsConfig && Math.floor(numTeams / 2) >= 1 && (
            <div className="mt-3 pt-3 border-t border-slate-800 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-slate-300">
                  Pre-Assign Courts by Matchup (Round 1)
                </span>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => {
                      const mCount = Math.floor(numTeams / 2);
                      const cCount = Math.max(1, Number(numCourts) || 2);
                      const next = {};
                      if (cCount >= mCount) {
                        const base = Math.floor(cCount / mCount);
                        const extra = cCount % mCount;
                        let cursor = 1;
                        for (let i = 0; i < mCount; i++) {
                          const size = base + (i < extra ? 1 : 0);
                          next[i + 1] = [];
                          for (let j = 0; j < size; j++) next[i + 1].push(cursor++);
                        }
                      } else {
                        for (let i = 0; i < mCount; i++) {
                          next[i + 1] = [(i % cCount) + 1];
                        }
                      }
                      setMatchupCourtsConfig(next);
                    }}
                    className="text-[11px] font-bold text-[#d7f24c] hover:underline"
                  >
                    Auto-Split Evenly
                  </button>
                )}
              </div>
              <p className="text-[11px] text-slate-500">
                Leave blank to auto-split evenly, or tap courts below to assign them to each matchup.
              </p>
              <div className="space-y-1.5">
                {Array.from({ length: Math.floor(numTeams / 2) }, (_, i) => i + 1).map((matchNum) => {
                  const assigned = Array.isArray(matchupCourtsConfig?.[matchNum])
                    ? matchupCourtsConfig[matchNum]
                    : [];
                  return (
                    <div
                      key={matchNum}
                      className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-800 rounded-xl px-3 py-2"
                    >
                      <span className="text-xs font-mono font-bold text-white shrink-0">
                        Matchup #{matchNum}
                      </span>
                      <div className="flex items-center gap-1 flex-wrap justify-end">
                        {Array.from({ length: Math.max(1, Number(numCourts) || 2) }, (_, cIdx) => cIdx + 1).map((ct) => {
                          const active = assigned.includes(ct);
                          return (
                            <button
                              key={ct}
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => {
                                const nextArr = active
                                  ? assigned.filter((x) => x !== ct)
                                  : [...assigned, ct].sort((a, b) => a - b);
                                setMatchupCourtsConfig({
                                  ...(matchupCourtsConfig || {}),
                                  [matchNum]: nextArr,
                                });
                              }}
                              className={`px-2 py-0.5 rounded-md text-[11px] font-mono font-bold border transition ${
                                active
                                  ? 'bg-[#d7f24c] text-slate-950 border-[#d7f24c]'
                                  : 'bg-slate-800 text-slate-400 hover:text-white border-slate-700'
                              }`}
                            >
                              C{ct}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Custom Team Names (Optional) */}
      {setCustomTeamNames && (
        <div className={activeTab === 'players' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
          <label className="text-slate-300 text-sm font-semibold mb-1 block">
            Custom Team Names <span className="text-slate-500 text-xs font-normal">(Optional)</span>
          </label>
          <p className="text-slate-500 text-xs mb-3">
            Leave blank to default each team name to its Captain&apos;s name.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {Array.from({ length: numTeams }, (_, i) => (
              <input
                key={i}
                type="text"
                disabled={!isAdmin}
                value={customTeamNames[i] || ''}
                onChange={(e) => {
                  const next = [...(customTeamNames || [])];
                  next[i] = e.target.value;
                  setCustomTeamNames(next);
                }}
                placeholder={`Team ${i + 1} (Defaults to Captain)`}
                className="bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-[#d7f24c] disabled:opacity-60"
              />
            ))}
          </div>
        </div>
      )}

      {/* Dreambreaker Score Limit & Format */}
      <div className={activeTab === 'courts' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
        <label className="text-slate-300 text-sm font-semibold mb-1 flex items-center justify-between">
          <span className="flex items-center gap-1.5"><Zap size={14} className="text-amber-400" /> Dreambreaker Format &amp; Score Limit</span>
          <span className="text-[11px] text-amber-400 font-bold uppercase tracking-wider">Tiebreaker</span>
        </label>
        <p className="text-slate-500 text-xs mb-3">
          {dreambreakerFormat === 'doubles'
            ? 'Doubles (2v2) rotation every 4 points when regulation match ties.'
            : 'Singles (1v1) rotation every 4 points when regulation match ties.'}
        </p>

        {/* Singles vs Doubles Format Toggle */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => setDreambreakerFormat && setDreambreakerFormat('singles')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              dreambreakerFormat !== 'doubles'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
            }`}
          >
            Singles (1v1)
          </button>
          <button
            type="button"
            disabled={!isAdmin}
            onClick={() => setDreambreakerFormat && setDreambreakerFormat('doubles')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              dreambreakerFormat === 'doubles'
                ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
            }`}
          >
            Doubles (2v2)
          </button>
        </div>

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
      <div className={activeTab === 'courts' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
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
      <div className={activeTab === 'players' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
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

      {/* Saved Tournament Configuration Settings Card */}
      {isAdmin && (
        <div className={activeTab === 'presets' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
          <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
            <label className="text-slate-200 text-sm font-bold flex items-center gap-1.5">
              <Bookmark size={15} className="text-[#d7f24c]" /> Saved Tournament Configurations
            </label>
            <div className="flex items-center gap-1.5">
              <input
                ref={configFileInputRef}
                type="file"
                accept=".json,application/json"
                onChange={handleImportConfigJson}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => configFileInputRef.current?.click()}
                title="Import tournament configuration from a JSON file"
                className="text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl px-2.5 py-1 flex items-center gap-1 transition active:scale-95"
              >
                <Upload size={11} className="text-[#d7f24c]" /> Import
              </button>
              <button
                type="button"
                onClick={handleExportConfigJson}
                title="Export current tournament configuration as a JSON file"
                className="text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 rounded-xl px-2.5 py-1 flex items-center gap-1 transition active:scale-95"
              >
                <Download size={11} className="text-[#d7f24c]" /> Export
              </button>
            </div>
          </div>
          <p className="text-slate-400 text-xs mb-3">
            Save your current rules (teams, score limits, Dreambreaker format, partner matchups, and uneven settings) as your default configuration or as named presets.
          </p>

          {configFeedback && (
            <div
              className={`mb-3 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                configFeedback.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Check size={13} /> {configFeedback.message}
              </span>
              <button
                type="button"
                onClick={() => setConfigFeedback(null)}
                className="text-slate-400 hover:text-white ml-2"
              >
                <X size={13} />
              </button>
            </div>
          )}

          {/* Default Settings Actions */}
          <div className="flex items-center gap-2 mb-3 flex-wrap">
            <button
              type="button"
              onClick={() => {
                if (onSaveDefaultConfig) {
                  onSaveDefaultConfig();
                  showConfigToast('Saved current settings as default tournament configuration');
                }
              }}
              className="flex-1 py-2 px-3 rounded-xl bg-[#d7f24c]/15 hover:bg-[#d7f24c]/25 text-[#d7f24c] border border-[#d7f24c]/30 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
            >
              <Save size={13} /> Save Current as Default
            </button>
            {savedDefaultConfig && (
              <button
                type="button"
                onClick={() => {
                  if (onApplyConfig) {
                    onApplyConfig(savedDefaultConfig);
                    showConfigToast('Loaded saved default configuration');
                  }
                }}
                className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 border border-slate-700 font-bold text-xs flex items-center justify-center gap-1.5 transition active:scale-95"
              >
                <RotateCcw size={13} /> Load Saved Default
              </button>
            )}
          </div>

          {/* Save Named Preset Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              const trimmed = presetNameInput.trim();
              if (!trimmed || !onSaveConfigPreset) return;
              onSaveConfigPreset(trimmed);
              setPresetNameInput('');
              showConfigToast(`Saved preset "${trimmed}"`);
            }}
            className="flex items-center gap-1.5 mb-3"
          >
            <input
              type="text"
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              placeholder="Preset name (e.g. Friday MLP Doubles DB)..."
              className="flex-1 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
            />
            <button
              type="submit"
              disabled={!presetNameInput.trim()}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-[#d7f24c] font-bold text-xs border border-slate-700 disabled:opacity-40 transition shrink-0 flex items-center gap-1"
            >
              <Plus size={12} /> Save Preset
            </button>
          </form>

          {/* Saved Presets List */}
          {configPresets.length > 0 ? (
            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
              {configPresets.map((preset) => {
                const key = preset.id || preset.name;
                const formatLabel = preset.dreambreakerFormat === 'doubles' ? 'Doubles DB' : 'Singles DB';
                const matchupLabel =
                  preset.matchupConfig?.preset === 'balanced'
                    ? 'Balanced (1&4, 2&3)'
                    : preset.matchupConfig?.preset === 'custom'
                    ? `Custom (${preset.matchupConfig?.customSlotPairs?.length || 0}G)`
                    : 'Adjacent (1&2, 3&4)';
                return (
                  <div
                    key={key}
                    className="flex items-center justify-between gap-2 bg-slate-950/60 border border-slate-800/90 rounded-xl px-3 py-2 text-xs"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-bold text-white truncate">{preset.name}</p>
                      <p className="text-[11px] text-slate-400 truncate">
                        {preset.numTeams} Teams &bull; {preset.goalScore} pts &bull; {preset.dreambreakerScore} pt {formatLabel} &bull; {matchupLabel}
                      </p>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          if (onApplyConfig) {
                            onApplyConfig(preset);
                            showConfigToast(`Applied preset "${preset.name}"`);
                          }
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 font-bold text-[11px] transition active:scale-95"
                      >
                        Apply
                      </button>
                      {onDeleteConfigPreset && (
                        <button
                          type="button"
                          onClick={() => onDeleteConfigPreset(key)}
                          title="Delete preset"
                          className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="text-[11px] text-slate-500 italic">
              No named presets saved yet. Name and save a preset above to switch between tournament formats anytime.
            </p>
          )}
        </div>
      )}

        </div>
      </div>

      {/* Dynamic Sizing Summary Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl text-sm text-slate-400">
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

      {/* Action Buttons */}
      {isAdmin && (
        <div className="flex flex-col sm:flex-row gap-3">
          {hasExistingTournament && onUpdateLiveSettings && (
            <button
              type="button"
              onClick={onUpdateLiveSettings}
              className="flex-1 py-4 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 transition active:scale-95 bg-cyan-400 hover:bg-cyan-300 text-slate-950 shadow-xl shadow-cyan-400/20"
            >
              Save Settings &amp; Return to Event
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              if (
                hasExistingTournament &&
                !window.confirm('An event is already in progress. Start a brand-new draft? This will replace the current teams and bracket.')
              ) {
                return;
              }
              onInitializeDraft();
            }}
            disabled={!canInitialize}
            className={`flex-1 py-4 rounded-2xl font-extrabold text-base flex items-center justify-center gap-2 transition active:scale-95 ${
              canInitialize
                ? hasExistingTournament
                  ? 'bg-slate-800 hover:bg-slate-750 text-[#d7f24c] border border-[#d7f24c]/40'
                  : 'bg-[#d7f24c] text-slate-950 shadow-xl shadow-[#d7f24c]/20 hover:bg-[#c6e140]'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            {hasExistingTournament ? 'Initialize New Draft' : 'Initialize Draft'}
          </button>
        </div>
      )}

      {/* Dedicated Directory Management Modal */}
      <DirectoryModal
        isOpen={isDirectoryModalOpen}
        onClose={() => setIsDirectoryModalOpen(false)}
        initialShowQr={directoryOpenWithQr}
        roomId={roomId}
        savedPlayers={savedPlayers}
        playerPool={playerPool}
        onAddDirectoryPlayer={onAddDirectoryPlayer}
        onAddMultiplePlayers={onAddMultiplePlayers}
        onRenameDirectoryPlayer={onRenameDirectoryPlayer}
        onRemoveSavedPlayer={onRemoveSavedPlayer}
        isAdmin={isAdmin}
      />
    </div>
  );
}
