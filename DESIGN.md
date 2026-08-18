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

## Resilient data fetching

Once a reviewer has Editor access to the sheet, it's reasonable to assume
the sheet may be actively edited while someone is reviewing the app — and
Google regenerates the published CSV snapshot in the background whenever
the underlying sheet changes. A fetch that lands mid-regeneration can come
back with a transient error even though the sheet and the publish are both
fine seconds later. That's an expected occasional condition given the
review workflow, not a real failure, so it shouldn't surface as one.

`fetchCsvWithRetry()` retries a failed fetch up to 3 attempts total, with
1s/2s/4s backoff between them, before giving up and showing the actual
error. While a retry is pending, the loading screen's text changes to
"Reconnecting…" so a slow-loading page reads as "still working" rather
than "stuck" if a reviewer happens to catch it. Only after all 3 attempts
fail does the loading screen show the real error message and give up —
there's still no recovery path for a genuinely broken sheet URL or a
sustained outage, just a wider window that stops a one-off blip from
being mistaken for one.

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

## Pyramid (tetrahedron)

A fifth layout, added after a reviewer asked for one — it wasn't part of
the original brief, so it inherits none of the "exact fit" data structure
the other layouts lean on and had to be built from scratch geometrically.

The 200 tiles split into 4 equal groups of 50, one per triangular face of
a regular tetrahedron. Within a face, a tile's position comes from a
triangular row/column grid (row `r` holds `r+1` points, apex to base)
converted to barycentric coordinates over that face's 3 vertices — the
same "weighted mix of 3 corners" trick used to interpolate anything across
a triangle. 50 isn't a perfect triangular number, so the grid runs 10 rows
and just stops once 50 points are placed, leaving the base row partially
filled; a small, accepted amount of unevenness rather than a real defect.

Two real bugs turned up while building this out:

- **Shared-edge tiles landing on identical coincident points.** A
  tetrahedron's 6 edges are each shared by 2 faces, and both faces
  declare their vertices in the same ascending order, so both sampled
  their shared edge identically — 80 of the 200 tiles ended up stacked
  exactly on top of another tile's position. Fixed by offsetting both
  barycentric parameters half a grid step so no tile's coordinates ever
  land exactly on a row/column boundary — which keeps every tile strictly
  inside its own face, off every edge, so no two faces can ever produce
  the same point.
- **Tiles facing the wrong way.** The first pass reused the sphere/helix
  convention of orienting each tile along its own radial direction from
  the tetrahedron's center. That only approximates a flat face's true
  outward direction near the face's centroid, and diverges sharply near
  the corners (measured up to ~70° off) — corner tiles visibly jutted out
  instead of lying flush with their face. Fixed by computing each face's
  one constant outward normal directly (via the cross product of two edge
  vectors) and orienting every tile on that face to it, rather than
  deriving a per-tile direction at all.

Beyond fixing those two, the barycentric weights are also shrunk toward
each face's centroid (`INSET = 0.88`) before mapping to 3D, pulling every
tile back from the vertices and edges. Every tetrahedron vertex is shared
by 3 faces, so even after the half-step fix stops faces from landing on
identical points, each face's own corner tiles still sample close to that
shared vertex — three faces' worth of steeply-angled corner tiles bunching
up tightly together. The inset gives faces more breathing room from each
other there.

Some tile roll/orientation inconsistency and a minor streak artifact from
steep viewing angles near those shared vertices may still be visible.
That was evaluated as acceptable rather than pursued further — it doesn't
affect the shape being correctly a tetrahedron, and every tile's position
is individually correct and bounded to its own face.

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
