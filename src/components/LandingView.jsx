import React, { useState } from 'react';
import { Sparkles, ArrowRight, ShieldCheck, KeyRound, Lock, History, Cloud, AlertCircle, Loader2, Eye, Trash2 } from 'lucide-react';
import { APP_VERSION } from '../version';
import { sanitizeRoomId } from '../utils/room';

export function LandingView({
  onCreatePrivateRoom,
  onJoinRoom,
  recentRoomId,
  savedRooms = [],
  onResumeRecentRoom,
  onRemoveSavedRoom,
  onOpenCloudConfig,
  isCloudActive,
}) {
  const [joinRoomId, setJoinRoomId] = useState('');
  const [joinPin, setJoinPin] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);

  async function handleJoinSubmit(e) {
    e.preventDefault();
    const cleanId = sanitizeRoomId(joinRoomId);
    if (!cleanId) {
      setErrorMsg('Please enter a valid Room ID.');
      return;
    }

    setErrorMsg('');
    setIsVerifying(true);
    try {
      const result = await onJoinRoom(cleanId, joinPin.trim());
      if (result && result.error) {
        setErrorMsg(result.error);
      }
    } catch (err) {
      setErrorMsg('Failed to join room. Please check your connection and try again.');
    } finally {
      setIsVerifying(false);
    }
  }

  function handleRoomIdChange(e) {
    const val = e.target.value.toUpperCase();
    setJoinRoomId(val);
    if (errorMsg) setErrorMsg('');
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between selection:bg-[#d7f24c] selection:text-slate-950">
      {/* Minimal Top Navigation */}
      <header className="border-b border-slate-900 bg-slate-950/60 backdrop-blur-md">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl overflow-hidden flex items-center justify-center filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)]">
              <img
                src="/logo.png"
                alt="NEEP-NLP Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="flex items-center gap-2">
              <span className="font-display font-black tracking-wider text-white text-base">
                NEEP-NLP
              </span>
              <span className="text-[10px] font-mono text-slate-400 bg-slate-900 border border-slate-800 px-1.5 py-0.5 rounded font-semibold">
                {APP_VERSION}
              </span>
            </div>
          </div>

          <button
            onClick={onOpenCloudConfig}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border transition ${
              isCloudActive
                ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20 hover:bg-emerald-500/20'
                : 'bg-amber-500/10 text-amber-400 border-amber-500/20 hover:bg-amber-500/20'
            }`}
          >
            <Cloud size={13} />
            <span>{isCloudActive ? 'Cloud Online' : 'Local Mode'}</span>
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col items-center justify-center px-4 py-10 sm:py-16">
        <div className="w-full max-w-4xl mx-auto">
          {/* Hero Branding */}
          <div className="text-center mb-8 sm:mb-12">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-slate-900 border border-slate-800 text-slate-300 text-xs font-semibold mb-4">
              <span className="w-2 h-2 rounded-full bg-[#d7f24c] animate-pulse" />
              Real-time Tournament & Dreambreaker Score Tracker
            </div>
            <h1 className="text-3xl sm:text-5xl font-black text-white tracking-tight mb-3">
              Ready to hit the courts?
            </h1>
            <p className="text-slate-400 text-sm sm:text-base max-w-lg mx-auto leading-relaxed">
              Generate a private tournament room with a random ID or enter your code to join an existing session.
            </p>
          </div>

          {/* Saved / Recent Rooms List */}
          {(savedRooms.length > 0 || recentRoomId) && (
            <div className="mb-8 max-w-2xl mx-auto">
              <div className="bg-slate-900/90 border border-slate-800 rounded-3xl p-4 sm:p-5 shadow-xl">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <History size={16} className="text-[#d7f24c]" />
                    <span className="text-xs font-bold uppercase tracking-wider text-slate-300">
                      Saved Tournament Rooms ({savedRooms.length || 1})
                    </span>
                  </div>
                  <span className="text-[11px] text-slate-500">Auto-saved on this device</span>
                </div>

                <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                  {(savedRooms.length > 0
                    ? savedRooms
                    : [{ roomId: recentRoomId, adminPin: null, isAdmin: false }]
                  ).map((entry) => (
                    <div
                      key={entry.roomId}
                      className="bg-slate-950/70 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition"
                    >
                      <div className="flex items-center gap-3 min-w-0">
                        <div className="px-2.5 py-1.5 rounded-xl bg-slate-900 border border-slate-800 font-mono font-black text-white text-sm tracking-wider shrink-0">
                          {entry.roomId}
                        </div>
                        <div className="min-w-0 flex flex-wrap items-center gap-1.5">
                          {entry.isAdmin ? (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-[#d7f24c]/15 text-[#d7f24c] border border-[#d7f24c]/30 px-2 py-0.5 rounded-full">
                              <ShieldCheck size={11} /> Scorekeeper Admin
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-cyan-500/15 text-cyan-300 border border-cyan-500/30 px-2 py-0.5 rounded-full">
                              <Eye size={11} /> Spectator
                            </span>
                          )}
                          {entry.isAdmin && entry.adminPin && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-mono font-bold bg-amber-500/10 text-amber-300 border border-amber-500/25 px-2 py-0.5 rounded-full">
                              <KeyRound size={10} /> PIN: {entry.adminPin}
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => onResumeRecentRoom(entry.roomId, entry.adminPin)}
                          className="flex-1 sm:flex-initial px-3.5 py-2 rounded-xl text-xs font-black bg-[#d7f24c] hover:bg-[#c8e33a] text-slate-950 transition flex items-center justify-center gap-1.5 active:scale-95 shadow-md shadow-[#d7f24c]/10"
                        >
                          <span>Resume {entry.isAdmin ? 'as Admin' : 'Room'}</span>
                          <ArrowRight size={13} />
                        </button>
                        {onRemoveSavedRoom && (
                          <button
                            type="button"
                            onClick={() => onRemoveSavedRoom(entry.roomId)}
                            title={`Remove ${entry.roomId} from saved rooms`}
                            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-red-400 border border-slate-800 transition"
                          >
                            <Trash2 size={14} />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* Dual Action Cards */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
            {/* Left Card: Generate New Private Room */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-925 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-slate-700 transition">
              <div className="absolute top-0 right-0 w-32 h-32 bg-[#d7f24c]/5 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-[#d7f24c]/10 border border-[#d7f24c]/20 flex items-center justify-center text-[#d7f24c]">
                    <Sparkles size={24} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-[#d7f24c] bg-[#d7f24c]/10 px-2.5 py-1 rounded-full border border-[#d7f24c]/20">
                    New Tournament
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
                  Create Private Room
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-6">
                  Create a clean, isolated room for your tournament. Room IDs and secret admin PINs are always randomly generated to ensure unique and collision-free sessions.
                </p>

                <div className="bg-slate-950/60 border border-slate-850 rounded-2xl p-3.5 mb-6 space-y-2">
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <ShieldCheck size={14} className="text-emerald-400 shrink-0" />
                    <span>Always randomly generated (e.g. <span className="font-mono font-bold text-white">NLP-XXXX</span>)</span>
                  </div>
                  <div className="flex items-center gap-2 text-xs text-slate-300">
                    <KeyRound size={14} className="text-amber-400 shrink-0" />
                    <span>Includes 4-digit secret Admin PIN for hosts</span>
                  </div>
                </div>
              </div>

              <div>
                <button
                  onClick={onCreatePrivateRoom}
                  className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-[#d7f24c] hover:bg-[#c8e33a] text-slate-950 flex items-center justify-center gap-2.5 shadow-xl shadow-[#d7f24c]/15 active:scale-95 transition"
                >
                  <Sparkles size={18} />
                  <span>Generate New Private Room</span>
                </button>
                <p className="text-[11px] text-slate-400 text-center mt-2.5">
                  Custom room names are disabled. Your room code will be created instantly.
                </p>
              </div>
            </div>

            {/* Right Card: Join Existing Room */}
            <div className="bg-gradient-to-b from-slate-900 to-slate-925 border border-slate-800 rounded-3xl p-6 sm:p-8 flex flex-col justify-between shadow-2xl relative overflow-hidden group hover:border-slate-700 transition">
              <div className="absolute top-0 right-0 w-32 h-32 bg-amber-500/5 rounded-full blur-3xl pointer-events-none" />

              <div>
                <div className="flex items-center justify-between mb-4">
                  <div className="w-12 h-12 rounded-2xl bg-amber-500/10 border border-amber-500/20 flex items-center justify-center text-amber-400">
                    <Lock size={24} />
                  </div>
                  <span className="text-[10px] font-bold uppercase tracking-wider text-amber-400 bg-amber-500/10 px-2.5 py-1 rounded-full border border-amber-500/20">
                    Existing Session
                  </span>
                </div>

                <h2 className="text-xl sm:text-2xl font-black text-white mb-2">
                  Join Existing Room
                </h2>
                <p className="text-xs sm:text-sm text-slate-400 leading-relaxed mb-5">
                  Have a room code from your tournament organizer? Enter it below to spectate or manage the matches.
                </p>

                <form id="join-room-form" onSubmit={handleJoinSubmit} className="space-y-3.5 mb-6">
                  <div>
                    <label className="text-slate-300 text-xs font-bold block mb-1">
                      Room ID <span className="text-[#d7f24c]">*</span>
                    </label>
                    <input
                      type="text"
                      value={joinRoomId}
                      onChange={handleRoomIdChange}
                      placeholder="e.g. NLP-8492"
                      maxLength={20}
                      disabled={isVerifying}
                      className="w-full bg-slate-950 border border-slate-750 focus:border-[#d7f24c] rounded-xl px-4 py-3 text-white font-mono uppercase text-sm tracking-wider placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#d7f24c] transition"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="text-slate-300 text-xs font-bold block">
                        Admin PIN
                      </label>
                      <span className="text-[11px] text-slate-400">Optional for Spectators</span>
                    </div>
                    <input
                      type="password"
                      maxLength={8}
                      value={joinPin}
                      onChange={(e) => setJoinPin(e.target.value)}
                      placeholder="Leave blank for Spectator Mode"
                      disabled={isVerifying}
                      className="w-full bg-slate-950 border border-slate-750 focus:border-[#d7f24c] rounded-xl px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:ring-1 focus:ring-[#d7f24c] transition"
                    />
                  </div>

                  {errorMsg && (
                    <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/20 flex items-center gap-2 text-xs text-red-400 font-medium animate-in fade-in duration-150">
                      <AlertCircle size={15} className="shrink-0" />
                      <span>{errorMsg}</span>
                    </div>
                  )}
                </form>
              </div>

              <div>
                <button
                  type="submit"
                  form="join-room-form"
                  disabled={isVerifying || !joinRoomId.trim()}
                  className="w-full py-4 px-6 rounded-2xl font-black text-sm bg-slate-800 hover:bg-slate-750 text-white border border-slate-700 hover:border-slate-600 flex items-center justify-center gap-2.5 active:scale-95 disabled:opacity-50 disabled:pointer-events-none transition"
                >
                  {isVerifying ? (
                    <>
                      <Loader2 size={18} className="animate-spin text-amber-400" />
                      <span>Verifying Room...</span>
                    </>
                  ) : (
                    <>
                      <span>Join Tournament</span>
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
                <p className="text-[11px] text-slate-400 text-center mt-2.5">
                  Spectators can watch brackets and live scoring without needing a PIN.
                </p>
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Minimal Footer */}
      <footer className="border-t border-slate-900 py-4 px-4 text-center text-xs text-slate-400">
        NEEP-NLP Score Tracker ({APP_VERSION}) · Isolated Private Sessions & Real-time Cloud Sync
      </footer>
    </div>
  );
}
