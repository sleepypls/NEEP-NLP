export const TEAM_COLORS = [
  { accent: '#22d3ee', chip: 'bg-cyan-500', text: 'text-cyan-400', border: 'border-cyan-500', ring: 'ring-cyan-400', soft: 'bg-cyan-500/10' },
  { accent: '#fb923c', chip: 'bg-orange-500', text: 'text-orange-400', border: 'border-orange-500', ring: 'ring-orange-400', soft: 'bg-orange-500/10' },
  { accent: '#f472b6', chip: 'bg-pink-500', text: 'text-pink-400', border: 'border-pink-500', ring: 'ring-pink-400', soft: 'bg-pink-500/10' },
  { accent: '#a3e635', chip: 'bg-lime-500', text: 'text-lime-400', border: 'border-lime-500', ring: 'ring-lime-400', soft: 'bg-lime-500/10' },
  { accent: '#c084fc', chip: 'bg-purple-500', text: 'text-purple-400', border: 'border-purple-500', ring: 'ring-purple-400', soft: 'bg-purple-500/10' },
  { accent: '#f87171', chip: 'bg-red-500', text: 'text-red-400', border: 'border-red-500', ring: 'ring-red-400', soft: 'bg-red-500/10' },
  { accent: '#facc15', chip: 'bg-yellow-500', text: 'text-yellow-400', border: 'border-yellow-500', ring: 'ring-yellow-400', soft: 'bg-yellow-500/10' },
  { accent: '#60a5fa', chip: 'bg-blue-500', text: 'text-blue-400', border: 'border-blue-500', ring: 'ring-blue-400', soft: 'bg-blue-500/10' },
];

export function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

export function getDefaultSlotPairs(teamSize, preset = 'adjacent') {
  const n = Math.max(2, teamSize || 4);
  const targetGames = Math.max(4, Math.ceil(n / 2) * 2);
  const pairs = [];
  const playCounts = new Array(n + 1).fill(0);
  const pairHistory = new Map();

  function addPair(s1, s2) {
    const a = Math.min(Math.max(1, s1), n);
    let b = Math.min(Math.max(1, s2), n);
    if (a === b) {
      b = (a % n) + 1;
    }
    const key = a < b ? `${a}-${b}` : `${b}-${a}`;
    pairs.push([a, b]);
    playCounts[a] += 1;
    playCounts[b] += 1;
    pairHistory.set(key, (pairHistory.get(key) || 0) + 1);
  }

  function pickFairCrossPair(preferredOffset = 2) {
    let bestS1 = 1;
    let bestS2 = 2;
    let bestScore = Infinity;

    for (let i = 1; i <= n; i++) {
      for (let j = i + 1; j <= n; j++) {
        const key = `${i}-${j}`;
        const used = pairHistory.get(key) || 0;
        const countSum = playCounts[i] + playCounts[j];
        const maxCount = Math.max(playCounts[i], playCounts[j]);
        const isPreferred = (j - i === preferredOffset) ? -0.5 : 0;
        // Prioritize: 1) lowest max playCount (so nobody stays at 1 game while others play 3),
        // 2) lowest sum of playCounts, 3) unused partnership, 4) preferred cross offset
        const score = maxCount * 1000 + countSum * 100 + used * 50 + isPreferred;
        if (score < bestScore) {
          bestScore = score;
          bestS1 = i;
          bestS2 = j;
        }
      }
    }
    addPair(bestS1, bestS2);
  }

  if (preset === 'balanced') {
    // Pass 1: Balanced / MLP style high-low (1&n, 2&(n-1), 3&(n-2)...)
    const half = Math.floor(n / 2);
    for (let i = 0; i < half; i++) {
      addPair(i + 1, n - i);
    }
    // If odd team size, pair the middle slot with the least-played / balanced partner
    if (n % 2 !== 0) {
      const mid = Math.ceil(n / 2);
      const partner = mid > 1 ? 1 : 2;
      addPair(mid, partner);
    }
    // Pass 2+: Fill remaining games ensuring every slot plays at least twice with fresh partners
    while (pairs.length < targetGames) {
      pickFairCrossPair(1);
    }
  } else {
    // Pass 1: Adjacent slots (1&2, 3&4, 5&6...)
    for (let i = 1; i <= n - 1; i += 2) {
      addPair(i, i + 1);
    }
    // If odd team size, cover the last slot N immediately
    if (n % 2 !== 0) {
      addPair(n - 1, n);
    }
    // Pass 2+: Second rotation (e.g. 1&3, 2&4 for 4-player teams, or fair cross-pairs for 5+ players)
    while (pairs.length < targetGames) {
      pickFairCrossPair(2);
    }
  }

  return pairs;
}

export function generatePairs(draftOrder) {
  const pairs = [];
  const n = draftOrder.length;
  for (let i = 0; i < Math.floor(n / 2); i++) {
    pairs.push([draftOrder[i], draftOrder[n - 1 - i]]);
  }
  return pairs;
}

/**
 * Returns the active player(s) on court for a Dreambreaker rotation index.
 * - 'singles': [lineup[rotationIndex % n]]
 * - 'doubles': [lineup[(rotationIndex * 2) % n], lineup[(rotationIndex * 2 + 1) % n]]
 */
export function getActiveDreambreakerPlayers(lineup = [], rotationIndex = 0, format = 'singles') {
  const n = lineup.length;
  if (n === 0) return [];
  if (format === 'doubles' && n >= 2) {
    const idx1 = (rotationIndex * 2) % n;
    let idx2 = (rotationIndex * 2 + 1) % n;
    if (idx1 === idx2) idx2 = (idx1 + 1) % n;
    return [lineup[idx1], lineup[idx2]];
  }
  return [lineup[rotationIndex % n]];
}

export function generateTeamPairsForGames(draftOrder, totalGames) {
  const n = draftOrder.length;
  if (n < 2) return [];
  const playCounts = {};
  draftOrder.forEach((id) => { playCounts[id] = 0; });
  const pairHistory = new Map();

  const pairs = [];
  for (let g = 0; g < totalGames; g++) {
    const candidates = shuffle([...draftOrder]).sort((a, b) => playCounts[a] - playCounts[b]);
    const p1 = candidates[0];
    let bestP2 = candidates[1];
    let bestScore = Infinity;
    for (let i = 1; i < candidates.length; i++) {
      const p2 = candidates[i];
      const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
      const timesTogether = pairHistory.get(key) || 0;
      const score = timesTogether * 10 + playCounts[p2];
      if (score < bestScore) {
        bestScore = score;
        bestP2 = p2;
      }
    }

    pairs.push([p1, bestP2]);
    playCounts[p1] += 1;
    playCounts[bestP2] += 1;

    const chosenKey = p1 < bestP2 ? `${p1}-${bestP2}` : `${bestP2}-${p1}`;
    pairHistory.set(chosenKey, (pairHistory.get(chosenKey) || 0) + 1);
  }
  return pairs;
}

export function generateGames(teamA, teamB, goalScore, matchupConfig = { preset: 'adjacent' }) {
  const nA = teamA.draftOrder.length;
  const nB = teamB.draftOrder.length;
  const commonSize = Math.min(nA, nB);

  // Determine slot pairs to use
  const isCustom = matchupConfig?.preset === 'custom' && Array.isArray(matchupConfig?.customSlotPairs) && matchupConfig.customSlotPairs.length > 0;
  let slotPairs = [];
  if (isCustom) {
    slotPairs = matchupConfig.customSlotPairs;
  } else {
    slotPairs = getDefaultSlotPairs(commonSize, matchupConfig?.preset || 'adjacent');
  }

  const baseGamesCount = slotPairs.length;
  const minGamesToCoverA = Math.ceil(nA / 2) * 2;
  const minGamesToCoverB = Math.ceil(nB / 2) * 2;
  let totalGames = isCustom
    ? baseGamesCount
    : Math.max(baseGamesCount, minGamesToCoverA, minGamesToCoverB, 4);
  if (!isCustom && totalGames % 2 !== 0) totalGames += 1;

  // Track play counts and partnership history so extra games prioritize under-played players
  const playCountsA = {};
  const playCountsB = {};
  teamA.draftOrder.forEach((id) => { playCountsA[id] = 0; });
  teamB.draftOrder.forEach((id) => { playCountsB[id] = 0; });
  const pairHistoryA = new Map();
  const pairHistoryB = new Map();

  function recordPair(pair, counts, history) {
    if (!pair || pair.length < 2) return;
    const [p1, p2] = pair;
    counts[p1] = (counts[p1] || 0) + 1;
    counts[p2] = (counts[p2] || 0) + 1;
    const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
    history.set(key, (history.get(key) || 0) + 1);
  }

  function pickBalancedPair(draftOrder, counts, history) {
    if (draftOrder.length < 2) return [...draftOrder];
    const candidates = shuffle([...draftOrder]).sort((a, b) => (counts[a] || 0) - (counts[b] || 0));
    const p1 = candidates[0];
    let bestP2 = candidates[1];
    let bestScore = Infinity;
    for (let i = 1; i < candidates.length; i++) {
      const p2 = candidates[i];
      const key = p1 < p2 ? `${p1}-${p2}` : `${p2}-${p1}`;
      const timesTogether = history.get(key) || 0;
      const score = (counts[p2] || 0) * 100 + timesTogether * 10;
      if (score < bestScore) {
        bestScore = score;
        bestP2 = p2;
      }
    }
    // Preserve draft order sorting inside the pair for clean display
    const idx1 = draftOrder.indexOf(p1);
    const idx2 = draftOrder.indexOf(bestP2);
    return idx1 <= idx2 ? [p1, bestP2] : [bestP2, p1];
  }

  const games = [];
  for (let idx = 0; idx < totalGames; idx++) {
    let pA, pB;
    let sPair = null;
    if (idx < slotPairs.length) {
      sPair = slotPairs[idx];
      // Convert 1-indexed slots to 0-indexed indices (safely bounded)
      let s1A = Math.min(Math.max(1, sPair[0]), nA) - 1;
      let s2A = Math.min(Math.max(1, sPair[1]), nA) - 1;
      if (s1A === s2A && nA >= 2) s2A = (s1A + 1) % nA;

      let s1B = Math.min(Math.max(1, sPair[0]), nB) - 1;
      let s2B = Math.min(Math.max(1, sPair[1]), nB) - 1;
      if (s1B === s2B && nB >= 2) s2B = (s1B + 1) % nB;

      pA = [teamA.draftOrder[s1A], teamA.draftOrder[s2A]];
      pB = [teamB.draftOrder[s1B], teamB.draftOrder[s2B]];
    } else {
      // Extra games for uneven rosters: prioritize players with the fewest games played!
      pA = pickBalancedPair(teamA.draftOrder, playCountsA, pairHistoryA);
      pB = pickBalancedPair(teamB.draftOrder, playCountsB, pairHistoryB);
    }

    recordPair(pA, playCountsA, pairHistoryA);
    recordPair(pB, playCountsB, pairHistoryB);

    const isExtra = idx >= baseGamesCount;
    games.push({
      id: idx,
      pairA: pA,
      pairB: pB,
      slotPair: sPair,
      scoreA: 0,
      scoreB: 0,
      saved: false,
      inProgress: false,
      goalScore,
      isExtra,
      randomized: isExtra || (nA !== nB),
    });
  }
  return games;
}

export function randomizePendingMatchups(games, teamA, teamB, mode = 'mirror') {
  const nA = teamA.draftOrder.length;
  const nB = teamB.draftOrder.length;
  const commonSize = Math.min(nA, nB);

  return games.map((game) => {
    // Only randomize games that are NOT in progress and NOT saved
    if (game.inProgress || game.saved) return game;

    if (mode === 'mirror' && commonSize >= 2) {
      // Pick 2 distinct slots between 1 and commonSize
      const slots = shuffle(Array.from({ length: commonSize }, (_, i) => i + 1));
      const s1 = Math.min(slots[0], slots[1]);
      const s2 = Math.max(slots[0], slots[1]);
      const pA = [teamA.draftOrder[s1 - 1], teamA.draftOrder[s2 - 1]];
      const pB = [teamB.draftOrder[s1 - 1], teamB.draftOrder[s2 - 1]];
      return {
        ...game,
        pairA: pA,
        pairB: pB,
        slotPair: [s1, s2],
        randomized: true,
      };
    } else {
      // Free pick: pick 2 random distinct players from teamA and 2 from teamB
      const candA = shuffle([...teamA.draftOrder]);
      const candB = shuffle([...teamB.draftOrder]);
      return {
        ...game,
        pairA: [candA[0], candA[1]],
        pairB: [candB[0], candB[1]],
        slotPair: null,
        randomized: true,
      };
    }
  });
}

export function revertPendingMatchups(games, teamA, teamB, goalScore, matchupConfig = { preset: 'adjacent' }) {
  const originalGames = generateGames(teamA, teamB, goalScore, matchupConfig);
  return games.map((game, idx) => {
    if (game.inProgress || game.saved) return game;
    const orig = originalGames[idx];
    if (!orig) return game;
    return {
      ...game,
      pairA: [...orig.pairA],
      pairB: [...orig.pairB],
      slotPair: orig.slotPair ? [...orig.slotPair] : null,
      randomized: orig.randomized,
    };
  });
}

export function revertSingleMatchup(game, gameIdx, teamA, teamB, goalScore, matchupConfig = { preset: 'adjacent' }) {
  if (game.inProgress || game.saved) return game;
  const originalGames = generateGames(teamA, teamB, goalScore, matchupConfig);
  const orig = originalGames[gameIdx];
  if (!orig) return game;
  return {
    ...game,
    pairA: [...orig.pairA],
    pairB: [...orig.pairB],
    slotPair: orig.slotPair ? [...orig.slotPair] : null,
    randomized: orig.randomized,
  };
}

export function hasRandomizedOrEditedPendingGames(games, teamA, teamB, goalScore, matchupConfig = { preset: 'adjacent' }) {
  if (!games || !teamA || !teamB) return false;
  const originalGames = generateGames(teamA, teamB, goalScore, matchupConfig);
  return games.some((game, idx) => {
    if (game.inProgress || game.saved) return false;
    const orig = originalGames[idx];
    if (!orig) return false;
    return (
      game.pairA[0] !== orig.pairA[0] ||
      game.pairA[1] !== orig.pairA[1] ||
      game.pairB[0] !== orig.pairB[0] ||
      game.pairB[1] !== orig.pairB[1]
    );
  });
}

export function isSingleGameModified(game, gameIdx, teamA, teamB, goalScore, matchupConfig = { preset: 'adjacent' }) {
  if (!game || game.inProgress || game.saved || !teamA || !teamB) return false;
  const originalGames = generateGames(teamA, teamB, goalScore, matchupConfig);
  const orig = originalGames[gameIdx];
  if (!orig) return false;
  return (
    game.pairA[0] !== orig.pairA[0] ||
    game.pairA[1] !== orig.pairA[1] ||
    game.pairB[0] !== orig.pairB[0] ||
    game.pairB[1] !== orig.pairB[1]
  );
}

export function substitutePlayerInTournament({ bracket, teams, playersById, playerPool, teamId, oldPlayerId, newPlayerName }) {
  const cleanName = String(newPlayerName).trim();
  if (!cleanName) return null;

  const maxExistingId = Math.max(0, ...playerPool.map((p) => p.id));
  const newPlayerId = maxExistingId + 1;

  const newPlayersById = { ...playersById, [newPlayerId]: cleanName };
  const newPlayerPool = [...playerPool, { id: newPlayerId, name: cleanName }];

  const newTeams = teams.map((team) => {
    if (team.id !== teamId) return team;
    return {
      ...team,
      draftOrder: team.draftOrder.map((id) => (id === oldPlayerId ? newPlayerId : id)),
      captainId: team.captainId === oldPlayerId ? newPlayerId : team.captainId,
    };
  });

  let newBracket = bracket ? JSON.parse(JSON.stringify(bracket)) : null;
  if (newBracket && newBracket.rounds) {
    newBracket.rounds.forEach((round) => {
      round.forEach((match) => {
        if (match.games) {
          match.games = match.games.map((g) => {
            if (g.saved) return g; // preserve completed game stats
            return {
              ...g,
              pairA: g.pairA.map((id) => (id === oldPlayerId ? newPlayerId : id)),
              pairB: g.pairB.map((id) => (id === oldPlayerId ? newPlayerId : id)),
            };
          });
        }
        if (match.dreambreaker && !match.dreambreaker.started) {
          if (Array.isArray(match.dreambreaker.lineupA)) {
            match.dreambreaker.lineupA = match.dreambreaker.lineupA.map((id) => (id === oldPlayerId ? newPlayerId : id));
          }
          if (Array.isArray(match.dreambreaker.lineupB)) {
            match.dreambreaker.lineupB = match.dreambreaker.lineupB.map((id) => (id === oldPlayerId ? newPlayerId : id));
          }
        }
      });
    });
  }

  return {
    bracket: newBracket,
    teams: newTeams,
    playersById: newPlayersById,
    playerPool: newPlayerPool,
    newPlayerId,
  };
}

export function renamePlayerInTournament({ playersById, playerPool, playerId, newName }) {
  const cleanName = String(newName).trim();
  if (!cleanName) return null;
  const newPlayersById = { ...playersById, [playerId]: cleanName };
  const newPlayerPool = (playerPool || []).map((p) => (p.id === playerId ? { ...p, name: cleanName } : p));
  return {
    playersById: newPlayersById,
    playerPool: newPlayerPool,
  };
}

export function reorderTeamDraftPosition({ bracket, teams, teamId, fromIndex, toIndex }) {
  const targetTeam = teams.find((t) => t.id === teamId);
  if (!targetTeam) return null;
  const n = targetTeam.draftOrder.length;
  if (fromIndex < 0 || fromIndex >= n || toIndex < 0 || toIndex >= n || fromIndex === toIndex) return null;

  const newDraftOrder = [...targetTeam.draftOrder];
  const [moved] = newDraftOrder.splice(fromIndex, 1);
  newDraftOrder.splice(toIndex, 0, moved);

  const newTeams = teams.map((team) => {
    if (team.id !== teamId) return team;
    return {
      ...team,
      draftOrder: newDraftOrder,
    };
  });

  let newBracket = bracket ? JSON.parse(JSON.stringify(bracket)) : null;
  if (newBracket && newBracket.rounds) {
    newBracket.rounds.forEach((round) => {
      round.forEach((match) => {
        const isTeamA = match.teamAId === teamId;
        const isTeamB = match.teamBId === teamId;
        if (!isTeamA && !isTeamB) return;

        if (match.games) {
          match.games = match.games.map((g) => {
            if (g.saved || g.inProgress || !g.slotPair || g.slotPair.length < 2) return g;
            const s1 = Math.min(Math.max(1, g.slotPair[0]), n) - 1;
            let s2 = Math.min(Math.max(1, g.slotPair[1]), n) - 1;
            if (s1 === s2 && n >= 2) s2 = (s1 + 1) % n;
            const updatedPair = [newDraftOrder[s1], newDraftOrder[s2]];
            return {
              ...g,
              pairA: isTeamA ? updatedPair : g.pairA,
              pairB: isTeamB ? updatedPair : g.pairB,
            };
          });
        }

        if (match.dreambreaker && !match.dreambreaker.started) {
          if (isTeamA && !match.dreambreaker.lockedA) {
            match.dreambreaker.lineupA = [...newDraftOrder];
          }
          if (isTeamB && !match.dreambreaker.lockedB) {
            match.dreambreaker.lineupB = [...newDraftOrder];
          }
        }
      });
    });
  }

  return {
    teams: newTeams,
    bracket: newBracket,
  };
}

export function parsePlayersFromCSV(csvText) {
  if (!csvText) return [];
  const lines = String(csvText)
    .replace(/^\uFEFF/, '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length === 0) return [];

  function splitCSVRow(row) {
    const result = [];
    let current = '';
    let inQuotes = false;
    for (let i = 0; i < row.length; i++) {
      const ch = row[i];
      if (ch === '"') {
        if (inQuotes && row[i + 1] === '"') {
          current += '"';
          i++;
        } else {
          inQuotes = !inQuotes;
        }
      } else if ((ch === ',' || ch === ';' || ch === '\t') && !inQuotes) {
        result.push(current.trim());
        current = '';
      } else {
        current += ch;
      }
    }
    result.push(current.trim());
    return result;
  }

  const rows = lines.map(splitCSVRow);
  const firstRow = rows[0].map((c) => c.toLowerCase());
  const headerKeywords = ['name', 'player', 'player name', 'full name', 'fullname', 'first name', 'firstname', 'participant', 'member'];
  const lastKeywords = ['last name', 'lastname', 'surname'];

  const nameColIdx = firstRow.findIndex((c) => headerKeywords.includes(c));
  const lastColIdx = firstRow.findIndex((c) => lastKeywords.includes(c));
  const hasHeader = nameColIdx !== -1 || firstRow.some((c) => ['id', 'email', 'phone', 'dupr', 'rating', 'skill', 'team', 'captain'].includes(c));

  const names = [];
  const startRow = hasHeader ? 1 : 0;

  for (let r = startRow; r < rows.length; r++) {
    const cols = rows[r];
    if (!cols || cols.length === 0) continue;

    if (hasHeader && nameColIdx !== -1) {
      let fullName = cols[nameColIdx] || '';
      if (lastColIdx !== -1 && cols[lastColIdx]) {
        fullName = `${fullName} ${cols[lastColIdx]}`.trim();
      }
      if (fullName) names.push(fullName);
    } else if (cols.length === 1) {
      if (cols[0]) names.push(cols[0]);
    } else {
      // Multi-column without explicit header: if single row of comma-separated names, add all; otherwise take first non-numeric cell
      if (rows.length === 1 && !hasHeader) {
        cols.forEach((c) => {
          if (c && isNaN(Number(c))) names.push(c);
        });
      } else {
        const candidate = cols.find((c) => c && isNaN(Number(c)));
        if (candidate) names.push(candidate);
      }
    }
  }

  // Deduplicate case-insensitively while preserving order
  const seen = new Set();
  const unique = [];
  for (const raw of names) {
    const clean = raw.replace(/^["']+|["']+$/g, '').trim();
    if (!clean) continue;
    const lower = clean.toLowerCase();
    if (!seen.has(lower)) {
      seen.add(lower);
      unique.push(clean);
    }
  }
  return unique;
}

function escapeCsvCell(val) {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/[",\r\n]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

export function triggerCsvDownload(filename, csvContent) {
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function generateDirectoryCSV(savedPlayers = [], playerPool = []) {
  const activeSet = new Set(
    (playerPool || []).map((p) => String(p?.name || '').trim().toLowerCase()).filter(Boolean)
  );
  const header = ['Player Name', 'In Active Tournament'];
  const rows = (savedPlayers || []).map((name) => {
    const clean = String(name || '').trim();
    const inPool = activeSet.has(clean.toLowerCase()) ? 'Yes' : 'No';
    return [escapeCsvCell(clean), escapeCsvCell(inPool)].join(',');
  });
  return [header.join(','), ...rows].join('\r\n');
}

export function generateSampleDirectoryCSV() {
  const header = ['Player Name'];
  const sampleNames = [
    'Alex Rivera',
    'Jordan Taylor',
    'Casey Morgan',
    'Sam Chen',
    'Taylor Brooks',
    'Morgan Lee',
    'Riley Patel',
    'Cameron Diaz',
  ];
  return [header.join(','), ...sampleNames].join('\r\n');
}

export function generateMatchScoresCSV({ bracket, teams = [], playersById = {}, roomId = '' }) {
  const header = [
    'Room ID',
    'Round',
    'Match ID',
    'Match Status',
    'Team A',
    'Team B',
    'Game #',
    'Game Type',
    'Team A Pair',
    'Team B Pair',
    'Score A',
    'Score B',
    'Winner',
  ];

  const rows = [];
  if (!bracket || !Array.isArray(bracket.rounds)) {
    return header.join(',');
  }

  const totalRounds = bracket.rounds.length;
  const pName = (id) => playersById[id] || `Player ${id}`;

  bracket.rounds.forEach((round, rIdx) => {
    const rLabel = roundName(totalRounds, rIdx);
    (round || []).forEach((match) => {
      if (match.isBye) return;
      const teamA = teams.find((t) => t.id === match.teamAId);
      const teamB = teams.find((t) => t.id === match.teamBId);
      const teamAName = teamA?.name || 'TBD';
      const teamBName = teamB?.name || 'TBD';

      if (Array.isArray(match.games) && match.games.length > 0) {
        match.games.forEach((g, gIdx) => {
          const pairALabel = (g.pairA || []).map(pName).join(' & ');
          const pairBLabel = (g.pairB || []).map(pName).join(' & ');
          let winnerLabel = 'Pending';
          if (g.saved) {
            if (g.scoreA > g.scoreB) winnerLabel = teamAName;
            else if (g.scoreB > g.scoreA) winnerLabel = teamBName;
            else winnerLabel = 'Tie';
          } else if (g.inProgress) {
            winnerLabel = 'In Progress';
          }

          rows.push(
            [
              roomId,
              rLabel,
              match.id,
              match.status,
              teamAName,
              teamBName,
              gIdx + 1,
              g.isExtra ? 'Regulation (Extra)' : 'Regulation',
              pairALabel,
              pairBLabel,
              g.saved ? g.scoreA : '',
              g.saved ? g.scoreB : '',
              winnerLabel,
            ]
              .map(escapeCsvCell)
              .join(',')
          );
        });
      }

      if (match.dreambreaker && (match.dreambreaker.started || match.dreambreaker.completed)) {
        const db = match.dreambreaker;
        const dbWinner =
          db.winnerId === match.teamAId
            ? teamAName
            : db.winnerId === match.teamBId
            ? teamBName
            : 'In Progress';
        const dbTypeLabel = db.format === 'doubles' ? 'Dreambreaker (Doubles)' : 'Dreambreaker (Singles)';

        rows.push(
          [
            roomId,
            rLabel,
            match.id,
            match.status,
            teamAName,
            teamBName,
            'TB',
            dbTypeLabel,
            (db.lineupA || []).map(pName).join(' / '),
            (db.lineupB || []).map(pName).join(' / '),
            db.scoreA,
            db.scoreB,
            dbWinner,
          ]
            .map(escapeCsvCell)
            .join(',')
        );
      }
    });
  });

  return [header.join(','), ...rows].join('\r\n');
}

export function generateIndividualStatsCSV({ globalStats = {}, roomId = '' }) {
  const header = [
    'Rank',
    'Room ID',
    'Player',
    'Matches Played',
    'Wins',
    'Losses',
    'Win %',
    'Points Won',
    'Points Lost',
    'Point Diff',
    'Dreambreaker +/-',
  ];

  const playerRows = Object.values(globalStats || {}).sort((a, b) => {
    const wrA = a.matchesPlayed ? a.wins / a.matchesPlayed : 0;
    const wrB = b.matchesPlayed ? b.wins / b.matchesPlayed : 0;
    return wrB - wrA || b.wins - a.wins;
  });

  const rows = playerRows.map((r, idx) => {
    const winPct = r.matchesPlayed ? `${Math.round((r.wins / r.matchesPlayed) * 100)}%` : '0%';
    const ptDiff = (r.pointsWon || 0) - (r.pointsLost || 0);
    return [
      idx + 1,
      roomId,
      r.name,
      r.matchesPlayed || 0,
      r.wins || 0,
      r.losses || 0,
      winPct,
      r.pointsWon || 0,
      r.pointsLost || 0,
      ptDiff,
      r.dreambreakerDiff || 0,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [header.join(','), ...rows].join('\r\n');
}

export function generatePartnershipStatsCSV({ partnershipStats = {}, roomId = '' }) {
  const header = [
    'Rank',
    'Room ID',
    'Partnership',
    'Games Played',
    'Wins',
    'Losses',
    'Win %',
    'Points Won',
    'Points Lost',
    'Point Diff',
  ];

  const pairRows = Object.values(partnershipStats || {}).sort((a, b) => {
    return b.pointDiff - a.pointDiff || b.wins - a.wins || b.gamesPlayed - a.gamesPlayed;
  });

  const rows = pairRows.map((r, idx) => {
    const winPct = r.gamesPlayed ? `${Math.round((r.wins / r.gamesPlayed) * 100)}%` : '0%';
    return [
      idx + 1,
      roomId,
      r.name,
      r.gamesPlayed || 0,
      r.wins || 0,
      r.losses || 0,
      winPct,
      r.pointsWon || 0,
      r.pointsLost || 0,
      r.pointDiff || 0,
    ]
      .map(escapeCsvCell)
      .join(',');
  });

  return [header.join(','), ...rows].join('\r\n');
}

export function generateLeaderboardCSV({ globalStats = {}, partnershipStats = {}, roomId = '' }) {
  const lines = [];

  // Section 1: Individual Player Leaderboard
  lines.push('INDIVIDUAL LEADERBOARD');
  lines.push(
    [
      'Rank',
      'Room ID',
      'Player',
      'Matches Played',
      'Wins',
      'Losses',
      'Win %',
      'Points Won',
      'Points Lost',
      'Point Diff',
      'Dreambreaker +/-',
    ].join(',')
  );

  const playerRows = Object.values(globalStats || {}).sort((a, b) => {
    const wrA = a.matchesPlayed ? a.wins / a.matchesPlayed : 0;
    const wrB = b.matchesPlayed ? b.wins / b.matchesPlayed : 0;
    return wrB - wrA || b.wins - a.wins;
  });

  playerRows.forEach((r, idx) => {
    const winPct = r.matchesPlayed ? `${Math.round((r.wins / r.matchesPlayed) * 100)}%` : '0%';
    const ptDiff = (r.pointsWon || 0) - (r.pointsLost || 0);
    lines.push(
      [
        idx + 1,
        roomId,
        r.name,
        r.matchesPlayed || 0,
        r.wins || 0,
        r.losses || 0,
        winPct,
        r.pointsWon || 0,
        r.pointsLost || 0,
        ptDiff,
        r.dreambreakerDiff || 0,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  });

  lines.push('');
  lines.push('PARTNERSHIP LEADERBOARD');
  lines.push(
    [
      'Rank',
      'Room ID',
      'Partnership',
      'Games Played',
      'Wins',
      'Losses',
      'Win %',
      'Points Won',
      'Points Lost',
      'Point Diff',
    ].join(',')
  );

  const pairRows = Object.values(partnershipStats || {}).sort((a, b) => {
    return b.pointDiff - a.pointDiff || b.wins - a.wins || b.gamesPlayed - a.gamesPlayed;
  });

  pairRows.forEach((r, idx) => {
    const winPct = r.gamesPlayed ? `${Math.round((r.wins / r.gamesPlayed) * 100)}%` : '0%';
    lines.push(
      [
        idx + 1,
        roomId,
        r.name,
        r.gamesPlayed || 0,
        r.wins || 0,
        r.losses || 0,
        winPct,
        r.pointsWon || 0,
        r.pointsLost || 0,
        r.pointDiff || 0,
      ]
        .map(escapeCsvCell)
        .join(',')
    );
  });

  return lines.join('\r\n');
}

export function initializeDraftState(playerPool, numTeams, allowUneven = true, selectedCaptainIds = []) {
  const teams = [];
  const draftPlayers = [...playerPool];
  const sittingOut = [];

  const baseTeamSize = Math.floor(draftPlayers.length / numTeams);
  const remainder = draftPlayers.length % numTeams;

  if (!allowUneven && remainder > 0) {
    const captainSet = new Set(selectedCaptainIds);
    const nonCaptains = draftPlayers.filter((p) => !captainSet.has(p.id));
    const shuffledNonCaptains = shuffle(nonCaptains);
    const toSitOut = shuffledNonCaptains.slice(0, remainder);
    const sitOutSet = new Set(toSitOut.map((p) => p.id));
    toSitOut.forEach((p) => sittingOut.push(p.id));

    const toDraft = draftPlayers.filter((p) => !sitOutSet.has(p.id));
    draftPlayers.length = 0;
    draftPlayers.push(...toDraft);
  }

  for (let i = 0; i < numTeams; i++) {
    teams.push({
      id: i,
      name: `Team ${i + 1}`,
      color: TEAM_COLORS[i % TEAM_COLORS.length],
      captainId: null,
      draftOrder: [],
    });
  }

  // Determine captains:
  const captains = [];
  const captainIdSet = new Set();
  if (Array.isArray(selectedCaptainIds)) {
    for (const cid of selectedCaptainIds) {
      const found = draftPlayers.find((p) => p.id === cid);
      if (found && !captainIdSet.has(found.id) && captains.length < numTeams) {
        captains.push(found);
        captainIdSet.add(found.id);
      }
    }
  }

  // Fill any remaining captain slots randomly
  const poolForRandomCaptains = shuffle(draftPlayers.filter((p) => !captainIdSet.has(p.id)));
  while (captains.length < numTeams && poolForRandomCaptains.length > 0) {
    const nextCaptain = poolForRandomCaptains.pop();
    captains.push(nextCaptain);
    captainIdSet.add(nextCaptain.id);
  }

  for (let i = 0; i < numTeams; i++) {
    const player = captains[i];
    teams[i].captainId = player.id;
    teams[i].name = `Team ${player.name}`;
    teams[i].draftOrder.push(player.id);
  }

  const remainingPool = shuffle(draftPlayers.filter((p) => !captainIdSet.has(p.id)));

  const pickSequence = [];
  let draftedCount = numTeams;
  const totalPlayersToDraft = draftPlayers.length;
  let round = 1;

  while (draftedCount < totalPlayersToDraft) {
    const isEvenRound = round % 2 === 0;
    const order = isEvenRound
      ? Array.from({ length: numTeams }, (_, i) => numTeams - 1 - i)
      : Array.from({ length: numTeams }, (_, i) => i);

    for (const teamIdx of order) {
      if (draftedCount < totalPlayersToDraft) {
        pickSequence.push(teamIdx);
        draftedCount++;
      }
    }
    round++;
  }

  const playersById = {};
  playerPool.forEach((p) => { playersById[p.id] = p.name; });

  return { teams, remainingPool, pickSequence, playersById, sittingOut, teamSize: baseTeamSize };
}

export function generateBracket(teamsInput) {
  const order = shuffle(teamsInput);
  const numTeams = order.length;
  const bracketSize = Math.pow(2, Math.ceil(Math.log2(Math.max(2, numTeams))));
  const numRounds = Math.log2(bracketSize);
  const rounds = [];

  const slots = new Array(bracketSize).fill(null);
  for (let i = 0; i < numTeams; i++) {
    slots[i] = order[i].id;
  }

  const round0 = [];
  for (let i = 0; i < bracketSize; i += 2) {
    const teamAId = slots[i];
    const teamBId = slots[i + 1];
    const isBye = teamAId !== null && teamBId === null;
    round0.push({
      id: `r0-m${i / 2}`,
      teamAId,
      teamBId,
      winnerId: isBye ? teamAId : null,
      isBye,
      status: isBye ? 'complete' : teamAId !== null && teamBId !== null ? 'ready' : 'pending',
      games: null,
      gamesWonA: 0,
      gamesWonB: 0,
      dreambreaker: null,
    });
  }
  rounds.push(round0);

  for (let r = 1; r < numRounds; r++) {
    const prevMatches = rounds[r - 1].length;
    const matches = [];
    for (let m = 0; m < prevMatches / 2; m++) {
      matches.push({
        id: `r${r}-m${m}`,
        teamAId: null,
        teamBId: null,
        winnerId: null,
        isBye: false,
        status: 'pending',
        games: null,
        gamesWonA: 0,
        gamesWonB: 0,
        dreambreaker: null,
      });
    }
    rounds.push(matches);
  }

  for (let mi = 0; mi < round0.length; mi++) {
    if (round0[mi].isBye && rounds.length > 1) {
      const nextIdx = Math.floor(mi / 2);
      const slot = mi % 2 === 0 ? 'teamAId' : 'teamBId';
      rounds[1][nextIdx][slot] = round0[mi].winnerId;
    }
  }
  if (rounds.length > 1) {
    rounds[1].forEach((m) => {
      if (m.teamAId !== null && m.teamBId !== null) m.status = 'ready';
    });
  }

  return { rounds, championId: null };
}

export function advanceWinner(bracket, roundIdx, matchIdx, winnerId) {
  const nb = JSON.parse(JSON.stringify(bracket));
  const m = nb.rounds[roundIdx][matchIdx];
  m.winnerId = winnerId;
  m.status = 'complete';
  if (roundIdx + 1 < nb.rounds.length) {
    const nextIdx = Math.floor(matchIdx / 2);
    const slot = matchIdx % 2 === 0 ? 'teamAId' : 'teamBId';
    const nextMatch = nb.rounds[roundIdx + 1][nextIdx];
    nextMatch[slot] = winnerId;
    if (nextMatch.teamAId !== null && nextMatch.teamBId !== null) nextMatch.status = 'ready';
  } else {
    nb.championId = winnerId;
  }
  return nb;
}

/**
 * Evenly distributes `1..numCourts` across ready/active matchups in each bracket round
 * and pre-generates games for ready matchups so both sides of the bracket can be
 * assigned courts and scored immediately.
 */
export function distributeCourtsToMatches(
  bracket,
  teams = [],
  numCourts = 2,
  goalScore = 11,
  matchupConfig = { preset: 'adjacent', customSlotPairs: [] }
) {
  if (!bracket || !Array.isArray(bracket.rounds)) return bracket;
  const nb = JSON.parse(JSON.stringify(bracket));
  const totalCourts = Math.max(1, Number(numCourts) || 2);
  const teamMap = new Map((teams || []).map((t) => [t.id, t]));

  nb.rounds.forEach((round) => {
    const activeMatches = round.filter(
      (m) => m.teamAId !== null && m.teamBId !== null && !m.isBye && m.status !== 'complete'
    );
    const mCount = activeMatches.length;
    if (mCount === 0) return;

    // Split 1..totalCourts evenly across activeMatches in this round
    const buckets = Array.from({ length: mCount }, () => []);
    if (totalCourts >= mCount) {
      const base = Math.floor(totalCourts / mCount);
      const extra = totalCourts % mCount;
      let cursor = 1;
      for (let i = 0; i < mCount; i++) {
        const size = base + (i < extra ? 1 : 0);
        for (let j = 0; j < size; j++) {
          buckets[i].push(cursor++);
        }
      }
    } else {
      for (let i = 0; i < mCount; i++) {
        buckets[i].push((i % totalCourts) + 1);
      }
    }

    const usedInitialCourts = new Set();
    activeMatches.forEach((m, idx) => {
      m.assignedCourts = buckets[idx] || [1];
      if (!m.games) {
        const teamA = teamMap.get(m.teamAId);
        const teamB = teamMap.get(m.teamBId);
        if (teamA && teamB) {
          m.games = generateGames(teamA, teamB, goalScore, matchupConfig);
        }
      }
      // Pre-assign court numbers to initial games matching this matchup's assignedCourts
      if (Array.isArray(m.games)) {
        let cIdx = 0;
        m.games.forEach((g) => {
          if (g.saved || g.inProgress || g.court) return;
          while (cIdx < m.assignedCourts.length && usedInitialCourts.has(m.assignedCourts[cIdx])) {
            cIdx++;
          }
          if (cIdx < m.assignedCourts.length) {
            g.court = m.assignedCourts[cIdx];
            usedInitialCourts.add(g.court);
            cIdx++;
          }
        });
      }
    });
  });

  return nb;
}

export function roundName(totalRounds, roundIdx) {
  const remaining = totalRounds - roundIdx;
  if (remaining === 1) return 'Final';
  if (remaining === 2) return 'Semifinals';
  if (remaining === 3) return 'Quarterfinals';
  return `Round ${roundIdx + 1}`;
}

export function getPartnershipKey(nameA, nameB) {
  const normA = String(nameA).trim();
  const normB = String(nameB).trim();
  return [normA, normB].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })).join(' & ');
}

export function computeAllStats(priorPlayerStats = {}, priorPartnershipStats = {}, bracket = null, teams = [], playersById = {}) {
  const playerStats = JSON.parse(JSON.stringify(priorPlayerStats || {}));
  const partnershipStats = JSON.parse(JSON.stringify(priorPartnershipStats || {}));

  function ensurePlayer(id) {
    const name = playersById[id];
    if (!name) return null;
    const key = String(name).trim().toLowerCase();
    if (!playerStats[key]) {
      playerStats[key] = { name: String(name).trim(), matchesPlayed: 0, wins: 0, losses: 0, pointsWon: 0, pointsLost: 0, dreambreakerDiff: 0 };
    }
    return playerStats[key];
  }

  function ensurePair(id1, id2) {
    const name1 = playersById[id1];
    const name2 = playersById[id2];
    if (!name1 || !name2) return null;
    const key = getPartnershipKey(name1, name2);
    if (!partnershipStats[key]) {
      partnershipStats[key] = {
        name: key,
        names: [String(name1).trim(), String(name2).trim()],
        gamesPlayed: 0,
        wins: 0,
        losses: 0,
        pointsWon: 0,
        pointsLost: 0,
        pointDiff: 0,
      };
    }
    return partnershipStats[key];
  }

  if (bracket && bracket.rounds) {
    bracket.rounds.forEach((round) => {
      round.forEach((match) => {
        if (!match.games) return;
        const teamA = teams.find((t) => t.id === match.teamAId);
        const teamB = teams.find((t) => t.id === match.teamBId);
        if (!teamA || !teamB) return;

        match.games.forEach((g) => {
          if (!g.saved) return;
          g.pairA.forEach((id) => {
            const p = ensurePlayer(id);
            if (p) { p.pointsWon += g.scoreA; p.pointsLost += g.scoreB; }
          });
          g.pairB.forEach((id) => {
            const p = ensurePlayer(id);
            if (p) { p.pointsWon += g.scoreB; p.pointsLost += g.scoreA; }
          });

          const pairA = ensurePair(g.pairA[0], g.pairA[1]);
          const pairB = ensurePair(g.pairB[0], g.pairB[1]);
          if (pairA) {
            pairA.gamesPlayed += 1;
            if (g.scoreA > g.scoreB) pairA.wins += 1; else if (g.scoreB > g.scoreA) pairA.losses += 1;
            pairA.pointsWon += g.scoreA;
            pairA.pointsLost += g.scoreB;
            pairA.pointDiff += (g.scoreA - g.scoreB);
          }
          if (pairB) {
            pairB.gamesPlayed += 1;
            if (g.scoreB > g.scoreA) pairB.wins += 1; else if (g.scoreA > g.scoreB) pairB.losses += 1;
            pairB.pointsWon += g.scoreB;
            pairB.pointsLost += g.scoreA;
            pairB.pointDiff += (g.scoreB - g.scoreA);
          }
        });

        if (match.status === 'complete' && match.winnerId !== null) {
          teamA.draftOrder.forEach((id) => {
            const p = ensurePlayer(id);
            if (p) {
              p.matchesPlayed += 1;
              if (match.winnerId === teamA.id) p.wins += 1; else p.losses += 1;
            }
          });
          teamB.draftOrder.forEach((id) => {
            const p = ensurePlayer(id);
            if (p) {
              p.matchesPlayed += 1;
              if (match.winnerId === teamB.id) p.wins += 1; else p.losses += 1;
            }
          });
        }

        const db = match.dreambreaker;
        if (db && db.completed && db.playerStats) {
          Object.entries(db.playerStats).forEach(([idStr, ps]) => {
            const p = ensurePlayer(Number(idStr));
            if (p) {
              p.pointsWon += ps.pointsWon;
              p.pointsLost += ps.pointsLost;
              p.dreambreakerDiff += (ps.pointsWon - ps.pointsLost);
            }
          });
        }
      });
    });
  }

  return { playerStats, partnershipStats };
}
