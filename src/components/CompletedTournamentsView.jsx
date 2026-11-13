import React, { useState } from 'react';
import {
  Archive,
  Trophy,
  Eye,
  Link2,
  Check,
  Trash2,
  ArrowLeft,
  Save,
  RefreshCw,
  Calendar,
} from 'lucide-react';

export function buildArchiveReadOnlyUrl(archiveId) {
  if (typeof window === 'undefined') return '';
  const url = new URL(window.location.href);
  url.search = `?archive=${encodeURIComponent(archiveId)}`;
  return url.toString();
}

export function CompletedTournamentsView({
  archives = [],
  isLoading = false,
  onRefresh,
  canSaveCurrent = false,
  defaultSaveTitle = '',
  onSaveCurrent,
  onOpenArchive,
  onDeleteArchive,
  onBack,
}) {
  const [saveTitle, setSaveTitle] = useState(defaultSaveTitle);
  const [isSaving, setIsSaving] = useState(false);
  const [saveFeedback, setSaveFeedback] = useState('');
  const [copiedId, setCopiedId] = useState(null);

  async function handleSaveSubmit(e) {
    e.preventDefault();
    if (!onSaveCurrent || isSaving) return;
    setIsSaving(true);
    setSaveFeedback('');
    try {
      const saved = await onSaveCurrent(saveTitle.trim() || defaultSaveTitle);
      if (saved) {
        setSaveTitle('');
        setSaveFeedback('Tournament saved to Completed Archive!');
        setTimeout(() => setSaveFeedback(''), 3500);
      }
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopyLink(archiveId) {
    const url = buildArchiveReadOnlyUrl(archiveId);
    if (!url) return;
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(archiveId);
      setTimeout(() => setCopiedId((curr) => (curr === archiveId ? null : curr)), 2000);
    } catch (e) {
      window.prompt('Copy read-only tournament link:', url);
    }
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 pb-20 space-y-5 animate-in fade-in duration-200">
      <div className="flex items-center justify-between gap-3 flex-wrap">
        <div className="flex items-center gap-3">
          {onBack && (
            <button
              type="button"
              onClick={onBack}
              className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 transition"
              title="Back"
            >
              <ArrowLeft size={16} />
            </button>
          )}
          <div>
            <h2 className="text-xl sm:text-2xl font-black text-white flex items-center gap-2">
              <Archive size={22} className="text-[#d7f24c]" />
              Completed Tournaments
            </h2>
            <p className="text-xs text-slate-400">
              Saved tournament snapshots with shareable read-only links.
            </p>
          </div>
        </div>

        {onRefresh && (
          <button
            type="button"
            onClick={onRefresh}
            disabled={isLoading}
            className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-800 text-xs font-bold flex items-center gap-1.5 transition"
          >
            <RefreshCw size={13} className={isLoading ? 'animate-spin' : ''} />
            <span>Refresh</span>
          </button>
        )}
      </div>

      {/* Save Current Tournament Card */}
      {canSaveCurrent && onSaveCurrent && (
        <form
          onSubmit={handleSaveSubmit}
          className="bg-slate-900/95 border border-[#d7f24c]/35 rounded-3xl p-4 sm:p-5 shadow-xl space-y-3"
        >
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <span className="text-xs font-black uppercase tracking-wider text-[#d7f24c] flex items-center gap-1.5">
              <Save size={14} /> Save Current Tournament
            </span>
            {saveFeedback && (
              <span className="text-xs font-bold text-emerald-300 bg-emerald-500/15 border border-emerald-500/30 px-2.5 py-0.5 rounded-full">
                {saveFeedback}
              </span>
            )}
          </div>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="text"
              value={saveTitle}
              onChange={(e) => setSaveTitle(e.target.value)}
              placeholder={defaultSaveTitle || 'Tournament name (e.g. Friday Night Open)'}
              maxLength={80}
              className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3.5 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
            />
            <button
              type="submit"
              disabled={isSaving}
              className="px-5 py-2.5 rounded-xl bg-[#d7f24c] hover:bg-[#c8e33a] text-slate-950 font-black text-xs flex items-center justify-center gap-1.5 transition active:scale-95 disabled:opacity-50 shrink-0"
            >
              <Save size={14} />
              <span>{isSaving ? 'Saving...' : 'Save Snapshot'}</span>
            </button>
          </div>
        </form>
      )}

      {/* Archive List */}
      {isLoading && archives.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center text-xs text-slate-400">
          Loading saved tournaments...
        </div>
      ) : archives.length === 0 ? (
        <div className="bg-slate-900/80 border border-slate-800 rounded-3xl p-8 text-center space-y-2">
          <Trophy size={32} className="mx-auto text-slate-600" />
          <p className="text-sm font-bold text-slate-300">No completed tournaments saved yet</p>
          <p className="text-xs text-slate-500">
            Save a tournament above or from the Bracket / Pools &amp; Bracket view to store it and generate a read-only link.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {archives.map((item) => {
            const isCopied = copiedId === item.id;
            const dateStr = item.savedAt
              ? new Date(item.savedAt).toLocaleString(undefined, {
                  dateStyle: 'medium',
                  timeStyle: 'short',
                })
              : 'Unknown date';
            return (
              <div
                key={item.id}
                className="bg-slate-900/95 border border-slate-800 hover:border-slate-700 rounded-3xl p-4 sm:p-5 shadow-lg flex flex-col md:flex-row md:items-center justify-between gap-4 transition"
              >
                <div className="space-y-1.5 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span
                      className={`text-[10px] font-black uppercase px-2 py-0.5 rounded-full border ${
                        item.tournamentStyle === 'tournament'
                          ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                          : 'bg-indigo-500/15 text-indigo-300 border-indigo-500/30'
                      }`}
                    >
                      {item.tournamentStyle === 'tournament' ? 'Pools + Knockout' : 'MLP Style'}
                    </span>
                    {item.roomId && (
                      <span className="text-[10px] font-mono font-bold bg-slate-800 text-slate-300 px-2 py-0.5 rounded-full">
                        Room {item.roomId}
                      </span>
                    )}
                    <span className="text-[11px] text-slate-400 inline-flex items-center gap-1">
                      <Calendar size={11} /> {dateStr}
                    </span>
                  </div>

                  <h3 className="text-base sm:text-lg font-black text-white truncate">
                    {item.title || 'Completed Tournament'}
                  </h3>

                  <div className="flex items-center gap-3 flex-wrap text-xs text-slate-400">
                    {item.championName && (
                      <span className="inline-flex items-center gap-1 text-amber-300 font-bold">
                        <Trophy size={12} /> Champion: {item.championName}
                      </span>
                    )}
                    {item.summary && <span>{item.summary}</span>}
                  </div>
                </div>

                <div className="flex items-center gap-2 flex-wrap shrink-0">
                  <button
                    type="button"
                    onClick={() => onOpenArchive?.(item)}
                    className="px-3.5 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 text-xs font-bold flex items-center gap-1.5 transition"
                  >
                    <Eye size={13} className="text-[#d7f24c]" />
                    <span>View Read-Only</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => handleCopyLink(item.id)}
                    className={`px-3.5 py-2 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition ${
                      isCopied
                        ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40'
                        : 'bg-[#d7f24c]/15 hover:bg-[#d7f24c]/25 text-[#d7f24c] border-[#d7f24c]/35'
                    }`}
                  >
                    {isCopied ? <Check size={13} /> : <Link2 size={13} />}
                    <span>{isCopied ? 'Link Copied!' : 'Copy Read-Only Link'}</span>
                  </button>

                  {onDeleteArchive && (
                    <button
                      type="button"
                      onClick={() => onDeleteArchive(item.id)}
                      title="Delete saved tournament"
                      className="p-2 rounded-xl bg-slate-950 hover:bg-rose-500/15 text-slate-500 hover:text-rose-400 border border-slate-800 transition"
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
