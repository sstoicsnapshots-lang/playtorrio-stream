# PlayTorrio Stream

Cross-platform streaming app with a TMDB catalog, multi-source resolution,
a live TV / sports aggregator, Stremio addon support, and an adaptive
HLS media player.

## Run locally

**Prerequisites:** Node.js 20+

1. Install dependencies:
   ```
   npm install
   ```
2. (Optional) copy `.env.example` to `.env` and set `TMDB_API_KEY` for a custom
   TMDB key. If omitted, built-in standard access is used.
3. Start the app:
   ```
   npm run dev
   ```

## Build

```
npm run build   # web assets + bundled server -> dist/
npm start        # run the built server
```

## Package as a macOS app

```
npm run dmg      # -> dist-dmg/PlayTorrio.dmg
```




<img width="1582" height="961" alt="Screenshot 2026-09-01 at 1 02 33 AM" src="https://github.com/user-attachments/assets/67cae6f3-9690-4128-8555-bf0c615c9c29" />

