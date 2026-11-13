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
  ChevronUp,
  ChevronDown,
  Trash2,
  Bookmark,
  Save,
  QrCode,
  Search,
} from 'lucide-react';
import { generateRoomId, generatePin, sanitizeRoomId } from '../utils/room';
import { generateDirectoryCSV, generateSampleDirectoryCSV, triggerCsvDownload } from '../utils/tournament';
import {
  getEntryDisplayName,
  KNOCKOUT_ROUND_KEYS,
  POOL_TIEBREAKER_PRESETS,
  TIEBREAKER_CRITERIA_LABELS,
  DEFAULT_TIEBREAKER_RULES,
} from '../utils/poolTournament';
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
  onClearEntries,
  onMoveEntry,
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
  knockoutFillMode = 'byes',
  setKnockoutFillMode,
  targetBracketSize = 'auto',
  setTargetBracketSize,
  seedingMode = 'snake',
  setSeedingMode,
  tiebreakerRules = DEFAULT_TIEBREAKER_RULES,
  setTiebreakerRules,
  poolFormat = { bestOf: 1, pointsTo: 15, winByTwo: true },
  setPoolFormat,
  knockoutFormat = { bestOf: 3, pointsTo: 11, winByTwo: true },
  setKnockoutFormat,
  includeBronze = true,
  setIncludeBronze,
  numCourts = 2,
  setNumCourts,
  roomId,
  setRoomId,
  adminPin,
  setAdminPin,
  hasExistingTournament = false,
  onUpdateTournamentSettings,
  onStartPoolTournament,
  isAdmin,
}) {
  const [activeTab, setActiveTab] = useState('entries');
  const [singleName, setSingleName] = useState('');
  const [partner1, setPartner1] = useState('');
  const [partner2, setPartner2] = useState('');
  const [directoryNameInput, setDirectoryNameInput] = useState('');
  const [directorySearch, setDirectorySearch] = useState('');
  const [isDirectoryModalOpen, setIsDirectoryModalOpen] = useState(false);
  const [directoryOpenWithQr, setDirectoryOpenWithQr] = useState(false);
  const [directoryQrPlayer, setDirectoryQrPlayer] = useState(null);
  const [csvFeedback, setCsvFeedback] = useState(null);
  const [presetNameInput, setPresetNameInput] = useState('');
  const [configFeedback, setConfigFeedback] = useState(null);
  const [savedPresets, setSavedPresets] = useState(() => {
    try {
      const raw = localStorage.getItem('neep_pool_presets');
      return raw ? JSON.parse(raw) : [];
    } catch (e) {
      return [];
    }
  });
  const csvFileInputRef = useRef(null);
  const configFileInputRef = useRef(null);

  function showConfigToast(message, type = 'success') {
    setConfigFeedback({ message, type });
    setTimeout(() => setConfigFeedback(null), 3500);
  }

  function handleSaveConfigPreset(e) {
    e?.preventDefault();
    const cleanName = presetNameInput.trim();
    if (!cleanName) return;
    const snap = {
      id: cleanName.toLowerCase().replace(/[^a-z0-9]+/g, '-'),
      name: cleanName,
      discipline,
      structure,
      numPools,
      advancePerPool,
      knockoutFillMode,
      targetBracketSize,
      seedingMode,
      poolFormat,
      knockoutFormat,
      includeBronze,
      numCourts,
    };
    const next = [snap, ...savedPresets.filter((p) => p.id !== snap.id)];
    setSavedPresets(next);
    setPresetNameInput('');
    try {
      localStorage.setItem('neep_pool_presets', JSON.stringify(next));
    } catch (err) {}
    showConfigToast(`Saved preset "${cleanName}"`);
  }

  function applyConfigSnapshot(cfg) {
    if (!cfg) return;
    if (cfg.structure && setStructure) setStructure(cfg.structure);
    if (cfg.numPools && setNumPools) setNumPools(cfg.numPools);
    if (cfg.advancePerPool && setAdvancePerPool) setAdvancePerPool(cfg.advancePerPool);
    if (cfg.knockoutFillMode && setKnockoutFillMode) setKnockoutFillMode(cfg.knockoutFillMode);
    if (cfg.targetBracketSize !== undefined && setTargetBracketSize) setTargetBracketSize(cfg.targetBracketSize);
    if (cfg.seedingMode && setSeedingMode) setSeedingMode(cfg.seedingMode);
    if (cfg.poolFormat && setPoolFormat) setPoolFormat(cfg.poolFormat);
    if (cfg.knockoutFormat && setKnockoutFormat) setKnockoutFormat(cfg.knockoutFormat);
    if (cfg.includeBronze !== undefined && setIncludeBronze) setIncludeBronze(cfg.includeBronze);
    if (cfg.numCourts && setNumCourts) setNumCourts(cfg.numCourts);
    showConfigToast(`Applied "${cfg.name || 'config'}"`);
  }

  function handleExportConfigJson() {
    const payload = {
      name: `${roomId || 'tournament'}-pool-config`,
      discipline,
      structure,
      numPools,
      advancePerPool,
      knockoutFillMode,
      targetBracketSize,
      seedingMode,
      poolFormat,
      knockoutFormat,
      includeBronze,
      numCourts,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${(roomId || 'tournament').toLowerCase()}-pool-config.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
    showConfigToast('Exported configuration JSON');
  }

  function handleImportConfigJson(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const parsed = JSON.parse(evt.target?.result || '{}');
        if (parsed && (parsed.poolFormat || parsed.knockoutFormat || parsed.numPools)) {
          applyConfigSnapshot(parsed);
        } else {
          showConfigToast('Invalid configuration JSON file.', 'error');
        }
      } catch (err) {
        showConfigToast('Could not parse JSON file.', 'error');
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  function handleSwitchDiscipline(nextDiscipline) {
    if (nextDiscipline === discipline) return;
    setSingleName('');
    setPartner1('');
    setPartner2('');
    setCsvFeedback(null);
    onChangeDiscipline(nextDiscipline);
  }

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

  const numberOfCourtsControl = setNumCourts ? (
    <div className="pt-3 border-t border-slate-800 space-y-2">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-bold text-slate-200">Number of Courts</span>
        <span className="text-[11px] font-mono text-slate-400">
          Assign Court 1–{Math.max(1, Number(numCourts) || 2)} to matchups
        </span>
      </div>
      <div className="grid grid-cols-6 gap-1.5">
        {[1, 2, 3, 4, 6, 8].map((n) => (
          <button
            key={n}
            type="button"
            disabled={!isAdmin}
            onClick={() => setNumCourts(n)}
            className={`py-1.5 rounded-xl text-xs font-bold transition ${
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
        placeholder="Custom number of courts (e.g. 6)"
        className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c] disabled:opacity-60"
      />
    </div>
  ) : null;

  return (
    <div className="max-w-lg lg:max-w-6xl mx-auto px-4 lg:px-6 py-6 pb-24 animate-in fade-in duration-200">
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
      <p className="text-slate-400 text-sm mb-4">
        {isKnockoutOnly
          ? 'Configure Singles or Doubles entries and Direct Knockout Bracket elimination rules.'
          : 'Configure Singles or Doubles entries, Pool Play round-robin groups, and Knockout elimination rules.'}
      </p>

      {/* Setup Configuration Tabs */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 mb-5 shadow-lg overflow-x-auto">
        {[
          { id: 'entries', label: '1. Players & Entries' },
          { id: 'structure', label: '2. Tournament Config' },
          { id: 'scoring', label: '3. Scoring Formats' },
          { id: 'presets', label: '4. Room & Presets' },
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
        <div className={activeTab === 'entries' ? 'lg:col-span-12 lg:grid lg:grid-cols-12 lg:gap-6 lg:items-start' : 'hidden'}>
          {/* Players & Entries Card (Left side on desktop to match MLP SetupView) */}
      <div className={`${isAdmin ? 'lg:col-span-6' : 'lg:col-span-12'} bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl space-y-4`}>
        <div>
          <div className="flex items-center justify-between gap-2 mb-2">
            <label className="text-slate-200 text-sm font-bold">
              Event Discipline
            </label>
            {entries.length > 0 && isAdmin && (
              <span className="text-[10px] text-slate-400">
                Switching clears current list
              </span>
            )}
          </div>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={!isAdmin}
              onClick={() => handleSwitchDiscipline('singles')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
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
              onClick={() => handleSwitchDiscipline('doubles')}
              className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
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
        <div className="flex items-center justify-between mb-1.5 gap-2 flex-wrap">
          <div>
            <label className="text-slate-200 text-sm font-bold block">
              {discipline === 'doubles' ? `Doubles Teams (${entries.length})` : `Singles Players (${entries.length})`}
            </label>
            <p className="text-[11px] text-slate-400">
              {discipline === 'doubles'
                ? 'Type two partners below or tap 2 players in your Room Directory.'
                : 'Type a player name below or tap names in your Room Directory.'}
            </p>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1.5">
              {entries.length > 0 && onClearEntries && (
                <button
                  type="button"
                  onClick={onClearEntries}
                  className="text-xs font-bold text-red-400 hover:text-red-300 bg-red-500/10 border border-red-500/30 rounded-xl px-2.5 py-1 flex items-center gap-1 transition active:scale-95"
                  title="Remove all entries"
                >
                  <Trash2 size={12} /> Clear All
                </button>
              )}
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
                <Upload size={12} /> CSV
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
                <Download size={12} className="text-slate-400" /> Sample
              </button>
            </div>
          )}
        </div>

        {csvFeedback && (
          <div
            className={`my-2.5 px-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-between border ${
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
            <form onSubmit={handleAddSingle} className="flex gap-2 my-3">
              <input
                value={singleName}
                onChange={(e) => setSingleName(e.target.value)}
                placeholder="Enter player name..."
                className="flex-1 bg-slate-800 border border-slate-700 rounded-xl px-4 py-2.5 text-white placeholder-slate-500 text-sm focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
              />
              <button
                type="submit"
                disabled={!singleName.trim()}
                className="bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 rounded-xl px-4 py-2.5 font-bold text-xs active:scale-95 transition flex items-center gap-1.5 disabled:opacity-40"
              >
                <UserPlus size={16} /> Add Player
              </button>
            </form>
          ) : (
            <form onSubmit={handleAddDoubles} className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3 space-y-2.5 my-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Partner 1
                  </span>
                  <input
                    value={partner1}
                    onChange={(e) => setPartner1(e.target.value)}
                    placeholder="First player..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                  />
                </div>
                <div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                    Partner 2
                  </span>
                  <input
                    value={partner2}
                    onChange={(e) => setPartner2(e.target.value)}
                    placeholder="Second player..."
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                  />
                </div>
              </div>
              <div className="flex items-center gap-2">
                {(partner1 || partner2) && (
                  <button
                    type="button"
                    onClick={() => {
                      setPartner1('');
                      setPartner2('');
                    }}
                    className="px-3 py-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white text-xs font-bold border border-slate-700 transition"
                  >
                    Clear
                  </button>
                )}
                <button
                  type="submit"
                  disabled={!partner1.trim() || !partner2.trim()}
                  className="flex-1 bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 rounded-xl py-2 px-3 font-black text-xs active:scale-95 transition flex items-center justify-center gap-1.5 disabled:opacity-40"
                >
                  <UserPlus size={15} /> Add Doubles Team
                </button>
              </div>
            </form>
          )
        )}

        {entries.length === 0 ? (
          <p className="text-slate-500 text-xs italic py-2 text-center bg-slate-950/40 rounded-xl border border-slate-800/60">
            No {discipline === 'doubles' ? 'teams' : 'players'} added yet. Add at least {isKnockoutOnly ? 2 : 3} to start.
          </p>
        ) : (
          <div className="max-h-[380px] lg:max-h-[440px] overflow-y-auto bg-slate-950/60 border border-slate-800 rounded-2xl p-2.5">
            <div
              className={`grid gap-2 ${
                discipline === 'doubles'
                  ? 'grid-cols-1 sm:grid-cols-2'
                  : 'grid-cols-2 sm:grid-cols-3'
              }`}
            >
              {entries.map((entry, idx) => {
                const displayName = getEntryDisplayName(entry);
                return (
                  <div
                    key={entry.id}
                    className="flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-xl bg-slate-900/80 border border-slate-800 hover:border-slate-700 text-xs transition"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="font-mono font-bold text-[11px] text-[#d7f24c] shrink-0">
                        #{idx + 1}
                      </span>
                      <span className="font-semibold text-white truncate" title={displayName}>
                        {displayName}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="inline-flex items-center gap-0.5 shrink-0">
                        {onMoveEntry && idx > 0 && (
                          <button
                            type="button"
                            onClick={() => onMoveEntry(idx, idx - 1)}
                            className="text-slate-400 hover:text-white p-0.5 rounded-lg transition"
                            title="Move seed up"
                          >
                            <ChevronUp size={13} />
                          </button>
                        )}
                        {onMoveEntry && idx < entries.length - 1 && (
                          <button
                            type="button"
                            onClick={() => onMoveEntry(idx, idx + 1)}
                            className="text-slate-400 hover:text-white p-0.5 rounded-lg transition"
                            title="Move seed down"
                          >
                            <ChevronDown size={13} />
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => onRemoveEntry(entry.id)}
                          className="text-slate-400 hover:text-red-400 p-0.5 rounded-lg transition"
                          title="Remove entry"
                        >
                          <X size={13} />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
        </div>
      </div>

        {/* Room Directory Card (Right side on desktop to match MLP SetupView) */}
        {isAdmin && (
          <div className="lg:col-span-6 bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
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
                  onClick={() => {
                    setDirectoryQrPlayer(null);
                    setDirectoryOpenWithQr(true);
                    setIsDirectoryModalOpen(true);
                  }}
                  className="text-xs font-bold text-emerald-300 hover:text-emerald-200 bg-slate-800 hover:bg-slate-750 border border-emerald-500/30 rounded-xl px-2.5 py-1 flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                  title="Show Admin or Spectator URL & QR Code"
                >
                  <QrCode size={12} /> Admin / Spectator QR
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setDirectoryQrPlayer(null);
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
              (() => {
                const q = directorySearch.trim().toLowerCase();
                const filteredSaved = [...savedPlayers]
                  .filter((name) => !q || name.toLowerCase().includes(q))
                  .sort((a, b) => {
                    const aIn = activePlayerNamesLower.has(a.trim().toLowerCase());
                    const bIn = activePlayerNamesLower.has(b.trim().toLowerCase());
                    if (aIn === bIn) return a.localeCompare(b);
                    return aIn ? 1 : -1;
                  });
                return (
                  <>
                    <div className="flex items-center justify-between gap-2 mb-1.5 flex-wrap">
                      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">
                        {discipline === 'doubles'
                          ? 'Click 2 players to fill Partner 1 & Partner 2'
                          : 'Click player to add to Singles draw'}
                      </span>
                    </div>
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
                            <th className="py-1.5 px-2 font-bold text-center w-20">Player QR</th>
                            <th className="py-1.5 px-3 font-bold text-center w-24">Status</th>
                            <th className="py-1.5 px-3 font-bold text-right w-28">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-800/70">
                          {filteredSaved.length === 0 ? (
                            <tr>
                              <td colSpan={4} className="py-4 px-3 text-center text-xs text-slate-500 italic">
                                No directory players match &ldquo;{directorySearch}&rdquo;.
                              </td>
                            </tr>
                          ) : (
                            filteredSaved.map((name) => {
                              const lower = name.trim().toLowerCase();
                              const isInPool = activePlayerNamesLower.has(lower);
                              const isStagedPartner =
                                discipline === 'doubles' &&
                                (partner1.trim().toLowerCase() === lower || partner2.trim().toLowerCase() === lower);

                              return (
                                <tr key={name} className="hover:bg-slate-900/60 transition">
                                  <td className="py-1.5 px-3 font-semibold text-white">{name}</td>
                                  <td className="py-1.5 px-2 text-center">
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setDirectoryQrPlayer(name);
                                        setDirectoryOpenWithQr(false);
                                        setIsDirectoryModalOpen(true);
                                      }}
                                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-bold bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 transition active:scale-95"
                                      title={`Player Login QR for ${name}`}
                                    >
                                      <QrCode size={11} /> QR
                                    </button>
                                  </td>
                                  <td className="py-1.5 px-3 text-center">
                                    {isStagedPartner ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#d7f24c]/15 text-[#d7f24c] border border-[#d7f24c]/40 px-2 py-0.5 rounded-full">
                                        Staged
                                      </span>
                                    ) : isInPool ? (
                                      <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full">
                                        <Check size={10} className="stroke-[3]" /> Entered
                                      </span>
                                    ) : (
                                      <span className="text-[10px] font-medium text-slate-500">Available</span>
                                    )}
                                  </td>
                                  <td className="py-1.5 px-3 text-right">
                                    {isInPool && discipline === 'singles' ? (
                                      <span className="text-[11px] text-slate-500 italic">In Draw</span>
                                    ) : (
                                      <button
                                        type="button"
                                        onClick={() => handleQuickPickDirectory(name)}
                                        className={`px-2.5 py-0.5 rounded-lg text-[11px] font-bold transition active:scale-95 ${
                                          isStagedPartner
                                            ? 'bg-slate-800 text-slate-400 border border-slate-700'
                                            : 'bg-[#d7f24c]/15 hover:bg-[#d7f24c]/25 text-[#d7f24c] border border-[#d7f24c]/40'
                                        }`}
                                      >
                                        {discipline === 'doubles' ? '+ Partner' : '+ Add'}
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
                        <Check size={12} className="stroke-[3]" /> All {savedPlayers.length} directory players are entered
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1.5 mt-2">
                        <Users size={11} className="text-[#d7f24c]" /> {savedPlayers.length - availableSaved.length} entered • {availableSaved.length} available to add
                      </div>
                    )}
                  </>
                );
              })()
            ) : (
              <p className="text-[11px] text-slate-500 italic py-1">
                No saved names in {roomId || 'this room'} yet. Add names above or import via CSV.
              </p>
            )}
          </div>
        )}

        </div>
        <div className={activeTab === 'entries' ? 'hidden' : 'lg:col-span-12'}>
          {/* Pool & Knockout Rules Card */}
      <div className={activeTab === 'structure' || activeTab === 'scoring' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-5 mb-4 shadow-xl space-y-4' : 'hidden'}>
        <label className="text-slate-200 text-sm font-bold flex items-center gap-1.5">
          <Trophy size={16} className="text-amber-400" />{' '}
          {activeTab === 'scoring'
            ? 'Match Scoring Formats & Bronze Medal'
            : 'Tournament Config'}
        </label>

        {activeTab === 'structure' && (
          <div className="space-y-4">
            <div>
              <label className="text-slate-200 text-xs font-bold uppercase tracking-wider block mb-2">
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

            {numberOfCourtsControl}
          </div>
        )}

        {!isKnockoutOnly && activeTab === 'structure' && (
          <div className="space-y-3">
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
                  {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((n) => (
                    <option key={n} value={n}>
                      {n} Pool{n === 1 ? '' : 's'}
                      {n % 2 === 1 && n > 1 ? ' (Odd)' : ''}
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

            {/* Odd Pools / Knockout Advancement Mode */}
            <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                  Knockout Advancement (Odd Pools / Bracket Fill)
                </span>
                <span className="text-[10px] font-mono text-emerald-300">
                  {totalAdvancing} auto-qualifiers
                </span>
              </div>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setKnockoutFillMode && setKnockoutFillMode('byes')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition text-left ${
                    knockoutFillMode !== 'wildcards'
                      ? 'bg-[#d7f24c] text-slate-950'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  <span>Top Seeds Get BYEs</span>
                  <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                    Best pool winners skip R1
                  </span>
                </button>
                <button
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setKnockoutFillMode && setKnockoutFillMode('wildcards')}
                  className={`py-2 px-2.5 rounded-xl text-xs font-bold transition text-left ${
                    knockoutFillMode === 'wildcards'
                      ? 'bg-emerald-400 text-slate-950'
                      : 'bg-slate-800 text-slate-300 border border-slate-700'
                  }`}
                >
                  <span>Fill with Wildcards</span>
                  <span className="block text-[10px] font-normal opacity-80 mt-0.5">
                    Best next-place finishers fill bracket
                  </span>
                </button>
              </div>

              <div className="flex items-center justify-between gap-2 pt-1">
                <span className="text-[11px] text-slate-400 font-semibold">
                  Target Bracket Size
                </span>
                <select
                  disabled={!isAdmin}
                  value={targetBracketSize}
                  onChange={(e) =>
                    setTargetBracketSize &&
                    setTargetBracketSize(e.target.value === 'auto' ? 'auto' : Number(e.target.value))
                  }
                  className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1.5 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                >
                  <option value="auto">Auto (Next Power of 2)</option>
                  <option value={4}>4 Teams (Semis)</option>
                  <option value={8}>8 Teams (Quarters)</option>
                  <option value={16}>16 Teams (Round of 16)</option>
                  <option value={32}>32 Teams (Round of 32)</option>
                </select>
              </div>
            </div>

            {/* Pool Tiebreaker Rules */}
            <div className="bg-slate-950/60 border border-slate-800/90 rounded-2xl p-3 space-y-2.5">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <span className="text-[11px] font-bold text-slate-200 uppercase tracking-wider">
                  Pool Tiebreaker Rules
                </span>
                <span className="text-[10px] font-mono text-slate-400">
                  After Match {tiebreakerRules?.rankByWinPct ? 'Win %' : 'Wins'}
                </span>
              </div>

              <select
                disabled={!isAdmin}
                value={tiebreakerRules?.preset || 'standard'}
                onChange={(e) => {
                  const key = e.target.value;
                  if (key === 'custom') {
                    setTiebreakerRules &&
                      setTiebreakerRules({
                        ...(tiebreakerRules || DEFAULT_TIEBREAKER_RULES),
                        preset: 'custom',
                      });
                  } else if (POOL_TIEBREAKER_PRESETS[key]) {
                    const p = POOL_TIEBREAKER_PRESETS[key];
                    setTiebreakerRules &&
                      setTiebreakerRules({
                        preset: key,
                        order: [...p.order],
                        rankByWinPct: Boolean(p.rankByWinPct),
                      });
                  }
                }}
                className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-bold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
              >
                {Object.entries(POOL_TIEBREAKER_PRESETS).map(([key, p]) => (
                  <option key={key} value={key}>
                    {p.label}
                  </option>
                ))}
                <option value="custom">Custom Tiebreaker Order</option>
              </select>

              <label className="flex items-center gap-2 text-xs text-slate-300 cursor-pointer select-none">
                <input
                  type="checkbox"
                  disabled={!isAdmin}
                  checked={Boolean(tiebreakerRules?.rankByWinPct)}
                  onChange={(e) =>
                    setTiebreakerRules &&
                    setTiebreakerRules({
                      ...(tiebreakerRules || DEFAULT_TIEBREAKER_RULES),
                      preset: 'custom',
                      rankByWinPct: e.target.checked,
                    })
                  }
                  className="accent-[#d7f24c] rounded"
                />
                <span>
                  Rank by <strong className="text-white">Win %</strong> first (recommended for uneven pool sizes)
                </span>
              </label>

              <div className="space-y-1">
                {(tiebreakerRules?.order || DEFAULT_TIEBREAKER_RULES.order).map((critKey, idx, arr) => (
                  <div
                    key={critKey}
                    className="flex items-center justify-between gap-2 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 text-xs"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="text-[10px] font-mono font-bold text-[#d7f24c] w-4 shrink-0">
                        {idx + 1}.
                      </span>
                      <span className="text-slate-200 font-semibold truncate">
                        {TIEBREAKER_CRITERIA_LABELS[critKey] || critKey}
                      </span>
                    </div>
                    {isAdmin && (
                      <div className="flex items-center gap-1 shrink-0">
                        <button
                          type="button"
                          disabled={idx === 0}
                          onClick={() => {
                            if (idx === 0 || !setTiebreakerRules) return;
                            const next = [...arr];
                            [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
                            setTiebreakerRules({
                              ...(tiebreakerRules || DEFAULT_TIEBREAKER_RULES),
                              preset: 'custom',
                              order: next,
                            });
                          }}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition"
                          title="Move up"
                        >
                          <ChevronUp size={12} />
                        </button>
                        <button
                          type="button"
                          disabled={idx === arr.length - 1}
                          onClick={() => {
                            if (idx === arr.length - 1 || !setTiebreakerRules) return;
                            const next = [...arr];
                            [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
                            setTiebreakerRules({
                              ...(tiebreakerRules || DEFAULT_TIEBREAKER_RULES),
                              preset: 'custom',
                              order: next,
                            });
                          }}
                          className="p-1 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 disabled:opacity-30 transition"
                          title="Move down"
                        >
                          <ChevronDown size={12} />
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Seeding */}
        <div className={activeTab === 'structure' ? '' : 'hidden'}>
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
        {!isKnockoutOnly && activeTab === 'scoring' && (
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
            <div className="space-y-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                Points to Win (Preset or Custom)
              </span>
              <div className="grid grid-cols-3 gap-2">
                {[11, 15, 21].map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    disabled={!isAdmin}
                    onClick={() => setPoolFormat({ ...poolFormat, pointsTo: pts })}
                    className={`py-1.5 rounded-xl text-xs font-bold transition ${
                      Number(poolFormat.pointsTo) === pts
                        ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                        : 'bg-slate-800 text-slate-400 border border-slate-700'
                    }`}
                  >
                    to {pts} pts
                  </button>
                ))}
              </div>
              <div
                className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border ${
                  ![11, 15, 21].includes(Number(poolFormat.pointsTo))
                    ? 'bg-emerald-400/10 border-emerald-400/40'
                    : 'bg-slate-950/60 border-slate-800'
                }`}
              >
                <span className="text-xs font-bold text-slate-300">Custom Score:</span>
                <input
                  type="text"
                  inputMode="numeric"
                  disabled={!isAdmin}
                  value={poolFormat.pointsTo ?? ''}
                  onFocus={(e) => e.target.select()}
                  onChange={(e) => {
                    const val = e.target.value.replace(/\D/g, '');
                    setPoolFormat({ ...poolFormat, pointsTo: val === '' ? '' : Number(val) });
                  }}
                  onBlur={() => {
                    if (!poolFormat.pointsTo || Number(poolFormat.pointsTo) < 1) {
                      setPoolFormat({ ...poolFormat, pointsTo: 11 });
                    }
                  }}
                  placeholder="e.g. 15"
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-center text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-emerald-400 disabled:opacity-60"
                />
                <span className="text-xs font-semibold text-slate-400">pts</span>
              </div>
            </div>
          </div>
        )}

        {/* Knockout Scoring Format + Per-Round Formats */}
        <div className={activeTab === 'scoring' ? 'pt-3 border-t border-slate-800 space-y-2.5' : 'hidden'}>
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
          <div className="space-y-2">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
              Points to Win (Preset or Custom)
            </span>
            <div className="grid grid-cols-3 gap-2">
              {[11, 15, 21].map((pts) => (
                <button
                  key={pts}
                  type="button"
                  disabled={!isAdmin}
                  onClick={() => setKnockoutFormat({ ...knockoutFormat, pointsTo: pts })}
                  className={`py-1.5 rounded-xl text-xs font-bold transition ${
                    Number(knockoutFormat.pointsTo) === pts
                      ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                      : 'bg-slate-800 text-slate-400 border border-slate-700'
                  }`}
                >
                  to {pts} pts
                </button>
              ))}
            </div>
            <div
              className={`flex items-center gap-2 rounded-xl px-3 py-1.5 border ${
                ![11, 15, 21].includes(Number(knockoutFormat.pointsTo))
                  ? 'bg-amber-400/10 border-amber-400/40'
                  : 'bg-slate-950/60 border-slate-800'
              }`}
            >
              <span className="text-xs font-bold text-slate-300">Custom Score:</span>
              <input
                type="text"
                inputMode="numeric"
                disabled={!isAdmin}
                value={knockoutFormat.pointsTo ?? ''}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const val = e.target.value.replace(/\D/g, '');
                  setKnockoutFormat({ ...knockoutFormat, pointsTo: val === '' ? '' : Number(val) });
                }}
                onBlur={() => {
                  if (!knockoutFormat.pointsTo || Number(knockoutFormat.pointsTo) < 1) {
                    setKnockoutFormat({ ...knockoutFormat, pointsTo: 11 });
                  }
                }}
                placeholder="e.g. 11"
                className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-center text-white font-mono font-bold text-xs focus:outline-none focus:ring-2 focus:ring-amber-400 disabled:opacity-60"
              />
              <span className="text-xs font-semibold text-slate-400">pts</span>
            </div>
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
        <label className={activeTab === 'scoring' ? 'flex items-start gap-3 cursor-pointer select-none pt-2 border-t border-slate-800' : 'hidden'}>
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

      {/* Saved Configuration Presets Card (from MLP Style App) */}
      {isAdmin && (
        <div className={activeTab === 'presets' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl space-y-3' : 'hidden'}>
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="text-slate-200 text-sm font-bold flex items-center gap-1.5">
              <Bookmark size={15} className="text-[#d7f24c]" /> Saved Tournament Configs
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
                className="text-[11px] font-bold text-slate-300 hover:text-white bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 flex items-center gap-1 transition"
              >
                <Upload size={11} /> Import JSON
              </button>
              <button
                type="button"
                onClick={handleExportConfigJson}
                className="text-[11px] font-bold text-[#d7f24c] hover:text-white bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-1 flex items-center gap-1 transition"
              >
                <Download size={11} /> Export JSON
              </button>
            </div>
          </div>

          {configFeedback && (
            <div
              className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                configFeedback.type === 'error'
                  ? 'bg-red-500/10 border-red-500/30 text-red-300'
                  : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
              }`}
            >
              <span>{configFeedback.message}</span>
              <button type="button" onClick={() => setConfigFeedback(null)}>
                <X size={12} />
              </button>
            </div>
          )}

          <form onSubmit={handleSaveConfigPreset} className="flex gap-2">
            <input
              type="text"
              value={presetNameInput}
              onChange={(e) => setPresetNameInput(e.target.value)}
              placeholder="Preset name (e.g. Friday Night Pools)..."
              className="flex-1 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
            />
            <button
              type="submit"
              disabled={!presetNameInput.trim()}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-[#d7f24c] font-bold text-xs border border-slate-700 flex items-center gap-1 disabled:opacity-40 transition"
            >
              <Save size={12} /> Save Preset
            </button>
          </form>

          {savedPresets.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {savedPresets.map((preset) => (
                <div
                  key={preset.id}
                  className="inline-flex items-center bg-slate-800/80 border border-slate-700 rounded-full text-xs overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => applyConfigSnapshot(preset)}
                    className="px-2.5 py-1 text-slate-200 hover:text-[#d7f24c] font-semibold transition"
                    title={`Apply ${preset.name}`}
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      const next = savedPresets.filter((p) => p.id !== preset.id);
                      setSavedPresets(next);
                      try {
                        localStorage.setItem('neep_pool_presets', JSON.stringify(next));
                      } catch (err) {}
                    }}
                    className="pr-2 pl-1 py-1 text-slate-500 hover:text-red-400 transition"
                    title="Delete preset"
                  >
                    <X size={11} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Private Session & PIN Card */}
      <div className={activeTab === 'presets' ? 'bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl' : 'hidden'}>
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
        <div className="space-y-2.5">
          {hasExistingTournament && onUpdateTournamentSettings && (
            <button
              type="button"
              onClick={onUpdateTournamentSettings}
              className="w-full py-3.5 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 transition active:scale-95 bg-emerald-500 hover:bg-emerald-400 text-slate-950 shadow-lg shadow-emerald-500/20"
            >
              <Settings size={16} /> Apply Rule &amp; Format Changes (Keep Played Scores)
            </button>
          )}
          <button
            type="button"
            onClick={onStartPoolTournament}
            disabled={!canStart}
            className={`w-full py-4 rounded-2xl font-extrabold text-lg flex items-center justify-center gap-2 transition active:scale-95 ${
              canStart
                ? hasExistingTournament
                  ? 'bg-slate-800 hover:bg-slate-750 text-[#d7f24c] border border-[#d7f24c]/40'
                  : 'bg-[#d7f24c] text-slate-950 shadow-xl shadow-[#d7f24c]/20 hover:bg-[#c6e140]'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Play size={20} />{' '}
            {hasExistingTournament
              ? isKnockoutOnly
                ? 'Regenerate Knockout Bracket'
                : 'Regenerate Pools & Schedule'
              : isKnockoutOnly
                ? 'Generate Knockout Bracket'
                : 'Generate Pools & Schedule'}
          </button>
        </div>
      )}

      {/* Dedicated Directory Management Modal */}
      <DirectoryModal
        isOpen={isDirectoryModalOpen}
        onClose={() => setIsDirectoryModalOpen(false)}
        initialShowQr={directoryOpenWithQr}
        initialQrPlayer={directoryQrPlayer}
        roomId={roomId}
        savedPlayers={savedPlayers}
        playerPool={activePlayerPool}
        onAddDirectoryPlayer={onAddDirectoryPlayer}
        onAddMultiplePlayers={onImportDirectoryNames}
        onRenameDirectoryPlayer={onRenameDirectoryPlayer}
        onRemoveSavedPlayer={onRemoveSavedPlayer}
        isAdmin={isAdmin}
        adminPin={adminPin}
      />
    </div>
  );
}

