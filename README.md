# Kasatria — People Table

A Google-Sheets-driven, Google-Sign-In-gated 3D visualization of 200 people, adapted from
the Three.js `css3d_periodictable` example. Arranges into four layouts: Table (20×10),
Sphere, double Helix, and Grid (5×4×10). Tiles are color-coded by net worth
(red < $100K, orange $100K–$200K, green > $200K).

## Files

- `index.html` — page structure, sign-in screen, styles
- `app.js` — Google Sign-In, CSV fetch/parse, Three.js scene and layouts

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

1. Create a new GitHub repo and push these files to it (see steps below).
2. In the repo, go to **Settings → Pages**, set Source to your main branch, root folder.
3. GitHub gives you a URL like `https://yourusername.github.io/repo-name/`.
4. Go back to Google Cloud Console → **Clients** → your OAuth client → add that exact
   URL (no trailing path after the domain, e.g. `https://yourusername.github.io`) as
   an additional Authorized JavaScript origin.
5. Reload your GitHub Pages URL and sign in to confirm it works there too.

```
git init
git add .
git commit -m "Kasatria assignment: people table"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

## Notes

- The sign-in check here is client-side only (no backend to verify the token against).
  That's the right tradeoff for a demo like this — a production app would verify the ID
  token on a server before trusting it.
- If a person's photo fails to load (broken link, hotlink blocking), the tile falls back
  to a solid color block in place of the image rather than showing a broken-image icon.
