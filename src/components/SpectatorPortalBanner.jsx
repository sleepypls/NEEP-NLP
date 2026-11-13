import React from 'react';
import { Eye, Flame, Clock, Swords, Trophy } from 'lucide-react';
import { LiveTimer } from './LiveTimer';
import {
  getEntryDisplayName,
  getKnockoutRoundLabel,
  getEffectiveMatchFormat,
} from '../utils/poolTournament';

function SpectatorMatchCard({ item }) {
  const { isLive, court, stage, subtitle, nameA, nameB, liveStartedAt, formatText } = item;

  return (
    <div
      className={`rounded-2xl p-3.5 border space-y-2.5 transition ${
        isLive
          ? 'bg-gradient-to-br from-amber-500/15 via-slate-950 to-slate-950 border-2 border-amber-400/75 shadow-lg shadow-amber-500/10'
          : 'bg-slate-950/75 border-slate-800'
      }`}
    >
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 flex-wrap">
          {isLive && (
            <span className="text-[10px] font-black bg-amber-400 text-slate-950 px-2.5 py-0.5 rounded-full inline-flex items-center gap-1.5 shadow-sm">
              <span className="w-1.5 h-1.5 rounded-full bg-slate-950 animate-ping" />
              <Flame size={11} /> LIVE NOW
              {liveStartedAt && (
                <LiveTimer
                  startedAt={liveStartedAt}
                  className="text-[10px] text-slate-950 font-black"
                />
              )}
            </span>
          )}
          {court && (
            <span className="text-[11px] font-mono font-black bg-[#d7f24c] text-slate-950 px-2.5 py-0.5 rounded-full">
              Court {court}
            </span>
          )}
          <span className="text-[11px] font-bold text-slate-300">{stage}</span>
        </div>
        {formatText && (
          <span className="text-[10px] font-mono text-slate-400">{formatText}</span>
        )}
      </div>

      {subtitle && (
        <div className="text-[11px] text-slate-400 font-semibold">{subtitle}</div>
      )}

      <div className="space-y-1.5">
        <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 bg-slate-900/80 border border-slate-800">
          <span className="text-xs sm:text-sm font-bold text-white truncate">{nameA}</span>
        </div>
        <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 bg-slate-900/80 border border-slate-800">
          <span className="text-xs sm:text-sm font-bold text-slate-200 truncate">{nameB}</span>
        </div>
      </div>
    </div>
  );
}

export function SpectatorPortalBanner({
  tournamentStyle,
  poolTournament,
  bracket,
  teams = [],
  playersById = {},
  activeTab = 'current',
  onChangeTab,
}) {
  const isTournament = tournamentStyle === 'tournament';
  const hasPools = Boolean(
    isTournament &&
      poolTournament?.pools &&
      poolTournament.pools.length > 0 &&
      poolTournament?.structure !== 'knockout_only'
  );

  const allMatches = [];

  if (isTournament && poolTournament) {
    const entryMap = new Map((poolTournament.entries || []).map((e) => [e.id, e]));

    (poolTournament.pools || []).forEach((pool) => {
      (pool.matches || []).forEach((m) => {
        if (m.saved || !m.entryAId || !m.entryBId) return;
        const fmt = getEffectiveMatchFormat(poolTournament, m, { isKnockout: false });
        const bestOf = fmt?.bestOf || 1;
        allMatches.push({
          key: `pool:${pool.id}:${m.id}`,
          isLive: Boolean(m.inProgress && !m.saved),
          court: m.court || null,
          stage: `${pool.name} • Round ${m.round || 1}`,
          nameA: getEntryDisplayName(entryMap.get(m.entryAId)),
          nameB: getEntryDisplayName(entryMap.get(m.entryBId)),
          liveStartedAt: m.liveStartedAt || null,
          formatText: `${bestOf > 1 ? `Best of ${bestOf}` : '1 Game'} to ${fmt?.pointsTo || 11}`,
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
          const fmt = getEffectiveMatchFormat(poolTournament, m, {
            isKnockout: true,
            totalRounds: totalR,
            roundIdx: rIdx,
            isBronze: false,
          });
          const bestOf = fmt?.bestOf || 1;
          allMatches.push({
            key: `ko:${rIdx}:${mIdx}`,
            isLive: Boolean(m.inProgress && !m.saved),
            court: m.court || null,
            stage: rLabel,
            nameA: getEntryDisplayName(entryMap.get(m.entryAId)),
            nameB: getEntryDisplayName(entryMap.get(m.entryBId)),
            liveStartedAt: m.liveStartedAt || null,
            formatText: `${bestOf > 1 ? `Best of ${bestOf}` : '1 Game'} to ${fmt?.pointsTo || 11}`,
          });
        });
      });
    }

    if (ko?.bronzeMatch && !ko.bronzeMatch.saved && ko.bronzeMatch.entryAId && ko.bronzeMatch.entryBId) {
      const bm = ko.bronzeMatch;
      const totalR = ko.rounds?.length || 1;
      const fmt = getEffectiveMatchFormat(poolTournament, bm, {
        isKnockout: true,
        totalRounds: totalR,
        roundIdx: totalR - 1,
        isBronze: true,
      });
      const bestOf = fmt?.bestOf || 1;
      allMatches.push({
        key: 'ko:bronze',
        isLive: Boolean(bm.inProgress && !bm.saved),
        court: bm.court || null,
        stage: 'Bronze Medal',
        nameA: getEntryDisplayName(entryMap.get(bm.entryAId)),
        nameB: getEntryDisplayName(entryMap.get(bm.entryBId)),
        liveStartedAt: bm.liveStartedAt || null,
        formatText: `${bestOf > 1 ? `Best of ${bestOf}` : '1 Game'} to ${fmt?.pointsTo || 11}`,
      });
    }
  } else if (bracket?.rounds) {
    const teamMap = new Map((teams || []).map((t) => [t.id, t.name]));
    const getPlayerName = (id) => {
      const val = playersById[id];
      if (typeof val === 'string' && val.trim()) return val;
      if (val && typeof val === 'object' && val.name) return val.name;
      return `Player ${id}`;
    };

    bracket.rounds.forEach((round, rIdx) => {
      round.forEach((m, mIdx) => {
        if (m.isBye || m.status === 'complete' || !m.games) return;
        const matchLabel = `${m.matchNumber ? `#${m.matchNumber} ` : ''}${teamMap.get(m.teamAId) || 'Team A'} vs ${teamMap.get(m.teamBId) || 'Team B'}`;
        m.games.forEach((g, gIdx) => {
          if (g.saved) return;
          allMatches.push({
            key: `mlp:${rIdx}:${mIdx}:${g.id}`,
            isLive: Boolean(g.inProgress && !g.saved),
            court: g.court || null,
            stage: `${matchLabel} • Game ${gIdx + 1}`,
            nameA: (g.pairA || []).map(getPlayerName).join(' & '),
            nameB: (g.pairB || []).map(getPlayerName).join(' & '),
            liveStartedAt: g.liveStartedAt || null,
            formatText: g.label || '',
          });
        });
      });
    });
  }

  const currentMatches = allMatches
    .filter((m) => m.isLive)
    .sort((a, b) => (a.court || 999) - (b.court || 999));
  const upcomingMatches = allMatches.filter((m) => !m.isLive);

  const resolvedTab = activeTab === 'pools' && !hasPools ? 'knockout' : activeTab;

  const tabs = [
    {
      id: 'current',
      label: 'Current Matches',
      count: currentMatches.length,
      icon: Flame,
      isLive: currentMatches.length > 0,
    },
    {
      id: 'upcoming',
      label: 'Upcoming Matches',
      count: upcomingMatches.length,
      icon: Clock,
    },
    ...(hasPools ? [{ id: 'pools', label: 'Pools', icon: Swords }] : []),
    {
      id: 'knockout',
      label: 'Knockout Bracket',
      icon: Trophy,
    },
  ];

  return (
    <div className="max-w-6xl mx-auto px-4 pt-4">
      <div className="bg-slate-900/95 border border-slate-800 rounded-3xl p-4 shadow-xl space-y-3">
        {/* Header */}
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <span className="inline-flex items-center gap-1.5 text-xs font-black bg-slate-800 text-slate-200 border border-slate-700 px-2.5 py-1 rounded-full">
            <Eye size={13} className="text-[#d7f24c]" /> Spectator View
          </span>
          <span className="text-xs font-bold text-slate-400">
            {currentMatches.length} live &bull; {upcomingMatches.length} upcoming
          </span>
        </div>

        {/* Tabs */}
        <div className="grid grid-cols-2 sm:flex bg-slate-950/80 border border-slate-800 rounded-2xl p-1 gap-1">
          {tabs.map((tab) => {
            const Icon = tab.icon;
            const isActive = resolvedTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => onChangeTab?.(tab.id)}
                className={`sm:flex-1 py-2 px-2.5 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 whitespace-nowrap ${
                  isActive
                    ? tab.id === 'current' && tab.isLive
                      ? 'bg-amber-400 text-slate-950 shadow-md'
                      : 'bg-[#d7f24c] text-slate-950 shadow-md'
                    : 'text-slate-400 hover:text-white hover:bg-slate-900'
                }`}
              >
                {tab.isLive && !isActive && (
                  <span className="w-1.5 h-1.5 rounded-full bg-amber-400 animate-ping shrink-0" />
                )}
                <Icon size={13} className="shrink-0" />
                <span className="truncate">{tab.label}</span>
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

        {/* Tab Body for Current & Upcoming Matches */}
        {resolvedTab === 'current' && (
          currentMatches.length === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-center space-y-2">
              <p className="text-xs text-slate-400">
                No matches are currently live on court.
              </p>
              {upcomingMatches.length > 0 && (
                <button
                  type="button"
                  onClick={() => onChangeTab?.('upcoming')}
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-[#d7f24c] text-xs font-bold border border-slate-700 transition"
                >
                  <Clock size={12} /> View Upcoming Matches ({upcomingMatches.length})
                </button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {currentMatches.map((item) => (
                <SpectatorMatchCard key={item.key} item={item} />
              ))}
            </div>
          )
        )}

        {resolvedTab === 'upcoming' && (
          upcomingMatches.length === 0 ? (
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-4 text-center">
              <p className="text-xs text-slate-400 italic">
                No upcoming matches queued right now.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              {upcomingMatches.map((item) => (
                <SpectatorMatchCard key={item.key} item={item} />
              ))}
            </div>
          )
        )}
      </div>
    </div>
  );
}
