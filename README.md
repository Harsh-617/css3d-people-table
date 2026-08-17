# Kasatria — People Table

**Live demo:** https://harsh-617.github.io/css3d-people-table/

A Google-Sheets-driven, Google-Sign-In-gated 3D visualization of 200 people, adapted from
the Three.js `css3d_periodictable` example. Arranges into four layouts: Table (20×10),
Sphere, double Helix, and Grid (5×4×10). Tiles are color-coded by net worth
(red < $100K, orange $100K–$200K, green > $200K).

Hovering a tile shows the person's name as a tooltip, and the color legend displays live
counts per net-worth bracket computed from the loaded data. Clicking a tile focuses the
camera on it and opens a detail panel with name, age, country, interest, and net worth.
Switching layouts resets the camera (position, target, and level horizon) back to a
default view. A filter bar above the scene supports free-text name search plus dropdowns
for country, interest, and net worth bracket, dimming tiles that don't match.

## Files

- `index.html` — page structure, sign-in screen, styles
- `app.js` — Google Sign-In, CSV fetch/parse, Three.js scene, layouts, filters
- `DESIGN.md` — reasoning behind key decisions (data source choice, layout math, color
  thresholds, helix design, and the extras above)

Config values (your Client ID and published-CSV URL) are set at the top of `app.js`.

## Run it locally

You can't just double-click `index.html` — ES modules and `fetch` need a real server.

**Option A — VS Code:** install the "Live Server" extension, right-click `index.html`,
choose "Open with Live Server". It defaults to `http://localhost:5500`, which matches
the Authorized JavaScript origin you already added in Google Cloud Console.

**Option B — Python:** from this folder, run:
```
python3 -m http.server 5500
```
then open `http://localhost:5500` in your browser.

If Google Sign-In fails with an origin error, double check the URL in your browser's
address bar matches exactly what you added under Authorized JavaScript origins in
Google Cloud Console → Google Auth Platform → Clients.

## Deploy to GitHub Pages

This repo is already live at the URL above via GitHub Pages — any push to `main`
auto-updates it, no manual redeploy step needed.

If you fork this and deploy your own copy, GitHub Pages will give you a URL like
`https://yourusername.github.io/repo-name/`. You'll need to go to Google Cloud Console →
**Clients** → your OAuth client → add that exact origin (no trailing path after the
domain, e.g. `https://yourusername.github.io`) as an additional Authorized JavaScript
origin, or Google Sign-In will fail there.

## Notes

See [DESIGN.md](DESIGN.md) for the full reasoning; the headline trade-offs:

- Sign-in is verified client-side only — there's no backend to check the ID token
  against, which is an acceptable trade-off for a demo but not for production.
- If a person's photo fails to load, the tile falls back to a solid color block rather
  than a broken-image icon.
