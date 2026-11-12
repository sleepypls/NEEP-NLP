// Self-contained QR Code matrix generator (Versions 1–10, Error Correction Level M, Byte Mode)
// Zero external dependencies; renders offline to SVG or PNG Canvas.

const EXP_TABLE = new Uint8Array(512);
const LOG_TABLE = new Uint8Array(256);
(function initGaloisTables() {
  let x = 1;
  for (let i = 0; i < 255; i++) {
    EXP_TABLE[i] = x;
    LOG_TABLE[x] = i;
    x <<= 1;
    if (x & 0x100) x ^= 0x11d;
  }
  for (let i = 255; i < 512; i++) {
    EXP_TABLE[i] = EXP_TABLE[i - 255];
  }
})();

function gfMul(a, b) {
  if (a === 0 || b === 0) return 0;
  return EXP_TABLE[LOG_TABLE[a] + LOG_TABLE[b]];
}

function getGeneratorPoly(degree) {
  let poly = new Uint8Array([1]);
  for (let i = 0; i < degree; i++) {
    const next = new Uint8Array(poly.length + 1);
    const root = EXP_TABLE[i];
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j];
      next[j + 1] ^= gfMul(poly[j], root);
    }
    poly = next;
  }
  return poly;
}

function computeReedSolomon(data, ecLen) {
  const gen = getGeneratorPoly(ecLen);
  const msg = new Uint8Array(data.length + ecLen);
  msg.set(data, 0);
  for (let i = 0; i < data.length; i++) {
    const coef = msg[i];
    if (coef !== 0) {
      for (let j = 0; j < gen.length; j++) {
        msg[i + j] ^= gfMul(gen[j], coef);
      }
    }
  }
  return msg.slice(data.length);
}

// Version 1..10 specs for Error Correction Level L (gives roomy byte capacity up to 271 bytes)
// [totalCodewords, ecCodewordsPerBlock, numBlocksGroup1, dataCodewordsGroup1, numBlocksGroup2, dataCodewordsGroup2]
const VERSION_SPECS_L = [
  null,
  [26, 7, 1, 19, 0, 0],    // v1: 17 bytes
  [44, 10, 1, 34, 0, 0],   // v2: 32 bytes
  [70, 15, 1, 55, 0, 0],   // v3: 53 bytes
  [100, 20, 1, 80, 0, 0],  // v4: 78 bytes
  [134, 26, 1, 108, 0, 0], // v5: 106 bytes
  [172, 18, 2, 68, 0, 0],  // v6: 134 bytes
  [196, 20, 2, 78, 0, 0],  // v7: 154 bytes
  [242, 24, 2, 97, 0, 0],  // v8: 192 bytes
  [292, 30, 2, 116, 0, 0], // v9: 230 bytes
  [346, 18, 2, 68, 2, 69], // v10: 271 bytes
];

const ALIGNMENT_POSITIONS = [
  null,
  [],
  [6, 18],
  [6, 22],
  [6, 26],
  [6, 30],
  [6, 34],
  [6, 22, 38],
  [6, 24, 42],
  [6, 26, 46],
  [6, 28, 50],
];

function selectVersion(byteLength) {
  for (let v = 1; v <= 10; v++) {
    const spec = VERSION_SPECS_L[v];
    const totalData = spec[2] * spec[3] + spec[4] * spec[5];
    const headerBits = v <= 9 ? 12 : 20; // 4 mode + 8/16 length
    const maxBytes = Math.floor((totalData * 8 - headerBits) / 8);
    if (byteLength <= maxBytes) return v;
  }
  return 10;
}

function encodeDataCodewords(bytes, version) {
  const spec = VERSION_SPECS_L[version];
  const totalData = spec[2] * spec[3] + spec[4] * spec[5];
  const bits = [];

  function pushBits(val, len) {
    for (let i = len - 1; i >= 0; i--) {
      bits.push((val >>> i) & 1);
    }
  }

  // Byte mode indicator (0100)
  pushBits(0b0100, 4);
  pushBits(bytes.length, version <= 9 ? 8 : 16);

  for (let i = 0; i < bytes.length; i++) {
    pushBits(bytes[i], 8);
  }

  // Terminator (up to 4 zeros)
  const maxBits = totalData * 8;
  const term = Math.min(4, maxBits - bits.length);
  pushBits(0, term);

  // Pad to byte boundary
  while (bits.length % 8 !== 0) {
    bits.push(0);
  }

  const codewords = new Uint8Array(totalData);
  let byteIdx = 0;
  for (let i = 0; i < bits.length && byteIdx < totalData; i += 8) {
    let b = 0;
    for (let j = 0; j < 8; j++) {
      b = (b << 1) | bits[i + j];
    }
    codewords[byteIdx++] = b;
  }

  const padBytes = [0xec, 0x11];
  let padToggle = 0;
  while (byteIdx < totalData) {
    codewords[byteIdx++] = padBytes[padToggle % 2];
    padToggle++;
  }

  return codewords;
}

function interleaveBlocks(dataCodewords, version) {
  const [, ecLen, g1Blocks, g1DataLen, g2Blocks, g2DataLen] = VERSION_SPECS_L[version];
  const dataBlocks = [];
  const ecBlocks = [];
  let offset = 0;

  for (let i = 0; i < g1Blocks; i++) {
    const block = dataCodewords.slice(offset, offset + g1DataLen);
    offset += g1DataLen;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomon(block, ecLen));
  }
  for (let i = 0; i < g2Blocks; i++) {
    const block = dataCodewords.slice(offset, offset + g2DataLen);
    offset += g2DataLen;
    dataBlocks.push(block);
    ecBlocks.push(computeReedSolomon(block, ecLen));
  }

  const result = [];
  const maxDataLen = Math.max(g1DataLen, g2DataLen);
  for (let i = 0; i < maxDataLen; i++) {
    for (let b = 0; b < dataBlocks.length; b++) {
      if (i < dataBlocks[b].length) {
        result.push(dataBlocks[b][i]);
      }
    }
  }
  for (let i = 0; i < ecLen; i++) {
    for (let b = 0; b < ecBlocks.length; b++) {
      result.push(ecBlocks[b][i]);
    }
  }

  return new Uint8Array(result);
}

function computeFormatBits(ecLevelBits, maskPattern) {
  const data = (ecLevelBits << 3) | maskPattern;
  let rem = data << 10;
  const gen = 0x537;
  for (let i = 14; i >= 10; i--) {
    if ((rem >>> i) & 1) {
      rem ^= gen << (i - 10);
    }
  }
  return ((data << 10) | rem) ^ 0x5412;
}

/**
 * Generates a 2D boolean matrix representing the QR code for `text`.
 */
export function generateQrMatrix(text) {
  const utf8 = new TextEncoder().encode(String(text || ''));
  const version = selectVersion(utf8.length);
  const size = version * 4 + 17;

  const modules = Array.from({ length: size }, () => new Uint8Array(size));
  const isFunction = Array.from({ length: size }, () => new Uint8Array(size));

  function setFunctionModule(r, c, dark) {
    if (r < 0 || r >= size || c < 0 || c >= size) return;
    modules[r][c] = dark ? 1 : 0;
    isFunction[r][c] = 1;
  }

  function drawFinderPattern(r, c) {
    for (let dy = -1; dy <= 7; dy++) {
      for (let dx = -1; dx <= 7; dx++) {
        const y = r + dy;
        const x = c + dx;
        if (y < 0 || y >= size || x < 0 || x >= size) continue;
        const inOuter = dy >= 0 && dy <= 6 && dx >= 0 && dx <= 6 && (dy === 0 || dy === 6 || dx === 0 || dx === 6);
        const inInner = dy >= 2 && dy <= 4 && dx >= 2 && dx <= 4;
        setFunctionModule(y, x, inOuter || inInner);
      }
    }
  }

  drawFinderPattern(0, 0);
  drawFinderPattern(0, size - 7);
  drawFinderPattern(size - 7, 0);

  // Timing patterns
  for (let i = 8; i < size - 8; i++) {
    setFunctionModule(6, i, i % 2 === 0);
    setFunctionModule(i, 6, i % 2 === 0);
  }

  // Alignment patterns
  const alignCoords = ALIGNMENT_POSITIONS[version] || [];
  for (let i = 0; i < alignCoords.length; i++) {
    for (let j = 0; j < alignCoords.length; j++) {
      const cy = alignCoords[i];
      const cx = alignCoords[j];
      // Skip finder corners
      if ((cy <= 8 && cx <= 8) || (cy <= 8 && cx >= size - 8) || (cy >= size - 8 && cx <= 8)) {
        continue;
      }
      for (let dy = -2; dy <= 2; dy++) {
        for (let dx = -2; dx <= 2; dx++) {
          const dist = Math.max(Math.abs(dy), Math.abs(dx));
          setFunctionModule(cy + dy, cx + dx, dist !== 1);
        }
      }
    }
  }

  // Dark module & reserve format info areas
  setFunctionModule(size - 8, 8, true);
  for (let i = 0; i <= 8; i++) {
    if (!isFunction[8][i]) setFunctionModule(8, i, false);
    if (!isFunction[i][8]) setFunctionModule(i, 8, false);
  }
  for (let i = 0; i < 8; i++) {
    if (!isFunction[8][size - 1 - i]) setFunctionModule(8, size - 1 - i, false);
    if (!isFunction[size - 1 - i][8]) setFunctionModule(size - 1 - i, 8, false);
  }

  // Encode & interleave data
  const dataCw = encodeDataCodewords(utf8, version);
  const fullCw = interleaveBlocks(dataCw, version);

  // Place data bits in zigzag
  let bitIdx = 0;
  const totalBits = fullCw.length * 8;
  let upward = true;

  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5; // skip vertical timing line
    for (let vert = 0; vert < size; vert++) {
      const r = upward ? size - 1 - vert : vert;
      for (let j = 0; j < 2; j++) {
        const c = right - j;
        if (!isFunction[r][c]) {
          let dark = false;
          if (bitIdx < totalBits) {
            dark = ((fullCw[bitIdx >>> 3] >>> (7 - (bitIdx & 7))) & 1) !== 0;
            bitIdx++;
          }
          // Apply mask 0: (r + c) % 2 === 0
          if ((r + c) % 2 === 0) dark = !dark;
          modules[r][c] = dark ? 1 : 0;
        }
      }
    }
    upward = !upward;
  }

  // Write Format Information (Level L = 01, Mask = 0)
  const formatBits = computeFormatBits(0b01, 0);
  for (let i = 0; i <= 5; i++) setFunctionModule(8, i, ((formatBits >>> i) & 1) !== 0);
  setFunctionModule(8, 7, ((formatBits >>> 6) & 1) !== 0);
  setFunctionModule(8, 8, ((formatBits >>> 7) & 1) !== 0);
  setFunctionModule(7, 8, ((formatBits >>> 8) & 1) !== 0);
  for (let i = 9; i < 15; i++) setFunctionModule(14 - i, 8, ((formatBits >>> i) & 1) !== 0);

  for (let i = 0; i < 8; i++) setFunctionModule(8, size - 1 - i, ((formatBits >>> i) & 1) !== 0);
  for (let i = 8; i < 15; i++) setFunctionModule(size - 15 + i, 8, ((formatBits >>> i) & 1) !== 0);

  return modules.map((row) => Array.from(row, (v) => v === 1));
}

/**
 * Generates a downloadable PNG data URL containing the QR code + Room ID + optional Admin PIN card.
 */
export function renderQrCardPngDataUrl({
  url,
  roomId,
  adminPin,
  mode = 'admin', // 'admin' | 'spectator'
}) {
  const matrix = generateQrMatrix(url);
  const qrCount = matrix.length;
  const scale = 8;
  const quietZone = 4;
  const qrPixelSize = (qrCount + quietZone * 2) * scale;

  const width = Math.max(420, qrPixelSize + 80);
  const height = mode === 'admin' && adminPin ? qrPixelSize + 240 : qrPixelSize + 190;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  // Background card
  ctx.fillStyle = '#0f172a';
  ctx.fillRect(0, 0, width, height);

  // Accent header border
  ctx.fillStyle = mode === 'admin' ? '#d7f24c' : '#22d3ee';
  ctx.fillRect(0, 0, width, 8);

  // Header title
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 22px system-ui, -apple-system, sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('NEEP-NLP TOURNAMENT PASS', width / 2, 46);

  ctx.fillStyle = mode === 'admin' ? '#d7f24c' : '#22d3ee';
  ctx.font = 'bold 13px monospace';
  ctx.fillText(mode === 'admin' ? 'ADMIN / SCOREKEEPER QR ACCESS' : 'SPECTATOR LIVE VIEW QR', width / 2, 68);

  // White QR Box
  const qrX = Math.floor((width - qrPixelSize) / 2);
  const qrY = 86;
  ctx.fillStyle = '#ffffff';
  ctx.beginPath();
  if (ctx.roundRect) {
    ctx.roundRect(qrX, qrY, qrPixelSize, qrPixelSize, 16);
  } else {
    ctx.rect(qrX, qrY, qrPixelSize, qrPixelSize);
  }
  ctx.fill();

  // Draw QR modules
  ctx.fillStyle = '#020617';
  for (let r = 0; r < qrCount; r++) {
    for (let c = 0; c < qrCount; c++) {
      if (matrix[r][c]) {
        ctx.fillRect(
          qrX + (c + quietZone) * scale,
          qrY + (r + quietZone) * scale,
          scale,
          scale
        );
      }
    }
  }

  // Footer details (Room ID & PIN)
  const detailsY = qrY + qrPixelSize + 36;
  ctx.fillStyle = '#94a3b8';
  ctx.font = 'bold 12px system-ui, -apple-system, sans-serif';
  ctx.fillText('ROOM CODE', width / 2, detailsY);

  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 28px monospace';
  ctx.fillText(String(roomId || ''), width / 2, detailsY + 30);

  if (mode === 'admin' && adminPin) {
    ctx.fillStyle = '#fbbf24';
    ctx.font = 'bold 16px monospace';
    ctx.fillText(`ADMIN PIN: ${adminPin}`, width / 2, detailsY + 62);

    ctx.fillStyle = '#64748b';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Scan QR to open room directly with Admin access', width / 2, detailsY + 86);
  } else {
    ctx.fillStyle = '#64748b';
    ctx.font = '11px system-ui, -apple-system, sans-serif';
    ctx.fillText('Scan QR to watch live scores & bracket', width / 2, detailsY + 56);
  }

  return canvas.toDataURL('image/png');
}

