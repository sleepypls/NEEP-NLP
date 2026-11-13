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
/**
 * Evenly distributes courts (1..numCourts) across `poolCount` pools.
 * E.g. 4 courts / 2 pools -> [[1,2], [3,4]]; 5 courts / 2 pools -> [[1,2,3], [4,5]].
 * If fewer courts than pools, assigns round-robin primary court per pool.
 */
export function distributeCourtsToPools(poolCount, numCourts = 2) {
  const pCount = Math.max(1, Number(poolCount) || 1);
  const cCount = Math.max(1, Number(numCourts) || 2);
  const buckets = Array.from({ length: pCount }, () => []);

  if (cCount >= pCount) {
    const base = Math.floor(cCount / pCount);
    const extra = cCount % pCount;
    let cursor = 1;
    for (let i = 0; i < pCount; i++) {
      const size = base + (i < extra ? 1 : 0);
      for (let j = 0; j < size; j++) {
        buckets[i].push(cursor++);
      }
    }
  } else {
    for (let i = 0; i < pCount; i++) {
      buckets[i].push((i % cCount) + 1);
    }
  }
  return buckets;
}

export function generatePoolsAndSchedule({
  entries = [],
  discipline = 'doubles',
  structure = 'pools_knockout',
  numPools = 2,
  numCourts = 2,
  poolFormat = { bestOf: 1, pointsTo: 15, winByTwo: true },
  knockoutFormat = { bestOf: 3, pointsTo: 11, winByTwo: true },
  advancePerPool = 2,
  knockoutFillMode = 'byes',
  targetBracketSize = 'auto',
  includeBronze = true,
  seedingMode = 'snake',
  tiebreakerRules = null,
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
  const courtBuckets = distributeCourtsToPools(poolCount, numCourts);
  const pools = Array.from({ length: poolCount }, (_, i) => ({
    id: `pool-${poolLetters[i] || i + 1}`,
    name: `Pool ${poolLetters[i] || i + 1}`,
    entryIds: [],
    assignedCourts: courtBuckets[i] || [1],
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

  // Pre-assign initial Round 1 (or earliest non-conflicting) matches evenly to each pool's courts
  const usedInitialCourts = new Set();
  pools.forEach((pool) => {
    const busyEntries = new Set();
    let courtIdx = 0;
    const poolCourts = pool.assignedCourts || [];
    for (const m of pool.matches) {
      while (courtIdx < poolCourts.length && usedInitialCourts.has(poolCourts[courtIdx])) {
        courtIdx++;
      }
      if (courtIdx >= poolCourts.length) break;
      if (!busyEntries.has(m.entryAId) && !busyEntries.has(m.entryBId)) {
        m.court = poolCourts[courtIdx];
        usedInitialCourts.add(m.court);
        busyEntries.add(m.entryAId);
        busyEntries.add(m.entryBId);
        courtIdx++;
      }
    }
  });

  return {
    structure: 'pools_knockout',
    discipline,
    entries: cleanEntries,
    pools,
    numCourts: Math.max(1, Number(numCourts) || 2),
    poolFormat,
    knockoutFormat,
    advancePerPool,
    knockoutFillMode,
    targetBracketSize,
    includeBronze,
    seedingMode,
    tiebreakerRules: tiebreakerRules || DEFAULT_TIEBREAKER_RULES,
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

export const POOL_TIEBREAKER_PRESETS = {
  standard: {
    label: 'Pickleball Standard (H2H → Game Diff → Point Diff → Points For)',
    order: ['h2h', 'gameDiff', 'pointDiff', 'pointsFor'],
    rankByWinPct: false,
  },
  usap: {
    label: 'USA Pickleball (H2H → Point Diff → Points For → Fewest Pts Allowed)',
    order: ['h2h', 'pointDiff', 'pointsFor', 'pointsAgainst'],
    rankByWinPct: false,
  },
  point_diff_first: {
    label: 'Point Differential First (Point Diff → H2H → Points For → Game Diff)',
    order: ['pointDiff', 'h2h', 'pointsFor', 'gameDiff'],
    rankByWinPct: false,
  },
  game_diff_first: {
    label: 'Game Differential First (Game Diff → H2H → Point Diff → Points For)',
    order: ['gameDiff', 'h2h', 'pointDiff', 'pointsFor'],
    rankByWinPct: false,
  },
  points_for: {
    label: 'Highest Points Scored (Points For → Point Diff → H2H → Fewest Pts Allowed)',
    order: ['pointsFor', 'pointDiff', 'h2h', 'pointsAgainst'],
    rankByWinPct: false,
  },
  uneven_win_pct: {
    label: 'Uneven Pools — Win % First (Win % → H2H → Pt Diff/Match → Pts/Match)',
    order: ['h2h', 'pointDiffPerMatch', 'pointsForPerMatch', 'gameDiffPerMatch'],
    rankByWinPct: true,
  },
};

export const TIEBREAKER_CRITERIA_LABELS = {
  h2h: 'Head-to-Head',
  gameDiff: 'Game Differential (GW − GL)',
  pointDiff: 'Point Differential (PF − PA)',
  pointsFor: 'Points Scored (PF)',
  pointsAgainst: 'Fewest Points Allowed (PA)',
  gamesWon: 'Games Won (GW)',
  pointDiffPerMatch: 'Point Diff / Match',
  pointsForPerMatch: 'Points For / Match',
  gameDiffPerMatch: 'Game Diff / Match',
};

export const DEFAULT_TIEBREAKER_RULES = {
  preset: 'standard',
  order: ['h2h', 'gameDiff', 'pointDiff', 'pointsFor'],
  rankByWinPct: false,
};

/**
 * Computes pool standings using the configured tiebreaker hierarchy
 * (defaults to Pickleball Standard: Wins -> H2H -> Game Diff -> Point Diff -> Points For).
 */
export function computePoolStandings(pool, entries = [], bestOf = 1, tiebreakerRules = null) {
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
  const rules = tiebreakerRules || DEFAULT_TIEBREAKER_RULES;
  const order = Array.isArray(rules.order) && rules.order.length > 0
    ? rules.order
    : DEFAULT_TIEBREAKER_RULES.order;

  rows.sort((a, b) => {
    if (rules.rankByWinPct) {
      if (Math.abs(b.winPct - a.winPct) > 1e-9) return b.winPct - a.winPct;
    }
    if (b.wins !== a.wins) return b.wins - a.wins;

    for (const key of order) {
      if (key === 'h2h') {
        const pairKey = [String(a.entryId), String(b.entryId)].sort().join('|');
        const h2hWinner = h2hWinners.get(pairKey);
        if (h2hWinner === a.entryId) return -1;
        if (h2hWinner === b.entryId) return 1;
      } else if (key === 'gameDiff') {
        if (b.gameDiff !== a.gameDiff) return b.gameDiff - a.gameDiff;
      } else if (key === 'pointDiff') {
        if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      } else if (key === 'pointsFor') {
        if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      } else if (key === 'pointsAgainst') {
        if (a.pointsAgainst !== b.pointsAgainst) return a.pointsAgainst - b.pointsAgainst;
      } else if (key === 'gamesWon') {
        if (b.gamesWon !== a.gamesWon) return b.gamesWon - a.gamesWon;
      } else if (key === 'pointDiffPerMatch') {
        if (Math.abs(b.pointDiffPerMatch - a.pointDiffPerMatch) > 1e-9) {
          return b.pointDiffPerMatch - a.pointDiffPerMatch;
        }
      } else if (key === 'pointsForPerMatch') {
        if (Math.abs(b.pointsForPerMatch - a.pointsForPerMatch) > 1e-9) {
          return b.pointsForPerMatch - a.pointsForPerMatch;
        }
      } else if (key === 'gameDiffPerMatch') {
        if (Math.abs(b.gameDiffPerMatch - a.gameDiffPerMatch) > 1e-9) {
          return b.gameDiffPerMatch - a.gameDiffPerMatch;
        }
      }
    }

    return (a.entry.seed || 999) - (b.entry.seed || 999);
  });

  // Attach Head-to-Head record vs opponents tied on Wins / Win%
  rows.forEach((row) => {
    const tiedPeers = rows.filter((other) => {
      if (other.entryId === row.entryId) return false;
      if (rules.rankByWinPct) {
        return Math.abs(other.winPct - row.winPct) <= 1e-9 && other.wins === row.wins;
      }
      return other.wins === row.wins;
    });
    let h2hW = 0;
    let h2hL = 0;
    const notes = [];
    tiedPeers.forEach((peer) => {
      const pairKey = [String(row.entryId), String(peer.entryId)].sort().join('|');
      const wId = h2hWinners.get(pairKey);
      if (wId === row.entryId) {
        h2hW += 1;
        notes.push(`Beat ${peer.name}`);
      } else if (wId === peer.entryId) {
        h2hL += 1;
        notes.push(`Lost to ${peer.name}`);
      }
    });
    row.h2hTiedWins = h2hW;
    row.h2hTiedLosses = h2hL;
    row.h2hTiedPlayed = h2hW + h2hL;
    row.h2hTiedTooltip = notes.length > 0 ? notes.join(' • ') : '';
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
  tiebreakerRules = null,
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
      getEffectiveMatchFormat(tournament, null, { isKnockout: false }).bestOf,
      tournament?.tiebreakerRules
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
    const standings = computePoolStandings(pool, entries, bestOf, tournament?.tiebreakerRules);
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

export function computeTournamentPlayerStats(tournament) {
  if (!tournament) return { entryStats: [], playerStats: [] };
  const entries = tournament.entries || [];
  const entryMap = new Map(entries.map((e) => [e.id, e]));
  const entryStatsMap = new Map();
  const playerStatsMap = new Map();

  const ensureEntry = (entryId) => {
    const entry = entryMap.get(entryId);
    if (!entry) return null;
    if (!entryStatsMap.has(entryId)) {
      entryStatsMap.set(entryId, {
        id: entryId,
        name: getEntryDisplayName(entry),
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
      });
    }
    return entryStatsMap.get(entryId);
  };

  const ensurePlayer = (playerName) => {
    const clean = String(playerName || '').trim();
    if (!clean) return null;
    const key = clean.toLowerCase();
    if (!playerStatsMap.has(key)) {
      playerStatsMap.set(key, {
        name: clean,
        matchesPlayed: 0,
        wins: 0,
        losses: 0,
        gamesWon: 0,
        gamesLost: 0,
        pointsFor: 0,
        pointsAgainst: 0,
        pointDiff: 0,
      });
    }
    return playerStatsMap.get(key);
  };

  const recordMatch = (m, bestOf) => {
    if (!m || m.isBye || !m.saved || !m.winnerId || !m.entryAId || !m.entryBId) return;
    const evalRes = evaluatePoolOrKnockoutMatch(m.games, m.customFormat?.bestOf || bestOf);
    const aWon = m.winnerId === m.entryAId;

    const applyTo = (stat, isSideA) => {
      if (!stat) return;
      const won = isSideA ? aWon : !aWon;
      stat.matchesPlayed += 1;
      if (won) stat.wins += 1;
      else stat.losses += 1;
      stat.gamesWon += isSideA ? evalRes.gamesWonA : evalRes.gamesWonB;
      stat.gamesLost += isSideA ? evalRes.gamesWonB : evalRes.gamesWonA;
      stat.pointsFor += isSideA ? evalRes.pointsA : evalRes.pointsB;
      stat.pointsAgainst += isSideA ? evalRes.pointsB : evalRes.pointsA;
      stat.pointDiff = stat.pointsFor - stat.pointsAgainst;
    };

    applyTo(ensureEntry(m.entryAId), true);
    applyTo(ensureEntry(m.entryBId), false);

    (entryMap.get(m.entryAId)?.players || []).forEach((p) => applyTo(ensurePlayer(p), true));
    (entryMap.get(m.entryBId)?.players || []).forEach((p) => applyTo(ensurePlayer(p), false));
  };

  const poolBestOf = tournament.poolFormat?.bestOf || 1;
  (tournament.pools || []).forEach((pool) => {
    (pool.matches || []).forEach((m) => recordMatch(m, poolBestOf));
  });

  if (tournament.knockout) {
    const totalRounds = tournament.knockout.rounds?.length || 1;
    (tournament.knockout.rounds || []).forEach((round, rIdx) => {
      const fmt = getEffectiveMatchFormat(tournament, null, {
        isKnockout: true,
        totalRounds,
        roundIdx: rIdx,
      });
      round.forEach((m) => recordMatch(m, fmt.bestOf));
    });
    if (tournament.knockout.bronzeMatch) {
      const bFmt = getEffectiveMatchFormat(tournament, tournament.knockout.bronzeMatch, {
        isKnockout: true,
        totalRounds,
        roundIdx: totalRounds - 1,
        isBronze: true,
      });
      recordMatch(tournament.knockout.bronzeMatch, bFmt.bestOf);
    }
  }

  const sortStats = (list) =>
    list
      .map((s) => ({
        ...s,
        winPct: s.matchesPlayed > 0 ? Math.round((s.wins / s.matchesPlayed) * 100) : 0,
      }))
      .sort((a, b) => {
        if (b.wins !== a.wins) return b.wins - a.wins;
        if (b.winPct !== a.winPct) return b.winPct - a.winPct;
        if (b.gamesWon - b.gamesLost !== a.gamesWon - a.gamesLost) {
          return b.gamesWon - b.gamesLost - (a.gamesWon - a.gamesLost);
        }
        return b.pointDiff - a.pointDiff;
      });

  return {
    entryStats: sortStats(Array.from(entryStatsMap.values())),
    playerStats: sortStats(Array.from(playerStatsMap.values())),
  };
}

export function generateTournamentLeaderboardCSV(statsList = [], roomId = '', label = 'Player / Team') {
  const lines = [
    ['Room ID', 'Rank', label, 'Matches', 'Wins', 'Losses', 'Win %', 'Games W-L', 'PF', 'PA', 'Point Diff'].join(','),
  ];
  statsList.forEach((row, idx) => {
    lines.push(
      [
        roomId,
        idx + 1,
        row.name,
        row.matchesPlayed,
        row.wins,
        row.losses,
        `${row.winPct}%`,
        `${row.gamesWon}-${row.gamesLost}`,
        row.pointsFor,
        row.pointsAgainst,
        row.pointDiff,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  });
  return lines.join('\r\n');
}

/**
 * Collects a Set of entry IDs currently playing in any live (inProgress && !saved)
 * pool or knockout match.
 */
export function getBusyPoolEntryIds(tournament, excludeMatchKey = null) {
  const busy = new Set();
  if (!tournament) return busy;
  (tournament.pools || []).forEach((pool) => {
    (pool.matches || []).forEach((m) => {
      const key = `pool:${pool.id}:${m.id}`;
      if (m.inProgress && !m.saved && key !== excludeMatchKey) {
        if (m.entryAId) busy.add(m.entryAId);
        if (m.entryBId) busy.add(m.entryBId);
      }
    });
  });
  const ko = tournament.knockout;
  if (ko && Array.isArray(ko.rounds)) {
    ko.rounds.forEach((round, rIdx) => {
      round.forEach((m) => {
        const key = `ko:${rIdx}:${m.matchIdx}`;
        if (!m.isBye && m.inProgress && !m.saved && key !== excludeMatchKey) {
          if (m.entryAId) busy.add(m.entryAId);
          if (m.entryBId) busy.add(m.entryBId);
        }
      });
    });
    if (ko.bronzeMatch && excludeMatchKey !== 'ko:bronze') {
      const bm = ko.bronzeMatch;
      if (bm.inProgress && !bm.saved) {
        if (bm.entryAId) busy.add(bm.entryAId);
        if (bm.entryBId) busy.add(bm.entryBId);
      }
    }
  }
  return busy;
}

/**
 * Computes currently live courts, free courts, eligible ready-to-play matches,
 * and smart conflict-free court suggestions for Pools + Knockout.
 */
export function buildPoolCourtSuggestions(tournament, numCourtsOverride = null) {
  const totalCourts = Math.max(1, Number(numCourtsOverride || tournament?.numCourts) || 2);
  const entryMap = new Map((tournament?.entries || []).map((e) => [e.id, e]));
  const liveByCourt = new Map();
  const busyEntryIds = new Set();
  const eligibleMatches = [];

  const pools = tournament?.pools || [];
  pools.forEach((pool) => {
    (pool.matches || []).forEach((m) => {
      if (m.inProgress && !m.saved) {
        if (m.court) liveByCourt.set(Number(m.court), { match: m, stage: pool.name });
        if (m.entryAId) busyEntryIds.add(m.entryAId);
        if (m.entryBId) busyEntryIds.add(m.entryBId);
      } else if (!m.saved && !m.inProgress && m.entryAId && m.entryBId) {
        const nameA = getEntryDisplayName(entryMap.get(m.entryAId));
        const nameB = getEntryDisplayName(entryMap.get(m.entryBId));
        eligibleMatches.push({
          key: `pool:${pool.id}:${m.id}`,
          type: 'pool',
          poolId: pool.id,
          poolName: pool.name,
          assignedCourts: pool.assignedCourts || [],
          matchId: m.id,
          round: m.round || 1,
          entryAId: m.entryAId,
          entryBId: m.entryBId,
          preAssignedCourt: m.court ? Number(m.court) : null,
          label: `${pool.name} (R${m.round || 1}): ${nameA} vs ${nameB}`,
          shortLabel: `${nameA} vs ${nameB}`,
        });
      }
    });
  });

  const knockout = tournament?.knockout;
  if (knockout && Array.isArray(knockout.rounds)) {
    const totalRounds = knockout.rounds.length;
    knockout.rounds.forEach((round, rIdx) => {
      const roundLabel = getKnockoutRoundLabel(totalRounds, rIdx);
      round.forEach((m) => {
        if (m.isBye) return;
        if (m.inProgress && !m.saved) {
          if (m.court) liveByCourt.set(Number(m.court), { match: m, stage: roundLabel });
          if (m.entryAId) busyEntryIds.add(m.entryAId);
          if (m.entryBId) busyEntryIds.add(m.entryBId);
        } else if (!m.saved && !m.inProgress && m.entryAId && m.entryBId) {
          const nameA = getEntryDisplayName(entryMap.get(m.entryAId));
          const nameB = getEntryDisplayName(entryMap.get(m.entryBId));
          eligibleMatches.push({
            key: `ko:${rIdx}:${m.matchIdx}`,
            type: 'knockout',
            roundIdx: rIdx,
            matchIdx: m.matchIdx,
            isBronze: false,
            assignedCourts: [],
            matchId: m.id,
            round: rIdx + 100,
            entryAId: m.entryAId,
            entryBId: m.entryBId,
            preAssignedCourt: m.court ? Number(m.court) : null,
            label: `${roundLabel}: ${nameA} vs ${nameB}`,
            shortLabel: `${nameA} vs ${nameB}`,
          });
        }
      });
    });

    if (knockout.bronzeMatch) {
      const bm = knockout.bronzeMatch;
      if (bm.inProgress && !bm.saved) {
        if (bm.court) liveByCourt.set(Number(bm.court), { match: bm, stage: 'Bronze Medal' });
        if (bm.entryAId) busyEntryIds.add(bm.entryAId);
        if (bm.entryBId) busyEntryIds.add(bm.entryBId);
      } else if (!bm.saved && !bm.inProgress && bm.entryAId && bm.entryBId) {
        const nameA = getEntryDisplayName(entryMap.get(bm.entryAId));
        const nameB = getEntryDisplayName(entryMap.get(bm.entryBId));
        eligibleMatches.push({
          key: 'ko:bronze',
          type: 'knockout',
          roundIdx: 0,
          matchIdx: 0,
          isBronze: true,
          assignedCourts: [],
          matchId: bm.id || 'bronze',
          round: totalRounds + 100,
          entryAId: bm.entryAId,
          entryBId: bm.entryBId,
          preAssignedCourt: bm.court ? Number(bm.court) : null,
          label: `Bronze Medal: ${nameA} vs ${nameB}`,
          shortLabel: `${nameA} vs ${nameB}`,
        });
      }
    }
  }

  const freeCourts = [];
  for (let c = 1; c <= totalCourts; c++) {
    if (!liveByCourt.has(c)) freeCourts.push(c);
  }

  // Sort eligible matches by round ascending
  eligibleMatches.sort((a, b) => a.round - b.round);

  const suggestions = {};
  const plannedBusy = new Set(busyEntryIds);
  const usedKeys = new Set();

  const isFreeOfConflict = (cand) =>
    !usedKeys.has(cand.key) &&
    !plannedBusy.has(cand.entryAId) &&
    !plannedBusy.has(cand.entryBId);

  // Pass 1: Match pre-assigned court or pool's designated court first
  freeCourts.forEach((courtNum) => {
    const exactPre = eligibleMatches.find(
      (c) => c.preAssignedCourt === courtNum && isFreeOfConflict(c)
    );
    const poolPreferred =
      exactPre ||
      eligibleMatches.find(
        (c) => c.assignedCourts.includes(courtNum) && isFreeOfConflict(c)
      );
    if (poolPreferred) {
      suggestions[courtNum] = poolPreferred.key;
      usedKeys.add(poolPreferred.key);
      plannedBusy.add(poolPreferred.entryAId);
      plannedBusy.add(poolPreferred.entryBId);
    }
  });

  // Pass 2: Fill any remaining free courts with next non-conflicting eligible matches
  freeCourts.forEach((courtNum) => {
    if (suggestions[courtNum]) return;
    const nextMatch = eligibleMatches.find((c) => isFreeOfConflict(c));
    if (nextMatch) {
      suggestions[courtNum] = nextMatch.key;
      usedKeys.add(nextMatch.key);
      plannedBusy.add(nextMatch.entryAId);
      plannedBusy.add(nextMatch.entryBId);
    } else {
      suggestions[courtNum] = '';
    }
  });

  return {
    totalCourts,
    liveByCourt,
    busyEntryIds,
    freeCourts,
    eligibleMatches,
    suggestions,
  };
}


