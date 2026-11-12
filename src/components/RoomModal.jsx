import React, { useState } from 'react';
import { X, Lock, KeyRound, Copy, Check, PlusCircle, ArrowRight, ShieldCheck, Eye, EyeOff, Sparkles, LogOut, History, Trash2 } from 'lucide-react';
import { generateRoomId, generatePin, sanitizeRoomId } from '../utils/room';

export function RoomModal({
  isOpen,
  onClose,
  currentRoomId,
  adminPin,
  isAdmin,
  savedRooms = [],
  onRemoveSavedRoom,
  onSwitchRoom,
  onCreatePrivateRoom,
  onExitToLanding,
}) {
  const [joinInput, setJoinInput] = useState('');
  const [joinPin, setJoinPin] = useState('');
  const [copiedRoom, setCopiedRoom] = useState(false);
  const [copiedPin, setCopiedPin] = useState(false);
  const [showPin, setShowPin] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  if (!isOpen) return null;

  function copyText(text, isPin = false) {
    navigator.clipboard.writeText(text).then(() => {
      if (isPin) {
        setCopiedPin(true);
        setTimeout(() => setCopiedPin(false), 2000);
      } else {
        setCopiedRoom(true);
        setTimeout(() => setCopiedRoom(false), 2000);
      }
    });
  }

  function handleJoinSubmit(e) {
    e.preventDefault();
    const sanitized = sanitizeRoomId(joinInput);
    if (!sanitized) {
      setErrorMsg('Please enter a valid Room ID.');
      return;
    }
    setErrorMsg('');
    onSwitchRoom(sanitized, joinPin.trim());
    onClose();
  }

  function handleCreateNew() {
    const newRoom = generateRoomId('NLP');
    const newPin = generatePin();
    onCreatePrivateRoom(newRoom, newPin);
    onClose();
  }

  const isDefaultRoom = currentRoomId === 'neep-main' || currentRoomId === 'neep-pickleball';

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm px-4">
      <div className="bg-slate-900 border border-slate-750 rounded-3xl p-6 w-full max-w-md shadow-2xl animate-in fade-in zoom-in-95 duration-150 max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-xl bg-amber-500/10 text-amber-400">
              <Lock size={20} />
            </div>
            <div>
              <h3 className="text-white text-lg font-bold leading-tight">Tournament Room</h3>
              <p className="text-xs text-slate-400">Private session & isolation</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-full hover:bg-slate-800 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Current Active Room Info Box */}
        <div className="bg-slate-850 border border-slate-750 rounded-2xl p-4 mb-5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Current Room</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${
              isDefaultRoom
                ? 'bg-slate-800 text-slate-400 border-slate-700'
                : 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
            }`}>
              {isDefaultRoom ? 'Public Room' : 'Private Session'}
            </span>
          </div>

          <div className="flex items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2 mb-2">
            <span className="font-mono font-black text-white text-base tracking-wider">{currentRoomId}</span>
            <button
              onClick={() => copyText(currentRoomId, false)}
              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs"
              title="Copy Room ID"
            >
              {copiedRoom ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
              <span>{copiedRoom ? 'Copied' : 'Copy'}</span>
            </button>
          </div>

          {isAdmin && (
            <div className="flex items-center justify-between gap-2 bg-slate-900/80 border border-slate-800 rounded-xl px-3 py-2">
              <div className="flex items-center gap-2">
                <KeyRound size={14} className="text-amber-400" />
                <span className="text-xs text-slate-400 font-medium">Admin PIN:</span>
                <span className="font-mono font-bold text-amber-300 tracking-widest text-sm">
                  {showPin ? adminPin : '••••'}
                </span>
                <button
                  type="button"
                  onClick={() => setShowPin(!showPin)}
                  className="text-slate-500 hover:text-slate-300 p-0.5 transition"
                >
                  {showPin ? <EyeOff size={13} /> : <Eye size={13} />}
                </button>
              </div>
              <button
                onClick={() => copyText(adminPin, true)}
                className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-slate-300 hover:text-white transition flex items-center gap-1 text-xs"
                title="Copy Admin PIN"
              >
                {copiedPin ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                <span>{copiedPin ? 'Copied' : 'Copy'}</span>
              </button>
            </div>
          )}
        </div>

        {/* Action 1: Create New Private Tournament */}
        <div className="mb-5 pb-5 border-b border-slate-800">
          <button
            onClick={handleCreateNew}
            className="w-full py-3 px-4 rounded-xl font-bold text-sm bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 text-slate-950 flex items-center justify-center gap-2 shadow-lg shadow-amber-500/20 active:scale-95 transition"
          >
            <Sparkles size={16} /> Create New Private Room
          </button>
          <p className="text-slate-400 text-xs mt-2 text-center">
            Generates a unique Room code & PIN for an isolated tournament.
          </p>
        </div>

        {/* Saved Rooms Quick Switcher */}
        {savedRooms.filter((r) => r.roomId !== currentRoomId).length > 0 && (
          <div className="mb-5 pb-5 border-b border-slate-800">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-400 flex items-center gap-1.5 mb-2.5">
              <History size={13} className="text-[#d7f24c]" /> Saved Rooms on This Device
            </span>
            <div className="space-y-2 max-h-40 overflow-y-auto pr-1">
              {savedRooms
                .filter((r) => r.roomId !== currentRoomId)
                .map((entry) => (
                  <div
                    key={entry.roomId}
                    className="flex items-center justify-between gap-2 bg-slate-950/70 border border-slate-800 rounded-xl px-3 py-2"
                  >
                    <div className="min-w-0 flex items-center gap-2">
                      <span className="font-mono font-bold text-white text-xs">{entry.roomId}</span>
                      {entry.isAdmin && entry.adminPin ? (
                        <span className="text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/25 px-1.5 py-0.5 rounded">
                          PIN: {entry.adminPin}
                        </span>
                      ) : (
                        <span className="text-[10px] text-slate-500">Spectator</span>
                      )}
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          onSwitchRoom(entry.roomId, entry.isAdmin ? entry.adminPin : '');
                          onClose();
                        }}
                        className="px-2.5 py-1 rounded-lg bg-[#d7f24c] hover:bg-[#c8e33a] text-slate-950 font-bold text-xs transition active:scale-95"
                      >
                        Switch
                      </button>
                      {onRemoveSavedRoom && (
                        <button
                          type="button"
                          onClick={() => onRemoveSavedRoom(entry.roomId)}
                          title={`Forget ${entry.roomId}`}
                          className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-slate-800 transition"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        )}

        {/* Action 2: Join Existing Room */}
        <form onSubmit={handleJoinSubmit} className="space-y-3">
          <span className="text-xs font-bold uppercase tracking-wider text-slate-400 block">
            Join Another Tournament Room
          </span>

          <div>
            <label className="text-slate-400 text-xs mb-1 block">Room ID</label>
            <input
              type="text"
              value={joinInput}
              onChange={(e) => setJoinInput(sanitizeRoomId(e.target.value))}
              placeholder="e.g. NLP-8492"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white font-mono uppercase text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          <div>
            <label className="text-slate-400 text-xs mb-1 block">Admin PIN (Optional)</label>
            <input
              type="password"
              maxLength={8}
              value={joinPin}
              onChange={(e) => setJoinPin(e.target.value)}
              placeholder="Leave blank for Spectator Mode"
              className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3.5 py-2.5 text-white text-sm placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-400"
            />
          </div>

          {errorMsg && <p className="text-red-400 text-xs font-medium">{errorMsg}</p>}

          <button
            type="submit"
            className="w-full py-2.5 px-4 rounded-xl font-bold text-sm bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 flex items-center justify-center gap-2 active:scale-95 transition"
          >
            <span>Switch to Room</span>
            <ArrowRight size={15} />
          </button>
        </form>

        {onExitToLanding && (
          <div className="mt-4 pt-3 border-t border-slate-800">
            <button
              type="button"
              onClick={() => {
                onClose();
                onExitToLanding();
              }}
              className="w-full py-2.5 px-4 rounded-xl font-bold text-xs bg-slate-850 hover:bg-slate-800 text-slate-400 hover:text-white border border-slate-750 flex items-center justify-center gap-2 transition active:scale-95"
            >
              <LogOut size={14} />
              <span>Leave Room & Return to Home</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
