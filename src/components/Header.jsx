import React, { useState } from 'react';
import { Trophy, Swords, Share2, Cloud, RotateCcw, Trash2, ShieldCheck, Eye, KeyRound, Lock, Unlock, Users, LogOut, LayoutGrid, UserCheck } from 'lucide-react';
import { isCloudEnabled } from '../services/firebase';
import { APP_VERSION } from '../version';

export function Header({
  hasTournament,
  tournamentStyle = 'mlp',
  view,
  setView,
  onBracketTab,
  onClear,
  onWipeStats,
  onOpenShare,
  onOpenCloudConfig,
  cloudError = null,
  roomId,
  onOpenRoomModal,
  isAdmin,
  isTournamentLocked = false,
  onToggleTournamentLock,
  onUnlockAdmin,
  loggedInPlayerName,
  onOpenPlayerLogin,
  onOpenRosterModal,
  onExitToLanding,
}) {
  const cloudActive = isCloudEnabled();
  const isPlayerOnly = !isAdmin && Boolean(loggedInPlayerName);
  const [showPinPrompt, setShowPinPrompt] = useState(false);
  const [enteredPin, setEnteredPin] = useState('');

  function submitPin(e) {
    e.preventDefault();
    if (onUnlockAdmin(enteredPin)) {
      setShowPinPrompt(false);
      setEnteredPin('');
    } else {
      alert('Incorrect Admin PIN. Please try again.');
    }
  }

  return (
    <header className="border-b border-slate-800/80 bg-slate-950/80 backdrop-blur-md sticky top-0 z-40">
      <div className="max-w-6xl mx-auto px-3 sm:px-4 py-2 sm:py-3 flex items-center justify-between gap-2 sm:gap-3">
        {/* Logo and Brand */}
        <div className="flex items-center gap-2 sm:gap-3 shrink-0 min-w-0">
          <button onClick={() => (isPlayerOnly ? onBracketTab() : setView(tournamentStyle === 'tournament' ? 'poolSetup' : 'setup'))} className="text-left flex items-center gap-2 sm:gap-2.5 group">
            <div className="w-7 h-9 sm:w-8 sm:h-10 shrink-0 flex items-center justify-center filter drop-shadow-[0_2px_8px_rgba(0,0,0,0.5)] group-hover:scale-105 transition duration-150">
              <img
                src="/logo.png"
                alt="NEEP-NLP Score Tracker Logo"
                className="w-full h-full object-contain"
              />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-1 sm:gap-2 whitespace-nowrap">
                <span className="font-display font-black tracking-wider text-white text-sm sm:text-base leading-none">
                  NEEP-NLP
                </span>
                <span className="text-[9px] font-mono text-slate-400 uppercase tracking-wider bg-slate-900 border border-slate-800 px-1 py-0.5 rounded font-semibold hidden xs:inline">
                  {APP_VERSION}
                </span>
              </div>
              <p className="text-[9px] sm:text-[10px] text-slate-400 font-medium leading-none mt-0.5 truncate hidden xs:block">Score Tracker</p>
            </div>
          </button>
        </div>

        {/* Desktop Navigation Tabs */}
        {!isPlayerOnly && hasTournament && (
          <nav className="hidden sm:flex items-center gap-1 bg-slate-900/90 border border-slate-800 rounded-xl p-1">
            {tournamentStyle === 'tournament' ? (
              <>
                {!isPlayerOnly && (
                  <button
                    onClick={() => setView('poolSetup')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      view === 'poolSetup'
                        ? 'bg-[#d7f24c] text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Setup
                  </button>
                )}
                <button
                  onClick={onBracketTab}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    view === 'poolPlay'
                      ? 'bg-[#d7f24c] text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Swords size={13} /> Pools &amp; Bracket
                </button>
                {isAdmin && (
                  <button
                    onClick={() => setView('scorekeeper')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      view === 'scorekeeper'
                        ? 'bg-[#d7f24c] text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LayoutGrid size={13} /> Scorekeeper
                  </button>
                )}
              </>
            ) : (
              <>
                {!isPlayerOnly && (
                  <button
                    onClick={() => setView('setup')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      view === 'setup'
                        ? 'bg-[#d7f24c] text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    Setup
                  </button>
                )}
                <button
                  onClick={onBracketTab}
                  className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                    view === 'bracket' || view === 'match' || view === 'dreambreakerSetup' || view === 'dreambreakerPlay' || view === 'draft'
                      ? 'bg-[#d7f24c] text-slate-950 shadow-md'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  <Swords size={13} /> Bracket
                </button>
                {!isPlayerOnly && onOpenRosterModal && (
                  <button
                    onClick={onOpenRosterModal}
                    className="px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 text-slate-400 hover:text-white hover:bg-slate-800"
                  >
                    <Users size={13} /> Rosters & Subs
                  </button>
                )}
                {!isPlayerOnly && (
                  <button
                    onClick={() => setView('leaderboard')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      view === 'leaderboard'
                        ? 'bg-[#d7f24c] text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <Trophy size={13} /> Leaderboard
                  </button>
                )}
                {isAdmin && (
                  <button
                    onClick={() => setView('scorekeeper')}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition flex items-center gap-1.5 ${
                      view === 'scorekeeper'
                        ? 'bg-[#d7f24c] text-slate-950 shadow-md'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    <LayoutGrid size={13} /> Scorekeeper
                  </button>
                )}
              </>
            )}
          </nav>
        )}

        {/* Action Controls */}
        <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
          {/* Cloud Status Pill (Hidden in Player View) */}
          {!isPlayerOnly && (
            <button
              onClick={onOpenCloudConfig}
              title={
                cloudError
                  ? `Cloud Sync Error (${cloudError}) — Check Firebase Firestore rules! Click for details.`
                  : cloudActive
                    ? 'Connected to Firebase Firestore'
                    : 'Running in Local Mode. Click to connect cloud!'
              }
              className={`flex items-center gap-1.5 p-1.5 sm:px-2.5 sm:py-1 rounded-full border text-xs font-medium transition ${
                cloudError
                  ? 'bg-rose-500/15 hover:bg-rose-500/25 border-rose-500/50 text-rose-300'
                  : 'bg-slate-900 hover:bg-slate-850 border-slate-800'
              }`}
            >
              <span
                className={`w-2 h-2 rounded-full ${
                  cloudError
                    ? 'bg-rose-500 animate-ping'
                    : cloudActive
                      ? 'bg-emerald-400 animate-pulse'
                      : 'bg-amber-400'
                }`}
              />
              <span className={`hidden md:inline text-[11px] font-mono ${cloudError ? 'text-rose-300 font-bold' : 'text-slate-300'}`}>
                {cloudError ? 'Sync Error' : cloudActive ? 'Cloud Live' : 'Local'}
              </span>
            </button>
          )}

          {/* Room Pill (Hidden in Player View) */}
          {!isPlayerOnly && (
            <button
              onClick={onOpenRoomModal}
              title="Tournament Room Sessions. Click to switch or create rooms!"
              className="flex items-center gap-1 px-2 py-1 rounded-full bg-slate-900 hover:bg-slate-850 border border-slate-800 text-xs font-medium transition active:scale-95"
            >
              <Lock size={11} className="text-amber-400 shrink-0" />
              <span className="text-slate-300 font-mono text-[10px] sm:text-[11px] font-bold max-w-[48px] xs:max-w-[70px] sm:max-w-none truncate">
                {roomId || 'Room'}
              </span>
            </button>
          )}

          {/* Player Login Pill */}
          {!isAdmin && onOpenPlayerLogin && (
            isPlayerOnly ? (
              <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] sm:text-[11px] font-bold whitespace-nowrap max-w-[110px] bg-emerald-500/15 border-emerald-500/40 text-emerald-300">
                <UserCheck size={12} className="shrink-0" />
                <span className="truncate">{loggedInPlayerName}</span>
              </span>
            ) : (
              <button
                type="button"
                onClick={onOpenPlayerLogin}
                title="Player Login for match alerts & self-scoring"
                className="inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] sm:text-[11px] font-bold transition whitespace-nowrap max-w-[110px] bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-emerald-300"
              >
                <UserCheck size={12} className="shrink-0" />
                <span className="truncate">Player</span>
              </button>
            )
          )}

          {/* Lock Tournament Settings (Admin toggle / Non-admin badge) */}
          {isAdmin && onToggleTournamentLock ? (
            <button
              type="button"
              onClick={onToggleTournamentLock}
              title={
                isTournamentLocked
                  ? 'Tournament settings locked (only admins can edit). Click to unlock.'
                  : 'Lock tournament settings to prevent editing except by admins'
              }
              className={`inline-flex items-center gap-1 px-2 py-1 rounded-full border text-[10px] sm:text-[11px] font-bold transition whitespace-nowrap ${
                isTournamentLocked
                  ? 'bg-amber-500/20 border-amber-400/50 text-amber-300 hover:bg-amber-500/30'
                  : 'bg-slate-900 hover:bg-slate-800 border-slate-800 text-slate-300 hover:text-white'
              }`}
            >
              {isTournamentLocked ? <Lock size={11} className="shrink-0" /> : <Unlock size={11} className="shrink-0" />}
              <span className="hidden md:inline">{isTournamentLocked ? 'Locked' : 'Lock'}</span>
            </button>
          ) : !isAdmin && isTournamentLocked ? (
            <span
              title="Tournament settings are locked by an Admin"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-amber-500/15 border border-amber-500/35 text-amber-300 text-[10px] sm:text-[11px] font-bold whitespace-nowrap"
            >
              <Lock size={11} className="shrink-0" />
              <span className="hidden md:inline">Locked</span>
            </span>
          ) : null}

          {/* Admin Role Badge (Hidden in Player & Spectator views) */}
          {isAdmin && (
            <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full bg-[#d7f24c]/15 border border-[#d7f24c]/30 text-[#d7f24c] text-[10px] sm:text-[11px] font-bold whitespace-nowrap">
              <ShieldCheck size={12} className="shrink-0" />
              <span className="hidden xs:inline">Scorekeeper</span>
              <span className="xs:hidden">Admin</span>
            </span>
          )}

          {/* Share Tournament */}
          <button
            onClick={onOpenShare}
            title="Share Tournament Link"
            className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-300 hover:text-[#d7f24c] border border-slate-800 transition active:scale-95 shrink-0"
          >
            <Share2 size={15} />
          </button>

          {/* Reset / New Tournament (Admin only) */}
          {isAdmin && hasTournament && (
            <button
              onClick={onClear}
              title="Reset or Start New Tournament"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 transition active:scale-95 shrink-0"
            >
              <RotateCcw size={15} />
            </button>
          )}

          {/* Wipe All Stats (Admin only) */}
          {isAdmin && (
            <button
              onClick={onWipeStats}
              title="Wipe Global Leaderboard"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-500 hover:text-red-400 border border-slate-800 transition active:scale-95 shrink-0"
            >
              <Trash2 size={15} />
            </button>
          )}

          {/* Leave Room / Return to Landing Page (Hidden in Player View) */}
          {!isPlayerOnly && onExitToLanding && (
            <button
              onClick={onExitToLanding}
              title="Exit Room & Return to Landing Page"
              className="p-1.5 sm:p-2 rounded-xl bg-slate-900 hover:bg-slate-850 text-slate-400 hover:text-white border border-slate-800 transition active:scale-95 shrink-0 flex items-center gap-1"
            >
              <LogOut size={14} />
              <span className="hidden xl:inline text-[11px] font-semibold">Exit</span>
            </button>
          )}
        </div>
      </div>

      {/* Admin PIN Unlock Prompt */}
      {showPinPrompt && !isAdmin && (
        <div className="border-t border-slate-800 bg-slate-900/95 px-4 py-2.5">
          <form onSubmit={submitPin} className="max-w-md mx-auto flex items-center gap-2">
            <span className="text-xs text-slate-300 font-bold flex items-center gap-1 whitespace-nowrap">
              <KeyRound size={13} className="text-[#d7f24c]" /> Scorekeeper PIN:
            </span>
            <input
              type="password"
              autoFocus
              value={enteredPin}
              onChange={(e) => setEnteredPin(e.target.value)}
              placeholder="Enter PIN (default 1234)"
              className="flex-1 bg-slate-950 border border-slate-700 rounded-lg px-2.5 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
            />
            <button
              type="submit"
              className="px-3 py-1 rounded-lg bg-[#d7f24c] text-slate-950 font-bold text-xs active:scale-95 transition"
            >
              Unlock
            </button>
            <button
              type="button"
              onClick={() => setShowPinPrompt(false)}
              className="px-2 py-1 text-slate-400 hover:text-white text-xs font-semibold"
            >
              Cancel
            </button>
          </form>
        </div>
      )}

      {/* Mobile Navigation Tabs */}
      {!isPlayerOnly && hasTournament && (
        <div className="sm:hidden flex border-t border-slate-800/80 bg-slate-950/90">
          {tournamentStyle === 'tournament' ? (
            <>
              {!isPlayerOnly && (
                <button
                  onClick={() => setView('poolSetup')}
                  className={`flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    view === 'poolSetup'
                      ? 'text-[#d7f24c] border-b-2 border-[#d7f24c] bg-[#d7f24c]/5'
                      : 'text-slate-500'
                  }`}
                >
                  Setup
                </button>
              )}
              <button
                onClick={onBracketTab}
                className={`flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  view === 'poolPlay'
                    ? 'text-[#d7f24c] border-b-2 border-[#d7f24c] bg-[#d7f24c]/5'
                    : 'text-slate-500'
                }`}
              >
                <Swords size={13} /> Pools &amp; Bracket
              </button>
              {isAdmin && (
                <button
                  onClick={() => setView('scorekeeper')}
                  className={`flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    view === 'scorekeeper'
                      ? 'text-[#d7f24c] border-b-2 border-[#d7f24c] bg-[#d7f24c]/5'
                      : 'text-slate-500'
                  }`}
                >
                  <LayoutGrid size={13} /> Scorekeeper
                </button>
              )}
            </>
          ) : (
            <>
              {!isPlayerOnly && (
                <button
                  onClick={() => setView('setup')}
                  className={`flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    view === 'setup'
                      ? 'text-[#d7f24c] border-b-2 border-[#d7f24c] bg-[#d7f24c]/5'
                      : 'text-slate-500'
                  }`}
                >
                  Setup
                </button>
              )}
              <button
                onClick={onBracketTab}
                className={`flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                  view === 'bracket' || view === 'match' || view === 'dreambreakerSetup' || view === 'dreambreakerPlay' || view === 'draft'
                    ? 'text-[#d7f24c] border-b-2 border-[#d7f24c] bg-[#d7f24c]/5'
                    : 'text-slate-500'
                }`}
              >
                <Swords size={13} /> Bracket
              </button>
              {!isPlayerOnly && onOpenRosterModal && (
                <button
                  onClick={onOpenRosterModal}
                  className="flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 text-slate-400 hover:text-white"
                >
                  <Users size={13} /> Rosters
                </button>
              )}
              {!isPlayerOnly && (
                <button
                  onClick={() => setView('leaderboard')}
                  className={`flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    view === 'leaderboard'
                      ? 'text-[#d7f24c] border-b-2 border-[#d7f24c] bg-[#d7f24c]/5'
                      : 'text-slate-500'
                  }`}
                >
                  <Trophy size={13} /> Leaderboard
                </button>
              )}
              {isAdmin && (
                <button
                  onClick={() => setView('scorekeeper')}
                  className={`flex-1 py-2 text-xs font-bold transition flex items-center justify-center gap-1.5 ${
                    view === 'scorekeeper'
                      ? 'text-[#d7f24c] border-b-2 border-[#d7f24c] bg-[#d7f24c]/5'
                      : 'text-slate-500'
                  }`}
                >
                  <LayoutGrid size={13} /> Scorekeeper
                </button>
              )}
            </>
          )}
        </div>
      )}
    </header>
  );
}
