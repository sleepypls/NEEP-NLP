import React, { useState, useMemo } from 'react';
import { X, UserCheck, Search, Bell, QrCode, LogOut, Check } from 'lucide-react';
import { generateQrMatrix } from '../utils/qrcode';

function MiniQrSvg({ url, size = 128 }) {
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

export function PlayerLoginModal({
  isOpen,
  onClose,
  playerNames = [],
  loggedInPlayerName = '',
  onLoginPlayer,
  onLogoutPlayer,
  roomId = 'neep-main',
  notifPermission = 'default',
  onRequestNotifPermission,
}) {
  const [search, setSearch] = useState('');
  const [showQr, setShowQr] = useState(false);

  if (!isOpen) return null;

  const uniqueNames = Array.from(
    new Set((playerNames || []).map((n) => String(n || '').trim()).filter(Boolean))
  ).sort((a, b) => a.localeCompare(b));

  const filtered = uniqueNames.filter((n) =>
    n.toLowerCase().includes(search.trim().toLowerCase())
  );

  const baseUrl = window.location.origin + window.location.pathname;
  const playerLoginUrl = `${baseUrl}?room=${encodeURIComponent(roomId || 'neep-main')}&mode=player`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4 py-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] flex flex-col">
        <div className="flex items-center justify-between gap-3 mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              <UserCheck size={18} />
            </div>
            <div>
              <h3 className="text-white text-lg font-bold leading-tight">Player Login</h3>
              <p className="text-xs text-slate-400">
                Get match alerts, enter scores &amp; approve results
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Logged In Banner */}
        {loggedInPlayerName && (
          <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-2xl p-3 mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400 block">
                Signed in as
              </span>
              <span className="text-sm font-extrabold text-white truncate block">
                {loggedInPlayerName}
              </span>
            </div>
            <button
              type="button"
              onClick={() => {
                onLogoutPlayer();
                onClose();
              }}
              className="px-2.5 py-1.5 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 border border-slate-700 text-xs font-bold flex items-center gap-1 transition"
            >
              <LogOut size={12} /> Sign Out
            </button>
          </div>
        )}

        {/* Phone Notifications */}
        {typeof Notification !== 'undefined' && (
          <div className="bg-slate-950/70 border border-slate-800 rounded-2xl p-3 mb-3 flex items-center justify-between gap-2">
            <div className="min-w-0">
              <span className="text-xs font-bold text-slate-200 flex items-center gap-1.5">
                <Bell size={13} className="text-amber-400" /> Matchup Alerts
              </span>
              <span className="text-[11px] text-slate-400 block">
                {notifPermission === 'granted'
                  ? 'Browser notifications enabled for your next match.'
                  : notifPermission === 'denied'
                    ? 'Notifications blocked in browser settings (in-app alerts active).'
                    : 'Enable alerts to get notified when your court is called.'}
              </span>
            </div>
            {notifPermission !== 'granted' && notifPermission !== 'denied' && (
              <button
                type="button"
                onClick={onRequestNotifPermission}
                className="px-2.5 py-1.5 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-xs font-black shrink-0 transition"
              >
                Enable
              </button>
            )}
            {notifPermission === 'granted' && (
              <span className="text-[10px] font-bold bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2 py-0.5 rounded-full shrink-0 flex items-center gap-1">
                <Check size={10} /> On
              </span>
            )}
          </div>
        )}

        {/* Search Input */}
        <div className="relative mb-3">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search your name..."
            className="w-full bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-2 text-xs text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
          />
        </div>

        {/* Player List */}
        <div className="overflow-y-auto flex-1 space-y-1.5 pr-1 max-h-56 mb-3">
          {filtered.length === 0 ? (
            <div className="text-center py-6 bg-slate-950/50 border border-slate-800 rounded-2xl text-xs text-slate-400 space-y-2 px-3">
              <p>
                {uniqueNames.length === 0
                  ? 'No players found in this room yet.'
                  : `No player matching "${search}".`}
              </p>
              {search.trim() && (
                <button
                  type="button"
                  onClick={() => {
                    onLoginPlayer(search.trim());
                    onClose();
                  }}
                  className="px-3 py-1.5 rounded-xl bg-[#d7f24c] text-slate-950 text-xs font-black transition"
                >
                  Continue as "{search.trim()}"
                </button>
              )}
            </div>
          ) : (
            filtered.map((name) => {
              const isCurrent =
                loggedInPlayerName.trim().toLowerCase() === name.toLowerCase();
              return (
                <button
                  key={name}
                  type="button"
                  onClick={() => {
                    onLoginPlayer(name);
                    onClose();
                  }}
                  className={`w-full text-left px-3 py-2.5 rounded-xl border text-xs font-bold flex items-center justify-between transition ${
                    isCurrent
                      ? 'bg-[#d7f24c]/15 border-[#d7f24c]/50 text-[#d7f24c]'
                      : 'bg-slate-950/60 hover:bg-slate-800 border-slate-800 text-slate-200'
                  }`}
                >
                  <span className="truncate">{name}</span>
                  {isCurrent && (
                    <span className="text-[10px] font-mono bg-[#d7f24c] text-slate-950 px-2 py-0.5 rounded-full font-black">
                      Active
                    </span>
                  )}
                </button>
              );
            })
          )}
        </div>

        {/* QR Code Toggle */}
        <div className="border-t border-slate-800 pt-3">
          <button
            type="button"
            onClick={() => setShowQr((v) => !v)}
            className="w-full py-2 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 text-xs font-bold flex items-center justify-center gap-1.5 transition"
          >
            <QrCode size={14} className="text-[#d7f24c]" />
            {showQr ? 'Hide Player Login QR Code' : 'Show Player Login QR Code'}
          </button>
          {showQr && (
            <div className="mt-3 bg-slate-950 border border-slate-800 rounded-2xl p-3 text-center space-y-1.5">
              <MiniQrSvg url={playerLoginUrl} size={132} />
              <p className="text-[10px] text-slate-400">
                Scan with phone camera to open Player Login for room <strong className="text-white">{roomId}</strong>
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

