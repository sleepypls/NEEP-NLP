/**
 * Returns the display name for a court number (1-indexed), falling back to "Court <n>".
 * Supports both an object map ({ "1": "Show Court" }) and a 0-indexed array (["Show Court"]).
 */
export function getCourtDisplayName(courtNumber, courtNames) {
  if (courtNumber === null || courtNumber === undefined || courtNumber === '') return '';
  const num = Number(courtNumber);
  if (Array.isArray(courtNames)) {
    const custom = courtNames[num - 1];
    if (typeof custom === 'string' && custom.trim()) return custom.trim();
  } else if (courtNames && typeof courtNames === 'object') {
    const custom = courtNames[String(courtNumber)] ?? courtNames[num];
    if (typeof custom === 'string' && custom.trim()) return custom.trim();
  }
  return `Court ${courtNumber}`;
}

