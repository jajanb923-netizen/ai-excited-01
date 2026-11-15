// ai-excited-01 entry: a colossal whale breaching out of a tiny teacup.
//
// The picture lives in this repository as entry.png (JPEG bytes, 1024x1024).
// This program does one thing: it copies that picture, byte for byte, to
// the output directory as entry.png. A pure copy is deterministic by
// construction, uses no network, and needs no other input, so two runs
// always write the same bytes.

import { copyFileSync, existsSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const IMAGE_NAME = "entry.png";
const MAX_BYTES = 1048576;
const MAX_SIDE = 1024;

// The JPEG and PNG signatures, so a truncated or swapped image is caught
// before anything is written instead of silently passing through.
const JPEG_MAGIC = Buffer.from([0xff, 0xd8, 0xff]);
const PNG_MAGIC = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

function fail(message) {
  console.error(`error: ${message}`);
  process.exit(1);
}

// Read the pixel dimensions out of a JPEG or PNG header, so an image
// over the 1024x1024 limit is caught here instead of at the gate.
function jpegDimensions(bytes) {
  // Walk the JPEG segments until a Start Of Frame marker (SOF0/SOF2).
  let offset = 2;
  while (offset + 9 < bytes.length) {
    if (bytes[offset] !== 0xff) return null;
    const marker = bytes[offset + 1];
    const length = bytes.readUInt16BE(offset + 2);
    if (marker >= 0xc0 && marker <= 0xcf && marker !== 0xc4 && marker !== 0xc8 && marker !== 0xcc) {
      return {
        width: bytes.readUInt16BE(offset + 7),
        height: bytes.readUInt16BE(offset + 5),
      };
    }
    offset += 2 + length;
  }
  return null;
}

function pngDimensions(bytes) {
  if (bytes.length < 24) return null;
  return { width: bytes.readUInt32BE(16), height: bytes.readUInt32BE(20) };
}

function main() {
  const here = dirname(fileURLToPath(import.meta.url));
  const source = join(here, IMAGE_NAME);

  if (!existsSync(source)) {
    fail(`${IMAGE_NAME} is missing next to main.ts`);
  }

  const bytes = readFileSync(source);
  if (bytes.length === 0 || bytes.length > MAX_BYTES) {
    fail(`${IMAGE_NAME} is ${bytes.length} bytes, outside the 1 MiB limit`);
  }
  const looksJpeg = bytes.subarray(0, 3).equals(JPEG_MAGIC);
  const looksPng = bytes.subarray(0, 8).equals(PNG_MAGIC);
  if (!looksJpeg && !looksPng) {
    fail(`${IMAGE_NAME} is neither a JPEG nor a PNG`);
  }

  const size = looksJpeg ? jpegDimensions(bytes) : pngDimensions(bytes);
  if (size === null) {
    fail(`${IMAGE_NAME} has an unreadable image header`);
  }
  if (size.width > MAX_SIDE || size.height > MAX_SIDE) {
    fail(`${IMAGE_NAME} is ${size.width}x${size.height}, over the 1024x1024 limit`);
  }

  const outDir = process.env.MAKEFUN_OUTPUT_DIR || "/output";
  mkdirSync(outDir, { recursive: true });
  const target = join(outDir, IMAGE_NAME);
  copyFileSync(source, target);

  const written = statSync(target);
  if (written.size !== bytes.length) {
    fail(`wrote ${written.size} bytes, expected ${bytes.length}`);
  }
  console.log(`wrote ${target} (${written.size} bytes, ${size.width}x${size.height})`);
}

main();
