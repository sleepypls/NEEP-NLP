import React, { useState, useEffect, useRef } from 'react';
import {
  UserCheck,
  Bell,
  BellRing,
  Flame,
  Check,
  X,
  Send,
  Clock,
  ShieldAlert,
  Swords,
  Trophy,
} from 'lucide-react';
import { LiveTimer } from './LiveTimer';
import {
  getEntryDisplayName,
  getKnockoutRoundLabel,
  getEffectiveMatchFormat,
  evaluatePoolOrKnockoutMatch,
  resizeGamesForBestOf,
} from '../utils/poolTournament';

function playNotificationChime() {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    const now = ctx.currentTime;
    [523.25, 659.25, 783.99].forEach((freq, i) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.11);
      gain.gain.setValueAtTime(0.08, now + i * 0.11);
      gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.11 + 0.25);
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + i * 0.11);
      osc.stop(now + i * 0.11 + 0.26);
    });
  } catch (e) {
    // ignore audio autoplay restrictions
  }
}

function normalizeName(n) {
  return String(n || '').trim().toLowerCase();
}

function PoolMatchSelfScoreRow({
  item,
  playerName,
  onSubmitPending,
  onApprovePending,
  onRejectPending,
}) {
  const { match, mySide, stage, nameA, nameB, format } = item;
  const bestOf = format?.bestOf || 1;
  const initialGames = resizeGamesForBestOf(match.games, bestOf);
  const [draftGames, setDraftGames] = useState(initialGames);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setDraftGames(resizeGamesForBestOf(match.games, bestOf));
  }, [match.id, bestOf, match.pendingScore?.submittedAt]);

  const pending = match.pendingScore;
  const pendingSummary = pending
    ? (pending.games || [])
        .filter((g) => g.scoreA !== '' && g.scoreB !== '')
        .map((g) => `${g.scoreA}-${g.scoreB}`)
        .join(', ')
    : '';

  function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    const evalRes = evaluatePoolOrKnockoutMatch(draftGames, bestOf);
    if (!evalRes.winnerSide) {
      setErrorMsg(
        bestOf > 1
          ? `Enter valid game scores until one side wins ${Math.ceil(bestOf / 2)} games (no ties).`
          : 'Enter valid non-tied game scores.'
      );
      return;
    }
    const winnerId = evalRes.winnerSide === 'A' ? match.entryAId : match.entryBId;
    onSubmitPending(item, {
      games: draftGames,
      winnerId,
      submittedByName: playerName,
      submittedBySide: mySide,
      submittedAt: Date.now(),
    });
  }

  const isLive = Boolean(match.inProgress && !match.saved);
  const needsMyApproval = Boolean(pending && pending.submittedBySide !== mySide);

  return (
    <div
      className={`rounded-2xl p-3.5 border space-y-3 transition ${
        needsMyApproval
          ? 'bg-amber-500/15 border-2 border-amber-400/70 shadow-lg shadow-amber-500/10'
          : isLive
            ? 'bg-gradient-to-br from-amber-500/15 via-slate-950 to-slate-950 border-2 border-amber-400/75 shadow-lg shadow-amber-500/10'
            : 'bg-slate-950/70 border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isLive && (
            <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
              <Flame size={11} /> LIVE NOW
              {match.liveStartedAt && (
                <LiveTimer startedAt={match.liveStartedAt} className="text-[10px] text-slate-950 font-black" />
              )}
            </span>
          )}
          {match.court && (
            <span className="text-[11px] font-mono font-black bg-[#d7f24c] text-slate-950 px-2.5 py-0.5 rounded-full">
              Court {match.court}
            </span>
          )}
          <span className="text-[11px] font-bold text-slate-300">{stage}</span>
        </div>
        <span className="text-[10px] font-mono text-slate-400">
          {bestOf > 1 ? `Best of ${bestOf}` : '1 Game'} to {format?.pointsTo || 11}
        </span>
      </div>

      {pending ? (
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            {[
              { side: 'A', name: nameA },
              { side: 'B', name: nameB },
            ].map((team) => {
              const isMe = mySide === team.side;
              return (
                <div
                  key={team.side}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border ${
                    isMe
                      ? 'bg-[#d7f24c]/10 border-[#d7f24c]/35'
                      : 'bg-slate-900/75 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold truncate ${isMe ? 'text-[#d7f24c]' : 'text-slate-100'}`}>
                      {team.name}
                    </span>
                    {isMe && (
                      <span className="text-[9px] font-black uppercase bg-[#d7f24c] text-slate-950 px-1.5 py-0.5 rounded shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {(pending.games || [])
                      .filter((g) => g.scoreA !== '' && g.scoreB !== '')
                      .map((g, idx) => (
                        <span
                          key={g.gameNum || idx}
                          className="min-w-[2rem] text-center font-mono text-xs font-black text-white bg-slate-950 border border-slate-700 rounded-lg px-2 py-1"
                        >
                          {team.side === 'A' ? g.scoreA : g.scoreB}
                        </span>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>

          {pending.submittedBySide === mySide ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                <Clock size={13} className="text-amber-400 shrink-0" />
                <span>
                  Submitted <strong className="text-white font-mono">{pendingSummary}</strong> &mdash; waiting for opponent approval
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRejectPending(item)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-[11px] font-bold transition"
              >
                Withdraw
              </button>
            </div>
          ) : (
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-2.5 space-y-2">
              <div className="text-xs text-amber-200 font-semibold">
                <strong>{pending.submittedByName}</strong> submitted score:{' '}
                <span className="font-mono font-black text-white">{pendingSummary}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onApprovePending(item)}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Check size={14} /> Approve &amp; Finalize
                </button>
                <button
                  type="button"
                  onClick={() => onRejectPending(item)}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition"
                >
                  <X size={13} /> Reject
                </button>
              </div>
            </div>
          )}
        </div>
      ) : !isLive ? (
        <div className="space-y-2">
          <div className="space-y-1.5">
            {[
              { side: 'A', name: nameA },
              { side: 'B', name: nameB },
            ].map((team) => {
              const isMe = mySide === team.side;
              return (
                <div
                  key={team.side}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border ${
                    isMe
                      ? 'bg-[#d7f24c]/10 border-[#d7f24c]/30'
                      : 'bg-slate-900/60 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold truncate ${isMe ? 'text-[#d7f24c]' : 'text-slate-200'}`}>
                      {team.name}
                    </span>
                    {isMe && (
                      <span className="text-[9px] font-black uppercase bg-[#d7f24c] text-slate-950 px-1.5 py-0.5 rounded shrink-0">
                        You
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Clock size={12} className="text-slate-500 shrink-0" />
            Upcoming &mdash; score entry opens when this match goes LIVE.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2.5">
          {bestOf > 1 && (
            <div className="flex items-center justify-end gap-1.5 pr-3">
              {draftGames.map((g, gIdx) => (
                <span
                  key={g.gameNum || gIdx}
                  className="w-12 text-center text-[10px] font-mono font-bold text-slate-400"
                >
                  G{gIdx + 1}
                </span>
              ))}
            </div>
          )}
          <div className="space-y-1.5">
            {[
              { side: 'A', name: nameA, field: 'scoreA' },
              { side: 'B', name: nameB, field: 'scoreB' },
            ].map((team) => {
              const isMe = mySide === team.side;
              return (
                <div
                  key={team.side}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border ${
                    isMe
                      ? 'bg-[#d7f24c]/10 border-[#d7f24c]/35'
                      : 'bg-slate-900/75 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs sm:text-sm font-bold truncate ${isMe ? 'text-[#d7f24c]' : 'text-slate-100'}`}>
                      {team.name}
                    </span>
                    {isMe && (
                      <span className="text-[9px] font-black uppercase bg-[#d7f24c] text-slate-950 px-1.5 py-0.5 rounded shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1.5 shrink-0">
                    {draftGames.map((g, gIdx) => (
                      <input
                        key={g.gameNum || gIdx}
                        type="number"
                        min={0}
                        max={99}
                        aria-label={`${team.name} Game ${gIdx + 1} score`}
                        value={g[team.field]}
                        onChange={(e) => {
                          const val = e.target.value;
                          setDraftGames((prev) =>
                            prev.map((row, idx) =>
                              idx === gIdx ? { ...row, [team.field]: val } : row
                            )
                          );
                        }}
                        placeholder="0"
                        className="w-12 sm:w-14 h-9 bg-slate-950 border border-slate-700 rounded-lg px-1.5 text-center text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                      />
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            {errorMsg ? (
              <p className="text-[11px] text-rose-400 flex items-center gap-1">
                <ShieldAlert size={12} /> {errorMsg}
              </p>
            ) : (
              <span className="text-[10px] text-slate-500">Enter score next to each team</span>
            )}
            <button
              type="submit"
              className="ml-auto py-2 px-4 rounded-xl bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 text-xs font-black flex items-center gap-1.5 transition active:scale-95"
            >
              <Send size={12} /> Submit Score
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function MlpGameSelfScoreRow({
  item,
  playerName,
  onSubmitPending,
  onApprovePending,
  onRejectPending,
}) {
  const { game, mySide, matchLabel, gameIndex, namesA, namesB } = item;
  const [scoreA, setScoreA] = useState(
    game.scoreA !== undefined && game.scoreA !== null ? String(game.scoreA) : ''
  );
  const [scoreB, setScoreB] = useState(
    game.scoreB !== undefined && game.scoreB !== null ? String(game.scoreB) : ''
  );
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    setScoreA(game.scoreA !== undefined && game.scoreA !== null ? String(game.scoreA) : '');
    setScoreB(game.scoreB !== undefined && game.scoreB !== null ? String(game.scoreB) : '');
  }, [game.id, game.pendingScore?.submittedAt]);

  const pending = game.pendingScore;

  function handleSubmit(e) {
    e.preventDefault();
    setErrorMsg('');
    if (scoreA === '' || scoreB === '') {
      setErrorMsg('Enter both scores.');
      return;
    }
    const nA = Number(scoreA);
    const nB = Number(scoreB);
    if (Number.isNaN(nA) || Number.isNaN(nB) || nA < 0 || nB < 0 || nA === nB) {
      setErrorMsg('Scores must be valid non-tied numbers.');
      return;
    }
    onSubmitPending(item, {
      scoreA: nA,
      scoreB: nB,
      submittedByName: playerName,
      submittedBySide: mySide,
      submittedAt: Date.now(),
    });
  }

  const isLive = Boolean(game.inProgress && !game.saved);
  const needsMyApproval = Boolean(pending && pending.submittedBySide !== mySide);

  return (
    <div
      className={`rounded-2xl p-3.5 border space-y-3 transition ${
        needsMyApproval
          ? 'bg-amber-500/15 border-2 border-amber-400/70 shadow-lg shadow-amber-500/10'
          : isLive
            ? 'bg-gradient-to-br from-cyan-500/15 via-slate-950 to-slate-950 border-2 border-cyan-400/75 shadow-lg shadow-cyan-500/10'
            : 'bg-slate-950/70 border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isLive && (
            <span className="text-[10px] font-black bg-cyan-400 text-slate-950 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
              <Flame size={11} /> LIVE NOW
              {game.liveStartedAt && (
                <LiveTimer startedAt={game.liveStartedAt} className="text-[10px] text-slate-950 font-black" />
              )}
            </span>
          )}
          {game.court && (
            <span className="text-[11px] font-mono font-black bg-[#d7f24c] text-slate-950 px-2.5 py-0.5 rounded-full">
              Court {game.court}
            </span>
          )}
          <span className="text-[11px] font-bold text-slate-300">
            {matchLabel} &bull; Game {gameIndex + 1}
          </span>
        </div>
      </div>

      {pending ? (
        <div className="space-y-2.5">
          <div className="space-y-1.5">
            {[
              { side: 'A', name: namesA, score: pending.scoreA },
              { side: 'B', name: namesB, score: pending.scoreB },
            ].map((team) => {
              const isMe = mySide === team.side;
              return (
                <div
                  key={team.side}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border ${
                    isMe
                      ? 'bg-[#d7f24c]/10 border-[#d7f24c]/35'
                      : 'bg-slate-900/75 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold truncate ${isMe ? 'text-[#d7f24c]' : 'text-slate-100'}`}>
                      {team.name}
                    </span>
                    {isMe && (
                      <span className="text-[9px] font-black uppercase bg-[#d7f24c] text-slate-950 px-1.5 py-0.5 rounded shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  <span className="min-w-[2.5rem] text-center font-mono text-sm font-black text-white bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 shrink-0">
                    {team.score}
                  </span>
                </div>
              );
            })}
          </div>

          {pending.submittedBySide === mySide ? (
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-2.5 flex items-center justify-between gap-2 flex-wrap">
              <div className="text-xs text-slate-300 flex items-center gap-1.5">
                <Clock size={13} className="text-amber-400 shrink-0" />
                <span>
                  Submitted <strong className="text-white font-mono">{pending.scoreA} - {pending.scoreB}</strong> &mdash; waiting for opponent approval
                </span>
              </div>
              <button
                type="button"
                onClick={() => onRejectPending(item)}
                className="px-2.5 py-1 rounded-lg bg-slate-800 hover:bg-rose-500/20 text-slate-300 hover:text-rose-300 text-[11px] font-bold transition"
              >
                Withdraw
              </button>
            </div>
          ) : (
            <div className="bg-amber-500/15 border border-amber-500/40 rounded-xl p-2.5 space-y-2">
              <div className="text-xs text-amber-200 font-semibold">
                <strong>{pending.submittedByName}</strong> submitted score:{' '}
                <span className="font-mono font-black text-white">
                  {pending.scoreA} - {pending.scoreB}
                </span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onApprovePending(item)}
                  className="flex-1 py-2 px-3 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-black flex items-center justify-center gap-1.5 transition active:scale-95"
                >
                  <Check size={14} /> Approve &amp; Finalize
                </button>
                <button
                  type="button"
                  onClick={() => onRejectPending(item)}
                  className="py-2 px-3 rounded-xl bg-slate-800 hover:bg-rose-500/20 text-rose-300 border border-rose-500/30 text-xs font-bold flex items-center gap-1 transition"
                >
                  <X size={13} /> Reject
                </button>
              </div>
            </div>
          )}
        </div>
      ) : !isLive ? (
        <div className="space-y-2">
          <div className="space-y-1.5">
            {[
              { side: 'A', name: namesA },
              { side: 'B', name: namesB },
            ].map((team) => {
              const isMe = mySide === team.side;
              return (
                <div
                  key={team.side}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border ${
                    isMe
                      ? 'bg-[#d7f24c]/10 border-[#d7f24c]/30'
                      : 'bg-slate-900/60 border-slate-800/80'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs font-bold truncate ${isMe ? 'text-[#d7f24c]' : 'text-slate-200'}`}>
                      {team.name}
                    </span>
                    {isMe && (
                      <span className="text-[9px] font-black uppercase bg-[#d7f24c] text-slate-950 px-1.5 py-0.5 rounded shrink-0">
                        You
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
          <p className="text-[11px] text-slate-400 flex items-center gap-1.5">
            <Clock size={12} className="text-slate-500 shrink-0" />
            Upcoming &mdash; score entry opens when this match goes LIVE.
          </p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="space-y-2.5">
          <div className="space-y-1.5">
            {[
              { side: 'A', name: namesA, value: scoreA, onChange: setScoreA },
              { side: 'B', name: namesB, value: scoreB, onChange: setScoreB },
            ].map((team) => {
              const isMe = mySide === team.side;
              return (
                <div
                  key={team.side}
                  className={`flex items-center justify-between gap-2 rounded-xl px-3 py-2 border ${
                    isMe
                      ? 'bg-[#d7f24c]/10 border-[#d7f24c]/35'
                      : 'bg-slate-900/75 border-slate-800'
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`text-xs sm:text-sm font-bold truncate ${isMe ? 'text-[#d7f24c]' : 'text-slate-100'}`}>
                      {team.name}
                    </span>
                    {isMe && (
                      <span className="text-[9px] font-black uppercase bg-[#d7f24c] text-slate-950 px-1.5 py-0.5 rounded shrink-0">
                        You
                      </span>
                    )}
                  </div>
                  <input
                    type="number"
                    min={0}
                    max={99}
                    aria-label={`${team.name} score`}
                    value={team.value}
                    onChange={(e) => team.onChange(e.target.value)}
                    placeholder="0"
                    className="w-16 h-9 bg-slate-950 border border-slate-700 rounded-lg px-2 text-center text-sm font-mono font-bold text-white focus:outline-none focus:ring-2 focus:ring-[#d7f24c] shrink-0"
                  />
                </div>
              );
            })}
          </div>
          <div className="flex items-center justify-between gap-2 flex-wrap pt-0.5">
            {errorMsg ? (
              <span className="text-[11px] text-rose-400 flex items-center gap-1">
                <ShieldAlert size={12} /> {errorMsg}
              </span>
            ) : (
              <span className="text-[10px] text-slate-500">Enter score next to each team</span>
            )}
            <button
              type="submit"
              className="ml-auto py-2 px-4 rounded-xl bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 text-xs font-black flex items-center gap-1.5 transition active:scale-95"
            >
              <Send size={12} /> Submit Score
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

export function PlayerPortalBanner({
  loggedInPlayerName,
  onOpenPlayerLogin,
  tournamentStyle,
  poolTournament,
  bracket,
  teams = [],
  playersById = {},
  notifPermission = 'default',
  onRequestNotifPermission,
  onSubmitPoolPendingScore,
  onApprovePoolPendingScore,
  onRejectPoolPendingScore,
  onSubmitMlpPendingScore,
  onApproveMlpPendingScore,
  onRejectMlpPendingScore,
  activePlayerTab = 'current',
  onChangePlayerTab,
}) {
  const [alertBanner, setAlertBanner] = useState(null);
  const seenAlertsRef = useRef(new Set());

  const targetLower = normalizeName(loggedInPlayerName);
  const myPoolMatches = [];
  const myMlpGames = [];

  if (targetLower && tournamentStyle === 'tournament' && poolTournament) {
    const entryMap = new Map((poolTournament.entries || []).map((e) => [e.id, e]));
    const entryHasPlayer = (entry) => {
      if (!entry) return false;
      if (Array.isArray(entry.players) && entry.players.some((p) => normalizeName(p) === targetLower)) {
        return true;
      }
      return normalizeName(entry.name) === targetLower;
    };

    (poolTournament.pools || []).forEach((pool) => {
      (pool.matches || []).forEach((m) => {
        if (m.saved || !m.entryAId || !m.entryBId) return;
        const eA = entryMap.get(m.entryAId);
        const eB = entryMap.get(m.entryBId);
        const inA = entryHasPlayer(eA);
        const inB = entryHasPlayer(eB);
        if (!inA && !inB) return;
        const roundNum = Number(m.round) || 1;
        myPoolMatches.push({
          key: `pool:${pool.id}:${m.id}`,
          type: 'pool',
          poolId: pool.id,
          match: m,
          mySide: inA ? 'A' : 'B',
          stage: `${pool.name} • Round ${roundNum}`,
          roundLabel: `Round ${roundNum}`,
          roundSortOrder: roundNum,
          nameA: getEntryDisplayName(eA),
          nameB: getEntryDisplayName(eB),
          format: getEffectiveMatchFormat(poolTournament, m, { isKnockout: false }),
        });
      });
    });

    const ko = poolTournament.knockout;
    if (ko?.rounds) {
      const totalR = ko.rounds.length;
      ko.rounds.forEach((round, rIdx) => {
        const rLabel = getKnockoutRoundLabel(totalR, rIdx);
        round.forEach((m, mIdx) => {
          if (m.isBye || m.saved || !m.entryAId || !m.entryBId) return;
          const eA = entryMap.get(m.entryAId);
          const eB = entryMap.get(m.entryBId);
          const inA = entryHasPlayer(eA);
          const inB = entryHasPlayer(eB);
          if (!inA && !inB) return;
          myPoolMatches.push({
            key: `ko:${rIdx}:${mIdx}`,
            type: 'knockout',
            roundIdx: rIdx,
            matchIdx: mIdx,
            isBronze: false,
            match: m,
            mySide: inA ? 'A' : 'B',
            stage: rLabel,
            roundLabel: rLabel,
            roundSortOrder: 1000 + rIdx,
            nameA: getEntryDisplayName(eA),
            nameB: getEntryDisplayName(eB),
            format: getEffectiveMatchFormat(poolTournament, m, {
              isKnockout: true,
              totalRounds: totalR,
              roundIdx: rIdx,
              isBronze: false,
            }),
          });
        });
      });
    }

    if (ko?.bronzeMatch && !ko.bronzeMatch.saved && ko.bronzeMatch.entryAId && ko.bronzeMatch.entryBId) {
      const bm = ko.bronzeMatch;
      const eA = entryMap.get(bm.entryAId);
      const eB = entryMap.get(bm.entryBId);
      const inA = entryHasPlayer(eA);
      const inB = entryHasPlayer(eB);
      if (inA || inB) {
        const totalR = ko.rounds?.length || 1;
        myPoolMatches.push({
          key: 'ko:bronze',
          type: 'knockout',
          roundIdx: 0,
          matchIdx: 0,
          isBronze: true,
          match: bm,
          mySide: inA ? 'A' : 'B',
          stage: 'Bronze Medal',
          roundLabel: 'Bronze Medal',
          roundSortOrder: 2000,
          nameA: getEntryDisplayName(eA),
          nameB: getEntryDisplayName(eB),
          format: getEffectiveMatchFormat(poolTournament, bm, {
            isKnockout: true,
            totalRounds: totalR,
            roundIdx: totalR - 1,
            isBronze: true,
          }),
        });
      }
    }
  } else if (targetLower && bracket?.rounds) {
    const teamMap = new Map((teams || []).map((t) => [t.id, t.name]));
    const getPlayerName = (id) => {
      const val = playersById[id];
      if (typeof val === 'string' && val.trim()) return val;
      if (val && typeof val === 'object' && val.name) return val.name;
      return `Player ${id}`;
    };
    const sideHasPlayer = (ids) =>
      (ids || []).some((id) => normalizeName(getPlayerName(id)) === targetLower);

    bracket.rounds.forEach((round, rIdx) => {
      round.forEach((m, mIdx) => {
        if (m.isBye || m.status === 'complete' || !m.games) return;
        const matchLabel = `${m.matchNumber ? `#${m.matchNumber} ` : ''}${teamMap.get(m.teamAId) || 'Team A'} vs ${teamMap.get(m.teamBId) || 'Team B'}`;
        m.games.forEach((g, gIdx) => {
          if (g.saved) return;
          const inA = sideHasPlayer(g.pairA);
          const inB = sideHasPlayer(g.pairB);
          if (!inA && !inB) return;
          myMlpGames.push({
            key: `mlp:${rIdx}:${mIdx}:${g.id}`,
            round: rIdx,
            idx: mIdx,
            game: g,
            gameIndex: gIdx,
            mySide: inA ? 'A' : 'B',
            matchLabel,
            roundLabel: `Round ${rIdx + 1}`,
            roundSortOrder: rIdx + 1,
            namesA: (g.pairA || []).map(getPlayerName).join(' & '),
            namesB: (g.pairB || []).map(getPlayerName).join(' & '),
          });
        });
      });
    });
  }

  // Trigger in-app + browser Notification when a player's match goes LIVE or needs their approval
  useEffect(() => {
    if (!targetLower) return;
    const items = tournamentStyle === 'tournament' ? myPoolMatches : myMlpGames;
    items.forEach((item) => {
      const obj = item.match || item.game;
      const isLive = Boolean(obj?.inProgress && !obj?.saved);
      const needsApproval = Boolean(obj?.pendingScore && obj.pendingScore.submittedBySide !== item.mySide);

      if (isLive) {
        const alertId = `live:${item.key}:${obj.court || 'nc'}`;
        if (!seenAlertsRef.current.has(alertId)) {
          seenAlertsRef.current.add(alertId);
          const title = obj.court
            ? `Court ${obj.court}: Your match is LIVE!`
            : 'Your match is LIVE!';
          const body =
            tournamentStyle === 'tournament'
              ? `${item.stage}: ${item.nameA} vs ${item.nameB}`
              : `${item.matchLabel} • Game ${item.gameIndex + 1}`;
          setAlertBanner({ title, body, type: 'live' });
          playNotificationChime();
          navigator.vibrate?.([200, 100, 200]);
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(title, { body, tag: alertId });
            } catch (e) {
              // ignore mobile Notification constructor error
            }
          }
        }
      }

      if (needsApproval) {
        const alertId = `approve:${item.key}:${obj.pendingScore.submittedAt}`;
        if (!seenAlertsRef.current.has(alertId)) {
          seenAlertsRef.current.add(alertId);
          const title = 'Score Approval Needed';
          const body = `${obj.pendingScore.submittedByName} submitted a score for your match. Tap to approve.`;
          setAlertBanner({ title, body, type: 'approval' });
          playNotificationChime();
          if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
            try {
              new Notification(title, { body, tag: alertId });
            } catch (e) {
              // ignore
            }
          }
        }
      }
    });
  }, [loggedInPlayerName, tournamentStyle, poolTournament, bracket]);

  if (!loggedInPlayerName) return null;

  const isTournament = tournamentStyle === 'tournament';
  const hasPools = Boolean(
    isTournament &&
      poolTournament?.pools &&
      poolTournament.pools.length > 0 &&
      poolTournament?.structure !== 'knockout_only'
  );
  const allItems = isTournament ? myPoolMatches : myMlpGames;

  const isFeaturedItem = (item) => {
    const obj = item.match || item.game;
    const isLive = Boolean(obj?.inProgress && !obj?.saved);
    const hasPending = Boolean(obj?.pendingScore);
    return isLive || hasPending;
  };

  const featuredItems = allItems.filter(isFeaturedItem);
  const upcomingItems = allItems.filter((item) => !isFeaturedItem(item));

  const resolvedTab = activePlayerTab === 'pools' && !hasPools ? 'knockout' : activePlayerTab;

  const tabs = [
    {
      id: 'current',
      label: 'Current',
      count: featuredItems.length,
      icon: Flame,
      isLive: featuredItems.length > 0,
    },
    {
      id: 'upcoming',
      label: 'Upcoming',
      count: upcomingItems.length,
      icon: Clock,
    },
    ...(hasPools ? [{ id: 'pools', label: 'Pools', icon: Swords }] : []),
    {
      id: 'knockout',
      label: 'Knockout',
      icon: Trophy,
    },
  ];

  const renderItemCard = (item) =>
    isTournament ? (
      <PoolMatchSelfScoreRow
        key={item.key}
        item={item}
        playerName={loggedInPlayerName}
        onSubmitPending={onSubmitPoolPendingScore}
        onApprovePending={onApprovePoolPendingScore}
        onRejectPending={onRejectPoolPendingScore}
      />
    ) : (
      <MlpGameSelfScoreRow
        key={item.key}
        item={item}
        playerName={loggedInPlayerName}
        onSubmitPending={onSubmitMlpPendingScore}
        onApprovePending={onApproveMlpPendingScore}
        onRejectPending={onRejectMlpPendingScore}
      />
    );

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4">
      <div className="bg-slate-900/95 border border-emerald-500/35 rounded-3xl p-4 shadow-xl space-y-3">
        {/* Header Bar */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className="inline-flex items-center gap-1.5 text-xs font-black bg-emerald-500/15 text-emerald-300 border border-emerald-500/30 px-2.5 py-1 rounded-full">
              <UserCheck size={13} /> Player: {loggedInPlayerName}
            </span>
          </div>

          <div className="flex items-center gap-1.5 flex-wrap">
            {typeof Notification !== 'undefined' && notifPermission !== 'granted' && notifPermission !== 'denied' && (
              <button
                type="button"
                onClick={onRequestNotifPermission}
                className="px-2.5 py-1 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 text-[11px] font-black flex items-center gap-1 transition"
              >
                <Bell size={12} /> Enable Alerts
              </button>
            )}
            {typeof Notification !== 'undefined' && notifPermission === 'granted' && (
              <span className="text-[10px] font-bold text-emerald-300 bg-emerald-500/10 border border-emerald-500/25 px-2 py-1 rounded-xl flex items-center gap-1">
                <BellRing size={11} /> Alerts On
              </span>
            )}
          </div>
        </div>

        {/* Live In-App Alert Toast */}
        {alertBanner && (
          <div className="bg-amber-400/15 border border-amber-400/50 rounded-2xl px-3 py-2 flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 min-w-0">
              <BellRing size={15} className="text-amber-300 shrink-0 animate-bounce" />
              <div className="text-xs min-w-0">
                <strong className="text-amber-200">{alertBanner.title}</strong>{' '}
                <span className="text-slate-200">{alertBanner.body}</span>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setAlertBanner(null)}
              className="p-1 text-slate-400 hover:text-white"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {/* Player View Tabs */}
        <div className="flex items-center gap-1 bg-slate-950/80 border border-slate-800 rounded-2xl p-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = resolvedTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangePlayerTab?.(tab.id)}
                className={`flex-1 py-2 px-1.5 sm:px-3 rounded-xl text-[11px] sm:text-xs font-bold transition flex items-center justify-center gap-1 sm:gap-1.5 whitespace-nowrap ${
                  isActive
                    ? tab.id === 'current' && tab.isLive
                      ? 'bg-amber-400 text-slate-950 shadow-md'
                      : 'bg-[#d7f24c] text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {tab.isLive && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0 hidden xs:inline-block" />
                )}
                <Icon size={12} className="shrink-0 hidden sm:inline" />
                <span>{tab.label}</span>
                {typeof tab.count === 'number' && tab.count > 0 && (
                  <span
                    className={`px-1.5 py-0.2 rounded-full text-[10px] font-black font-mono ${
                      isActive
                        ? 'bg-slate-950/20 text-slate-950'
                        : tab.isLive
                          ? 'bg-amber-400/20 text-amber-300'
                          : 'bg-slate-800 text-slate-300'
                    }`}
                  >
                    {tab.count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Tab Body for Current Match & Upcoming Matches */}
        {resolvedTab === 'current' && (
          featuredItems.length === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-center space-y-2">
              <p className="text-xs text-slate-400">
                No live match on court right now for <strong className="text-slate-200">{loggedInPlayerName}</strong>.
              </p>
              {upcomingItems.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChangePlayerTab?.('upcoming')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[#d7f24c] text-xs font-bold border border-slate-700 transition"
                >
                  <Clock size={12} /> View Upcoming Matches ({upcomingItems.length})
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-[11px] font-black uppercase tracking-wider text-amber-300">
                <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping" />
                <span>Live Match — Enter or Approve Score</span>
              </div>
              <div
                className={`grid grid-cols-1 ${
                  featuredItems.length > 1 ? 'md:grid-cols-2' : ''
                } gap-3`}
              >
                {featuredItems.map(renderItemCard)}
              </div>
            </div>
          )
        )}

        {resolvedTab === 'upcoming' && (
          upcomingItems.length === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-xs text-slate-400 italic">
                No upcoming matches queued right now for <strong className="text-slate-200">{loggedInPlayerName}</strong>.
              </p>
            </div>
          ) : (() => {
            const roundGroups = new Map();
            upcomingItems.forEach((item) => {
              const label = item.roundLabel || 'Upcoming';
              const order = item.roundSortOrder ?? 9999;
              if (!roundGroups.has(label)) {
                roundGroups.set(label, { label, order, items: [] });
              }
              roundGroups.get(label).items.push(item);
            });
            const sortedGroups = Array.from(roundGroups.values()).sort((a, b) => a.order - b.order);

            return (
              <div className="space-y-4">
                {sortedGroups.map((group) => (
                  <div key={group.label} className="space-y-2">
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-black uppercase tracking-wider text-[#d7f24c] bg-[#d7f24c]/10 border border-[#d7f24c]/25 px-2.5 py-0.5 rounded-full">
                        {group.label}
                      </span>
                      <span className="text-[10px] font-mono text-slate-500">
                        {group.items.length} {group.items.length === 1 ? 'match' : 'matches'}
                      </span>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {group.items.map(renderItemCard)}
                    </div>
                  </div>
                ))}
              </div>
            );
          })()
        )}
      </div>
    </div>
  );
}

