import React, { useState } from 'react';
import { Trophy, User, Users, Download } from 'lucide-react';
import { generateLeaderboardCSV, generateMatchScoresCSV, triggerCsvDownload } from '../utils/tournament';

export function LeaderboardView({
  globalStats = {},
  partnershipStats = {},
  bracket = null,
  teams = [],
  playersById = {},
  roomId = '',
}) {
  const [tab, setTab] = useState('players');

  const playerRows = Object.values(globalStats || {}).sort((a, b) => {
    const wrA = a.matchesPlayed ? a.wins / a.matchesPlayed : 0;
    const wrB = b.matchesPlayed ? b.wins / b.matchesPlayed : 0;
    return wrB - wrA || b.wins - a.wins;
  });

  const pairRows = Object.values(partnershipStats || {}).sort((a, b) => {
    return (b.pointDiff - a.pointDiff) || (b.wins - a.wins) || (b.gamesPlayed - a.gamesPlayed);
  });

  function handleExportLeaderboardCsv() {
    const csv = generateLeaderboardCSV({ globalStats, partnershipStats, roomId });
    triggerCsvDownload(`${roomId || 'room'}-leaderboard-stats.csv`, csv);
  }

  function handleExportMatchScoresCsv() {
    const csv = generateMatchScoresCSV({ bracket, teams, playersById, roomId });
    triggerCsvDownload(`${roomId || 'room'}-match-scores.csv`, csv);
  }

  const hasStats = playerRows.length > 0 || pairRows.length > 0;
  const hasMatchGames = Boolean(
    bracket?.rounds?.some((r) => r.some((m) => Array.isArray(m.games) && m.games.length > 0))
  );

  return (
    <div className="max-w-4xl mx-auto px-4 py-6 pb-24 animate-in fade-in duration-200">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-2">
        <div>
          <h2 className="text-white text-3xl font-display uppercase tracking-wide font-semibold flex items-center gap-2">
            <Trophy size={24} className="text-amber-400" /> Room Leaderboard
          </h2>
          <p className="text-slate-500 text-sm text-balance">
            Isolated stats & partnership records for room <span className="font-mono text-slate-300 font-bold">{roomId}</span>.
          </p>
        </div>

        {(hasStats || hasMatchGames) && (
          <div className="flex items-center gap-2 flex-wrap">
            {hasStats && (
              <button
                type="button"
                onClick={handleExportLeaderboardCsv}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-[#d7f24c] text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                title="Export individual & partnership leaderboard stats as CSV"
              >
                <Download size={14} />
                <span>Export Leaderboard CSV</span>
              </button>
            )}
            {hasMatchGames && (
              <button
                type="button"
                onClick={handleExportMatchScoresCsv}
                className="px-3 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 hover:text-white text-xs font-bold flex items-center gap-1.5 transition active:scale-95 shadow-sm"
                title="Export all regulation & Dreambreaker game scores as CSV"
              >
                <Download size={14} className="text-[#d7f24c]" />
                <span>Export Match Scores CSV</span>
              </button>
            )}
          </div>
        )}
      </div>

      {/* Segmented Tab Switcher */}
      <div className="flex bg-slate-900 border border-slate-800 rounded-2xl p-1 mb-6 max-w-xs shadow-lg">
        <button
          onClick={() => setTab('players')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            tab === 'players' ? 'bg-[#d7f24c] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <User size={14} /> Individual
        </button>
        <button
          onClick={() => setTab('partnerships')}
          className={`flex-1 py-2 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
            tab === 'partnerships' ? 'bg-[#d7f24c] text-slate-950 shadow-md' : 'text-slate-400 hover:text-white'
          }`}
        >
          <Users size={14} /> Partnerships
        </button>
      </div>

      {tab === 'players' && (
        <>
          {playerRows.length === 0 ? (
            <p className="text-slate-600 italic py-6">No completed matches yet. Stats appear here once a match finishes.</p>
          ) : (
            <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-800">
                    <th className="text-left py-3.5 px-4">Player</th>
                    <th className="text-right py-3.5 px-3">MP</th>
                    <th className="text-right py-3.5 px-3">Win %</th>
                    <th className="text-right py-3.5 px-3">Pts Won</th>
                    <th className="text-right py-3.5 px-3">Pts Lost</th>
                    <th className="text-right py-3.5 px-4">DB +/-</th>
                  </tr>
                </thead>
                <tbody>
                  {playerRows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-850/50 transition">
                      <td className="py-3.5 px-4 text-white font-semibold flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-center">
                          {i + 1}
                        </span>
                        {r.name}
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono tabular-nums">{r.matchesPlayed}</td>
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono tabular-nums">
                        {r.matchesPlayed ? Math.round((r.wins / r.matchesPlayed) * 100) : 0}%
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono tabular-nums">{r.pointsWon}</td>
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono tabular-nums">{r.pointsLost}</td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-bold tabular-nums ${
                          r.dreambreakerDiff > 0 ? 'text-[#d7f24c]' : r.dreambreakerDiff < 0 ? 'text-red-400' : 'text-slate-400'
                        }`}
                      >
                        {r.dreambreakerDiff > 0 ? '+' : ''}
                        {r.dreambreakerDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}

      {tab === 'partnerships' && (
        <>
          {pairRows.length === 0 ? (
            <p className="text-slate-600 italic py-6">
              No completed partnership games yet. Stats appear here as regulation doubles games are saved.
            </p>
          ) : (
            <div className="overflow-x-auto bg-slate-900 border border-slate-800 rounded-3xl shadow-xl">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-slate-500 text-xs uppercase tracking-wider border-b border-slate-800">
                    <th className="text-left py-3.5 px-4">Partnership</th>
                    <th className="text-right py-3.5 px-3">GP</th>
                    <th className="text-right py-3.5 px-3">W - L</th>
                    <th className="text-right py-3.5 px-3">Win %</th>
                    <th className="text-right py-3.5 px-3">Pts Won</th>
                    <th className="text-right py-3.5 px-3">Pts Lost</th>
                    <th className="text-right py-3.5 px-4">Diff (+/-)</th>
                  </tr>
                </thead>
                <tbody>
                  {pairRows.map((r, i) => (
                    <tr key={i} className="border-b border-slate-800/60 last:border-0 hover:bg-slate-850/50 transition">
                      <td className="py-3.5 px-4 text-white font-semibold flex items-center gap-2">
                        <span className="w-5 h-5 rounded-full bg-slate-800 text-[10px] font-mono text-slate-400 flex items-center justify-center">
                          {i + 1}
                        </span>
                        {r.name}
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono tabular-nums">{r.gamesPlayed}</td>
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono tabular-nums">
                        {r.wins} - {r.losses}
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono tabular-nums">
                        {r.gamesPlayed ? Math.round((r.wins / r.gamesPlayed) * 100) : 0}%
                      </td>
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono tabular-nums">{r.pointsWon}</td>
                      <td className="py-3.5 px-3 text-right text-slate-300 font-mono tabular-nums">{r.pointsLost}</td>
                      <td
                        className={`py-3.5 px-4 text-right font-mono font-extrabold tabular-nums ${
                          r.pointDiff > 0 ? 'text-[#d7f24c]' : r.pointDiff < 0 ? 'text-red-400' : 'text-slate-400'
                        }`}
                      >
                        {r.pointDiff > 0 ? '+' : ''}
                        {r.pointDiff}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}
