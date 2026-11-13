import React, { useState, useEffect } from 'react';
import { Clock } from 'lucide-react';

export function formatDuration(ms) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return null;
  const totalSec = Math.max(0, Math.floor(Number(ms) / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hrs > 0) return `${hrs}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function formatClockTime(ts) {
  if (!ts) return null;
  try {
    return new Date(Number(ts)).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
  } catch (e) {
    return null;
  }
}

export function formatElapsed(startedAt, nowMs) {
  if (!startedAt) return '00:00';
  const totalSec = Math.max(0, Math.floor((nowMs - Number(startedAt)) / 1000));
  const hrs = Math.floor(totalSec / 3600);
  const mins = Math.floor((totalSec % 3600) / 60);
  const secs = totalSec % 60;
  const mm = String(mins).padStart(2, '0');
  const ss = String(secs).padStart(2, '0');
  if (hrs > 0) return `${hrs}:${mm}:${ss}`;
  return `${mm}:${ss}`;
}

export function LiveTimer({ startedAt, className = '' }) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    if (!startedAt) return;
    setNow(Date.now());
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [startedAt]);

  if (!startedAt) return null;

  return (
    <span className={`inline-flex items-center gap-1 font-mono tabular-nums ${className}`}>
      <Clock size={10} className="shrink-0" />
      <span>{formatElapsed(startedAt, now)}</span>
    </span>
  );
}

