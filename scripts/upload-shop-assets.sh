#!/bin/bash
set -e

BUCKET="799d3c02-99e72b95-3b78-492f-af40-bfc39c0f8bb7"
ACCESS="GBZQW3Q2QMSLFBY6IXOH"
SECRET="IDo7bC66zeCTEMDgaTd8AMBiAD6CqGnakAz1Pv8z"
S3_HOST="s3.twcstorage.ru"
BASE_URL="https://${S3_HOST}/${BUCKET}"

upload_svg() {
  local key="$1"
  local svg="$2"
  local tmpfile=$(mktemp /tmp/chesscoin_XXXXXX.svg)
  echo "$svg" > "$tmpfile"
  curl -sf --resolve "${S3_HOST}:443:217.78.234.145" \
    -X PUT "https://${S3_HOST}/${BUCKET}/${key}" \
    -H "Host: ${S3_HOST}" \
    -H "Content-Type: image/svg+xml" \
    --aws-sigv4 "aws:amz:ru-1:s3" \
    --user "${ACCESS}:${SECRET}" \
    --data-binary "@${tmpfile}" \
    -H "x-amz-acl: public-read" \
    -o /dev/null
  rm -f "$tmpfile"
  echo "✅ ${BASE_URL}/${key}"
}

# ─── Avatar Frames ───────────────────────────────────────────────────────────

upload_svg "items/avatar_frame_gold.svg" '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<defs>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#F5C842" stop-opacity="0.35"/><stop offset="100%" stop-color="#F5C842" stop-opacity="0"/></radialGradient>
  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFE066"/><stop offset="50%" stop-color="#F5C842"/><stop offset="100%" stop-color="#B8860B"/></linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="6"/></filter>
</defs>
<rect width="200" height="200" rx="100" fill="#0B0D11"/>
<circle cx="100" cy="100" r="90" fill="url(#glow)" filter="url(#blur)"/>
<circle cx="100" cy="100" r="88" fill="none" stroke="url(#grad)" stroke-width="10"/>
<circle cx="100" cy="100" r="78" fill="none" stroke="#F5C842" stroke-width="2" opacity="0.5"/>
<circle cx="100" cy="100" r="68" fill="#13161E" opacity="0.9"/>
<text x="100" y="115" text-anchor="middle" font-size="44" dominant-baseline="middle">👑</text>
</svg>'

upload_svg "items/avatar_frame_diamond.svg" '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<defs>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#7DF9FF" stop-opacity="0.4"/><stop offset="100%" stop-color="#4169E1" stop-opacity="0"/></radialGradient>
  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E0F7FF"/><stop offset="50%" stop-color="#7DF9FF"/><stop offset="100%" stop-color="#4169E1"/></linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="6"/></filter>
</defs>
<rect width="200" height="200" rx="100" fill="#0B0D11"/>
<circle cx="100" cy="100" r="90" fill="url(#glow)" filter="url(#blur)"/>
<circle cx="100" cy="100" r="88" fill="none" stroke="url(#grad)" stroke-width="8"/>
<circle cx="100" cy="100" r="80" fill="none" stroke="#7DF9FF" stroke-width="1.5" stroke-dasharray="5 4" opacity="0.7"/>
<circle cx="100" cy="100" r="72" fill="none" stroke="#4169E1" stroke-width="1" opacity="0.4"/>
<circle cx="100" cy="100" r="64" fill="#13161E" opacity="0.9"/>
<text x="100" y="115" text-anchor="middle" font-size="40" dominant-baseline="middle">💎</text>
</svg>'

upload_svg "items/avatar_frame_fire.svg" '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<defs>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#FF6B35" stop-opacity="0.4"/><stop offset="100%" stop-color="#FF0000" stop-opacity="0"/></radialGradient>
  <linearGradient id="grad" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFD700"/><stop offset="50%" stop-color="#FF6B35"/><stop offset="100%" stop-color="#CC0000"/></linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="7"/></filter>
</defs>
<rect width="200" height="200" rx="100" fill="#0B0D11"/>
<circle cx="100" cy="100" r="92" fill="url(#glow)" filter="url(#blur)"/>
<circle cx="100" cy="100" r="88" fill="none" stroke="url(#grad)" stroke-width="10"/>
<circle cx="100" cy="100" r="78" fill="none" stroke="#FF4500" stroke-width="2" opacity="0.6"/>
<circle cx="100" cy="100" r="68" fill="#13161E" opacity="0.9"/>
<text x="100" y="115" text-anchor="middle" font-size="44" dominant-baseline="middle">🔥</text>
</svg>'

upload_svg "items/avatar_frame_legendary.svg" '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<defs>
  <radialGradient id="glow" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#B57BEE" stop-opacity="0.4"/><stop offset="50%" stop-color="#F5C842" stop-opacity="0.2"/><stop offset="100%" stop-color="#B57BEE" stop-opacity="0"/></radialGradient>
  <linearGradient id="grad1" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#F5C842"/><stop offset="50%" stop-color="#B57BEE"/><stop offset="100%" stop-color="#F5C842"/></linearGradient>
  <linearGradient id="grad2" x1="100%" y1="0%" x2="0%" y2="100%"><stop offset="0%" stop-color="#B57BEE"/><stop offset="100%" stop-color="#F5C842"/></linearGradient>
  <filter id="blur"><feGaussianBlur stdDeviation="8"/></filter>
</defs>
<rect width="200" height="200" rx="100" fill="#0B0D11"/>
<circle cx="100" cy="100" r="94" fill="url(#glow)" filter="url(#blur)"/>
<circle cx="100" cy="100" r="88" fill="none" stroke="url(#grad1)" stroke-width="12"/>
<circle cx="100" cy="100" r="76" fill="none" stroke="url(#grad2)" stroke-width="3"/>
<circle cx="100" cy="100" r="70" fill="none" stroke="#F5C842" stroke-width="1" stroke-dasharray="3 5" opacity="0.8"/>
<circle cx="100" cy="100" r="62" fill="#13161E" opacity="0.92"/>
<text x="100" y="110" text-anchor="middle" font-size="38" dominant-baseline="middle">♟</text>
<text x="100" y="148" text-anchor="middle" font-size="11" fill="#F5C842" font-family="sans-serif" font-weight="bold" letter-spacing="2">LEGENDARY</text>
</svg>'

# ─── Board Skins ─────────────────────────────────────────────────────────────

gen_board() {
  local light="$1" dark="$2" bg="$3" border="$4"
  local squares=""
  for r in 0 1 2 3 4 5 6 7; do
    for c in 0 1 2 3 4 5 6 7; do
      local x=$((4 + c * 24)) y=$((4 + r * 24))
      local sum=$((r + c))
      if [ $((sum % 2)) -eq 0 ]; then
        squares="${squares}<rect x=\"${x}\" y=\"${y}\" width=\"24\" height=\"24\" fill=\"${light}\"/>"
      else
        squares="${squares}<rect x=\"${x}\" y=\"${y}\" width=\"24\" height=\"24\" fill=\"${dark}\"/>"
      fi
    done
  done
  echo "<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 200 200\" width=\"200\" height=\"200\"><rect width=\"200\" height=\"200\" rx=\"16\" fill=\"${bg}\"/><rect x=\"2\" y=\"2\" width=\"196\" height=\"196\" rx=\"15\" fill=\"none\" stroke=\"${border}\" stroke-width=\"3\"/>${squares}</svg>"
}

upload_svg "items/board_classic.svg" "$(gen_board '#E8C99A' '#8B5E3C' '#5C3A1E' '#A0714A')"
upload_svg "items/board_marble.svg" "$(gen_board '#DCDCDC' '#555555' '#1C1C1C' '#888888')"
upload_svg "items/board_neon.svg" "$(gen_board '#1A3060' '#070F22' '#050A18' '#00FFFF')"

# ─── Piece Skins ─────────────────────────────────────────────────────────────

upload_svg "items/pieces_standard.svg" '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<rect width="200" height="200" rx="16" fill="#13161E"/>
<defs><linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#D8D8D8"/><stop offset="100%" stop-color="#888888"/></linearGradient></defs>
<ellipse cx="100" cy="175" rx="50" ry="8" fill="#00000066"/>
<path d="M100 40 L100 30 M90 30 L110 30 M86 50 C86 38 114 38 114 50 L118 68 L130 90 L130 120 Q130 145 100 152 Q70 145 70 120 L70 90 L82 68 Z M88 68 L88 95 L76 95 L76 105 L124 105 L124 95 L112 95 L112 68 Z" fill="url(#g)" stroke="#AAAAAA" stroke-width="1.5" stroke-linejoin="round"/>
</svg>'

upload_svg "items/pieces_gold.svg" '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<rect width="200" height="200" rx="16" fill="#13161E"/>
<defs>
  <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#FFE066"/><stop offset="50%" stop-color="#F5C842"/><stop offset="100%" stop-color="#B8860B"/></linearGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="3" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
  <radialGradient id="shine" cx="40%" cy="35%" r="40%"><stop offset="0%" stop-color="#FFF5AA" stop-opacity="0.6"/><stop offset="100%" stop-color="#F5C842" stop-opacity="0"/></radialGradient>
</defs>
<ellipse cx="100" cy="175" rx="50" ry="8" fill="#F5C84244"/>
<path d="M100 40 L100 30 M90 30 L110 30 M86 50 C86 38 114 38 114 50 L118 68 L130 90 L130 120 Q130 145 100 152 Q70 145 70 120 L70 90 L82 68 Z M88 68 L88 95 L76 95 L76 105 L124 105 L124 95 L112 95 L112 68 Z" fill="url(#g)" filter="url(#glow)" stroke="#FFE066" stroke-width="1"/>
<path d="M100 40 L100 30 M90 30 L110 30 M86 50 C86 38 114 38 114 50 L118 68 L130 90 L130 120 Q130 145 100 152 Q70 145 70 120 L70 90 L82 68 Z M88 68 L88 95 L76 95 L76 105 L124 105 L124 95 L112 95 L112 68 Z" fill="url(#shine)" opacity="0.5"/>
</svg>'

upload_svg "items/pieces_crystal.svg" '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<rect width="200" height="200" rx="16" fill="#13161E"/>
<defs>
  <linearGradient id="g" x1="0%" y1="0%" x2="100%" y2="100%"><stop offset="0%" stop-color="#E0F7FF" stop-opacity="0.9"/><stop offset="50%" stop-color="#7DF9FF" stop-opacity="0.7"/><stop offset="100%" stop-color="#4169E1" stop-opacity="0.8"/></linearGradient>
  <filter id="glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter>
</defs>
<ellipse cx="100" cy="175" rx="50" ry="8" fill="#7DF9FF33"/>
<path d="M100 40 L100 30 M90 30 L110 30 M86 50 C86 38 114 38 114 50 L118 68 L130 90 L130 120 Q130 145 100 152 Q70 145 70 120 L70 90 L82 68 Z M88 68 L88 95 L76 95 L76 105 L124 105 L124 95 L112 95 L112 68 Z" fill="url(#g)" filter="url(#glow)" stroke="#7DF9FF" stroke-width="1.5"/>
</svg>'

# ─── Move Animations ─────────────────────────────────────────────────────────

upload_svg "items/anim_lightning.svg" '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<defs><radialGradient id="bg" cx="50%" cy="50%" r="50%"><stop offset="0%" stop-color="#F5C842" stop-opacity="0.25"/><stop offset="100%" stop-color="#0B0D11" stop-opacity="0"/></radialGradient></defs>
<rect width="200" height="200" rx="16" fill="#13161E"/>
<circle cx="100" cy="100" r="85" fill="url(#bg)"/>
<circle cx="60" cy="55" r="6" fill="#FFD700" opacity="0.35"/>
<circle cx="148" cy="70" r="4" fill="#F5C842" opacity="0.3"/>
<circle cx="55" cy="148" r="5" fill="#FFD700" opacity="0.28"/>
<circle cx="150" cy="145" r="3" fill="#F5C842" opacity="0.22"/>
<text x="100" y="118" text-anchor="middle" font-size="88" dominant-baseline="middle">⚡</text>
</svg>'

upload_svg "items/anim_fire.svg" '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200" width="200" height="200">
<defs><radialGradient id="bg" cx="50%" cy="60%" r="55%"><stop offset="0%" stop-color="#FF6B35" stop-opacity="0.3"/><stop offset="100%" stop-color="#0B0D11" stop-opacity="0"/></radialGradient></defs>
<rect width="200" height="200" rx="16" fill="#13161E"/>
<circle cx="100" cy="100" r="85" fill="url(#bg)"/>
<circle cx="55" cy="65" r="8" fill="#FF4500" opacity="0.25"/>
<circle cx="148" cy="58" r="5" fill="#FF6B35" opacity="0.2"/>
<circle cx="62" cy="148" r="7" fill="#FF0000" opacity="0.18"/>
<circle cx="144" cy="142" r="4" fill="#FF4500" opacity="0.25"/>
<text x="100" y="118" text-anchor="middle" font-size="88" dominant-baseline="middle">🔥</text>
</svg>'

echo ""
echo "─── All uploads complete ───"
echo "URLs:"
echo "avatar_frame_gold:      https://${S3_HOST}/${BUCKET}/items/avatar_frame_gold.svg"
echo "avatar_frame_diamond:   https://${S3_HOST}/${BUCKET}/items/avatar_frame_diamond.svg"
echo "avatar_frame_fire:      https://${S3_HOST}/${BUCKET}/items/avatar_frame_fire.svg"
echo "avatar_frame_legendary: https://${S3_HOST}/${BUCKET}/items/avatar_frame_legendary.svg"
echo "board_classic:          https://${S3_HOST}/${BUCKET}/items/board_classic.svg"
echo "board_marble:           https://${S3_HOST}/${BUCKET}/items/board_marble.svg"
echo "board_neon:             https://${S3_HOST}/${BUCKET}/items/board_neon.svg"
echo "pieces_standard:        https://${S3_HOST}/${BUCKET}/items/pieces_standard.svg"
echo "pieces_gold:            https://${S3_HOST}/${BUCKET}/items/pieces_gold.svg"
echo "pieces_crystal:         https://${S3_HOST}/${BUCKET}/items/pieces_crystal.svg"
echo "anim_lightning:         https://${S3_HOST}/${BUCKET}/items/anim_lightning.svg"
echo "anim_fire:              https://${S3_HOST}/${BUCKET}/items/anim_fire.svg"
