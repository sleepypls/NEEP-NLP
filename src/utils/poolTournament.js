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

/**
 * Generates balanced pools using serpentine (snake) seeding,
 * and creates a full round-robin match schedule for each pool.
 */
export function generatePoolsAndSchedule({
  entries = [],
  discipline = 'doubles',
  numPools = 2,
  poolFormat = { bestOf: 1, pointsTo: 15, winByTwo: true },
  knockoutFormat = { bestOf: 3, pointsTo: 11, winByTwo: true },
  advancePerPool = 2,
  includeBronze = true,
  seedingMode = 'snake',
}) {
  const cleanEntries = entries.map((e, idx) => ({
    ...e,
    seed: e.seed || idx + 1,
  }));

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
    discipline,
    entries: cleanEntries,
    pools,
    poolFormat,
    knockoutFormat,
    advancePerPool,
    includeBronze,
    knockout: null,
    stage: 'pools', // 'pools' | 'knockout' | 'complete'
  };
}

export function createEmptyGames(bestOf = 1) {
  const count = bestOf === 3 ? 3 : 1;
  return Array.from({ length: count }, (_, i) => ({
    gameNum: i + 1,
    scoreA: '',
    scoreB: '',
  }));
}

/**
 * Evaluates a match's games array (1 game or Best of 3) to determine match winner & totals.
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

  const neededToWin = bestOf === 3 ? 2 : 1;
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
    const evalRes = evaluatePoolOrKnockoutMatch(m.games, bestOf);
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

    const pairKey = [m.entryAId, m.entryBId].sort((a, b) => a - b).join('|');
    h2hWinners.set(pairKey, m.winnerId);
  });

  const rows = Array.from(statsMap.values());
  rows.sort((a, b) => {
    if (b.wins !== a.wins) return b.wins - a.wins;
    // Head-to-head check
    const pairKey = [a.entryId, b.entryId].sort((x, y) => x - y).join('|');
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

/**
 * Generates standard cross-pool seeded Single-Elimination Knockout Bracket
 * + optional Bronze Medal (3rd place) match.
 */
export function generateKnockoutBracket(tournament) {
  const { pools = [], entries = [], advancePerPool = 2, poolFormat, knockoutFormat, includeBronze = true } = tournament;
  const bestOfPool = poolFormat?.bestOf || 1;
  const bestOfKo = knockoutFormat?.bestOf || 3;

  // Collect qualifiers per pool, ordered by placement rank (1st place across pools, then 2nd place, etc.)
  const poolStandings = pools.map((pool) => ({
    pool,
    rows: computePoolStandings(pool, entries, bestOfPool),
  }));

  const qualifiers = [];
  for (let rank = 0; rank < advancePerPool; rank++) {
    const rankSlice = [];
    poolStandings.forEach(({ pool, rows }, poolIdx) => {
      if (rows[rank]) {
        rankSlice.push({
          entryId: rows[rank].entryId,
          poolName: pool.name,
          poolIdx,
          poolRank: rank + 1,
          wins: rows[rank].wins,
          pointDiff: rows[rank].pointDiff,
        });
      }
    });
    // Cross-order lower tiers so same-pool teams land on opposite sides of the bracket
    if (rank % 2 === 1) {
      rankSlice.reverse();
    }
    qualifiers.push(...rankSlice);
  }

  if (qualifiers.length < 2) return null;

  // Pad to next power of 2
  let bracketSize = 2;
  while (bracketSize < qualifiers.length) bracketSize *= 2;

  const seededSlots = Array.from({ length: bracketSize }, (_, i) => qualifiers[i] || null);
  const seedOrder = getBracketSeedOrder(bracketSize);

  const rounds = [];
  const totalRounds = Math.log2(bracketSize);

  // Round 0
  const round0 = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const qA = seededSlots[seedOrder[i] - 1];
    const qB = seededSlots[seedOrder[i + 1] - 1];
    const isBye = !qA || !qB;
    round0.push({
      id: `ko-r0-m${i / 2}`,
      roundIdx: 0,
      matchIdx: i / 2,
      entryAId: qA ? qA.entryId : null,
      entryBId: qB ? qB.entryId : null,
      seedLabelA: qA ? `${qA.poolName.replace('Pool ', '')}${qA.poolRank}` : null,
      seedLabelB: qB ? `${qB.poolName.replace('Pool ', '')}${qB.poolRank}` : null,
      isBye,
      games: createEmptyGames(bestOfKo),
      inProgress: false,
      saved: isBye,
      winnerId: isBye ? (qA ? qA.entryId : qB ? qB.entryId : null) : null,
    });
  }
  rounds.push(round0);

  // Subsequent rounds
  for (let r = 1; r < totalRounds; r++) {
    const prevRound = rounds[r - 1];
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
        seedLabelA: null,
        seedLabelB: null,
        isBye: false,
        games: createEmptyGames(bestOfKo),
        inProgress: false,
        saved: false,
        winnerId: null,
      });
    }
    rounds.push(currRound);
  }

  const bronzeMatch =
    includeBronze && totalRounds >= 2
      ? {
          id: 'ko-bronze',
          isBronze: true,
          entryAId: null,
          entryBId: null,
          games: createEmptyGames(bestOfKo),
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

