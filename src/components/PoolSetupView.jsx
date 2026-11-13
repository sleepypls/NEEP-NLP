import React, { useState, useRef } from 'react';
import {
  Users,
  User,
  UserPlus,
  X,
  Trophy,
  Swords,
  Shuffle,
  ShieldAlert,
  Upload,
  Download,
  Lock,
  Sparkles,
  KeyRound,
  Award,
  Play,
  Settings,
  Check,
} from 'lucide-react';
import { generateRoomId, generatePin, sanitizeRoomId } from '../utils/room';
import { generateDirectoryCSV, generateSampleDirectoryCSV, triggerCsvDownload } from '../utils/tournament';
import { getEntryDisplayName, KNOCKOUT_ROUND_KEYS } from '../utils/poolTournament';
import { APP_VERSION } from '../version';
import { DirectoryModal } from './DirectoryModal';

function parseEntriesFromCSV(text, discipline) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  const results = [];
  lines.forEach((line, idx) => {
    const lower = line.toLowerCase();
    if (
      idx === 0 &&
      (lower.startsWith('player') || lower.startsWith('name') || lower.startsWith('team') || lower.startsWith('entry'))
    ) {
      return;
    }

    if (discipline === 'doubles') {
      // Support "Alice / Bob", "Alice & Bob", or "Alice, Bob"
      const parts = line
        .split(/[\/&,]+/)
        .map((s) => s.replace(/^["']|["']$/g, '').trim())
        .filter(Boolean);
      if (parts.length >= 2) {
        results.push({ name: `${parts[0]} / ${parts[1]}`, players: [parts[0], parts[1]] });
      } else if (parts.length === 1) {
        results.push({ name: parts[0], players: [parts[0]] });
      }
    } else {
      const clean = line.split(',')[0].replace(/^["']|["']$/g, '').trim();
      if (clean) {
        results.push({ name: clean, players: [clean] });
      }
    }
  });
  return results;
}

export function PoolSetupView({
  discipline = 'doubles',
  onChangeDiscipline,
  structure = 'pools_knockout',
  setStructure,
  entries = [],
  onAddEntry,
  onAddMultipleEntries,
  onRemoveEntry,
  savedPlayers = [],
  onAddAllSavedPlayers,
  onRemoveSavedPlayer,
  onAddDirectoryPlayer,
  onRenameDirectoryPlayer,
  onImportDirectoryNames,
  numPools = 2,
  setNumPools,
  advancePerPool = 2,
  setAdvancePerPool,
  seedingMode = 'snake',
  setSeedingMode,
  poolFormat = { bestOf: 1, pointsTo: 15, winByTwo: true },
  setPoolFormat,
  knockoutFormat = { bestOf: 3, pointsTo: 11, winByTwo: true },
  setKnockoutFormat,
  includeBronze = true,
  setIncludeBronze,
  roomId,
  setRoomId,
  adminPin,
  setAdminPin,
  onStartPoolTournament,
  isAdmin,
}) {
  const [singleName, setSingleName] = useState('');
  const [partner1, setPartner1] = useState('');
  const [partner2, setPartner2] = useState('');
  const [directoryNameInput, setDirectoryNameInput] = useState('');
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [csvFeedback, setCsvFeedback] = useState(null);
  const csvFileInputRef = useRef(null);

  function handleAddSingle(e) {
    e?.preventDefault();
    const trimmed = singleName.trim();
    if (!trimmed) return;
    onAddEntry({ name: trimmed, players: [trimmed] });
    setSingleName('');
  }

  function handleAddDoubles(e) {
    e?.preventDefault();
    const p1 = partner1.trim();
    const p2 = partner2.trim();
    if (!p1 || !p2) return;
    onAddEntry({ name: `${p1} / ${p2}`, players: [p1, p2] });
    setPartner1('');
    setPartner2('');
  }

  function handleQuickPickDirectory(name) {
    if (!isAdmin) return;
    if (discipline === 'singles') {
      onAddEntry({ name, players: [name] });
    } else {
      if (!partner1.trim()) {
        setPartner1(name);
      } else if (!partner2.trim()) {
        setPartner2(name);
      } else {
        setPartner1(name);
        setPartner2('');
      }
    }
  }

  function handleCsvUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const parsed = parseEntriesFromCSV(evt.target?.result || '', discipline);
      if (parsed.length === 0) {
        setCsvFeedback({ type: 'error', message: 'No valid entries found in CSV.' });
      } else {
        onAddMultipleEntries(parsed);
        setCsvFeedback({
          type: 'success',
          message: `Imported ${parsed.length} ${discipline === 'doubles' ? 'team' : 'player'}${parsed.length === 1 ? '' : 's'} from ${file.name}`,
        });
      }
      setTimeout(() => setCsvFeedback(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  const activePlayerNamesLower = new Set(
    entries.flatMap((e) => (e.players || []).map((p) => String(p || '').trim().toLowerCase())).filter(Boolean)
  );
  const activePlayerPool = entries
    .flatMap((e) => e.players || [])
    .map((p) => String(p || '').trim())
    .filter(Boolean)
    .map((name, i) => ({ id: i + 1, name }));
  const availableSaved = (savedPlayers || []).filter(
    (name) => !activePlayerNamesLower.has(name.trim().toLowerCase())
  );

  const isKnockoutOnly = structure === 'knockout_only';
  const maxPoolsAllowed = Math.max(1, Math.floor(entries.length / 2));
  const effectivePools = Math.min(numPools, maxPoolsAllowed);
  const totalAdvancing = effectivePools * advancePerPool;
  const canStart = isKnockoutOnly ? entries.length >= 2 : entries.length >= 3 && effectivePools >= 1;

  const defaultRoundFormats = {
    r32: { bestOf: 1, pointsTo: 15 },
    r16: { bestOf: 1, pointsTo: 15 },
    quarters: { bestOf: 1, pointsTo: 15 },
    semis: { bestOf: 3, pointsTo: 11 },
    final: { bestOf: 3, pointsTo: 11 },
    bronze: { bestOf: 1, pointsTo: 15 },
    ...(knockoutFormat?.roundFormats || {}),
  };

  function updateRoundFormat(roundKey, patch) {
    setKnockoutFormat({
      ...knockoutFormat,
      useRoundFormats: true,
      roundFormats: {
        ...defaultRoundFormats,
        [roundKey]: {
          ...defaultRoundFormats[roundKey],
          ...patch,
        },
      },
    });
  }

  return (
    <div className="max-w-lg mx-auto px-4 py-6 pb-24 animate-in fade-in duration-200">
      {/* Hero Banner */}
      <div className="flex items-center gap-4 bg-gradient-to-r from-slate-900 via-slate-900/95 to-emerald-950/30 border border-slate-800 rounded-3xl p-4 mb-6 shadow-xl">
        <div className="w-14 h-16 flex-shrink-0 flex items-center justify-center filter drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]">
          <img src="/logo.png" alt="NEEP-NLP Logo" className="w-full h-full object-contain" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-display font-black tracking-wider text-white text-xl">NEEP-NLP</span>
            <span className="text-[10px] font-mono text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 rounded-full font-bold">
              {isKnockoutOnly ? 'KNOCKOUT BRACKET' : 'POOLS + KNOCKOUT'}
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-950/80 border border-slate-800 px-2 py-0.5 rounded-full font-semibold">
              {APP_VERSION}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            {isKnockoutOnly
              ? 'Direct Single-Elimination Knockout Bracket'
              : 'Round-Robin Pool Play & Seeded Knockout Bracket'}
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between mb-1">
        <h2 className="text-white text-2xl font-display uppercase tracking-wide font-semibold">
          Tournament Setup
        </h2>
        {!isAdmin && (
          <span className="text-[11px] font-bold bg-amber-500/20 text-amber-400 border border-amber-500/30 px-2 py-0.5 rounded-full flex items-center gap-1">
            <ShieldAlert size={12} /> Spectator Mode
          </span>
        )}
      </div>
      <p className="text-slate-400 text-sm mb-6">
        {isKnockoutOnly
          ? 'Configure Singles or Doubles entries and Direct Knockout Bracket elimination rules.'
          : 'Configure Singles or Doubles entries, Pool Play round-robin groups, and Knockout elimination rules.'}
      </p>

      {/* Discipline & Structure Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl space-y-4">
        <div>
          <label className="text-slate-200 text-sm font-bold block mb-2">
            Event Discipline
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => onChangeDiscipline('singles')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                discipline === 'singles'
                  ? 'bg-[#d7f24c] text-slate-950 shadow-md shadow-[#d7f24c]/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
              }`}
            >
              <User size={14} /> Singles (1v1)
            </button>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => onChangeDiscipline('doubles')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                discipline === 'doubles'
                  ? 'bg-[#d7f24c] text-slate-950 shadow-md shadow-[#d7f24c]/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
              }`}
            >
              <Users size={14} /> Doubles (2v2)
            </button>
          </div>
        </div>

        <div className="pt-3 border-t border-slate-800">
          <label className="text-slate-200 text-sm font-bold block mb-2">
            Tournament Structure
          </label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setStructure && setStructure('pools_knockout')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition text-left ${
                !isKnockoutOnly
                  ? 'bg-emerald-400 text-slate-950 shadow-md shadow-emerald-400/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Swords size={13} /> Pools + Knockout
              </span>
              <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                Round-robin groups into bracket
              </span>
            </button>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setStructure && setStructure('knockout_only')}
              className={`py-2.5 px-3 rounded-xl text-xs font-bold transition text-left ${
                isKnockoutOnly
                  ? 'bg-amber-400 text-slate-950 shadow-md shadow-amber-400/20'
                  : 'bg-slate-800 text-slate-300 hover:bg-slate-750 border border-slate-700'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Trophy size={13} /> Knockout Only
              </span>
              <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                Direct elimination (no pools)
              </span>
            </button>
          </div>
        </div>
      </div>

      {/* Entries Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
        <div className="flex items-center justify-between mb-2 gap-2 flex-wrap">
          <label className="text-slate-200 text-sm font-bold">
            {discipline === 'doubles' ? `Doubles Teams (${entries.length})` : `Singles Players (${entries.length})`}
          </label>
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              <input
                ref={csvFileInputRef}
                type="file"
                accept=".csv,.txt,text/csv,text/plain"
                onChange={handleCsvUpload}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => csvFileInputRef.current?.click()}
                className="text-xs font-bold text-[#d7f24c] hover:text-white bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 flex items-center gap-1.5 transition active:scale-95"
              >
                <Upload size={12} /> Upload CSV
              </button>
              <button
                type="button"
                onClick={() => {
                  const csv =
                    discipline === 'doubles'
                      ? 'Team / Pair\nAlex Rivera / Jordan Lee\nSam Taylor / Morgan Chen\nCasey Patel / Riley Nguyen\nTaylor Brooks / Jamie Kim\n'
                      : generateSampleDirectoryCSV();
                  triggerCsvDownload(
                    discipline === 'doubles' ? 'sample-doubles-teams.csv' : 'sample-singles-players.csv',
                    csv
                  );
                }}
                className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 flex items-center gap-1.5 transition active:scale-95"
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
            <button type="button" onClick={() => setCsvFeedback(null)} className="ml-2">
              <X size={13} />
            </button>
          </div>
        )}

        {isAdmin && (
          discipline === 'singles' ? (
            <form onSubmit={handleAddSingle} className="flex gap-2 mb-3">
              <input
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder="Player name..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
              />
              <button
                type="submit"
                disabled={!singleName.trim()}
                className="bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 rounded-xl px-4 py-2.5 font-bold active:scale-95 transition flex items-center gap-1 disabled:opacity-40"
              >
                <UserPlus size={18} />
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddDoubles} className="grid grid-cols-1 sm:grid-cols-5 gap-2 mb-3">
              <input
                value={partner1}
                onChange={(e) => setPartner1(e.target.value)}
                placeholder="Partner 1"
                className="sm:col-span-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
              />
              <input
                value={partner2}
                onChange={(e) => setPartner2(e.target.value)}
                placeholder="Partner 2"
                className="sm:col-span-2 bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
              />
              <button
                type="submit"
                disabled={!partner1.trim() || !partner2.trim()}
                className="bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 rounded-xl px-3 py-2.5 font-bold text-xs active:scale-95 transition flex items-center justify-center gap-1 disabled:opacity-40"
              >
                <UserPlus size={16} /> Add Pair
              </button>
            </form>
          )
        )}

        {entries.length === 0 ? (
          <p className="text-slate-500 text-xs italic py-2">
            Add at least {isKnockoutOnly ? 2 : 3} {discipline === 'doubles' ? 'doubles teams' : 'singles players'} to generate{' '}
            {isKnockoutOnly ? 'the bracket' : 'pools'}.
          </p>
        ) : (
          <div className="space-y-1.5 max-h-56 overflow-y-auto pr-1">
            {entries.map((entry, idx) => (
              <div
                key={entry.id}
                className="flex items-center justify-between gap-2 bg-slate-800/80 border border-slate-700/70 rounded-xl px-3 py-2 text-xs"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <span className="font-mono text-[11px] font-bold text-slate-400 bg-slate-900 px-1.5 py-0.5 rounded">
                    #{idx + 1}
                  </span>
                  <span className="text-white font-semibold truncate">{getEntryDisplayName(entry)}</span>
                </div>
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() => onRemoveEntry(entry.id)}
                    className="text-slate-400 hover:text-red-400 p-1 rounded-lg transition"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        {/* Room Directory Tray */}
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
                {((discipline === 'singles' && availableSaved.length > 0) ||
                  (discipline === 'doubles' && availableSaved.length >= 2)) &&
                  onAddAllSavedPlayers && (
                    <button
                      type="button"
                      onClick={onAddAllSavedPlayers}
                      className="text-xs font-bold text-[#d7f24c] hover:underline flex items-center gap-1 active:scale-95 transition"
                    >
                      <UserPlus size={13} />{' '}
                      {discipline === 'singles'
                        ? `+ Add All (${availableSaved.length})`
                        : `+ Pair All (${Math.floor(availableSaved.length / 2)})`}
                    </button>
                  )}
                {savedPlayers.length > 0 && (
                  <button
                    type="button"
                    onClick={() => {
                      const csv = generateDirectoryCSV(savedPlayers, activePlayerPool);
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
                  onClick={() => setIsDirectoryModalOpen(true)}
                  className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700/80 rounded-xl px-2.5 py-1 flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  title="Manage room directory players (rename, delete, search, export)"
                >
                  <Settings size={12} className="text-[#d7f24c]" /> Manage Players
                </button>
              </div>
            </div>

            {/* Quick save to room directory */}
            {onAddDirectoryPlayer && (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  const trimmed = directoryNameInput.trim();
                  if (trimmed) {
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
            )}

            {savedPlayers.length > 0 ? (
              <>
                <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
                  {discipline === 'doubles'
                    ? 'Click 2 players to fill Partner 1 & Partner 2'
                    : 'Click player to add to Singles draw'}
                </span>
                <div className="flex flex-wrap gap-1.5 max-h-44 overflow-y-auto pr-1">
                  {[...savedPlayers]
                    .sort((a, b) => {
                      const aIn = activePlayerNamesLower.has(a.trim().toLowerCase());
                      const bIn = activePlayerNamesLower.has(b.trim().toLowerCase());
                      if (aIn === bIn) return a.localeCompare(b);
                      return aIn ? 1 : -1;
                    })
                    .map((name) => {
                      const lower = name.trim().toLowerCase();
                      const isInPool = activePlayerNamesLower.has(lower);
                      const isStagedPartner =
                        discipline === 'doubles' &&
                        (partner1.trim().toLowerCase() === lower || partner2.trim().toLowerCase() === lower);

                      return (
                        <button
                          key={name}
                          type="button"
                          onClick={() => {
                            if (discipline === 'singles' && isInPool) return;
                            handleQuickPickDirectory(name);
                          }}
                          className={`inline-flex items-center gap-1 border rounded-full px-2.5 py-1 text-xs transition ${
                            isStagedPartner
                              ? 'bg-[#d7f24c]/15 border-[#d7f24c]/50 text-[#d7f24c] font-semibold'
                              : isInPool
                                ? 'bg-emerald-950/40 border-emerald-500/40 text-emerald-300 shadow-sm'
                                : 'bg-slate-800/80 hover:bg-slate-750 border-slate-700/70 text-slate-300 hover:text-white active:scale-95'
                          }`}
                          title={
                            isInPool
                              ? `${name} is already entered in this tournament`
                              : discipline === 'doubles'
                                ? `Pick ${name} as partner`
                                : `Add ${name} to tournament`
                          }
                        >
                          {isInPool ? (
                            <>
                              <Check size={11} className="stroke-[3] text-emerald-400" />
                              <span>{name}</span>
                            </>
                          ) : (
                            <>
                              <span>{name}</span>
                              <span className="text-[#d7f24c] font-bold text-sm leading-none">+</span>
                            </>
                          )}
                        </button>
                      );
                    })}
                </div>
              </>
            ) : (
              <p className="text-[11px] text-slate-500 italic py-1">
                No saved names in {roomId || 'this room'} yet. Add names above or import via CSV.
              </p>
            )}
          </div>
        )}
      </div>

      {/* Pool & Knockout Rules Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl space-y-4">
        <label className="text-slate-200 text-sm font-bold flex items-center gap-1.5">
          <Trophy size={16} className="text-amber-400" />{' '}
          {isKnockoutOnly ? 'Knockout Structure & Match Formats' : 'Pool & Knockout Structure'}
        </label>

        {!isKnockoutOnly && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Number of Pools
              </span>
              <select
                disabled={!isAdmin}
                value={numPools}
                onChange={(e) => setNumPools(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
              >
                {[1, 2, 3, 4, 6, 8].map((n) => (
                  <option key={n} value={n}>
                    {n} Pool{n === 1 ? '' : 's'}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1">
                Advance per Pool
              </span>
              <select
                disabled={!isAdmin}
                value={advancePerPool}
                onChange={(e) => setAdvancePerPool(Number(e.target.value))}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-sm font-bold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
              >
                {[1, 2, 3, 4].map((n) => (
                  <option key={n} value={n}>
                    Top {n} per Pool
                  </option>
                ))}
              </select>
            </div>
          </div>
        )}

        {/* Seeding */}
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            {isKnockoutOnly ? 'Bracket Seeding' : 'Pool Seeding'}
          </span>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setSeedingMode('snake')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition ${
                seedingMode === 'snake'
                  ? 'bg-[#d7f24c] text-slate-950'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              {isKnockoutOnly ? 'Seeded by Entry #' : 'Snake Seeded (by #)'}
            </button>
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => setSeedingMode('random')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1 ${
                seedingMode === 'random'
                  ? 'bg-[#d7f24c] text-slate-950'
                  : 'bg-slate-800 text-slate-300 border border-slate-700'
              }`}
            >
              <Shuffle size={12} /> Random Draw
            </button>
          </div>
        </div>

        {/* Pool Play Scoring Format */}
        {!isKnockoutOnly && (
          <div className="pt-3 border-t border-slate-800 space-y-2">
            <span className="text-xs font-bold text-slate-300 block">Pool Play Match Format</span>
            <div className="grid grid-cols-3 gap-2">
              {[1, 3, 5].map((bo) => (
                <button
                  key={bo}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setPoolFormat({ ...poolFormat, bestOf: bo })}
                  className={`py-2 rounded-xl text-xs font-bold transition ${
                    poolFormat.bestOf === bo
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  {bo === 1 ? '1 Game' : `Best of ${bo}`}
                </button>
              ))}
            </div>
            <div className="flex items-center gap-2">
              {[11, 15, 21].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setPoolFormat({ ...poolFormat, pointsTo: pts })}
                  className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                    Number(poolFormat.pointsTo) === pts
                      ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  to {pts}
                </button>
              ))}
              <input
                type="text"
                inputMode="numeric"
                disabled={!isAdmin}
                value={poolFormat.pointsTo ?? ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setPoolFormat({ ...poolFormat, pointsTo: val === '' ? '' : Number(val) });
                }}
                onBlur={() => {
                  if (!poolFormat.pointsTo || Number(poolFormat.pointsTo) < 1) {
                    setPoolFormat({ ...poolFormat, pointsTo: 11 });
                  }
                }}
                placeholder="Custom"
                title="Custom points to win"
                className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-center text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60"
              />
            </div>
          </div>
        )}

        {/* Knockout Scoring Format + Per-Round Formats */}
        <div className="pt-3 border-t border-slate-800 space-y-2.5">
          <div className="flex items-center justify-between gap-2">
            <span className="text-xs font-bold text-slate-300">
              {knockoutFormat?.useRoundFormats ? 'Default Knockout Format' : 'Knockout Match Format'}
            </span>
            <span className="text-[10px] font-mono text-amber-300/80">
              Custom score or per-round rules
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2">
            {[1, 3, 5].map((bo) => (
              <button
                key={bo}
                type="button"
                disabled={!isAdmin}
                onClick={() => setKnockoutFormat({ ...knockoutFormat, bestOf: bo })}
                className={`py-2 rounded-xl text-xs font-bold transition ${
                  knockoutFormat.bestOf === bo
                    ? 'bg-amber-400 text-slate-950'
                    : 'bg-slate-800 text-slate-300 border border-slate-700'
                }`}
              >
                {bo === 1 ? '1 Game' : `Best of ${bo}`}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {[11, 15, 21].map((pts) => (
              <button
                key={pts}
                type="button"
                disabled={!isAdmin}
                onClick={() => setKnockoutFormat({ ...knockoutFormat, pointsTo: pts })}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                  Number(knockoutFormat.pointsTo) === pts
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                to {pts}
              </button>
            ))}
            <input
              type="text"
              inputMode="numeric"
              disabled={!isAdmin}
              value={knockoutFormat.pointsTo ?? ''}
              onChange={(e) => {
                const val = e.target.value.replace(/\D/g, '');
                setKnockoutFormat({ ...knockoutFormat, pointsTo: val === '' ? '' : Number(val) });
              }}
              onBlur={() => {
                if (!knockoutFormat.pointsTo || Number(knockoutFormat.pointsTo) < 1) {
                  setKnockoutFormat({ ...knockoutFormat, pointsTo: 11 });
                }
              }}
              placeholder="Custom"
              title="Custom points to win"
              className="w-20 bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-center text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
            />
          </div>

          {/* Per-Round Knockout Formats Toggle & Editor */}
          <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-3 space-y-2.5">
            <label className="flex items-center justify-between gap-2 cursor-pointer select-none">
              <div>
                <span className="text-xs font-bold text-slate-200 block">
                  Customize Formats Per Knockout Round
                </span>
                <span className="text-[11px] text-slate-400 block">
                  e.g. R32/R16/QF as 1 Game to 15, Semis &amp; Final as Best of 3 to 11
                </span>
              </div>
              <input
                type="checkbox"
                disabled={!isAdmin}
                checked={Boolean(knockoutFormat?.useRoundFormats)}
                onChange={(e) =>
                  setKnockoutFormat({
                    ...knockoutFormat,
                    useRoundFormats: e.target.checked,
                    roundFormats: defaultRoundFormats,
                  })
                }
                className="w-4 h-4 rounded text-amber-400 bg-slate-800 border-slate-700 focus:ring-amber-400 shrink-0"
              />
            </label>

            {knockoutFormat?.useRoundFormats && (
              <div className="space-y-2 pt-2 border-t border-slate-800">
                {isAdmin && (
                  <button
                    type="button"
                    onClick={() =>
                      setKnockoutFormat({
                        ...knockoutFormat,
                        useRoundFormats: true,
                        roundFormats: {
                          r32: { bestOf: 1, pointsTo: 15 },
                          r16: { bestOf: 1, pointsTo: 15 },
                          quarters: { bestOf: 1, pointsTo: 15 },
                          semis: { bestOf: 3, pointsTo: 11 },
                          final: { bestOf: 3, pointsTo: 11 },
                          bronze: { bestOf: 1, pointsTo: 15 },
                        },
                      })
                    }
                    className="w-full py-1.5 px-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 border border-slate-700 text-[11px] font-bold text-amber-300 transition text-center"
                  >
                    Apply Preset: Early Rounds (1G to 15) &bull; Semis &amp; Final (Bo3 to 11)
                  </button>
                )}

                {KNOCKOUT_ROUND_KEYS.filter((r) => r.key !== 'bronze' || includeBronze).map(({ key, label }) => {
                  const cfg = defaultRoundFormats[key] || { bestOf: 1, pointsTo: 11 };
                  return (
                    <div
                      key={key}
                      className="flex items-center justify-between gap-2 bg-slate-900/90 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs"
                    >
                      <span className="font-semibold text-slate-200 truncate">{label}</span>
                      <div className="flex items-center gap-1.5 shrink-0">
                        <div className="flex bg-slate-950 border border-slate-800 rounded-lg p-0.5">
                          {[1, 3, 5].map((bo) => (
                            <button
                              key={bo}
                              type="button"
                              disabled={!isAdmin}
                              onClick={() => updateRoundFormat(key, { bestOf: bo })}
                              className={`px-2 py-0.5 rounded-md text-[10px] font-bold transition ${
                                Number(cfg.bestOf) === bo
                                  ? 'bg-amber-400 text-slate-950'
                                  : 'text-slate-400 hover:text-white'
                              }`}
                            >
                              {bo === 1 ? '1G' : `Bo${bo}`}
                            </button>
                          ))}
                        </div>
                        <input
                          type="text"
                          inputMode="numeric"
                          disabled={!isAdmin}
                          value={cfg.pointsTo ?? ''}
                          onChange={(e) => {
                            const val = e.target.value.replace(/\D/g, '');
                            updateRoundFormat(key, { pointsTo: val === '' ? '' : Number(val) });
                          }}
                          onBlur={() => {
                            if (!cfg.pointsTo || Number(cfg.pointsTo) < 1) {
                              updateRoundFormat(key, { pointsTo: 11 });
                            }
                          }}
                          className="w-11 bg-slate-950 border border-slate-700 rounded-lg py-0.5 text-center text-white font-mono font-bold text-[11px] focus:outline-none focus:ring-1 focus:ring-amber-400"
                          title={`Points to win ${label}`}
                        />
                        <span className="text-[10px] text-slate-500">pts</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Bronze Medal Toggle */}
        <label className="flex items-start gap-3 cursor-pointer select-none pt-2 border-t border-slate-800">
          <input
            type="checkbox"
            disabled={!isAdmin}
            checked={includeBronze}
            onChange={(e) => setIncludeBronze(e.target.checked)}
            className="mt-1 w-4 h-4 rounded text-[#d7f24c] bg-slate-800 border-slate-700 focus:ring-[#d7f24c]"
          />
          <div>
            <span className="text-slate-200 text-xs font-bold flex items-center gap-1.5">
              <Award size={13} className="text-amber-400" /> Include Bronze Medal Match (3rd Place)
            </span>
            <span className="text-slate-400 text-[11px] block">
              Semifinalists who lose compete for 3rd place / Bronze Medal.
            </span>
          </div>
        </label>
      </div>

      {/* Private Session & PIN Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
        <label className="text-slate-200 text-sm font-bold flex items-center gap-1.5 mb-2">
          <Lock size={15} className="text-amber-400" /> Private Session &amp; PIN
        </label>
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
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white font-mono font-bold text-sm focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
            />
          </div>
        </div>
      </div>

      {/* Summary Banner */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-5 text-xs text-slate-300 space-y-1">
        <p className="font-bold text-white flex items-center gap-1.5">
          <Swords size={14} className="text-[#d7f24c]" /> Format Summary
        </p>
        {isKnockoutOnly ? (
          <>
            <p>
              &bull; Direct Single-Elimination Knockout for <strong>{entries.length}</strong>{' '}
              {discipline === 'doubles' ? 'doubles teams' : 'singles players'} (no pool play)
            </p>
            <p>
              &bull; Seeding: <strong>{seedingMode === 'random' ? 'Random Draw' : 'Entry Seed Order'}</strong>
              {knockoutFormat?.useRoundFormats ? ' \u2022 Custom per-round match formats enabled' : ''}
            </p>
          </>
        ) : (
          <>
            <p>
              &bull; <strong>{entries.length}</strong> {discipline === 'doubles' ? 'doubles teams' : 'singles players'} split across{' '}
              <strong>{effectivePools}</strong> pool{effectivePools === 1 ? '' : 's'}
            </p>
            <p>
              &bull; Top <strong>{advancePerPool}</strong> per pool ({totalAdvancing} total) advance to the{' '}
              <strong>Knockout Bracket</strong>
              {knockoutFormat?.useRoundFormats ? ' (per-round formats enabled)' : ''}
            </p>
          </>
        )}
      </div>

      {isAdmin && (
        <button
          type="button"
          onClick={onStartPoolTournament}
          disabled={!canStart}
          className={`w-full py-4 rounded-2xl font-extrabold text-lg flex items-center justify-center gap-2 transition active:scale-95 ${
            canStart
              ? 'bg-[#d7f24c] text-slate-950 shadow-xl shadow-[#d7f24c]/20 hover:bg-[#c6e140]'
              : 'bg-slate-800 text-slate-600 cursor-not-allowed'
          }`}
        >
          <Play size={20} /> {isKnockoutOnly ? 'Generate Knockout Bracket' : 'Generate Pools & Schedule'}
        </button>
      )}

      {/* Dedicated Directory Management Modal */}
      <DirectoryModal
        isOpen={isDirectoryModalOpen}
        onClose={() => setIsDirectoryModalOpen(false)}
        roomId={roomId}
        savedPlayers={savedPlayers}
        playerPool={activePlayerPool}
        onAddDirectoryPlayer={onAddDirectoryPlayer}
        onAddMultiplePlayers={onImportDirectoryNames}
        onRenameDirectoryPlayer={onRenameDirectoryPlayer}
        onRemoveSavedPlayer={onRemoveSavedPlayer}
        isAdmin={isAdmin}
      />
    </div>
  );
}

