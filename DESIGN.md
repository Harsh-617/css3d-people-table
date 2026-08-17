# Design Notes — Kasatria People Table

Brief write-up of the reasoning behind the build, for anything that wasn't
fully spelled out in the assignment or had more than one reasonable approach.

## Data source: published CSV, not the Sheets API

The brief lists "Google login" and "retrieve data from the sheet" as two
separate numbered steps rather than one combined flow, so I treated them as
independent concerns instead of wiring the login's OAuth token into the
Sheets API itself.

Google Sign-In (Identity Services) handles the login gate on its own — it's
a self-contained client-side flow needing only a Client ID. The data comes
from the sheet published as a CSV endpoint (File → Share → Publish to web),
fetched with a plain `fetch()` call.

The alternative — using the sign-in's OAuth token to call the Sheets API
directly — would demonstrate a deeper auth integration, but adds real
project risk for no functional gain here: enabling the Sheets API, adding a
sensitive scope, and handling token expiry, all for a client that's read
against a document that's effectively public anyway. Given the timeline, the
published-CSV approach felt like the right trade-off: it satisfies both
requirements as written, with a much smaller surface area for something to
break close to the deadline.

## Table and Grid: exact fit, not coincidence-shaped

The CSV has exactly 200 rows. 20×10 (table) and 5×4×10 (grid) are both
exactly 200. That match meant every layout could use every row directly —
no padding, no leftover tiles, no guessing at how to handle a remainder.

- **Table** — the original demo positions elements using their chemical
  group/period (1–18, 1–10), baked into the source data. There's no
  equivalent structure for people, so tiles fill sequentially:
  `col = i % 20`, `row = floor(i / 20)`.
- **Grid** — re-bucketed from the original's 5×5-per-layer scheme to
  5×4×10: `col = i % 5`, `row = floor(i/5) % 4`, `layer = floor(i / 20)`.
- **Sphere** — untouched. The original's spherical distribution only
  depends on object count, not on any per-element data, so it works
  correctly for any dataset as-is.

## Helix: two strands, alternating by index

"Double helix instead of the default single helix" was interpreted as two
intertwined spirals, DNA-style, rather than one continuous line. The 200
tiles split by even/odd index into two strands of 100. Both strands share
the same height progression at a given step, with strand B's angle offset
180° from strand A at that same height — so adjacent data rows (i and i+1)
end up as "base pairs" directly across from each other, rather than one
strand being the first 100 rows and the other the last 100.

## Net worth thresholds

The brief's wording overlaps ("< $100K" / "> $100K" / "> $200K"), so I
resolved it as three non-overlapping bands: **red below $100K, orange from
$100K to $200K inclusive, green above $200K.** This is the only reading that
doesn't leave a gap or double-count the boundary values.

## Extras added beyond the brief

Each addition was aimed at a specific gap rather than added for its own
sake:

- **Name tooltips** — several names were truncating with an ellipsis;
  a native `title` attribute fixes readability without changing layout.
- **Live stats counts** — the color legend shows real counts computed from
  the loaded data, which doubles as a lightweight proof that the coloring
  is genuinely data-driven rather than eyeballed.
- **Click-to-focus with detail panel** — `TrackballControls` always zooms
  toward the scene's current center, so tiles near the edge of a layout
  were impossible to zoom into. Clicking a tile re-centers the camera on
  it and shows its full details, which solves that limitation as a side
  effect of adding a feature that was independently worth having.
- **Camera reset on layout switch** — switching layouts now also returns
  the camera to a level default view, including resetting `camera.up`
  (which `TrackballControls`' arcball-style rotation can otherwise leave
  tilted after certain drags).
- **Category filter bar** — dropdowns for country, interest, and net worth
  bracket (reusing the exact same bracketing function used for tile color,
  so the two can't drift out of sync), plus free-text name search. Filtering
  dims non-matches rather than removing or reordering tiles, since every
  layout positions tiles by array index — removing an entry would shift
  every subsequent tile's position calculation.

## Known trade-offs

- **Sign-in is verified client-side only.** There's no backend to check the
  ID token against, so the app trusts whatever Google's own library hands
  back. That's an acceptable trade-off for a demo with no backend — a
  production version would verify the token server-side before trusting it.
- **Photo reliability depends on an external host.** If a photo URL fails
  to load, the tile falls back to a solid color block rather than a broken
  image icon, but there's no control over the source images' own uptime.
- **Desktop-oriented interaction.** `TrackballControls` is drag-and-scroll
  based; touch support wasn't a focus given the assignment's scope and
  timeline.
