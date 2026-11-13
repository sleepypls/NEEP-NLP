import React, { useState, useRef, useMemo, useEffect } from 'react';
import { X, Users, Pencil, Trash2, Check, Search, UserPlus, ShieldAlert, AlertCircle, Upload, Download, QrCode, Copy } from 'lucide-react';
import { parsePlayersFromCSV, generateDirectoryCSV, generateSampleDirectoryCSV, triggerCsvDownload } from '../utils/tournament';
import { generateQrMatrix } from '../utils/qrcode';

function DirQrSvg({ url, size = 128 }) {
  const matrix = useMemo(() => generateQrMatrix(url), [url]);
  const count = matrix.length;
  const quiet = 3;
  const total = count + quiet * 2;
  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      className="rounded-xl bg-white p-1.5 shadow-inner mx-auto block"
      shapeRendering="crispEdges"
    >
      <rect width={total} height={total} fill="#ffffff" />
      {matrix.map((row, r) =>
        row.map((dark, c) =>
          dark ? (
            <rect key={`${r}-${c}`} x={c + quiet} y={r + quiet} width={1} height={1} fill="#020617" />
          ) : null
        )
      )}
    </svg>
  );
}

export function DirectoryModal({
  isOpen,
  onClose,
  roomId,
  savedPlayers = [],
  playerPool = [],
  onAddDirectoryPlayer,
  onAddMultiplePlayers,
  onRenameDirectoryPlayer,
  onRemoveSavedPlayer,
  isAdmin,
  initialShowQr = false,
}) {
  const [searchQuery, setSearchQuery] = useState('');
  const [newPlayerName, setNewPlayerName] = useState('');
  const [editingName, setEditingName] = useState(null);
  const [editValue, setEditValue] = useState('');
  const [pendingDeleteName, setPendingDeleteName] = useState(null);
  const [csvNotice, setCsvNotice] = useState(null);
  const [qrTargetPlayer, setQrTargetPlayer] = useState(null); // null | '' (room) | string (specific player)
  const [copiedQrUrl, setCopiedQrUrl] = useState(false);
  const csvInputRef = useRef(null);

  useEffect(() => {
    if (isOpen && initialShowQr) {
      setQrTargetPlayer('');
    } else if (!isOpen) {
      setQrTargetPlayer(null);
    }
  }, [isOpen, initialShowQr]);

  function handleDirectoryCsvUpload(e, addToTournament = false) {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const names = parsePlayersFromCSV(evt.target?.result || '');
      if (names.length === 0) {
        setCsvNotice({ type: 'error', text: 'No player names found in CSV.' });
      } else if (onAddMultiplePlayers) {
        const count = onAddMultiplePlayers(names, addToTournament);
        setCsvNotice({
          type: 'success',
          text: addToTournament
            ? `Imported ${count} player${count === 1 ? '' : 's'} into tournament & directory`
            : `Saved ${count} new player${count === 1 ? '' : 's'} to room directory`,
        });
      }
      setTimeout(() => setCsvNotice(null), 4000);
    };
    reader.readAsText(file);
    e.target.value = '';
  }

  if (!isOpen) return null;

  const poolNamesLower = new Set(
    (playerPool || []).map((p) => String(p?.name || '').trim().toLowerCase()).filter(Boolean)
  );

  const filteredPlayers = (savedPlayers || []).filter((name) =>
    name.toLowerCase().includes(searchQuery.trim().toLowerCase())
  );

  function handleAddSubmit(e) {
    e.preventDefault();
    const trimmed = newPlayerName.trim();
    if (!trimmed) return;
    if (onAddDirectoryPlayer) {
      onAddDirectoryPlayer(trimmed);
      setNewPlayerName('');
    }
  }

  function handleStartRename(name) {
    if (!isAdmin) return;
    setEditingName(name);
    setEditValue(name);
    setPendingDeleteName(null);
  }

  function handleSaveRename(oldName) {
    const trimmed = editValue.trim();
    if (trimmed && trimmed.toLowerCase() !== oldName.toLowerCase() && onRenameDirectoryPlayer) {
      onRenameDirectoryPlayer(oldName, trimmed);
    }
    setEditingName(null);
    setEditValue('');
  }

  function handleConfirmDelete(name) {
    if (onRemoveSavedPlayer) {
      onRemoveSavedPlayer(name);
    }
    setPendingDeleteName(null);
  }

  function handleExportDirectoryCsv() {
    const csv = generateDirectoryCSV(savedPlayers, playerPool);
    triggerCsvDownload(`${roomId || 'room'}-directory.csv`, csv);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4 animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-750 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        {/* Modal Header */}
        <div className="px-5 py-4 border-b border-slate-800 flex items-center justify-between shrink-0 bg-slate-900/90">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-2xl bg-[#d7f24c]/10 border border-[#d7f24c]/30 flex items-center justify-center text-[#d7f24c] shrink-0">
              <Users size={20} />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="text-white text-lg font-bold font-display leading-tight truncate">
                  Room Player Directory
                </h3>
                <span className="text-[10px] font-mono font-bold bg-slate-850 text-[#d7f24c] border border-slate-700 px-2 py-0.5 rounded-md shrink-0">
                  {roomId}
                </span>
              </div>
              <p className="text-xs text-slate-400 truncate">
                Isolated player roster for this room ({savedPlayers.length} total)
              </p>
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-2">
            <button
              type="button"
              onClick={() => setQrTargetPlayer((prev) => (prev === '' ? null : ''))}
              className={`px-2.5 py-1.5 rounded-xl text-xs font-bold flex items-center gap-1.5 border transition ${
                qrTargetPlayer !== null
                  ? 'bg-emerald-500 text-slate-950 border-emerald-400'
                  : 'bg-slate-800 hover:bg-slate-750 text-emerald-300 border-emerald-500/30'
              }`}
              title="Show Player Login URL & QR Code"
            >
              <QrCode size={14} />
              <span className="hidden xs:inline">Player QR</span>
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition shrink-0"
              title="Close"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Player Login URL & QR Code Panel */}
        {qrTargetPlayer !== null && (() => {
          const baseUrl = window.location.origin + window.location.pathname;
          const activeUrl = qrTargetPlayer
            ? `${baseUrl}?room=${encodeURIComponent(roomId || 'neep-main')}&mode=player&player=${encodeURIComponent(qrTargetPlayer)}`
            : `${baseUrl}?room=${encodeURIComponent(roomId || 'neep-main')}&mode=player`;
          return (
            <div className="p-4 border-b border-slate-800 bg-slate-950/90 space-y-2.5 shrink-0">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-emerald-300 flex items-center gap-1.5">
                  <QrCode size={14} />
                  {qrTargetPlayer
                    ? `Direct Player Login: ${qrTargetPlayer}`
                    : `Room Player Login (${roomId || 'neep-main'})`}
                </span>
                <button
                  type="button"
                  onClick={() => setQrTargetPlayer(null)}
                  className="text-[11px] text-slate-400 hover:text-white font-semibold"
                >
                  Hide
                </button>
              </div>
              <DirQrSvg url={activeUrl} size={132} />
              <div className="flex gap-2">
                <input
                  readOnly
                  value={activeUrl}
                  className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-2.5 py-1.5 text-[11px] font-mono text-slate-300 select-all focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => {
                    navigator.clipboard?.writeText(activeUrl);
                    setCopiedQrUrl(true);
                    setTimeout(() => setCopiedQrUrl(false), 2000);
                  }}
                  className="px-3 py-1.5 rounded-xl bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-bold text-xs flex items-center gap-1 transition shrink-0"
                >
                  {copiedQrUrl ? <Check size={13} /> : <Copy size={13} />}
                  {copiedQrUrl ? 'Copied' : 'Copy'}
                </button>
              </div>
            </div>
          );
        })()}

        {/* Quick Add Form & Search */}
        <div className="p-4 border-b border-slate-800/80 bg-slate-925 space-y-2.5 shrink-0">
          {isAdmin ? (
            <>
              <form onSubmit={handleAddSubmit} className="flex gap-2">
                <input
                  type="text"
                  value={newPlayerName}
                  onChange={(e) => setNewPlayerName(e.target.value)}
                  placeholder="Add player name to directory..."
                  className="flex-1 bg-slate-950/80 border border-slate-800 rounded-xl px-3 py-2 text-sm text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
                />
                <button
                  type="submit"
                  disabled={!newPlayerName.trim()}
                  className="px-3.5 py-2 rounded-xl bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 font-bold text-xs flex items-center gap-1.5 disabled:opacity-40 transition active:scale-95 shrink-0 shadow-md shadow-[#d7f24c]/10"
                >
                  <UserPlus size={14} /> Add
                </button>
                <input
                  ref={csvInputRef}
                  type="file"
                  accept=".csv,.txt,text/csv,text/plain"
                  onChange={(e) => handleDirectoryCsvUpload(e, true)}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => csvInputRef.current?.click()}
                  title="Import players from CSV into tournament & directory"
                  className="px-3 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-[#d7f24c] font-bold text-xs border border-slate-700 flex items-center gap-1.5 transition active:scale-95 shrink-0"
                >
                  <Upload size={14} /> CSV
                </button>
              </form>
              {csvNotice && (
                <div
                  className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center justify-between border ${
                    csvNotice.type === 'error'
                      ? 'bg-red-500/10 border-red-500/30 text-red-300'
                      : 'bg-emerald-500/10 border-emerald-500/30 text-emerald-300'
                  }`}
                >
                  <span>{csvNotice.text}</span>
                  <button type="button" onClick={() => setCsvNotice(null)} className="text-slate-400 hover:text-white ml-2">
                    <X size={12} />
                  </button>
                </div>
              )}
            </>
          ) : (
            <div className="flex items-center gap-2 text-amber-400 text-xs bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2">
              <ShieldAlert size={14} className="shrink-0" />
              <span>Viewing directory in Spectator mode. Admin PIN required to modify names.</span>
            </div>
          )}

          {/* Search bar */}
          <div className="relative">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search directory..."
              className="w-full bg-slate-950/60 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-slate-700"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
              >
                <X size={13} />
              </button>
            )}
          </div>
        </div>

        {/* Directory Player List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-2 divide-y divide-slate-800/40 min-h-[220px]">
          {filteredPlayers.length === 0 ? (
            <div className="text-center py-10">
              <Users size={32} className="mx-auto text-slate-600 mb-2 opacity-60" />
              <p className="text-sm font-medium text-slate-400">
                {searchQuery ? 'No matching players found' : 'No players in this directory yet'}
              </p>
              <p className="text-xs text-slate-500 mt-0.5">
                {searchQuery
                  ? 'Try searching with a different term'
                  : 'Add player names above or run tournaments in this room'}
              </p>
            </div>
          ) : (
            filteredPlayers.map((name) => {
              const isInTournament = poolNamesLower.has(name.trim().toLowerCase());
              const isEditing = editingName === name;
              const isDeleting = pendingDeleteName === name;

              if (isEditing) {
                return (
                  <form
                    key={name}
                    onSubmit={(e) => {
                      e.preventDefault();
                      handleSaveRename(name);
                    }}
                    className="pt-2 flex items-center gap-2"
                  >
                    <input
                      autoFocus
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Escape') setEditingName(null);
                      }}
                      className="flex-1 bg-slate-950 border border-[#d7f24c] rounded-xl px-3 py-1.5 text-sm text-white focus:outline-none"
                    />
                    <button
                      type="submit"
                      disabled={!editValue.trim()}
                      className="p-2 rounded-xl bg-emerald-500/20 text-emerald-400 hover:bg-emerald-500/30 border border-emerald-500/30 transition"
                      title="Save name"
                    >
                      <Check size={16} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setEditingName(null)}
                      className="p-2 rounded-xl bg-slate-800 text-slate-400 hover:text-white transition"
                      title="Cancel"
                    >
                      <X size={16} />
                    </button>
                  </form>
                );
              }

              if (isDeleting) {
                return (
                  <div
                    key={name}
                    className="pt-2 flex items-center justify-between gap-2 bg-red-950/20 border border-red-500/30 rounded-2xl p-2.5 animate-in fade-in duration-100"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <AlertCircle size={15} className="text-red-400 shrink-0" />
                      <span className="text-xs text-red-200 truncate">
                        Remove <strong className="text-white">{name}</strong> from directory?
                      </span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => handleConfirmDelete(name)}
                        className="px-2.5 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white text-xs font-bold transition shadow-sm"
                      >
                        Delete
                      </button>
                      <button
                        type="button"
                        onClick={() => setPendingDeleteName(null)}
                        className="px-2 py-1 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 text-xs font-medium transition"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                );
              }

              return (
                <div
                  key={name}
                  className="pt-2 flex items-center justify-between gap-3 group hover:bg-slate-850/40 rounded-xl px-2 py-1.5 transition"
                >
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-lg bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-300 text-xs font-bold shrink-0">
                      {name.charAt(0).toUpperCase()}
                    </div>
                    <span className="text-sm font-medium text-slate-200 truncate">{name}</span>
                    {isInTournament ? (
                      <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 rounded-md px-1.5 py-0.5 shrink-0 flex items-center gap-1">
                        <Check size={10} className="stroke-[3]" /> Active
                      </span>
                    ) : (
                      <span className="text-[10px] font-medium bg-slate-800 text-slate-400 rounded-md px-1.5 py-0.5 shrink-0">
                        Available
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      onClick={() => setQrTargetPlayer(name)}
                      className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-300 hover:bg-slate-800 transition"
                      title={`Player Login QR & URL for ${name}`}
                    >
                      <QrCode size={13} />
                    </button>
                    {isAdmin && (
                      <>
                        <button
                          type="button"
                          onClick={() => handleStartRename(name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-[#d7f24c] hover:bg-slate-800 transition"
                          title={`Rename ${name}`}
                        >
                          <Pencil size={13} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setPendingDeleteName(name)}
                          className="p-1.5 rounded-lg text-slate-400 hover:text-red-400 hover:bg-slate-800 transition"
                          title={`Remove ${name} from directory`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Modal Footer */}
        <div className="p-4 border-t border-slate-800 bg-slate-900/95 flex items-center justify-between gap-2 flex-wrap shrink-0">
          <div className="flex items-center gap-2 flex-wrap">
            <button
              type="button"
              onClick={() => {
                const sampleCsv = generateSampleDirectoryCSV();
                triggerCsvDownload('sample-player-directory.csv', sampleCsv);
              }}
              className="text-xs font-bold text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 flex items-center gap-1.5 py-2 px-3 rounded-xl transition active:scale-95"
              title="Download a sample CSV template for importing players"
            >
              <Download size={13} className="text-slate-400" /> Sample CSV
            </button>

            {savedPlayers.length > 0 && (
              <button
                type="button"
                onClick={handleExportDirectoryCsv}
                className="text-xs font-bold text-[#d7f24c] hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 flex items-center gap-1.5 py-2 px-3 rounded-xl transition active:scale-95"
                title="Export this room's player directory as a CSV file"
              >
                <Download size={13} /> Export Directory CSV
              </button>
            )}
          </div>

          <button
            type="button"
            onClick={onClose}
            className="px-5 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-white font-bold text-xs border border-slate-700 transition active:scale-95 shadow-md ml-auto"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  );
}
