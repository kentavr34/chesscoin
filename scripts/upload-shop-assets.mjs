// Script: generate SVG assets for shop items and upload to S3
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

const ENDPOINT = "https://s3.twcstorage.ru";
const BUCKET   = "799d3c02-99e72b95-3b78-492f-af40-bfc39c0f8bb7";
const ACCESS   = "GBZQW3Q2QMSLFBY6IXOH";
const SECRET   = "IDo7bC66zeCTEMDgaTd8AMBiAD6CqGnakAz1Pv8z";
const BASE_URL = `${ENDPOINT}/${BUCKET}`;

const s3 = new S3Client({
  endpoint: ENDPOINT,
  region: "ru-1",
  credentials: { accessKeyId: ACCESS, secretAccessKey: SECRET },
  forcePathStyle: true,
});

async function upload(key, svg) {
  await s3.send(new PutObjectCommand({
    Bucket: BUCKET,
    Key: key,
    Body: Buffer.from(svg, "utf-8"),
    ContentType: "image/svg+xml",
    ACL: "public-read",
  }));
  console.log(`✅ ${BASE_URL}/${key}`);
  return `${BASE_URL}/${key}`;
}

// ─── SVG generators ────────────────────────────────────────────────────────

function avatarFrame(color1, color2, glowColor, innerRing = false) {
  const glow = glowColor;
  const inner = innerRing
    ? `<circle cx="100" cy="100" r="72" fill="none" stroke="url(#grad)" stroke-width="1.5" stroke-dasharray="4 3" opacity="0.6"/>`
    : "";
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="glow" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${glow}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${glow}" stop-opacity="0"/>
    </radialGradient>
    <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${color1}"/>
      <stop offset="100%" stop-color="${color2}"/>
    </linearGradient>
    <filter id="blur"><feGaussianBlur stdDeviation="6"/></filter>
  </defs>
  <circle cx="100" cy="100" r="95" fill="url(#glow)" filter="url(#blur)"/>
  <circle cx="100" cy="100" r="88" fill="none" stroke="url(#grad)" stroke-width="8"/>
  <circle cx="100" cy="100" r="80" fill="none" stroke="url(#grad)" stroke-width="2"/>
  ${inner}
  <circle cx="100" cy="100" r="70" fill="#13161E" opacity="0.85"/>
  <circle cx="100" cy="100" r="70" fill="none" stroke="${color1}" stroke-width="1" opacity="0.4"/>
</svg>`;
}

function boardSkin(light, dark, label, accent = null) {
  const SQ = 22; const OFF = 4;
  let squares = "";
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      const x = OFF + c * SQ, y = OFF + r * SQ;
      const color = (r + c) % 2 === 0 ? light : dark;
      squares += `<rect x="${x}" y="${y}" width="${SQ}" height="${SQ}" fill="${color}"/>`;
    }
  }
  const border = accent || dark;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 188 188" width="200" height="200">
  <defs>
    <filter id="shadow"><feDropShadow dx="0" dy="2" stdDeviation="4" flood-color="${border}" flood-opacity="0.4"/></filter>
  </defs>
  <rect width="188" height="188" rx="18" fill="#0B0D11"/>
  <rect x="2" y="2" width="184" height="184" rx="16" fill="none" stroke="${border}" stroke-width="2"/>
  <g filter="url(#shadow)">${squares}</g>
</svg>`;
}

function pieceSkin(fill1, fill2, glowColor, label) {
  // King piece silhouette path (simplified)
  const king = `M94 30 L94 22 M86 22 L102 22 M82 38 C82 28 118 28 118 38 L118 50 L128 70 L128 90 Q128 110 100 118 Q72 110 72 90 L72 70 L82 50 Z
    M88 50 L88 72 L80 72 L80 80 L120 80 L120 72 L112 72 L112 50 Z`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 160" width="200" height="200">
  <defs>
    <linearGradient id="piece" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="${fill1}"/>
      <stop offset="100%" stop-color="${fill2}"/>
    </linearGradient>
    <filter id="glow">
      <feGaussianBlur stdDeviation="3" result="blur"/>
      <feMerge><feMergeNode in="blur"/><feMergeNode in="SourceGraphic"/></feMerge>
    </filter>
    <radialGradient id="bg" cx="50%" cy="70%" r="60%">
      <stop offset="0%" stop-color="${glowColor}" stop-opacity="0.15"/>
      <stop offset="100%" stop-color="#0B0D11" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="200" height="160" rx="18" fill="#13161E"/>
  <ellipse cx="100" cy="130" rx="42" ry="8" fill="${glowColor}" opacity="0.2"/>
  <ellipse cx="100" cy="140" rx="36" ry="6" fill="url(#bg)"/>
  <path d="${king}" fill="url(#piece)" filter="url(#glow)" transform="translate(0,8)"/>
</svg>`;
}

function animationIcon(emoji, bg1, bg2, particles) {
  const parts = particles.map((p, i) =>
    `<circle cx="${p[0]}" cy="${p[1]}" r="${p[2]}" fill="${p[3]}" opacity="${p[4]}"/>`
  ).join("\n  ");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
  <defs>
    <radialGradient id="bg" cx="50%" cy="50%" r="50%">
      <stop offset="0%" stop-color="${bg1}" stop-opacity="0.3"/>
      <stop offset="100%" stop-color="${bg2}" stop-opacity="0"/>
    </radialGradient>
  </defs>
  <rect width="200" height="200" rx="20" fill="#13161E"/>
  <circle cx="100" cy="100" r="80" fill="url(#bg)"/>
  ${parts}
  <text x="100" y="120" text-anchor="middle" font-size="72" dominant-baseline="middle">${emoji}</text>
</svg>`;
}

// ─── Generate assets ────────────────────────────────────────────────────────

const assets = {
  // Avatar frames
  "items/avatar_frame_gold.svg": avatarFrame("#F5C842", "#D4A017", "#F5C842"),
  "items/avatar_frame_diamond.svg": avatarFrame("#7DF9FF", "#4169E1", "#00BFFF", true),
  "items/avatar_frame_fire.svg": avatarFrame("#FF6B35", "#FF0000", "#FF4500"),
  "items/avatar_frame_legendary.svg": avatarFrame("#B57BEE", "#F5C842", "#A855F7", true),

  // Board skins
  "items/board_classic.svg": boardSkin("#E8C99A", "#8B5E3C", "Classic"),
  "items/board_marble.svg": boardSkin("#D8D8D8", "#4A4A4A", "Marble", "#9A9A9A"),
  "items/board_neon.svg": boardSkin("#1A2A4A", "#0A1A3A", "Neon", "#00FFFF"),

  // Piece skins
  "items/pieces_standard.svg": pieceSkin("#C8C8C8", "#888888", "#AAAAAA", "Standard"),
  "items/pieces_gold.svg": pieceSkin("#F5C842", "#D4A017", "#F5C842", "Gold"),
  "items/pieces_crystal.svg": pieceSkin("#7DF9FF", "#4169E1", "#00BFFF", "Crystal"),

  // Move animations
  "items/anim_lightning.svg": animationIcon("⚡", "#F5C842", "#FFD700", [
    [60, 60, 8, "#FFD700", 0.4],
    [140, 80, 5, "#F5C842", 0.3],
    [80, 140, 6, "#FFD700", 0.35],
    [150, 150, 4, "#F5C842", 0.25],
  ]),
  "items/anim_fire.svg": animationIcon("🔥", "#FF6B35", "#FF0000", [
    [50, 70, 10, "#FF4500", 0.3],
    [150, 60, 7, "#FF6B35", 0.25],
    [70, 150, 8, "#FF0000", 0.2],
    [145, 140, 5, "#FF4500", 0.3],
  ]),
};

// ─── Upload all ─────────────────────────────────────────────────────────────

const results = {};

for (const [key, svg] of Object.entries(assets)) {
  const url = await upload(key, svg);
  results[key] = url;
}

console.log("\n─── URLs for seed.ts ───");
console.log(JSON.stringify(results, null, 2));
