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
} from 'lucide-react';
import { generateRoomId, generatePin, sanitizeRoomId } from '../utils/room';
import { generateSampleDirectoryCSV, triggerCsvDownload } from '../utils/tournament';
import { getEntryDisplayName } from '../utils/poolTournament';
import { APP_VERSION } from '../version';

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
  entries = [],
  onAddEntry,
  onAddMultipleEntries,
  onRemoveEntry,
  savedPlayers = [],
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

  const maxPoolsAllowed = Math.max(1, Math.floor(entries.length / 2));
  const effectivePools = Math.min(numPools, maxPoolsAllowed);
  const totalAdvancing = effectivePools * advancePerPool;
  const canStart = entries.length >= 3 && effectivePools >= 1;

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
              POOLS + KNOCKOUT
            </span>
            <span className="text-[10px] font-mono text-slate-400 bg-slate-950/80 border border-slate-800 px-2 py-0.5 rounded-full font-semibold">
              {APP_VERSION}
            </span>
          </div>
          <p className="text-slate-400 text-xs mt-0.5">
            Round-Robin Pool Play &amp; Seeded Knockout Bracket
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
        Configure Singles or Doubles entries, Pool Play round-robin groups, and Knockout elimination rules.
      </p>

      {/* Discipline Toggle: Singles vs Doubles */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl">
        <label className="text-slate-200 text-sm font-bold block mb-2.5">
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
            Add at least 3 {discipline === 'doubles' ? 'doubles teams' : 'singles players'} to generate pools.
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

        {/* Quick-Add from Room Directory */}
        {isAdmin && savedPlayers.length > 0 && (
          <div className="mt-3 pt-3 border-t border-slate-800/80">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1.5">
              Quick-Pick from Room Directory ({discipline === 'doubles' ? 'click 2 names to pair' : 'click to add'})
            </span>
            <div className="flex flex-wrap gap-1.5 max-h-28 overflow-y-auto">
              {savedPlayers.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => handleQuickPickDirectory(name)}
                  className="px-2.5 py-1 rounded-full bg-slate-800 hover:bg-slate-750 border border-slate-700 text-xs text-slate-300 hover:text-white transition"
                >
                  + {name}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Pool & Knockout Rules Card */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 mb-4 shadow-xl space-y-4">
        <label className="text-slate-200 text-sm font-bold flex items-center gap-1.5">
          <Trophy size={16} className="text-amber-400" /> Pool &amp; Knockout Structure
        </label>

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

        {/* Pool Seeding */}
        <div>
          <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
            Pool Seeding
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
              Snake Seeded (by #)
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
        <div className="pt-2 border-t border-slate-800">
          <span className="text-xs font-bold text-slate-300 block mb-2">Pool Play Match Format</span>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[1, 3].map((bo) => (
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
                {bo === 1 ? '1 Game' : 'Best of 3'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {[11, 15, 21].map((pts) => (
              <button
                key={pts}
                type="button"
                disabled={!isAdmin}
                onClick={() => setPoolFormat({ ...poolFormat, pointsTo: pts })}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                  poolFormat.pointsTo === pts
                    ? 'bg-emerald-400/20 text-emerald-300 border border-emerald-400/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                to {pts} pts
              </button>
            ))}
          </div>
        </div>

        {/* Knockout Scoring Format */}
        <div className="pt-2 border-t border-slate-800">
          <span className="text-xs font-bold text-slate-300 block mb-2">Knockout Match Format</span>
          <div className="grid grid-cols-2 gap-2 mb-2">
            {[1, 3].map((bo) => (
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
                {bo === 1 ? '1 Game' : 'Best of 3'}
              </button>
            ))}
          </div>
          <div className="flex gap-2">
            {[11, 15, 21].map((pts) => (
              <button
                key={pts}
                type="button"
                disabled={!isAdmin}
                onClick={() => setKnockoutFormat({ ...knockoutFormat, pointsTo: pts })}
                className={`flex-1 py-1.5 rounded-xl text-xs font-bold transition ${
                  knockoutFormat.pointsTo === pts
                    ? 'bg-amber-400/20 text-amber-300 border border-amber-400/40'
                    : 'bg-slate-800 text-slate-400 border border-slate-700'
                }`}
              >
                to {pts} pts
              </button>
            ))}
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
        <p>
          &bull; <strong>{entries.length}</strong> {discipline === 'doubles' ? 'doubles teams' : 'singles players'} split across{' '}
          <strong>{effectivePools}</strong> pool{effectivePools === 1 ? '' : 's'}
        </p>
        <p>
          &bull; Top <strong>{advancePerPool}</strong> per pool ({totalAdvancing} total) advance to the{' '}
          <strong>Knockout Bracket</strong>
        </p>
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
          <Play size={20} /> Generate Pools &amp; Schedule
        </button>
      )}
    </div>
  );
}
