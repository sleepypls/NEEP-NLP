import React, { useState, useMemo } from 'react';
import { X, Copy, Check, Eye, ShieldCheck, Lock, KeyRound, Download } from 'lucide-react';
import { generateQrMatrix, renderQrCardPngDataUrl } from '../utils/qrcode';

function QrSvg({ url, size = 144 }) {
  const matrix = useMemo(() => generateQrMatrix(url), [url]);
  const count = matrix.length;
  const quiet = 3;
  const total = count + quiet * 2;

  return (
    <svg
      viewBox={`0 0 ${total} ${total}`}
      width={size}
      height={size}
      className="rounded-2xl bg-white p-1.5 shadow-inner mx-auto block"
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

export function ShareModal({ isOpen, onClose, isAdmin, adminPin, roomId }) {
  const [copiedSpectator, setCopiedSpectator] = useState(false);
  const [copiedAdmin, setCopiedAdmin] = useState(false);
  const [qrMode, setQrMode] = useState(() => (isAdmin ? 'admin' : 'spectator'));
  const [downloadedQr, setDownloadedQr] = useState(false);

  if (!isOpen) return null;

  const baseUrl = window.location.origin + window.location.pathname;
  const currentRoom = roomId || 'neep-main';
  const spectatorUrl = `${baseUrl}?room=${encodeURIComponent(currentRoom)}&mode=spectator`;
  const adminUrl = `${baseUrl}?room=${encodeURIComponent(currentRoom)}&mode=admin&pin=${encodeURIComponent(adminPin || '1234')}`;
  const effectiveMode = isAdmin ? qrMode : 'spectator';
  const activeQrUrl = effectiveMode === 'admin' ? adminUrl : spectatorUrl;

  function copyToClipboard(text, isSpectator) {
    navigator.clipboard.writeText(text).then(() => {
      if (isSpectator) {
        setCopiedSpectator(true);
        setTimeout(() => setCopiedSpectator(false), 2000);
      } else {
        setCopiedAdmin(true);
        setTimeout(() => setCopiedAdmin(false), 2000);
      }
    });
  }

  function handleDownloadQr() {
    try {
      const dataUrl = renderQrCardPngDataUrl({
        url: activeQrUrl,
        roomId: currentRoom,
        adminPin: effectiveMode === 'admin' ? (adminPin || '1234') : null,
        mode: effectiveMode,
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${currentRoom}-${effectiveMode}-qr-pass.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setDownloadedQr(true);
      setTimeout(() => setDownloadedQr(false), 2500);
    } catch (e) {
      console.warn('Failed to download QR card:', e);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4 py-4">
      <div className="bg-slate-900 border border-slate-700 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[92vh] overflow-y-auto">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-11 flex-shrink-0 flex items-center justify-center filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              <img src="/logo.png" alt="NEEP-NLP Score Tracker" className="w-full h-full object-contain" />
            </div>
            <div>
              <h3 className="text-white text-lg font-bold leading-tight">Share & QR Pass</h3>
              <p className="text-xs text-slate-400">NEEP-NLP Live Sync & Room Recovery</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition">
            <X size={18} />
          </button>
        </div>

        {/* Room Info Card */}
        <div className="bg-slate-950 border border-slate-800 rounded-2xl p-3.5 mb-4 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400 flex-shrink-0">
              <Lock size={16} />
            </div>
            <div className="min-w-0">
              <span className="text-[10px] uppercase font-bold text-slate-400 block tracking-wider">Tournament Room</span>
              <span className="font-mono font-black text-white text-sm tracking-wider truncate block">{currentRoom}</span>
            </div>
          </div>
          {isAdmin && (
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 rounded-xl px-2.5 py-1.5 flex-shrink-0">
              <KeyRound size={13} className="text-amber-400" />
              <div className="text-right">
                <span className="text-[9px] uppercase font-bold text-slate-500 block leading-none">PIN</span>
                <span className="font-mono font-bold text-amber-300 text-xs">{adminPin || '1234'}</span>
              </div>
            </div>
          )}
        </div>

        {/* QR Code Section with Download Option */}
        <div className="bg-slate-950/90 border border-slate-800 rounded-2xl p-4 mb-4 text-center">
          {isAdmin && (
            <div className="flex items-center justify-between gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 mb-3">
              <button
                type="button"
                onClick={() => setQrMode('admin')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  effectiveMode === 'admin'
                    ? 'bg-[#d7f24c] text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <ShieldCheck size={13} />
                Admin Pass QR
              </button>
              <button
                type="button"
                onClick={() => setQrMode('spectator')}
                className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  effectiveMode === 'spectator'
                    ? 'bg-cyan-400 text-slate-950 shadow-sm'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                <Eye size={13} />
                Spectator QR
              </button>
            </div>
          )}

          <QrSvg url={activeQrUrl} size={144} />

          <p className="text-[11px] text-slate-400 mt-2.5 mb-3">
            {effectiveMode === 'admin'
              ? 'Scan or save this QR Pass to return to this room with Admin PIN access.'
              : 'Players & fans can scan to watch live match scores and brackets.'}
          </p>

          <button
            type="button"
            onClick={handleDownloadQr}
            className="w-full py-2.5 px-3 rounded-xl font-bold text-xs bg-slate-800 hover:bg-slate-750 text-[#d7f24c] border border-slate-700 flex items-center justify-center gap-1.5 active:scale-95 transition"
          >
            {downloadedQr ? <Check size={14} className="text-emerald-400" /> : <Download size={14} />}
            <span>
              {downloadedQr
                ? 'QR Pass Saved!'
                : `Save ${effectiveMode === 'admin' ? 'Admin' : 'Spectator'} QR Code (.PNG)`}
            </span>
          </button>
        </div>

        {/* Spectator Link */}
        <div className="bg-slate-850 border border-slate-750 rounded-2xl p-3.5 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
              <Eye size={14} className="text-cyan-400" /> Spectator Link (Read-Only)
            </span>
            <span className="text-[10px] bg-cyan-500/20 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full font-bold">
              For Players & Fans
            </span>
          </div>
          <div className="flex gap-2">
            <input
              readOnly
              value={spectatorUrl}
              className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 select-all focus:outline-none"
            />
            <button
              onClick={() => copyToClipboard(spectatorUrl, true)}
              className="px-3.5 py-2 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-slate-950 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition"
            >
              {copiedSpectator ? <Check size={14} /> : <Copy size={14} />}
              {copiedSpectator ? 'Copied' : 'Copy'}
            </button>
          </div>
        </div>

        {/* Scorekeeper / Admin Link */}
        {isAdmin && (
          <div className="bg-slate-850 border border-slate-750 rounded-2xl p-3.5">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-slate-300 flex items-center gap-1.5">
                <ShieldCheck size={14} className="text-[#d7f24c]" /> Scorekeeper Admin Link
              </span>
              <span className="text-[10px] bg-amber-500/20 text-amber-300 border border-amber-500/30 px-2 py-0.5 rounded-full font-bold">
                Full Access
              </span>
            </div>
            <div className="flex gap-2">
              <input
                readOnly
                value={adminUrl}
                className="flex-1 bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-xs font-mono text-slate-300 select-all focus:outline-none"
              />
              <button
                onClick={() => copyToClipboard(adminUrl, false)}
                className="px-3.5 py-2 rounded-xl bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 font-bold text-xs flex items-center gap-1.5 active:scale-95 transition"
              >
                {copiedAdmin ? <Check size={14} /> : <Copy size={14} />}
                {copiedAdmin ? 'Copied' : 'Copy'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
