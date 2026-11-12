import React, { useState, useMemo } from 'react';
import { Sparkles, Copy, Check, KeyRound, ShieldCheck, Eye, EyeOff, ArrowRight, X, Download, QrCode } from 'lucide-react';
import { generateQrMatrix, renderQrCardPngDataUrl } from '../utils/qrcode';

function QrSvg({ url, size = 152 }) {
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

export function RoomCreatedModal({
  isOpen,
  onClose,
  roomId,
  adminPin,
}) {
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);
  const [showPin, setShowPin] = useState(true);
  const [qrMode, setQrMode] = useState('admin'); // 'admin' | 'spectator'
  const [downloadedQr, setDownloadedQr] = useState(false);

  if (!isOpen) return null;

  function copyText(text, type) {
    navigator.clipboard.writeText(text).then(() => {
      if (type === 'room') {
        setCopiedRoom(true);
        setTimeout(() => setCopiedRoom(false), 2000);
      } else if (type === 'pin') {
        setCopiedPin(true);
        setTimeout(() => setCopiedPin(false), 2000);
      } else if (type === 'link') {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 2000);
      }
    });
  }

  const baseUrl = window.location.origin + window.location.pathname;
  const spectatorUrl = `${baseUrl}?room=${encodeURIComponent(roomId)}&mode=spectator`;
  const adminUrl = `${baseUrl}?room=${encodeURIComponent(roomId)}&mode=admin&pin=${encodeURIComponent(adminPin || '')}`;
  const activeQrUrl = qrMode === 'admin' ? adminUrl : spectatorUrl;

  function handleDownloadQr() {
    try {
      const dataUrl = renderQrCardPngDataUrl({
        url: activeQrUrl,
        roomId,
        adminPin: qrMode === 'admin' ? adminPin : null,
        mode: qrMode,
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${roomId}-${qrMode}-qr-pass.png`;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4 py-4">
      <div className="bg-slate-900 border border-slate-750 rounded-3xl p-5 sm:p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[92vh] overflow-y-auto">
        {/* Header Badge */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-white text-lg sm:text-xl font-black leading-tight">Private Room Created!</h3>
              <p className="text-xs text-slate-400">Saved to this device &bull; Save QR pass for anytime access</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Room ID & Admin PIN Compact Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 mb-4">
          {/* Room ID Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Room Code</span>
              <span className="text-[9px] font-semibold px-1.5 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
                Active
              </span>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-black text-lg tracking-wider text-white select-all truncate">
                {roomId}
              </span>
              <button
                onClick={() => copyText(roomId, 'room')}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white transition flex items-center gap-1 text-xs font-bold active:scale-95 shrink-0"
              >
                {copiedRoom ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copiedRoom ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>

          {/* Admin PIN Box */}
          <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-3">
            <div className="flex items-center justify-between mb-1">
              <div className="flex items-center gap-1">
                <KeyRound size={11} className="text-amber-400" />
                <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Admin PIN</span>
              </div>
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 transition"
              >
                {showPin ? <EyeOff size={12} /> : <Eye size={12} />}
              </button>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="font-mono font-black text-lg tracking-widest text-amber-300">
                {showPin ? adminPin : '••••'}
              </span>
              <button
                onClick={() => copyText(adminPin, 'pin')}
                className="px-2.5 py-1 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white transition flex items-center gap-1 text-xs font-bold active:scale-95 shrink-0"
              >
                {copiedPin ? <Check size={13} className="text-emerald-400" /> : <Copy size={13} />}
                <span>{copiedPin ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          </div>
        </div>

        {/* QR Pass Card */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-4 text-center">
          <div className="flex items-center justify-between gap-1 bg-slate-900 p-1 rounded-xl border border-slate-800 mb-3">
            <button
              type="button"
              onClick={() => setQrMode('admin')}
              className={`flex-1 py-1.5 px-2.5 rounded-lg text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                qrMode === 'admin'
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
                qrMode === 'spectator'
                  ? 'bg-cyan-400 text-slate-950 shadow-sm'
                  : 'text-slate-400 hover:text-slate-200'
              }`}
            >
              <Eye size={13} />
              Spectator QR
            </button>
          </div>

          <QrSvg url={activeQrUrl} size={148} />

          <p className="text-[11px] text-slate-400 mt-2.5 mb-3">
            {qrMode === 'admin'
              ? 'Includes your Room ID & Admin PIN so you can return as Scorekeeper from any device.'
              : 'Read-only QR code for players and spectators to watch live scores.'}
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
                : `Save ${qrMode === 'admin' ? 'Admin' : 'Spectator'} QR Code (.PNG)`}
            </span>
          </button>
        </div>

        {/* Actions */}
        <div className="space-y-2">
          <button
            onClick={() => copyText(spectatorUrl, 'link')}
            className="w-full py-2.5 px-4 rounded-xl font-bold text-xs sm:text-sm bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            {copiedLink ? <Check size={15} className="text-emerald-400" /> : <Copy size={15} />}
            <span>{copiedLink ? 'Spectator Link Copied!' : 'Copy Spectator Invite Link'}</span>
          </button>

          <button
            onClick={onClose}
            className="w-full py-3 px-4 rounded-xl font-black text-sm bg-[#d7f24c] hover:bg-[#c8e33a] text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-[#d7f24c]/15 active:scale-95 transition"
          >
            <span>Start Tournament Setup</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
