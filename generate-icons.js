const fs = require('fs');
const path = require('path');
const zlib = require('zlib');

function crc32(buf) {
  let table = [];
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) {
      if (c & 1) c = 0xedb88320 ^ (c >>> 1);
      else c = c >>> 1;
    }
    table[n] = c;
  }
  let crc = -1;
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ table[(crc ^ buf[i]) & 0xff];
  }
  return (crc ^ -1) >>> 0;
}

function makePng(size) {
  const width = size;
  const height = size;
  const scanlines = [];
  const cx = size / 2;
  const cy = size / 2;
  const r = size * 0.44;

  for (let y = 0; y < height; y++) {
    scanlines.push(0); // filter: None
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Check if point is inside shield-like circle or checkmark
      if (dist <= r) {
        // Shield gradient: blue / violet
        const t = (x + y) / (width + height);
        const red = Math.round(37 + (99 - 37) * t);
        const green = Math.round(99 + (102 - 99) * t);
        const blue = Math.round(235 + (241 - 235) * t);

        // Simple shield/tick inside
        // Draw a white tick: (0.28, 0.5) -> (0.44, 0.68) -> (0.72, 0.34)
        const nx = x / size;
        const ny = y / size;

        let onTick = false;
        // Segment 1
        const d1 = distToSegment(nx, ny, 0.28, 0.50, 0.44, 0.68);
        // Segment 2
        const d2 = distToSegment(nx, ny, 0.44, 0.68, 0.72, 0.34);
        if (Math.min(d1, d2) < 0.075) {
          onTick = true;
        }

        if (onTick) {
          scanlines.push(255, 255, 255, 255);
        } else {
          // Border highlight
          if (dist > r - 1.2) {
            scanlines.push(30, 64, 175, 220);
          } else {
            scanlines.push(red, green, blue, 255);
          }
        }
      } else {
        scanlines.push(0, 0, 0, 0); // Transparent
      }
    }
  }

  function distToSegment(px, py, x1, y1, x2, y2) {
    const l2 = (x2 - x1) * (x2 - x1) + (y2 - y1) * (y2 - y1);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  }

  const rawData = Buffer.from(scanlines);
  const compressed = zlib.deflateSync(rawData);

  function makeChunk(type, data) {
    const len = Buffer.alloc(4);
    len.writeUInt32BE(data.length, 0);
    const typeBuf = Buffer.from(type, 'ascii');
    const toCrc = Buffer.concat([typeBuf, data]);
    const crcBuf = Buffer.alloc(4);
    crcBuf.writeUInt32BE(crc32(toCrc), 0);
    return Buffer.concat([len, typeBuf, data, crcBuf]);
  }

  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8; // bit depth
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0; // compression
  ihdrData[11] = 0; // filter
  ihdrData[12] = 0; // interlace

  const ihdrChunk = makeChunk('IHDR', ihdrData);
  const idatChunk = makeChunk('IDAT', compressed);
  const iendChunk = makeChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const iconsDir = path.join(__dirname, 'icons');
if (!fs.existsSync(iconsDir)) fs.mkdirSync(iconsDir, { recursive: true });

fs.writeFileSync(path.join(iconsDir, 'icon16.png'), makePng(16));
fs.writeFileSync(path.join(iconsDir, 'icon48.png'), makePng(48));
fs.writeFileSync(path.join(iconsDir, 'icon128.png'), makePng(128));
console.log('Icons generated successfully');

