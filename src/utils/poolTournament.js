// Pool Play + Knockout Tournament Engine (PickleballTournaments.com style)

export function escapeCsvCell(val) {
  const str = String(val ?? '');
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function getEntryDisplayName(entry) {
  if (!entry) return 'TBD';
  if (entry.name) return entry.name;
  if (Array.isArray(entry.players) && entry.players.length > 0) {
    return entry.players.filter(Boolean).join(' / ');
  }
  return `Entry ${entry.id}`;
}

export const KNOCKOUT_ROUND_KEYS = [
  { key: 'r32', label: 'Round of 32' },
  { key: 'r16', label: 'Round of 16' },
  { key: 'quarters', label: 'Quarterfinals' },
  { key: 'semis', label: 'Semifinals' },
  { key: 'final', label: 'Gold Medal Final' },
  { key: 'bronze', label: 'Bronze Medal Match' },
];

export function getKnockoutRoundKey(totalRounds, roundIdx, isBronze = false) {
  if (isBronze) return 'bronze';
  const remaining = totalRounds - roundIdx;
  if (remaining === 1) return 'final';
  if (remaining === 2) return 'semis';
  if (remaining === 3) return 'quarters';
  if (remaining === 4) return 'r16';
  return 'r32';
}

export function getEffectiveMatchFormat(
  tournament,
  match,
  { isKnockout = false, totalRounds = 1, roundIdx = 0, isBronze = false } = {}
) {
  if (match && match.customFormat && match.customFormat.bestOf) {
    return {
      bestOf: Number(match.customFormat.bestOf) || 1,
      pointsTo: Number(match.customFormat.pointsTo) || 11,
      isCustom: true,
    };
  }

  const koFmt = tournament?.knockoutFormat || { bestOf: 3, pointsTo: 11 };
  if (isKnockout) {
    if (koFmt.useRoundFormats && koFmt.roundFormats) {
      const roundKey = getKnockoutRoundKey(totalRounds, roundIdx, isBronze);
      const rf = koFmt.roundFormats[roundKey];
      if (rf && rf.bestOf) {
        return {
          bestOf: Number(rf.bestOf) || 1,
          pointsTo: Number(rf.pointsTo) || Number(koFmt.pointsTo) || 11,
          isCustom: false,
          isRoundSpecific: true,
        };
      }
    }
    return {
      bestOf: Number(koFmt.bestOf) || 3,
      pointsTo: Number(koFmt.pointsTo) || 11,
      isCustom: false,
    };
  }

  const poolFmt = tournament?.poolFormat || { bestOf: 1, pointsTo: 15 };
  return {
    bestOf: Number(poolFmt.bestOf) || 1,
    pointsTo: Number(poolFmt.pointsTo) || 11,
    isCustom: false,
  };
}

/**
 * Generates either:
 * - Pool Play + Seeded Knockout (`structure === 'pools_knockout'`)
 * - Direct Single-Elimination Knockout (`structure === 'knockout_only'`)
 */
export function generatePoolsAndSchedule({
  entries = [],
  discipline = 'doubles',
  structure = 'pools_knockout',
  numPools = 2,
  poolFormat = { bestOf: 1, pointsTo: 15, winByTwo: true },
  knockoutFormat = { bestOf: 3, pointsTo: 11, winByTwo: true },
  advancePerPool = 2,
  knockoutFillMode = 'byes',
  targetBracketSize = 'auto',
  includeBronze = true,
  seedingMode = 'snake',
}) {
  const cleanEntries = entries.map((e, idx) => ({
    ...e,
    seed: e.seed || idx + 1,
  }));

  if (structure === 'knockout_only') {
    const knockout = generateDirectKnockoutTournament({
      entries: cleanEntries,
      knockoutFormat,
      includeBronze,
      seedingMode,
    });
    return {
      structure: 'knockout_only',
      discipline,
      entries: cleanEntries,
      pools: [],
      poolFormat,
      knockoutFormat,
      advancePerPool,
      knockoutFillMode,
      targetBracketSize,
      includeBronze,
      seedingMode,
      knockout,
      stage: 'knockout',
    };
  }

  const poolCount = Math.max(1, Math.min(numPools, Math.floor(cleanEntries.length / 2) || 1));
  const poolLetters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const pools = Array.from({ length: poolCount }, (_, i) => ({
    id: `pool-${poolLetters[i] || i + 1}`,
    name: `Pool ${poolLetters[i] || i + 1}`,
    entryIds: [],
    matches: [],
  }));

  const ordered =
    seedingMode === 'random'
      ? [...cleanEntries].sort(() => Math.random() - 0.5)
      : [...cleanEntries];

  // Serpentine (snake) distribution across pools: 0,1,2,2,1,0...
  ordered.forEach((entry, idx) => {
    const cycle = Math.floor(idx / poolCount);
    const posInCycle = idx % poolCount;
    const poolIdx = cycle % 2 === 0 ? posInCycle : poolCount - 1 - posInCycle;
    pools[poolIdx].entryIds.push(entry.id);
  });

  // Circle-method round-robin schedule for each pool
  pools.forEach((pool) => {
    const list = [...pool.entryIds];
    if (list.length < 2) return;
    if (list.length % 2 === 1) list.push(null); // bye placeholder

    const n = list.length;
    const totalRounds = n - 1;
    let matchCounter = 1;

    for (let r = 0; r < totalRounds; r++) {
      for (let i = 0; i < n / 2; i++) {
        const a = list[i];
        const b = list[n - 1 - i];
        if (a !== null && b !== null) {
          pool.matches.push({
            id: `${pool.id}-m${matchCounter++}`,
            poolId: pool.id,
            round: r + 1,
            entryAId: a,
            entryBId: b,
            games: createEmptyGames(poolFormat.bestOf),
            inProgress: false,
            saved: false,
            winnerId: null,
          });
        }
      }
      // Rotate all elements except index 0
      const last = list.pop();
      list.splice(1, 0, last);
    }
  });

  return {
    structure: 'pools_knockout',
    discipline,
    entries: cleanEntries,
    pools,
    poolFormat,
    knockoutFormat,
    advancePerPool,
    knockoutFillMode,
    targetBracketSize,
    includeBronze,
    seedingMode,
    knockout: null,
    stage: 'pools', // 'pools' | 'knockout' | 'complete'
  };
}

export function createEmptyGames(bestOf = 1) {
  const count = Math.max(1, Number(bestOf) || 1);
  return Array.from({ length: count }, (_, i) => ({
    gameNum: i + 1,
    scoreA: '',
    scoreB: '',
  }));
}

export function resizeGamesForBestOf(existingGames = [], bestOf = 1) {
  const count = Math.max(1, Number(bestOf) || 1);
  return Array.from({ length: count }, (_, i) => {
    const prev = existingGames[i];
    return {
      gameNum: i + 1,
      scoreA: prev && prev.scoreA !== undefined ? prev.scoreA : '',
      scoreB: prev && prev.scoreB !== undefined ? prev.scoreB : '',
    };
  });
}

/**
 * Evaluates a match's games array (Best of 1, 3, or 5) to determine match winner & totals.
 */
export function evaluatePoolOrKnockoutMatch(games = [], bestOf = 1) {
  let gamesWonA = 0;
  let gamesWonB = 0;
  let pointsA = 0;
  let pointsB = 0;
  let validGames = 0;

  for (const g of games) {
    const sA = g.scoreA === '' || g.scoreA === null || g.scoreA === undefined ? null : Number(g.scoreA);
    const sB = g.scoreB === '' || g.scoreB === null || g.scoreB === undefined ? null : Number(g.scoreB);
    if (sA === null || sB === null || Number.isNaN(sA) || Number.isNaN(sB)) continue;
    if (sA === 0 && sB === 0) continue;
    if (sA === sB) continue; // pickleball games cannot end in a tie

    validGames++;
    pointsA += sA;
    pointsB += sB;
    if (sA > sB) gamesWonA++;
    else gamesWonB++;
  }

  const neededToWin = Math.ceil((Number(bestOf) || 1) / 2);
  const isComplete = gamesWonA >= neededToWin || gamesWonB >= neededToWin;
  const winnerSide = isComplete ? (gamesWonA > gamesWonB ? 'A' : 'B') : null;

  return {
    validGames,
    gamesWonA,
    gamesWonB,
    pointsA,
    pointsB,
    isComplete,
    winnerSide,
  };
}

/**
 * Computes pool standings using PickleballTournaments.com tiebreaker hierarchy:
 * 1. Match Wins (W)
 * 2. Head-to-Head (for 2-way ties)
 * 3. Game Differential (GW - GL)
 * 4. Point Differential (PF - PA)
 * 5. Points For (PF)
 */
export function computePoolStandings(pool, entries = [], bestOf = 1) {
  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const statsMap = new Map();

  (pool.entryIds || []).forEach((eid) => {
    const entry = entryMap.get(eid);
    if (!entry) return;
    statsMap.set(eid, {
      entryId: eid,
      entry,
      name: getEntryDisplayName(entry),
      matchesPlayed: 0,
      wins: 0,
      losses: 0,
      gamesWon: 0,
      gamesLost: 0,
      gameDiff: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    });
  });

  const h2hWinners = new Map(); // "idA|idB" -> winnerId

  (pool.matches || []).forEach((m) => {
    if (!m.saved || !m.winnerId) return;
    const matchBestOf = m.customFormat?.bestOf || bestOf;
    const evalRes = evaluatePoolOrKnockoutMatch(m.games, matchBestOf);
    const sA = statsMap.get(m.entryAId);
    const sB = statsMap.get(m.entryBId);
    if (!sA || !sB) return;

    sA.matchesPlayed += 1;
    sB.matchesPlayed += 1;

    if (m.winnerId === m.entryAId) {
      sA.wins += 1;
      sB.losses += 1;
    } else {
      sB.wins += 1;
      sA.losses += 1;
    }

    sA.gamesWon += evalRes.gamesWonA;
    sA.gamesLost += evalRes.gamesWonB;
    sA.gameDiff = sA.gamesWon - sA.gamesLost;

    sB.gamesWon += evalRes.gamesWonB;
    sB.gamesLost += evalRes.gamesWonA;
    sB.gameDiff = sB.gamesWon - sB.gamesLost;

    sA.pointsFor += evalRes.pointsA;
    sA.pointsAgainst += evalRes.pointsB;
    sA.pointDiff = sA.pointsFor - sA.pointsAgainst;

    sB.pointsFor += evalRes.pointsB;
    sB.pointsAgainst += evalRes.pointsA;
    sB.pointDiff = sB.pointsFor - sB.pointsAgainst;

    const pairKey = [String(m.entryAId), String(m.entryBId)].sort().join('|');
    h2hWinners.set(pairKey, m.winnerId);
  });

  const rows = Array.from(statsMap.values()).map((r) => {
    const mp = r.matchesPlayed || 0;
    return {
      ...r,
      winPct: mp > 0 ? r.wins / mp : 0,
      gameDiffPerMatch: mp > 0 ? r.gameDiff / mp : 0,
      pointDiffPerMatch: mp > 0 ? r.pointDiff / mp : 0,
      pointsForPerMatch: mp > 0 ? r.pointsFor / mp : 0,
    };
  });
  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    // Head-to-head check
    const pairKey = [String(a.entryId), String(b.entryId)].sort().join('|');
    const h2hWinner = h2hWinners.get(pairKey);
    if (h2hWinner === a.entryId) return -1;
    if (h2hWinner === b.entryId) return 1;
    // Game differential
    if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
    // Point differential
    if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
    // Points for
    if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
    return (a.entry.seed || 999) - (b.entry.seed || 999);
  });

  return rows;
}

function buildSeededBracket({ qualifiers, knockoutFormat, includeBronze = true, forcedBracketSize = null }) {
  if (!qualifiers || qualifiers.length < 2) return null;

  let bracketSize = 2;
  while (bracketSize < qualifiers.length) bracketSize *= 2;
  if (forcedBracketSize && Number(forcedBracketSize) >= bracketSize) {
    bracketSize = Number(forcedBracketSize);
  }

  const seededSlots = Array.from({ length: bracketSize }, (_, i) => qualifiers[i] || null);
  const seedOrder = getBracketSeedOrder(bracketSize);

  const rounds = [];
  const totalRounds = Math.log2(bracketSize);

  // Pair Round 0 slots & avoid same-pool Round 1 rematches where possible
  const round0Pairs = [];
  for (let i = 0; i < bracketSize; i += 2) {
    round0Pairs.push({
      qA: seededSlots[seedOrder[i] - 1],
      qB: seededSlots[seedOrder[i + 1] - 1],
    });
  }
  for (let i = 0; i < round0Pairs.length; i++) {
    const p = round0Pairs[i];
    if (p.qA && p.qB && p.qA.poolId && p.qA.poolId === p.qB.poolId) {
      // Look for another match whose qB is not from p.qA's pool and won't create a conflict if swapped
      for (let j = 0; j < round0Pairs.length; j++) {
        if (i === j) continue;
        const other = round0Pairs[j];
        if (!other.qB) continue;
        const otherPoolA = other.qA?.poolId;
        const otherPoolB = other.qB?.poolId;
        if (otherPoolB !== p.qA.poolId && p.qB.poolId !== otherPoolA) {
          const tmp = p.qB;
          p.qB = other.qB;
          other.qB = tmp;
          break;
        }
      }
    }
  }

  // Round 0
  const r0Fmt = getEffectiveMatchFormat({ knockoutFormat }, null, {
    isKnockout: true,
    totalRounds,
    roundIdx: 0,
  });
  const round0 = round0Pairs.map(({ qA, qB }, mIdx) => {
    const isBye = !qA || !qB;
    return {
      id: `ko-r0-m${mIdx}`,
      roundIdx: 0,
      matchIdx: mIdx,
      entryAId: qA ? qA.entryId : null,
      entryBId: qB ? qB.entryId : null,
      seedLabelA: qA ? qA.seedLabel : null,
      seedLabelB: qB ? qB.seedLabel : null,
      isBye,
      games: createEmptyGames(r0Fmt.bestOf),
      inProgress: false,
      saved: isBye,
      winnerId: isBye ? (qA ? qA.entryId : qB ? qB.entryId : null) : null,
    };
  });
  rounds.push(round0);

  // Subsequent rounds
  for (let r = 1; r < totalRounds; r++) {
    const prevRound = rounds[r - 1];
    const rFmt = getEffectiveMatchFormat({ knockoutFormat }, null, {
      isKnockout: true,
      totalRounds,
      roundIdx: r,
    });
    const currRound = [];
    for (let i = 0; i < prevRound.length; i += 2) {
      const mA = prevRound[i];
      const mB = prevRound[i + 1];
      currRound.push({
        id: `ko-r${r}-m${i / 2}`,
        roundIdx: r,
        matchIdx: i / 2,
        entryAId: mA.isBye ? mA.winnerId : null,
        entryBId: mB.isBye ? mB.winnerId : null,
        seedLabelA: mA.isBye ? (mA.entryAId ? mA.seedLabelA : mA.seedLabelB) : null,
        seedLabelB: mB.isBye ? (mB.entryAId ? mB.seedLabelA : mB.seedLabelB) : null,
        isBye: false,
        games: createEmptyGames(rFmt.bestOf),
        inProgress: false,
        saved: false,
        winnerId: null,
      });
    }
    rounds.push(currRound);
  }

  const bronzeFmt = getEffectiveMatchFormat({ knockoutFormat }, null, {
    isKnockout: true,
    totalRounds,
    roundIdx: totalRounds - 1,
    isBronze: true,
  });
  const bronzeMatch =
    includeBronze && totalRounds >= 2
      ? {
          id: 'ko-bronze',
          isBronze: true,
          entryAId: null,
          entryBId: null,
          games: createEmptyGames(bronzeFmt.bestOf),
          inProgress: false,
          saved: false,
          winnerId: null,
        }
      : null;

  return {
    rounds,
    bronzeMatch,
    championId: null,
    silverId: null,
    bronzeId: null,
  };
}

/**
 * Generates a Single-Elimination Knockout Bracket directly from entries (no pool play).
 */
export function generateDirectKnockoutTournament({
  entries = [],
  knockoutFormat,
  includeBronze = true,
  seedingMode = 'snake',
}) {
  const ordered =
    seedingMode === 'random'
      ? [...entries].sort(() => Math.random() - 0.5)
      : [...entries];

  const qualifiers = ordered.map((e, idx) => ({
    entryId: e.id,
    seedLabel: `#${idx + 1}`,
  }));

  return buildSeededBracket({ qualifiers, knockoutFormat, includeBronze });
}

function compareAcrossPools(a, b) {
  if (a.poolRank !== b.poolRank) return a.poolRank - b.poolRank;
  if (Math.abs(b.winPct - a.winPct) > 1e-6) return b.winPct - a.winPct;
  if (Math.abs(b.gameDiffPerMatch - a.gameDiffPerMatch) > 1e-6) {
    return b.gameDiffPerMatch - a.gameDiffPerMatch;
  }
  if (Math.abs(b.pointDiffPerMatch - a.pointDiffPerMatch) > 1e-6) {
    return b.pointDiffPerMatch - a.pointDiffPerMatch;
  }
  if (Math.abs(b.pointsForPerMatch - a.pointsForPerMatch) > 1e-6) {
    return b.pointsForPerMatch - a.pointsForPerMatch;
  }
  return (a.seed || 999) - (b.seed || 999);
}

/**
 * Generates standard cross-pool seeded Single-Elimination Knockout Bracket
 * supporting odd pool counts via either:
 * - `'byes'`: Top performance seeds receive Round 1 BYEs
 * - `'wildcards'`: Best non-advancing finishers across pools fill the bracket
 * + optional Bronze Medal (3rd place) match.
 */
export function generateKnockoutBracket(tournament) {
  const {
    structure = 'pools_knockout',
    pools = [],
    entries = [],
    advancePerPool = 2,
    knockoutFillMode = 'byes',
    targetBracketSize = 'auto',
    knockoutFormat,
    includeBronze = true,
    seedingMode = 'snake',
  } = tournament;

  if (structure === 'knockout_only' || pools.length === 0) {
    return generateDirectKnockoutTournament({
      entries,
      knockoutFormat,
      includeBronze,
      seedingMode,
    });
  }

  const poolStandings = pools.map((pool) => ({
    pool,
    rows: computePoolStandings(
      pool,
      entries,
      getEffectiveMatchFormat(tournament, null, { isKnockout: false }).bestOf
    ),
  }));

  // 1. Collect automatic qualifiers from each pool & rank across pools by performance
  const autoQualifiers = [];
  const remainingPoolCandidates = [];

  poolStandings.forEach(({ pool, rows }) => {
    const shortPool = pool.name.replace('Pool ', '');
    rows.forEach((row, rankIdx) => {
      const candidate = {
        entryId: row.entryId,
        poolId: pool.id,
        poolName: pool.name,
        shortPool,
        poolRank: rankIdx + 1,
        seedLabel: `${shortPool}${rankIdx + 1}`,
        wins: row.wins,
        winPct: row.winPct,
        gameDiffPerMatch: row.gameDiffPerMatch,
        pointDiffPerMatch: row.pointDiffPerMatch,
        pointsForPerMatch: row.pointsForPerMatch,
        pointDiff: row.pointDiff,
        seed: row.entry?.seed || 999,
      };
      if (rankIdx < advancePerPool) {
        autoQualifiers.push(candidate);
      } else {
        remainingPoolCandidates.push(candidate);
      }
    });
  });

  // Sort automatic qualifiers fairly (1st place winners ranked #1..#P by win% & pt diff, then 2nd place, etc.)
  // This guarantees top-performing pool winners earn Seed #1/#2 and Round 1 BYEs when pools are odd!
  autoQualifiers.sort(compareAcrossPools);

  let qualifiers = [...autoQualifiers];

  // Determine desired power-of-2 bracket size
  let desiredSize = 2;
  while (desiredSize < Math.max(2, autoQualifiers.length)) desiredSize *= 2;
  if (targetBracketSize !== 'auto' && Number(targetBracketSize) >= 2) {
    desiredSize = Math.max(desiredSize, Number(targetBracketSize));
  }

  // 2. If Wildcards mode is enabled and bracket has open slots, fill with best non-qualifiers
  if (knockoutFillMode === 'wildcards' && qualifiers.length < desiredSize && remainingPoolCandidates.length > 0) {
    remainingPoolCandidates.sort(compareAcrossPools);
    const needed = Math.min(desiredSize - qualifiers.length, remainingPoolCandidates.length);
    const wildcards = remainingPoolCandidates.slice(0, needed).map((wc) => ({
      ...wc,
      isWildcard: true,
      seedLabel: `WC\u2022${wc.shortPool}${wc.poolRank}`,
    }));
    qualifiers = [...qualifiers, ...wildcards];
  }

  return buildSeededBracket({
    qualifiers,
    knockoutFormat,
    includeBronze,
    forcedBracketSize: targetBracketSize !== 'auto' ? Number(targetBracketSize) : null,
  });
}

function getBracketSeedOrder(size) {
  let order = [1, 2];
  while (order.length < size) {
    const nextSize = order.length * 2;
    const expanded = [];
    for (const seed of order) {
      expanded.push(seed, nextSize + 1 - seed);
    }
    order = expanded;
  }
  return order;
}

export function getKnockoutRoundLabel(totalRounds, roundIdx) {
  const remaining = totalRounds - roundIdx;
  if (remaining === 1) return 'Gold Medal Final';
  if (remaining === 2) return 'Semifinals';
  if (remaining === 3) return 'Quarterfinals';
  return `Round of ${Math.pow(2, remaining)}`;
}

export function advanceKnockoutWinner(knockout, roundIdx, matchIdx, winnerId) {
  const nextKo = JSON.parse(JSON.stringify(knockout));
  const totalRounds = nextKo.rounds.length;
  const m = nextKo.rounds[roundIdx][matchIdx];
  m.winnerId = winnerId;
  m.saved = true;
  m.inProgress = false;

  const loserId = m.entryAId === winnerId ? m.entryBId : m.entryAId;

  if (roundIdx + 1 < totalRounds) {
    const nextIdx = Math.floor(matchIdx / 2);
    const slot = matchIdx % 2 === 0 ? 'entryAId' : 'entryBId';
    nextKo.rounds[roundIdx + 1][nextIdx][slot] = winnerId;

    // If this was a Semifinal and Bronze Medal match exists, route loser to Bronze Medal match
    if (roundIdx === totalRounds - 2 && nextKo.bronzeMatch && loserId) {
      const bronzeSlot = matchIdx % 2 === 0 ? 'entryAId' : 'entryBId';
      nextKo.bronzeMatch[bronzeSlot] = loserId;
    }
  } else {
    // Gold Medal Final completed!
    nextKo.championId = winnerId;
    nextKo.silverId = loserId;
  }

  return nextKo;
}

export function generatePoolStandingsCSV(tournament, roomId = '') {
  if (!tournament) return '';
  const lines = [];
  const entries = tournament.entries || [];
  const bestOf = tournament.poolFormat?.bestOf || 1;

  lines.push(
    [
      'Room ID',
      'Pool',
      'Pos',
      'Entry / Players',
      'Matches Played',
      'Wins',
      'Losses',
      'Games Won',
      'Games Lost',
      'Game Diff',
      'Points For',
      'Points Against',
      'Point Diff',
      'Qualifies',
    ].join(',')
  );

  (tournament.pools || []).forEach((pool) => {
    const standings = computePoolStandings(pool, entries, bestOf);
    standings.forEach((row, idx) => {
      const qualifies = idx < (tournament.advancePerPool || 2) ? 'Yes' : 'No';
      lines.push(
        [
          roomId,
          pool.name,
          idx + 1,
          row.name,
          row.matchesPlayed,
          row.wins,
          row.losses,
          row.gamesWon,
          row.gamesLost,
          row.gameDiff,
          row.pointsFor,
          row.pointsAgainst,
          row.pointDiff,
          qualifies,
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    });
  });

  return lines.join('\r\n');
}

export function generatePoolAndKnockoutMatchesCSV(tournament, roomId = '') {
  if (!tournament) return '';
  const entryMap = new Map((tournament.entries || []).map((e) => [e.id, getEntryDisplayName(e)]));
  const lines = [];

  lines.push(
    [
      'Room ID',
      'Stage',
      'Round / Pool',
      'Entry A',
      'Entry B',
      'Scores',
      'Winner',
    ].join(',')
  );

  const formatScores = (games = []) =>
    games
      .filter((g) => g.scoreA !== '' && g.scoreB !== '')
      .map((g) => `${g.scoreA}-${g.scoreB}`)
      .join(' | ');

  (tournament.pools || []).forEach((pool) => {
    (pool.matches || []).forEach((m) => {
      lines.push(
        [
          roomId,
          'Pool Play',
          `${pool.name} (R${m.round})`,
          entryMap.get(m.entryAId) || 'TBD',
          entryMap.get(m.entryBId) || 'TBD',
          formatScores(m.games),
          m.winnerId ? entryMap.get(m.winnerId) || '' : 'Pending',
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    });
  });

  if (tournament.knockout) {
    const totalRounds = tournament.knockout.rounds.length;
    tournament.knockout.rounds.forEach((round, rIdx) => {
      const label = getKnockoutRoundLabel(totalRounds, rIdx);
      round.forEach((m) => {
        if (m.isBye) return;
        lines.push(
          [
            roomId,
            'Knockout',
            label,
            entryMap.get(m.entryAId) || 'TBD',
            entryMap.get(m.entryBId) || 'TBD',
            formatScores(m.games),
            m.winnerId ? entryMap.get(m.winnerId) || '' : 'Pending',
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      });
    });

    if (tournament.knockout.bronzeMatch) {
      const bm = tournament.knockout.bronzeMatch;
      lines.push(
        [
          roomId,
          'Knockout',
          'Bronze Medal (3rd Place)',
          entryMap.get(bm.entryAId) || 'TBD',
          entryMap.get(bm.entryBId) || 'TBD',
          formatScores(bm.games),
          bm.winnerId ? entryMap.get(bm.winnerId) || '' : 'Pending',
        ]
          .map(escapeCsvCell)
          .join(',')
      );
    }
  }

  return lines.join('\r\n');
}

