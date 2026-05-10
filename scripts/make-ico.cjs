#!/usr/bin/env node
// Create ICO file from JPEG/PNG using raw buffer manipulation
const fs = require('fs');
const path = require('path');
const { createCanvas, loadImage } = (() => {
  try { return require('canvas'); } catch { return null; }
})() || {};

const inputPath = path.join(__dirname, '../icon.png');
const outputPath = path.join(__dirname, '../icon.ico');

// ICO file builder - supports multiple sizes
function buildIco(pngBuffers) {
  const num = pngBuffers.length;
  const headerSize = 6;
  const dirEntrySize = 16;
  const headerTotal = headerSize + dirEntrySize * num;

  let offset = headerTotal;
  const header = Buffer.alloc(headerSize);
  header.writeUInt16LE(0, 0); // reserved
  header.writeUInt16LE(1, 2); // type: 1 = ICO
  header.writeUInt16LE(num, 4); // count

  const dirEntries = [];
  for (const { buf, size } of pngBuffers) {
    const entry = Buffer.alloc(dirEntrySize);
    entry.writeUInt8(size > 255 ? 0 : size, 0);  // width (0 = 256)
    entry.writeUInt8(size > 255 ? 0 : size, 1);  // height
    entry.writeUInt8(0, 2);   // color count
    entry.writeUInt8(0, 3);   // reserved
    entry.writeUInt16LE(1, 4); // color planes
    entry.writeUInt16LE(32, 6); // bits per pixel
    entry.writeUInt32LE(buf.length, 8); // image size
    entry.writeUInt32LE(offset, 12); // offset
    dirEntries.push(entry);
    offset += buf.length;
  }

  return Buffer.concat([header, ...dirEntries, ...pngBuffers.map(x => x.buf)]);
}

// Since icon.png is actually a JPEG, use node's built-in to re-encode
// We'll use the Jimp approach via npm install or manual PNG creation
// Try to read and use as-is if it's a valid image

async function main() {
  console.log('📦 Creating icon.ico from icon.png...');

  // Install jimp on the fly
  const { execSync } = require('child_process');
  try {
    require.resolve('jimp');
  } catch {
    console.log('Installing jimp...');
    execSync('npm install jimp --no-save', { cwd: path.join(__dirname, '..'), stdio: 'inherit' });
  }

  const Jimp = require('jimp');

  const sizes = [16, 32, 48, 64, 128, 256];
  const pngBuffers = [];

  for (const size of sizes) {
    const img = await Jimp.read(inputPath);
    img.resize(size, size);
    const buf = await img.getBufferAsync(Jimp.MIME_PNG);
    pngBuffers.push({ buf, size });
    console.log(`  ✓ ${size}x${size}`);
  }

  const icoBuffer = buildIco(pngBuffers);
  fs.writeFileSync(outputPath, icoBuffer);
  console.log('✅ icon.ico created successfully!');
}

main().catch(err => {
  console.error('❌ Error:', err.message);
  process.exit(1);
});
