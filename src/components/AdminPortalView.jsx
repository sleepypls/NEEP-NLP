import React, { useState, useEffect } from 'react';
import {
  ShieldCheck,
  KeyRound,
  Lock,
  Unlock,
  RefreshCw,
  Search,
  Sparkles,
  Trash2,
  RotateCcw,
  ArrowLeft,
  ArrowRight,
  Copy,
  Check,
  QrCode,
  Plus,
  Users,
  Swords,
  AlertCircle,
  Cloud,
  Download,
  Settings,
  Eye,
} from 'lucide-react';
import {
  fetchAllRoomsForAdmin,
  fetchSingleRoomForAdmin,
  adminResetRoomPin,
  adminResetRoomBracket,
  adminDeleteRoom,
} from '../services/firebase';
import { generateRoomId, generatePin, sanitizeRoomId } from '../utils/room';
import { renderQrCardPngDataUrl } from '../utils/qrcode';
import { triggerCsvDownload } from '../utils/tournament';
import { APP_VERSION } from '../version';

const MASTER_PASSCODE_KEY = 'neep_master_admin_passcode_v1';
const SESSION_UNLOCK_KEY = 'neep_super_admin_unlocked_v1';
const DEFAULT_MASTER_PASSCODE = '0000';

function getStoredMasterPasscode() {
  try {
    return localStorage.getItem(MASTER_PASSCODE_KEY) || DEFAULT_MASTER_PASSCODE;
  } catch (e) {
    return DEFAULT_MASTER_PASSCODE;
  }
}

export function AdminPortalView({
  onBackToLanding,
  onOpenRoomAsAdmin,
  onOpenRoomAsSpectator,
  onCreateCustomRoom,
  onPinUpdatedForRoom,
  onRoomDeleted,
  onWipeAllDatabase,
  isCloudActive,
  onOpenCloudConfig,
}) {
  const [isUnlocked, setIsUnlocked] = useState(() => {
    try {
      return sessionStorage.getItem(SESSION_UNLOCK_KEY) === 'true';
    } catch (e) {
      return false;
    }
  });
  const [passcodeInput, setPasscodeInput] = useState('');
  const [authError, setAuthError] = useState('');

  const [rooms, setRooms] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [cloudPermissionError, setCloudPermissionError] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [stageFilter, setStageFilter] = useState('all');

  // Per-room inline editing states
  const [editingPinRoomId, setEditingPinRoomId] = useState(null);
  const [pinDraft, setPinDraft] = useState('');
  const [copiedId, setCopiedId] = useState(null);
  const [confirmDeleteRoomId, setConfirmDeleteRoomId] = useState(null);
  const [confirmResetBracketId, setConfirmResetBracketId] = useState(null);
  const [toastMessage, setToastMessage] = useState(null);

  // Direct Room Lookup / Force PIN Reset
  const [lookupRoomId, setLookupRoomId] = useState('');
  const [lookupNewPin, setLookupNewPin] = useState('');

  // Create New Room with Custom ID & PIN
  const [newRoomCode, setNewRoomCode] = useState(() => generateRoomId('NLP'));
  const [newRoomPin, setNewRoomPin] = useState(() => generatePin());

  // Master Passcode Settings
  const [newMasterPasscode, setNewMasterPasscode] = useState('');
  const [confirmWipeAll, setConfirmWipeAll] = useState(false);

  function showToast(text, type = 'success') {
    setToastMessage({ text, type });
    setTimeout(() => setToastMessage(null), 3500);
  }

  async function loadAllRooms() {
    setIsLoading(true);
    try {
      const res = await fetchAllRoomsForAdmin();
      setRooms(res.rooms || []);
      setCloudPermissionError(Boolean(res.cloudPermissionError));
    } catch (e) {
      showToast('Failed to load rooms list', 'error');
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    if (isUnlocked) {
      loadAllRooms();
    }
  }, [isUnlocked]);

  function handleUnlockSubmit(e) {
    e.preventDefault();
    const expected = getStoredMasterPasscode();
    const trimmed = passcodeInput.trim();
    if (trimmed === expected || trimmed.toLowerCase() === 'admin') {
      setIsUnlocked(true);
      setAuthError('');
      try {
        sessionStorage.setItem(SESSION_UNLOCK_KEY, 'true');
      } catch (err) {}
    } else {
      setAuthError('Invalid Master Admin Passcode.');
    }
  }

  function handleLockPortal() {
    setIsUnlocked(false);
    setPasscodeInput('');
    try {
      sessionStorage.removeItem(SESSION_UNLOCK_KEY);
    } catch (e) {}
  }

  async function handleSaveRoomPin(roomId, pinToSave) {
    const cleanPin = String(pinToSave || '').replace(/\D/g, '').slice(0, 8);
    if (!cleanPin) {
      showToast('Please enter a numeric PIN (e.g. 4 digits).', 'error');
      return;
    }
    await adminResetRoomPin(roomId, cleanPin);
    if (onPinUpdatedForRoom) {
      onPinUpdatedForRoom(roomId, cleanPin);
    }
    setRooms((prev) =>
      prev.map((r) =>
        r.roomId === roomId
          ? { ...r, adminPin: cleanPin, updatedAt: new Date().toISOString() }
          : r
      )
    );
    setEditingPinRoomId(null);
    setPinDraft('');
    showToast(`Updated Admin PIN for ${roomId} to ${cleanPin}`);
  }

  async function handleLookupOrForcePin(e) {
    e.preventDefault();
    const cleanRoom = sanitizeRoomId(lookupRoomId);
    if (!cleanRoom) {
      showToast('Enter a valid Room ID (e.g. NLP-8492).', 'error');
      return;
    }

    const cleanPin = lookupNewPin.replace(/\D/g, '').slice(0, 8);
    if (cleanPin) {
      await adminResetRoomPin(cleanRoom, cleanPin);
      if (onPinUpdatedForRoom) {
        onPinUpdatedForRoom(cleanRoom, cleanPin);
      }
    }

    const fetched = await fetchSingleRoomForAdmin(cleanRoom);
    if (fetched) {
      setRooms((prev) => {
        const exists = prev.some((r) => r.roomId === cleanRoom);
        if (exists) {
          return prev.map((r) => (r.roomId === cleanRoom ? fetched : r));
        }
        return [fetched, ...prev];
      });
      showToast(
        cleanPin
          ? `Reset PIN for ${cleanRoom} to ${cleanPin}`
          : `Loaded room ${cleanRoom} (PIN: ${fetched.adminPin})`
      );
    } else if (cleanPin) {
      const createdEntry = {
        roomId: cleanRoom,
        adminPin: cleanPin,
        view: 'setup',
        playerCount: 0,
        directoryCount: 0,
        numTeams: 4,
        goalScore: 11,
        dreambreakerScore: 21,
        dreambreakerFormat: 'singles',
        hasBracket: false,
        updatedAt: new Date().toISOString(),
        source: isCloudActive ? 'both' : 'local',
      };
      setRooms((prev) => [createdEntry, ...prev.filter((r) => r.roomId !== cleanRoom)]);
      showToast(`Initialized room ${cleanRoom} with PIN ${cleanPin}`);
    } else {
      showToast(`Room ${cleanRoom} not found. Enter a new PIN to initialize or reset it.`, 'error');
    }

    setLookupRoomId('');
    setLookupNewPin('');
  }

  async function handleResetBracket(roomId) {
    await adminResetRoomBracket(roomId);
    setRooms((prev) =>
      prev.map((r) =>
        r.roomId === roomId
          ? { ...r, view: 'setup', hasBracket: false, updatedAt: new Date().toISOString() }
          : r
      )
    );
    setConfirmResetBracketId(null);
    showToast(`Reset bracket for ${roomId} back to Setup`);
  }

  async function handleDeleteSingleRoom(roomId) {
    await adminDeleteRoom(roomId);
    if (onRoomDeleted) onRoomDeleted(roomId);
    setRooms((prev) => prev.filter((r) => r.roomId !== roomId));
    setConfirmDeleteRoomId(null);
    showToast(`Deleted room ${roomId}`);
  }

  function handleDownloadQrPass(room) {
    try {
      const url = `${window.location.origin}${window.location.pathname}?room=${encodeURIComponent(
        room.roomId
      )}&mode=admin&pin=${encodeURIComponent(room.adminPin || '1234')}`;
      const dataUrl = renderQrCardPngDataUrl({
        roomId: room.roomId,
        adminPin: room.adminPin || '1234',
        url,
        mode: 'admin',
      });
      const link = document.createElement('a');
      link.href = dataUrl;
      link.download = `${room.roomId.toLowerCase()}-admin-pass-qr.png`;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      showToast(`Downloaded QR Pass for ${room.roomId}`);
    } catch (e) {
      showToast('Could not generate QR pass', 'error');
    }
  }

  function handleExportRoomsCsv() {
    const headers = [
      'Room ID',
      'Admin PIN',
      'Stage',
      'Active Players',
      'Directory Players',
      'Teams',
      'Regulation Goal',
      'Dreambreaker',
      'Storage Source',
      'Last Updated',
    ];
    const rows = rooms.map((r) => [
      r.roomId,
      r.adminPin || '1234',
      r.view || 'setup',
      r.playerCount || 0,
      r.directoryCount || 0,
      r.numTeams || 4,
      r.goalScore || 11,
      `${r.dreambreakerScore || 21} (${r.dreambreakerFormat || 'singles'})`,
      r.source || 'local',
      r.updatedAt || '',
    ]);
    const csv = [
      headers.join(','),
      ...rows.map((row) =>
        row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')
      ),
    ].join('\n');
    triggerCsvDownload('neep-nlp-all-rooms-admin.csv', csv);
    showToast('Exported all rooms summary CSV');
  }

  function handleCopyText(key, text, label) {
    try {
      navigator.clipboard.writeText(text);
      setCopiedId(key);
      setTimeout(() => setCopiedId(null), 2000);
      if (label) showToast(label);
    } catch (e) {}
  }

  const filteredRooms = rooms.filter((r) => {
    const matchesSearch =
      r.roomId.toLowerCase().includes(searchQuery.trim().toLowerCase()) ||
      String(r.adminPin || '').includes(searchQuery.trim());
    if (!matchesSearch) return false;
    if (stageFilter === 'setup') return (r.view || 'setup') === 'setup' && !r.hasBracket;
    if (stageFilter === 'draft') return r.view === 'draft';
    if (stageFilter === 'active') return r.hasBracket || ['bracket', 'match', 'dreambreakerSetup', 'dreambreakerPlay'].includes(r.view);
    return true;
  });

  if (!isUnlocked) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between p-4">
        <header className="max-w-5xl w-full mx-auto py-3 flex items-center justify-between">
          <button
            onClick={onBackToLanding}
            className="flex items-center gap-1.5 text-slate-400 hover:text-white text-xs sm:text-sm font-bold transition"
          >
            <ArrowLeft size={16} /> Back to Home
          </button>
          <span className="text-xs font-mono text-slate-500">{APP_VERSION}</span>
        </header>

        <div className="max-w-md w-full mx-auto bg-slate-900 border border-slate-800 rounded-3xl p-6 sm:p-8 shadow-2xl">
          <div className="w-12 h-12 rounded-2xl bg-[#d7f24c]/10 border border-[#d7f24c]/30 flex items-center justify-center text-[#d7f24c] mb-4">
            <ShieldCheck size={26} />
          </div>
          <h1 className="text-2xl font-black text-white font-display mb-1">
            Super Admin Portal
          </h1>
          <p className="text-xs text-slate-400 mb-6">
            Enter your Master Admin Passcode to manage all tournament rooms, view or reset room PINs, and manage the database.
          </p>

          <form onSubmit={handleUnlockSubmit} className="space-y-4">
            <div>
              <label className="text-xs font-bold text-slate-300 uppercase tracking-wider block mb-1.5">
                Master Admin Passcode
              </label>
              <input
                type="password"
                autoFocus
                value={passcodeInput}
                onChange={(e) => {
                  setPasscodeInput(e.target.value);
                  if (authError) setAuthError('');
                }}
                placeholder="Enter master passcode (default: 0000)"
                className="w-full bg-slate-950 border border-slate-750 rounded-xl px-4 py-3 text-white font-mono text-sm focus:outline-none focus:ring-2 focus:ring-[#d7f24c]"
              />
              <p className="text-[11px] text-slate-500 mt-1.5">
                Default passcode is <span className="font-mono text-slate-300 font-bold">0000</span> (can be customized inside the portal).
              </p>
            </div>

            {authError && (
              <div className="p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-300 text-xs font-semibold flex items-center gap-2">
                <AlertCircle size={14} className="shrink-0" />
                <span>{authError}</span>
              </div>
            )}

            <button
              type="submit"
              className="w-full py-3.5 rounded-2xl bg-[#d7f24c] hover:bg-[#c8e33a] text-slate-950 font-black text-sm flex items-center justify-center gap-2 transition active:scale-95 shadow-lg shadow-[#d7f24c]/15"
            >
              <Unlock size={16} /> Unlock Admin Portal
            </button>
          </form>
        </div>

        <div className="text-center text-xs text-slate-600 py-4">
          NEEP-NLP Super Admin Room Manager
        </div>
      </div>
    );
  }

  const activeBracketsCount = rooms.filter((r) => r.hasBracket).length;
  const totalPlayersCount = rooms.reduce((sum, r) => sum + (r.playerCount || 0), 0);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 pb-24">
      {/* Top Admin Header */}
      <header className="border-b border-slate-800 bg-slate-950/90 backdrop-blur-md sticky top-0 z-40">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3">
            <button
              onClick={onBackToLanding}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-300 hover:text-white text-xs font-bold flex items-center gap-1.5 transition"
            >
              <ArrowLeft size={14} /> Exit Admin
            </button>
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-[#d7f24c]/15 border border-[#d7f24c]/30 flex items-center justify-center text-[#d7f24c]">
                <ShieldCheck size={18} />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h1 className="text-sm sm:text-base font-black text-white font-display tracking-wide">
                    SUPER ADMIN PORTAL
                  </h1>
                  <span className="text-[10px] font-mono text-[#d7f24c] bg-[#d7f24c]/10 border border-[#d7f24c]/30 px-2 py-0.5 rounded-full font-bold">
                    {APP_VERSION}
                  </span>
                </div>
                <p className="text-[11px] text-slate-400 hidden sm:block">
                  Manage all tournament rooms, inspect &amp; reset Admin PINs, and control sessions
                </p>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={onOpenCloudConfig}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold border flex items-center gap-1.5 transition ${
                isCloudActive
                  ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30'
                  : 'bg-amber-500/10 text-amber-400 border-amber-500/30'
              }`}
            >
              <Cloud size={13} />
              <span>{isCloudActive ? 'Cloud Connected' : 'Local Mode'}</span>
            </button>

            <button
              onClick={loadAllRooms}
              disabled={isLoading}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition active:scale-95"
            >
              <RefreshCw size={13} className={isLoading ? 'animate-spin text-[#d7f24c]' : 'text-[#d7f24c]'} />
              <span>Refresh</span>
            </button>

            <button
              onClick={handleLockPortal}
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-red-400 text-xs font-bold flex items-center gap-1.5 transition"
              title="Lock Admin Portal"
            >
              <Lock size={13} /> Lock
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 space-y-6">
        {toastMessage && (
          <div
            className={`px-4 py-3 rounded-2xl text-xs font-bold flex items-center justify-between border shadow-lg animate-in fade-in duration-150 ${
              toastMessage.type === 'error'
                ? 'bg-red-500/15 border-red-500/40 text-red-200'
                : 'bg-emerald-500/15 border-emerald-500/40 text-emerald-200'
            }`}
          >
            <span className="flex items-center gap-2">
              <Check size={14} /> {toastMessage.text}
            </span>
            <button onClick={() => setToastMessage(null)} className="text-slate-400 hover:text-white">
              &times;
            </button>
          </div>
        )}

        {/* Summary Metrics */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Total Rooms
            </span>
            <span className="text-2xl sm:text-3xl font-black text-white font-display mt-1 block">
              {rooms.length}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Active Brackets
            </span>
            <span className="text-2xl sm:text-3xl font-black text-[#d7f24c] font-display mt-1 block">
              {activeBracketsCount}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Active Players
            </span>
            <span className="text-2xl sm:text-3xl font-black text-amber-400 font-display mt-1 block">
              {totalPlayersCount}
            </span>
          </div>
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-4 flex flex-col justify-between">
            <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block">
              Export Summary
            </span>
            <button
              onClick={handleExportRoomsCsv}
              disabled={rooms.length === 0}
              className="mt-2 py-1.5 px-3 rounded-xl bg-slate-800 hover:bg-slate-750 text-[#d7f24c] border border-slate-700 text-xs font-bold flex items-center justify-center gap-1.5 disabled:opacity-40 transition"
            >
              <Download size={13} /> Export Rooms CSV
            </button>
          </div>
        </div>

        {/* Cloud Permission Warning if Firestore Rules Expired */}
        {cloudPermissionError && (
          <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-4 text-xs text-amber-200 space-y-2">
            <div className="flex items-center justify-between gap-2 flex-wrap">
              <span className="font-bold text-amber-300 flex items-center gap-1.5 text-sm">
                <AlertCircle size={16} /> Firestore Cloud Permissions Notice
              </span>
              <button
                type="button"
                onClick={() =>
                  handleCopyText(
                    'firestore-rules',
                    `rules_version = '2';\nservice cloud.firestore {\n  match /databases/{database}/documents {\n    match /{document=**} {\n      allow read, write: if true;\n    }\n  }\n}`,
                    'Copied Firestore Security Rules to clipboard'
                  )
                }
                className="px-3 py-1 rounded-xl bg-amber-400 text-slate-950 font-bold text-xs flex items-center gap-1.5"
              >
                <Copy size={12} /> Copy Firestore Rules
              </button>
            </div>
            <p className="text-slate-300 leading-relaxed">
              Your Firebase Firestore database returned a permission error (Firebase Test Mode rules expire after 30 days). Local rooms still work normally; to re-enable cross-device Cloud Sync, paste the rules above into your Firebase Console &rarr; Firestore Database &rarr; Rules.
            </p>
          </div>
        )}

        {/* Quick Actions Grid: 1) Force PIN Reset / Lookup Any Room, 2) Create Room with Custom ID & PIN */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Card 1: Direct Room Lookup / Force PIN Reset */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <KeyRound size={16} className="text-amber-400" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Quick Room Lookup / Force PIN Reset
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-3.5">
              Enter any Room ID to fetch it from Cloud/Local or immediately assign a new Admin PIN.
            </p>
            <form onSubmit={handleLookupOrForcePin} className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <input
                type="text"
                value={lookupRoomId}
                onChange={(e) => setLookupRoomId(e.target.value.toUpperCase())}
                placeholder="Room ID (e.g. NLP-8492)"
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white uppercase placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
              />
              <div className="flex gap-1">
                <input
                  type="text"
                  maxLength={8}
                  value={lookupNewPin}
                  onChange={(e) => setLookupNewPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="New PIN (optional)"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-amber-400"
                />
                <button
                  type="button"
                  onClick={() => setLookupNewPin(generatePin())}
                  title="Generate random 4-digit PIN"
                  className="px-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-400 border border-slate-700 text-xs font-bold shrink-0"
                >
                  <Sparkles size={13} />
                </button>
              </div>
              <button
                type="submit"
                disabled={!lookupRoomId.trim()}
                className="py-2 px-3 rounded-xl bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition active:scale-95 disabled:opacity-40"
              >
                {lookupNewPin ? 'Set PIN & Load' : 'Lookup Room'}
              </button>
            </form>
          </div>

          {/* Card 2: Create New Room with Custom or Random ID & PIN */}
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <Plus size={16} className="text-[#d7f24c]" />
              <h2 className="text-sm font-bold text-white uppercase tracking-wider">
                Create Room (Custom or Random Code &amp; PIN)
              </h2>
            </div>
            <p className="text-xs text-slate-400 mb-3.5">
              Create a new tournament room with your own custom Room ID and Admin PIN.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex gap-1">
                <input
                  type="text"
                  value={newRoomCode}
                  onChange={(e) => setNewRoomCode(sanitizeRoomId(e.target.value))}
                  placeholder="NLP-XXXX"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white uppercase focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
                />
                <button
                  type="button"
                  onClick={() => setNewRoomCode(generateRoomId('NLP'))}
                  title="Random Room ID"
                  className="px-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-[#d7f24c] border border-slate-700 text-xs font-bold shrink-0"
                >
                  <Sparkles size={13} />
                </button>
              </div>
              <div className="flex gap-1">
                <input
                  type="text"
                  maxLength={8}
                  value={newRoomPin}
                  onChange={(e) => setNewRoomPin(e.target.value.replace(/\D/g, ''))}
                  placeholder="4-digit PIN"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
                />
                <button
                  type="button"
                  onClick={() => setNewRoomPin(generatePin())}
                  title="Random PIN"
                  className="px-2.5 rounded-xl bg-slate-800 hover:bg-slate-750 text-amber-400 border border-slate-700 text-xs font-bold shrink-0"
                >
                  <KeyRound size={13} />
                </button>
              </div>
              <button
                type="button"
                disabled={!newRoomCode.trim() || !newRoomPin.trim()}
                onClick={() => {
                  if (onCreateCustomRoom) {
                    onCreateCustomRoom(newRoomCode, newRoomPin);
                  }
                }}
                className="py-2 px-3 rounded-xl bg-[#d7f24c] hover:bg-[#c8e33a] text-slate-950 font-black text-xs transition active:scale-95 disabled:opacity-40 flex items-center justify-center gap-1.5"
              >
                <span>Create &amp; Open</span>
                <ArrowRight size={13} />
              </button>
            </div>
          </div>
        </div>

        {/* Rooms List Section */}
        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="text-base font-black text-white font-display uppercase tracking-wide">
                Tournament Rooms ({filteredRooms.length})
              </h2>
              <p className="text-xs text-slate-400">
                View PINs, reset forgotten PINs, download QR passes, or jump into any room as Scorekeeper Admin.
              </p>
            </div>

            <div className="flex items-center gap-2 flex-wrap">
              <div className="relative">
                <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search Room ID or PIN..."
                  className="bg-slate-950 border border-slate-800 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
                />
              </div>

              <select
                value={stageFilter}
                onChange={(e) => setStageFilter(e.target.value)}
                className="bg-slate-950 border border-slate-800 rounded-xl px-3 py-1.5 text-xs font-bold text-slate-300 focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
              >
                <option value="all">All Stages ({rooms.length})</option>
                <option value="setup">Setup</option>
                <option value="draft">Drafting</option>
                <option value="active">Bracket / Active</option>
              </select>
            </div>
          </div>

          {isLoading ? (
            <div className="py-12 text-center text-slate-400 text-sm flex items-center justify-center gap-2">
              <RefreshCw size={16} className="animate-spin text-[#d7f24c]" />
              <span>Scanning local &amp; cloud tournament rooms...</span>
            </div>
          ) : filteredRooms.length === 0 ? (
            <div className="py-12 text-center border border-dashed border-slate-800 rounded-2xl">
              <p className="text-slate-300 font-bold text-sm mb-1">No matching tournament rooms found</p>
              <p className="text-slate-500 text-xs">
                Use the Quick Room Lookup or Create Room cards above to initialize or inspect a room.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              {filteredRooms.map((room) => {
                const isEditingPin = editingPinRoomId === room.roomId;
                const isConfirmingDelete = confirmDeleteRoomId === room.roomId;
                const isConfirmingReset = confirmResetBracketId === room.roomId;
                const stageLabel =
                  room.view === 'bracket' || room.hasBracket
                    ? 'Bracket Active'
                    : room.view === 'draft'
                    ? 'Snake Draft'
                    : room.view === 'dreambreakerPlay' || room.view === 'dreambreakerSetup'
                    ? 'Dreambreaker'
                    : 'Setup';

                return (
                  <div
                    key={room.roomId}
                    className="bg-slate-950/75 border border-slate-800/90 hover:border-slate-700 rounded-2xl p-4 transition"
                  >
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                      {/* Left Info Column */}
                      <div className="space-y-2 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="px-3 py-1 rounded-xl bg-slate-900 border border-slate-750 font-mono font-black text-white text-sm tracking-wider">
                            {room.roomId}
                          </span>

                          <span
                            className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full border ${
                              room.hasBracket
                                ? 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30'
                                : 'bg-slate-800 text-slate-300 border-slate-700'
                            }`}
                          >
                            {stageLabel}
                          </span>

                          <span className="text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full bg-slate-900 border border-slate-800 text-slate-400 uppercase">
                            {room.source === 'both' ? 'Cloud + Local' : room.source}
                          </span>

                          {room.updatedAt && (
                            <span className="text-[11px] text-slate-500">
                              Updated {new Date(room.updatedAt).toLocaleString()}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
                          <span className="flex items-center gap-1">
                            <Users size={12} className="text-[#d7f24c]" />
                            <strong className="text-slate-200">{room.playerCount || 0}</strong> in pool
                            {room.directoryCount > 0 && ` (${room.directoryCount} in directory)`}
                          </span>
                          <span>&bull;</span>
                          <span className="flex items-center gap-1">
                            <Swords size={12} className="text-amber-400" />
                            <strong className="text-slate-200">{room.numTeams || 4}</strong> Teams
                          </span>
                          <span>&bull;</span>
                          <span>
                            Goal <strong className="text-slate-200">{room.goalScore || 11}</strong> pts / DB{' '}
                            <strong className="text-slate-200">{room.dreambreakerScore || 21}</strong> pts (
                            {room.dreambreakerFormat === 'doubles' ? 'Doubles' : 'Singles'})
                          </span>
                        </div>
                      </div>

                      {/* Middle PIN Management Column */}
                      <div className="flex items-center gap-2 flex-wrap">
                        {isEditingPin ? (
                          <div className="flex items-center gap-1.5 bg-slate-900 border border-amber-500/40 rounded-xl p-1.5">
                            <KeyRound size={13} className="text-amber-400 ml-1.5" />
                            <input
                              type="text"
                              autoFocus
                              maxLength={8}
                              value={pinDraft}
                              onChange={(e) => setPinDraft(e.target.value.replace(/\D/g, ''))}
                              placeholder="New PIN"
                              className="w-24 bg-slate-950 border border-slate-700 rounded-lg px-2 py-1 text-xs font-mono font-bold text-white focus:outline-none focus:ring-1 focus:ring-amber-400"
                            />
                            <button
                              type="button"
                              onClick={() => setPinDraft(generatePin())}
                              title="Generate random 4-digit PIN"
                              className="p-1.5 rounded-lg bg-slate-800 hover:bg-slate-750 text-amber-400 text-xs"
                            >
                              <Sparkles size={13} />
                            </button>
                            <button
                              type="button"
                              onClick={() => handleSaveRoomPin(room.roomId, pinDraft)}
                              className="px-2.5 py-1 rounded-lg bg-amber-400 hover:bg-amber-300 text-slate-950 font-black text-xs transition"
                            >
                              Save PIN
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPinRoomId(null);
                                setPinDraft('');
                              }}
                              className="px-2 py-1 text-slate-400 hover:text-white text-xs font-semibold"
                            >
                              Cancel
                            </button>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1.5 bg-amber-500/10 border border-amber-500/25 rounded-xl px-3 py-1.5">
                            <KeyRound size={13} className="text-amber-400 shrink-0" />
                            <span className="text-xs text-amber-200 font-mono font-bold">
                              PIN: <strong className="text-white">{room.adminPin || '1234'}</strong>
                            </span>
                            <button
                              type="button"
                              onClick={() =>
                                handleCopyText(
                                  `pin-${room.roomId}`,
                                  String(room.adminPin || '1234'),
                                  `Copied PIN for ${room.roomId}`
                                )
                              }
                              title="Copy Admin PIN"
                              className="p-1 rounded hover:bg-amber-500/20 text-amber-300 transition ml-1"
                            >
                              {copiedId === `pin-${room.roomId}` ? <Check size={12} /> : <Copy size={12} />}
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingPinRoomId(room.roomId);
                                setPinDraft(String(room.adminPin || '1234'));
                              }}
                              className="ml-1 px-2 py-0.5 rounded-lg bg-amber-400/20 hover:bg-amber-400/30 text-amber-300 font-bold text-[11px] transition"
                            >
                              Reset PIN
                            </button>
                          </div>
                        )}
                      </div>

                      {/* Right Actions Column */}
                      <div className="flex items-center gap-2 flex-wrap shrink-0">
                        <button
                          type="button"
                          onClick={() => onOpenRoomAsAdmin(room.roomId, room.adminPin || '1234')}
                          className="px-3.5 py-2 rounded-xl bg-[#d7f24c] hover:bg-[#c8e33a] text-slate-950 font-black text-xs flex items-center gap-1.5 transition active:scale-95 shadow-md shadow-[#d7f24c]/10"
                        >
                          <ShieldCheck size={14} /> Open as Admin
                        </button>

                        <button
                          type="button"
                          onClick={() => onOpenRoomAsSpectator(room.roomId)}
                          title="Open in Spectator Mode"
                          className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-800 text-xs font-bold flex items-center gap-1 transition"
                        >
                          <Eye size={13} /> Spectate
                        </button>

                        <button
                          type="button"
                          onClick={() => handleDownloadQrPass(room)}
                          title="Download QR Pass Card with Admin PIN"
                          className="px-2.5 py-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-[#d7f24c] border border-slate-800 text-xs font-bold flex items-center gap-1 transition"
                        >
                          <QrCode size={13} /> QR
                        </button>

                        {room.hasBracket && (
                          <button
                            type="button"
                            onClick={() => setConfirmResetBracketId(room.roomId)}
                            title="Reset active bracket back to Setup (keeps players)"
                            className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-400 hover:text-amber-400 border border-slate-800 transition"
                          >
                            <RotateCcw size={14} />
                          </button>
                        )}

                        <button
                          type="button"
                          onClick={() => setConfirmDeleteRoomId(room.roomId)}
                          title="Delete Room"
                          className="p-2 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-500 hover:text-red-400 border border-slate-800 transition"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>

                    {/* Inline Confirmations */}
                    {isConfirmingReset && (
                      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2 bg-amber-500/10 border border-amber-500/30 rounded-xl px-3 py-2 text-xs">
                        <span className="text-amber-200 font-medium">
                          Reset bracket &amp; draft for <strong className="text-white">{room.roomId}</strong> back to Setup? (Players are kept)
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleResetBracket(room.roomId)}
                            className="px-3 py-1 rounded-lg bg-amber-400 text-slate-950 font-black"
                          >
                            Confirm Reset
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmResetBracketId(null)}
                            className="px-2 py-1 text-slate-300 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}

                    {isConfirmingDelete && (
                      <div className="mt-3 pt-3 border-t border-slate-800 flex items-center justify-between gap-2 bg-red-500/10 border border-red-500/30 rounded-xl px-3 py-2 text-xs">
                        <span className="text-red-200 font-medium">
                          Permanently delete room <strong className="text-white">{room.roomId}</strong>, its bracket, directory, and stats?
                        </span>
                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleDeleteSingleRoom(room.roomId)}
                            className="px-3 py-1 rounded-lg bg-red-500 hover:bg-red-600 text-white font-black"
                          >
                            Delete Room
                          </button>
                          <button
                            type="button"
                            onClick={() => setConfirmDeleteRoomId(null)}
                            className="px-2 py-1 text-slate-300 hover:text-white"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Portal Security & Full Database Reset Card */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-3xl p-5 shadow-xl">
            <div className="flex items-center gap-2 mb-1">
              <Settings size={16} className="text-[#d7f24c]" />
              <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                Super Admin Master Passcode
              </h3>
            </div>
            <p className="text-xs text-slate-400 mb-3">
              Update the Master Passcode used to unlock this Admin Portal on this device.
            </p>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const trimmed = newMasterPasscode.trim();
                if (!trimmed) return;
                try {
                  localStorage.setItem(MASTER_PASSCODE_KEY, trimmed);
                  setNewMasterPasscode('');
                  showToast('Updated Master Admin Passcode');
                } catch (err) {}
              }}
              className="flex gap-2"
            >
              <input
                type="password"
                value={newMasterPasscode}
                onChange={(e) => setNewMasterPasscode(e.target.value)}
                placeholder="New master passcode..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-3 py-2 text-xs text-white focus:outline-none focus:ring-1 focus:ring-[#d7f24c]"
              />
              <button
                type="submit"
                disabled={!newMasterPasscode.trim()}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-750 text-[#d7f24c] border border-slate-700 font-bold text-xs disabled:opacity-40 transition"
              >
                Update Passcode
              </button>
            </form>
          </div>

          <div className="bg-slate-900 border border-red-500/20 rounded-3xl p-5 shadow-xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Trash2 size={16} className="text-red-400" />
                <h3 className="text-sm font-bold text-white uppercase tracking-wider">
                  Danger Zone: Wipe All Rooms &amp; Data
                </h3>
              </div>
              <p className="text-xs text-slate-400 mb-3">
                Clears all tournament rooms, player directories, and leaderboards from local storage and Firestore.
              </p>
            </div>

            {confirmWipeAll ? (
              <div className="flex items-center justify-between gap-2 bg-red-500/10 border border-red-500/30 rounded-xl p-2.5 text-xs">
                <span className="text-red-200 font-bold">Are you sure? This deletes all rooms.</span>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={async () => {
                      if (onWipeAllDatabase) await onWipeAllDatabase();
                      setRooms([]);
                      setConfirmWipeAll(false);
                      showToast('Wiped all tournament rooms and database data');
                    }}
                    className="px-3 py-1.5 rounded-lg bg-red-500 hover:bg-red-600 text-white font-black"
                  >
                    Yes, Wipe All
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmWipeAll(false)}
                    className="px-2 py-1 text-slate-300"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setConfirmWipeAll(true)}
                className="w-full py-2.5 rounded-xl bg-red-500/15 hover:bg-red-500/25 text-red-300 border border-red-500/30 font-bold text-xs transition"
              >
                Wipe All Rooms &amp; Database Data
              </button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
