#!/usr/bin/env bash
#
# Build a self-contained, ad-hoc-signed macOS .dmg for PlayTorrio.
#
#   bash scripts/dmg.sh
#
# Output: dist-dmg/PlayTorrio.dmg
#
# The .app bundles a Node runtime + the built server + the web assets. It runs
# a local server and opens the app in your default browser (Brave). No Chromium,
# no Electron. ~50 MB.
#
set -euo pipefail

# --- config ---------------------------------------------------------------
APP_NAME="PlayTorrio"
BUNDLE_ID="com.playtorrio.app"
NODE_VERSION="${NODE_VERSION:-22.14.0}"          # pinned LTS; override via env
SIGN_ID="${SIGN_ID:--}"                          # "-" = ad-hoc. Set to a Dev ID to real-sign.
VERSION="$(node -p "require('./package.json').version || '1.0.0'" 2>/dev/null || echo 1.0.0)"

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
OUT="$ROOT/dist-dmg"
STAGE="$OUT/stage"
APP="$STAGE/$APP_NAME.app"
RES="$APP/Contents/Resources"
APPDIR="$RES/app"

case "$(uname -m)" in
  arm64)  NODE_ARCH="arm64" ;;
  x86_64) NODE_ARCH="x64" ;;
  *) echo "Unsupported arch: $(uname -m)" >&2; exit 1 ;;
esac
NODE_PKG="node-v${NODE_VERSION}-darwin-${NODE_ARCH}"
NODE_URL="https://nodejs.org/dist/v${NODE_VERSION}/${NODE_PKG}.tar.gz"
NODE_CACHE="$OUT/.cache/${NODE_PKG}/bin/node"

say() { printf '\033[1;36m▸ %s\033[0m\n' "$*"; }

# --- 1. build web + server ---------------------------------------------------
say "Building web assets and server bundle"
cd "$ROOT"
npm run build   # -> dist/ (vite) + dist/server.cjs (esbuild)

# --- 2. fetch a standalone Node runtime -----------------------------------
if [[ ! -x "$NODE_CACHE" ]]; then
  say "Downloading Node v${NODE_VERSION} (${NODE_ARCH})"
  mkdir -p "$OUT/.cache"
  curl -fsSL "$NODE_URL" | tar -xz -C "$OUT/.cache"
fi

# --- 3. assemble the .app bundle -----------------------------------------
say "Assembling $APP_NAME.app"
rm -rf "$STAGE"
mkdir -p "$APP/Contents/MacOS" "$APPDIR"

cp -R "$ROOT/dist" "$APPDIR/dist"
cp "$ROOT/dist/server.cjs" "$APPDIR/server.cjs"
[[ -f "$ROOT/dist/server.cjs.map" ]] && cp "$ROOT/dist/server.cjs.map" "$APPDIR/"
[[ -f "$ROOT/.env" ]] && cp "$ROOT/.env" "$APPDIR/.env" || true
cp "$NODE_CACHE" "$RES/node"
chmod +x "$RES/node"

# minimal production node_modules — copy the exact versions the project resolved
# (installing fresh would pull Express 5, which breaks the '*' routes).
say "Bundling production dependencies"
mkdir -p "$APPDIR/node_modules"
node -e '
  const fs = require("fs"), path = require("path");
  const seen = new Set();
  const src = path.join(process.cwd(), "node_modules");
  const dst = process.argv[1];
  function copyPkg(name) {
    if (seen.has(name)) return; seen.add(name);
    const from = path.join(src, name);
    if (!fs.existsSync(from)) { console.warn("  missing:", name); return; }
    fs.cpSync(from, path.join(dst, name), { recursive: true, dereference: true });
    let pj = {};
    try { pj = JSON.parse(fs.readFileSync(path.join(from, "package.json"), "utf8")); } catch {}
    for (const dep of Object.keys(pj.dependencies || {})) copyPkg(dep);
  }
  ["express", "cors", "dotenv"].forEach(copyPkg);
  console.log("  copied", seen.size, "packages");
' "$APPDIR/node_modules"
printf '{"name":"playtorrio-runtime","private":true}\n' > "$APPDIR/package.json"

# --- 4. launcher --------------------------------------------------------
cat > "$APP/Contents/MacOS/$APP_NAME" <<'LAUNCH'
#!/bin/bash
set -euo pipefail
HERE="$(cd "$(dirname "$0")" && pwd)"
RES="$(cd "$HERE/../Resources" && pwd)"
cd "$RES/app"

export NODE_ENV=production
export DIST_PATH="$RES/app/dist"

# pick a free port starting at 3000
PORT=3000
while lsof -iTCP:"$PORT" -sTCP:LISTEN >/dev/null 2>&1; do PORT=$((PORT+1)); done
export PORT

"$RES/node" "$RES/app/server.cjs" &
SERVER_PID=$!
trap 'kill "$SERVER_PID" 2>/dev/null || true' EXIT INT TERM

for _ in $(seq 1 60); do
  curl -s "http://localhost:$PORT" >/dev/null 2>&1 && break
  sleep 0.25
done

open "http://localhost:$PORT"
wait "$SERVER_PID"
LAUNCH
chmod +x "$APP/Contents/MacOS/$APP_NAME"

# --- 5. Info.plist + icon --------------------------------------------------
cat > "$APP/Contents/Info.plist" <<PLIST
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleName</key><string>$APP_NAME</string>
  <key>CFBundleDisplayName</key><string>$APP_NAME</string>
  <key>CFBundleIdentifier</key><string>$BUNDLE_ID</string>
  <key>CFBundleVersion</key><string>$VERSION</string>
  <key>CFBundleShortVersionString</key><string>$VERSION</string>
  <key>CFBundlePackageType</key><string>APPL</string>
  <key>CFBundleExecutable</key><string>$APP_NAME</string>
  <key>CFBundleIconFile</key><string>AppIcon</string>
  <key>LSMinimumSystemVersion</key><string>11.0</string>
  <key>NSHighResolutionCapable</key><true/>
  <key>LSApplicationCategoryType</key><string>public.app-category.entertainment</string>
</dict>
</plist>
PLIST

# app icon: ICON_SRC env, else the bundled brand logo, else scripts/icon.png
ICON_SRC="${ICON_SRC:-}"
if [[ -z "$ICON_SRC" ]]; then
  ICON_SRC="$(ls "$ROOT"/src/assets/images/playtorrio_logo_*.jpg 2>/dev/null | head -1 || true)"
  [[ -z "$ICON_SRC" && -f "$ROOT/scripts/icon.png" ]] && ICON_SRC="$ROOT/scripts/icon.png"
fi
if [[ -n "$ICON_SRC" && -f "$ICON_SRC" ]]; then
  say "Generating app icon from $(basename "$ICON_SRC")"
  ICON_PNG="$OUT/.cache/icon_1024.png"
  mkdir -p "$OUT/.cache"
  if python3 "$ROOT/scripts/make-icon.py" "$ICON_SRC" "$ICON_PNG" 2>/dev/null; then :; else
    # no Pillow — fall back to the raw square
    sips -s format png -z 1024 1024 "$ICON_SRC" --out "$ICON_PNG" >/dev/null
  fi
  ICONSET="$OUT/AppIcon.iconset"; rm -rf "$ICONSET"; mkdir -p "$ICONSET"
  for s in 16 32 128 256 512; do
    sips -z $s $s             "$ICON_PNG" --out "$ICONSET/icon_${s}x${s}.png"      >/dev/null
    sips -z $((s*2)) $((s*2)) "$ICON_PNG" --out "$ICONSET/icon_${s}x${s}@2x.png"   >/dev/null
  done
  cp "$ICON_PNG" "$ICONSET/icon_512x512@2x.png"
  iconutil -c icns "$ICONSET" -o "$RES/AppIcon.icns"
  rm -rf "$ICONSET"
  cp "$ICON_PNG" "$RES/app/dist/appicon.png"   # also usable as a favicon
else
  echo "  (no icon source found — shipping default icon)"
fi

# --- 6. ad-hoc sign ------------------------------------------------------
say "Signing (${SIGN_ID})"
codesign --force --deep --timestamp=none --sign "$SIGN_ID" "$APP"
codesign --verify --deep --strict "$APP" && echo "  signature ok"

# --- 7. dmg -----------------------------------------------------------
say "Building disk image"
DMG="$OUT/$APP_NAME.dmg"
rm -f "$DMG"
ln -sf /Applications "$STAGE/Applications"
# give the mounted volume the same icon
if [[ -f "$RES/AppIcon.icns" ]]; then
  cp "$RES/AppIcon.icns" "$STAGE/.VolumeIcon.icns"
  SetFile -a C "$STAGE" 2>/dev/null || true
fi
hdiutil create -volname "$APP_NAME" -srcfolder "$STAGE" -ov -format UDZO "$DMG" >/dev/null
codesign --force --sign "$SIGN_ID" "$DMG" 2>/dev/null || true

SIZE="$(du -h "$DMG" | cut -f1)"
say "Done → $DMG  ($SIZE)"
echo
echo "  Install: open the .dmg, drag $APP_NAME to Applications."
echo "  First launch: right-click → Open (ad-hoc signed apps need this once)."
