import React, { useState } from 'react';
import { Sparkles, Copy, Check, KeyRound, ShieldCheck, Eye, EyeOff, ArrowRight, X, Lock } from 'lucide-react';

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

  const shareUrl = `${window.location.origin}?room=${encodeURIComponent(roomId)}`;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-md px-4">
      <div className="bg-slate-900 border border-slate-750 rounded-3xl p-6 sm:p-7 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-200">
        {/* Header Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-400">
              <Sparkles size={22} />
            </div>
            <div>
              <h3 className="text-white text-lg sm:text-xl font-black leading-tight">Private Room Created!</h3>
              <p className="text-xs text-slate-400">Your isolated tournament space is ready</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        <p className="text-xs text-slate-300 mb-5 leading-relaxed">
          Save your room code and admin PIN. You can share the link with players or spectators to let them join in real-time.
        </p>

        {/* Room ID Box */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-3">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wider text-slate-400">Room Code</span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-400 border border-emerald-500/30">
              Active Room
            </span>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono font-black text-2xl tracking-wider text-white select-all">
              {roomId}
            </span>
            <button
              onClick={() => copyText(roomId, 'room')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white transition flex items-center gap-1.5 text-xs font-bold active:scale-95"
            >
              {copiedRoom ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedRoom ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
        </div>

        {/* Admin PIN Box */}
        <div className="bg-slate-950/80 border border-slate-800 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <KeyRound size={12} className="text-amber-400" />
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400">Admin PIN (Secret)</span>
            </div>
            <button
              type="button"
              onClick={() => setShowPin(!showPin)}
              className="text-slate-400 hover:text-slate-200 text-xs flex items-center gap-1 transition"
            >
              {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
              <span className="text-[11px]">{showPin ? 'Hide' : 'Reveal'}</span>
            </button>
          </div>
          <div className="flex items-center justify-between gap-3">
            <span className="font-mono font-black text-xl tracking-widest text-amber-300">
              {showPin ? adminPin : '••••'}
            </span>
            <button
              onClick={() => copyText(adminPin, 'pin')}
              className="px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-200 hover:text-white transition flex items-center gap-1.5 text-xs font-bold active:scale-95"
            >
              {copiedPin ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedPin ? 'Copied' : 'Copy'}</span>
            </button>
          </div>
          <p className="text-[11px] text-slate-400 mt-2">
            Use this PIN if you need to log in as administrator on another device.
          </p>
        </div>

        {/* Actions */}
        <div className="space-y-2.5">
          <button
            onClick={() => copyText(shareUrl, 'link')}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            {copiedLink ? <Check size={16} className="text-emerald-400" /> : <Copy size={16} />}
            <span>{copiedLink ? 'Link Copied to Clipboard!' : 'Copy Spectator Invite Link'}</span>
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
