import React, { useState, useEffect } from 'react';
import { X, Shuffle, Check, ArrowRightLeft, Users, ShieldAlert } from 'lucide-react';

export function EditMatchupModal({
  isOpen,
  onClose,
  game,
  gameIndex,
  teamA,
  teamB,
  playersById,
  onSaveMatchup,
  isAdmin,
}) {
  const [mode, setMode] = useState('mirror'); // 'mirror' | 'free'

  // Mirror state (1-indexed draft slots)
  const [slot1, setSlot1] = useState(1);
  const [slot2, setSlot2] = useState(2);

  // Free pick state (player IDs)
  const [teamAPlayer1, setTeamAPlayer1] = useState('');
  const [teamAPlayer2, setTeamAPlayer2] = useState('');
  const [teamBPlayer1, setTeamBPlayer1] = useState('');
  const [teamBPlayer2, setTeamBPlayer2] = useState('');

  const nA = teamA?.draftOrder?.length || 4;
  const nB = teamB?.draftOrder?.length || 4;
  const maxSlots = Math.min(nA, nB);

  useEffect(() => {
    if (!game) return;
    // Initialize mirror slots if possible
    if (game.slotPair && game.slotPair.length === 2) {
      setSlot1(game.slotPair[0]);
      setSlot2(game.slotPair[1]);
    } else if (game.pairA && teamA?.draftOrder) {
      const idx1 = teamA.draftOrder.indexOf(game.pairA[0]);
      const idx2 = teamA.draftOrder.indexOf(game.pairA[1]);
      if (idx1 !== -1 && idx2 !== -1) {
        setSlot1(idx1 + 1);
        setSlot2(idx2 + 1);
      } else {
        setSlot1(1);
        setSlot2(2);
      }
    }

    // Initialize free picks
    if (game.pairA && game.pairA.length === 2) {
      setTeamAPlayer1(game.pairA[0]);
      setTeamAPlayer2(game.pairA[1]);
    }
    if (game.pairB && game.pairB.length === 2) {
      setTeamBPlayer1(game.pairB[0]);
      setTeamBPlayer2(game.pairB[1]);
    }
  }, [game, teamA, teamB]);

  if (!isOpen || !game) return null;

  function handleSave() {
    if (!isAdmin) return;
    if (mode === 'mirror') {
      const s1A = Math.min(Math.max(1, slot1), nA) - 1;
      const s2A = Math.min(Math.max(1, slot2), nA) - 1;
      const s1B = Math.min(Math.max(1, slot1), nB) - 1;
      const s2B = Math.min(Math.max(1, slot2), nB) - 1;

      const pA = [teamA.draftOrder[s1A], teamA.draftOrder[s2A]];
      const pB = [teamB.draftOrder[s1B], teamB.draftOrder[s2B]];
      onSaveMatchup(game.id, pA, pB, [slot1, slot2]);
    } else {
      if (teamAPlayer1 === teamAPlayer2 || teamBPlayer1 === teamBPlayer2) return;
      onSaveMatchup(game.id, [Number(teamAPlayer1), Number(teamAPlayer2)], [Number(teamBPlayer1), Number(teamBPlayer2)], null);
    }
    onClose();
  }

  const pName = (id) => playersById[id] || `Player ${id}`;

  const mirrorPairANames = [
    teamA?.draftOrder?.[slot1 - 1] ? pName(teamA.draftOrder[slot1 - 1]) : `Slot ${slot1}`,
    teamA?.draftOrder?.[slot2 - 1] ? pName(teamA.draftOrder[slot2 - 1]) : `Slot ${slot2}`,
  ];

  const mirrorPairBNames = [
    teamB?.draftOrder?.[slot1 - 1] ? pName(teamB.draftOrder[slot1 - 1]) : `Slot ${slot1}`,
    teamB?.draftOrder?.[slot2 - 1] ? pName(teamB.draftOrder[slot2 - 1]) : `Slot ${slot2}`,
  ];

  const isMirrorValid = slot1 !== slot2 && slot1 >= 1 && slot2 >= 1 && slot1 <= maxSlots && slot2 <= maxSlots;
  const isFreeValid = teamAPlayer1 && teamAPlayer2 && teamAPlayer1 !== teamAPlayer2 && teamBPlayer1 && teamBPlayer2 && teamBPlayer1 !== teamBPlayer2;
  const canSave = isAdmin && (mode === 'mirror' ? isMirrorValid : isFreeValid);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-slate-950/80 backdrop-blur-sm animate-in fade-in duration-150">
      <div className="bg-slate-900 border border-slate-800 rounded-3xl w-full max-w-md p-5 sm:p-6 shadow-2xl relative overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-mono font-bold text-[#d7f24c] uppercase tracking-wider bg-[#d7f24c]/10 border border-[#d7f24c]/30 px-2 py-0.5 rounded-full">
                Game {gameIndex + 1}
              </span>
              <h3 className="text-lg font-bold text-white font-display">Edit Matchup</h3>
            </div>
            <p className="text-xs text-slate-400 mt-0.5">Customize player pairings for this upcoming game.</p>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-400 hover:text-white transition"
          >
            <X size={18} />
          </button>
        </div>

        {/* Mode Selector Tabs */}
        <div className="grid grid-cols-2 gap-1.5 bg-slate-950 p-1 rounded-2xl border border-slate-800 mb-4">
          <button
            type="button"
            onClick={() => setMode('mirror')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mode === 'mirror'
                ? 'bg-[#d7f24c] text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <ArrowRightLeft size={13} />
            Mirror Draft Slots
          </button>
          <button
            type="button"
            onClick={() => setMode('free')}
            className={`py-2 px-3 rounded-xl text-xs font-bold transition flex items-center justify-center gap-1.5 ${
              mode === 'free'
                ? 'bg-[#d7f24c] text-slate-950 shadow-md'
                : 'text-slate-400 hover:text-slate-200'
            }`}
          >
            <Users size={13} />
            Custom Free Pick
          </button>
        </div>

        {/* Tab 1: Mirror Draft Slots */}
        {mode === 'mirror' && (
          <div className="space-y-4">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-2xl p-3.5 text-xs text-slate-400">
              <span className="font-semibold text-slate-200 block mb-1 flex items-center gap-1.5">
                <ArrowRightLeft size={13} className="text-[#d7f24c]" /> Mirrored Draft Order Rules
              </span>
              Both teams will play with the corresponding draft picks (e.g. Slot {slot1} & Slot {slot2}). Neither team receives an unfair pairing matchup.
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Slot Position A
                </label>
                <select
                  value={slot1}
                  onChange={(e) => setSlot1(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                >
                  {Array.from({ length: maxSlots }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>
                      Slot {s} {s === 1 ? '(Captain)' : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="text-[11px] font-bold text-slate-400 uppercase tracking-wider block mb-1.5">
                  Slot Position B
                </label>
                <select
                  value={slot2}
                  onChange={(e) => setSlot2(Number(e.target.value))}
                  className="w-full bg-slate-800 border border-slate-700 rounded-xl px-3 py-2.5 text-white font-bold text-sm focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                >
                  {Array.from({ length: maxSlots }, (_, i) => i + 1).map((s) => (
                    <option key={s} value={s}>
                      Slot {s} {s === 1 ? '(Captain)' : ''}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {slot1 === slot2 && (
              <p className="text-red-400 text-xs font-semibold">Please pick two distinct draft slot positions.</p>
            )}

            {/* Live Preview */}
            <div className="bg-slate-800/60 border border-slate-700/60 rounded-2xl p-3.5">
              <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block mb-2">
                Live Matchup Preview
              </span>
              <div className="flex items-center justify-between text-xs sm:text-sm font-semibold">
                <div className="min-w-0 flex-1">
                  <span className="text-slate-400 text-[10px] block truncate">{teamA.name}</span>
                  <span className="text-white font-bold">{mirrorPairANames.join(' & ')}</span>
                </div>
                <span className="text-slate-500 font-bold px-2">VS</span>
                <div className="min-w-0 flex-1 text-right">
                  <span className="text-slate-400 text-[10px] block truncate">{teamB.name}</span>
                  <span className="text-white font-bold">{mirrorPairBNames.join(' & ')}</span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: Custom Free Pick */}
        {mode === 'free' && (
          <div className="space-y-3.5">
            {/* Team A Selection */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
              <label className="text-xs font-bold text-slate-300 block mb-2 truncate">
                {teamA.name} Players
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={teamAPlayer1}
                  onChange={(e) => setTeamAPlayer1(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                >
                  <option value="" disabled>Player 1</option>
                  {teamA.draftOrder.map((id, idx) => (
                    <option key={id} value={id}>
                      {pName(id)} (Slot {idx + 1})
                    </option>
                  ))}
                </select>
                <select
                  value={teamAPlayer2}
                  onChange={(e) => setTeamAPlayer2(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                >
                  <option value="" disabled>Player 2</option>
                  {teamA.draftOrder.map((id, idx) => (
                    <option key={id} value={id}>
                      {pName(id)} (Slot {idx + 1})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {/* Team B Selection */}
            <div className="bg-slate-950/60 border border-slate-800 rounded-2xl p-3">
              <label className="text-xs font-bold text-slate-300 block mb-2 truncate">
                {teamB.name} Players
              </label>
              <div className="grid grid-cols-2 gap-2">
                <select
                  value={teamBPlayer1}
                  onChange={(e) => setTeamBPlayer1(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                >
                  <option value="" disabled>Player 1</option>
                  {teamB.draftOrder.map((id, idx) => (
                    <option key={id} value={id}>
                      {pName(id)} (Slot {idx + 1})
                    </option>
                  ))}
                </select>
                <select
                  value={teamBPlayer2}
                  onChange={(e) => setTeamBPlayer2(Number(e.target.value))}
                  className="bg-slate-800 border border-slate-700 rounded-xl px-2.5 py-2 text-white text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
                >
                  <option value="" disabled>Player 2</option>
                  {teamB.draftOrder.map((id, idx) => (
                    <option key={id} value={id}>
                      {pName(id)} (Slot {idx + 1})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {(teamAPlayer1 === teamAPlayer2 || teamBPlayer1 === teamBPlayer2) && (
              <p className="text-red-400 text-xs font-semibold">Each team must have two distinct players.</p>
            )}
          </div>
        )}

        {/* Footer Actions */}
        <div className="mt-5 pt-3 border-t border-slate-800 flex gap-2">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-slate-300 font-bold text-sm transition"
          >
            Cancel
          </button>
          <button
            type="button"
            disabled={!canSave}
            onClick={handleSave}
            className={`flex-1 py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-1.5 transition active:scale-95 ${
              canSave
                ? 'bg-[#d7f24c] hover:bg-[#c6e140] text-slate-950 shadow-lg shadow-[#d7f24c]/20'
                : 'bg-slate-800 text-slate-600 cursor-not-allowed'
            }`}
          >
            <Check size={16} />
            Apply Matchup
          </button>
        </div>
      </div>
    </div>
  );
}
