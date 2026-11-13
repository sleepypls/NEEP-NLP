import React, { useState, useEffect } from 'react';
import { X, ArrowRightLeft, Check, RotateCcw, Sliders, Users } from 'lucide-react';
import { getEntryDisplayName } from '../utils/poolTournament';

export function EditPoolMatchModal({
  isOpen,
  onClose,
  match,
  entries = [],
  stageLabel = 'Match',
  defaultFormat = { bestOf: 1, pointsTo: 11 },
  allowBye = false,
  onSave,
  isAdmin,
}) {
  const [entryAId, setEntryAId] = useState('');
  const [entryBId, setEntryBId] = useState('');
  const [useCustomFormat, setUseCustomFormat] = useState(false);
  const [bestOf, setBestOf] = useState(defaultFormat.bestOf || 1);
  const [pointsTo, setPointsTo] = useState(defaultFormat.pointsTo || 11);

  useEffect(() => {
    if (!match) return;
    setEntryAId(match.entryAId || '');
    setEntryBId(match.entryBId || '');
    if (match.customFormat && match.customFormat.bestOf) {
      setUseCustomFormat(true);
      setBestOf(match.customFormat.bestOf);
      setPointsTo(match.customFormat.pointsTo || defaultFormat.pointsTo || 11);
    } else {
      setUseCustomFormat(false);
      setBestOf(defaultFormat.bestOf || 1);
      setPointsTo(defaultFormat.pointsTo || 11);
    }
  }, [match, defaultFormat.bestOf, defaultFormat.pointsTo]);

  if (!isOpen || !match) return null;

  const isDuplicateSameEntry = entryAId && entryBId && entryAId === entryBId;
  const hasMissingPoolEntry = !allowBye && (!entryAId || !entryBId);
  const canSave = isAdmin && !isDuplicateSameEntry && !hasMissingPoolEntry;

  function handleSwapSides() {
    const prevA = entryAId;
    setEntryAId(entryBId);
    setEntryBId(prevA);
  }

  function handleResetFormat() {
    setUseCustomFormat(false);
    setBestOf(defaultFormat.bestOf || 1);
    setPointsTo(defaultFormat.pointsTo || 11);
  }

  function handleSubmit(e) {
    e?.preventDefault();
    if (!canSave) return;
    const cleanPoints = Math.max(1, Number(pointsTo) || defaultFormat.pointsTo || 11);
    onSave({
      entryAId: entryAId || null,
      entryBId: entryBId || null,
      customFormat: useCustomFormat
        ? { bestOf: Number(bestOf) || 1, pointsTo: cleanPoints }
        : null,
    });
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-mono font-bold text-[#d7f24c] uppercase tracking-wider bg-[#d7f24c]/10 border border-[#d7f24c]/30 px-2 py-0.5 rounded-full">
                {stageLabel}
              </span>
              <h3 className="text-lg font-bold text-white font-display">Edit Matchup &amp; Format</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">
              Customize entrants or match scoring format for this matchup.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition shrink-0"
          >
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Matchup Teams / Players */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-2.5">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Users size={13} className="text-[#d7f24c]" /> Matchup Entrants
              </span>
              <button
                type="button"
                onClick={handleSwapSides}
                className="text-[11px] font-bold text-[#d7f24c] hover:text-white bg-slate-800 hover:bg-slate-750 border border-slate-700 px-2.5 py-1 rounded-lg flex items-center gap-1 transition"
              >
                <ArrowRightLeft size={11} /> Swap A &harr; B
              </button>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Side A
              </label>
              <select
                value={entryAId}
                onChange={(e) => setEntryAId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
              >
                <option value="">{allowBye ? '— BYE / TBD —' : '— Select Entrant A —'}</option>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {getEntryDisplayName(entry)}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block mb-1">
                Side B
              </label>
              <select
                value={entryBId}
                onChange={(e) => setEntryBId(e.target.value)}
                className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
              >
                <option value="">{allowBye ? '— BYE / TBD —' : '— Select Entrant B —'}</option>
                {entries.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {getEntryDisplayName(entry)}
                  </option>
                ))}
              </select>
            </div>

            {isDuplicateSameEntry && (
              <p className="text-[11px] text-red-400 font-semibold">
                Side A and Side B cannot be the same entrant.
              </p>
            )}
            {allowBye && ((!entryAId && entryBId) || (entryAId && !entryBId)) && (
              <p className="text-[11px] text-amber-300/90">
                Leaving one side as BYE advances the assigned entrant automatically.
              </p>
            )}
          </div>

          {/* Match Format Override */}
          <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3.5 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Sliders size={13} className="text-amber-400" /> Match Scoring Format
              </span>
              {useCustomFormat && (
                <button
                  type="button"
                  onClick={handleResetFormat}
                  className="text-[11px] font-semibold text-slate-400 hover:text-white flex items-center gap-1"
                >
                  <RotateCcw size={11} /> Use Round Default
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 gap-1.5 bg-slate-900 p-1 rounded-xl border border-slate-800">
              <button
                type="button"
                onClick={handleResetFormat}
                className={`py-1.5 rounded-lg text-xs font-bold transition ${
                  !useCustomFormat
                    ? 'bg-slate-800 text-white shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Default ({defaultFormat.bestOf === 1 ? '1G' : `Bo${defaultFormat.bestOf}`} to {defaultFormat.pointsTo})
              </button>
              <button
                type="button"
                onClick={() => setUseCustomFormat(true)}
                className={`py-1.5 rounded-lg text-xs font-bold transition ${
                  useCustomFormat
                    ? 'bg-amber-400 text-slate-950 shadow'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                Custom Format
              </button>
            </div>

            {useCustomFormat && (
              <div className="space-y-2.5 pt-1">
                <div className="grid grid-cols-3 gap-1.5">
                  {[1, 3, 5].map((bo) => (
                    <button
                      key={bo}
                      type="button"
                      onClick={() => setBestOf(bo)}
                      className={`py-1.5 rounded-xl text-xs font-bold transition ${
                        bestOf === bo
                          ? 'bg-amber-400 text-slate-950'
                          : 'bg-slate-800 text-slate-300 border border-slate-700'
                      }`}
                    >
                      {bo === 1 ? '1 Game' : `Best of ${bo}`}
                    </button>
                  ))}
                </div>
                <div className="space-y-1.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400 block">
                    Points to Win (Preset or Custom)
                  </span>
                  <div className="grid grid-cols-3 gap-1.5">
                    {[11, 15, 21].map((pts) => (
                      <button
                        key={pts}
                        type="button"
                        onClick={() => setPointsTo(pts)}
                        className={`py-1.5 rounded-xl text-xs font-bold transition ${
                          Number(pointsTo) === pts
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
                      ![11, 15, 21].includes(Number(pointsTo))
                        ? 'bg-amber-400/10 border-amber-400/40'
                        : 'bg-slate-900 border-slate-700'
                    }`}
                  >
                    <span className="text-[11px] font-bold text-slate-300">Custom Score:</span>
                    <input
                      type="text"
                      inputMode="numeric"
                      value={pointsTo}
                      onFocus={(e) => e.target.select()}
                      onChange={(e) => {
                        const clean = e.target.value.replace(/\D/g, '');
                        setPointsTo(clean === '' ? '' : Number(clean));
                      }}
                      onBlur={() => {
                        if (!pointsTo || Number(pointsTo) < 1) setPointsTo(11);
                      }}
                      placeholder="e.g. 9"
                      className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-center text-white text-xs font-mono font-bold focus:outline-none focus:ring-1 focus:ring-amber-400"
                    />
                    <span className="text-[11px] font-semibold text-slate-400">pts</span>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Actions */}
          <div className="flex gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-xs border border-slate-700 transition"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSave}
              className="flex-1 py-2.5 rounded-xl bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-40"
            >
              <Check size={14} /> Save Changes
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

