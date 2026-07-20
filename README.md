# Colorado 14ers — Summer '26 Roadtrip Map

An interactive map of **all 58 named Colorado 14ers**, grouped into 14 town hubs you can
sleep at and climb out of for a few days at a time. A curated shortlist of **28 featured
picks** is shown by default; use **Choose peaks** to switch on any of the rest, or to cut
it down to your own list.

Every peak shows its **difficulty class**, **exposure**, **rockfall potential** and
**route-finding** ratings, along with its standard route and route stats.

## Using it

- **Choose peaks** opens a picker with all 58, grouped by hub, showing elevation, class
  and exposure for each. Tick what you're interested in; the map and list show only
  those. Search by peak, range or hub; select or clear a whole hub at once; or use the
  **All 58 / Featured 28 / None** shortcuts. Featured picks are marked ★ and unranked
  peaks are badged. Your selection is saved in the browser's local storage, so it
  survives reloads.
- **Copy link to this selection** puts your picks in the URL so you can move them between
  devices — curate on a laptop, text yourself the link, open it at a trailhead. Opening a
  link adopts and saves that selection on the new device. The address bar always reflects
  the current selection, so you can copy it from there too.
- **Pick a hub** from the dropdown (or click a blue hub pill on the map) to see only the
  peaks you can reach from that basecamp.
- **Filter by max difficulty and max risk** when the weather, your legs, or your
  partners argue for something easier. The risk filter applies to the *worst* of the
  three risk dimensions, so capping at Moderate never leaves a High-rockfall peak in
  the list.
- **Click any peak** — in the list or on the map — to fly to it and read the details.
- Marker ring = difficulty class. Marker's centre dot = exposure. Hubs are tent icons;
  hover one for its name, click to filter to that basecamp.
- **The control at top right** holds both the basemap switcher and a collapsible legend
  explaining the ring and dot colours. *Relief* (default) is a grayscale hillshade with
  labels — terrain reads clearly while leaving the markers as the only saturated thing on
  screen. *Roads* adds the road network. *Terrain* is full-colour OpenTopoMap with contour
  lines. *Dark* is a dark basemap; peak and hub outlines flip to light so they still
  separate from the background.

## The ratings

All of these describe each peak's standard route. They're independently verified
figures — none are invented here.

**Difficulty (Class 1–4)** is the Yosemite Decimal System rating:

| Class | Meaning |
| --- | --- |
| 1 | Hiking on a trail |
| 2 | Off-trail; hands down occasionally for balance |
| 3 | Scrambling; hands needed most of the time |
| 4 | Climbing; a fall could be fatal, rope sometimes used |

"Difficult Class 2" and "Easy Class 3" are intermediate grades between those steps.

**Risk** is rated on three independent dimensions, each Low → Moderate → Considerable →
High → Extreme (only Sunlight Peak's summit block reaches Extreme):

| Dimension | What it measures |
| --- | --- |
| Exposure | How far you'd fall, and how bad it would be |
| Rockfall | Loose rock, and parties above you knocking it down |
| Route-finding | How easy it is to get off-route, especially descending |

Keeping them separate matters, because they diverge. Missouri Mountain is only Class 2
but Considerable for exposure. Mount Belford is Low exposure with Moderate rockfall.
Crestone Needle is High for exposure *and* route-finding but only Considerable for
rockfall — the rock there is famously solid; the danger is ending up in the wrong gully.

> **This map is for planning, not for navigation.** Coordinates and hub notes are
> editorial. Distance and gain reflect the highest trailhead where a road offers several
> — Sneffels reads 6 mi from the middle lot but 7.75 mi from 2WD parking, so confirm
> them against a full route description before planning around them. Before you climb
> anything here, read that description in full, check the forecast and current
> conditions, start early, and be willing to turn around.

## Peaks and hubs

All 58 are on the map. The **featured** column is the shortlist shown by default, chosen
so that any five of them make a trip worth taking.

| Hub | Featured | Also available |
| --- | --- | --- |
| Estes Park | Longs | — |
| Georgetown / Idaho Springs | Grays, Torreys, Bierstadt | Blue Sky |
| Colorado Springs | — | Pikes |
| Alma / Fairplay | Quandary, Democrat | Lincoln, Cameron, Bross, Sherman |
| Leadville | Elbert, Massive, La Plata, Belford, Missouri, Huron, Holy Cross | Oxford |
| Buena Vista / Salida | Harvard, Yale, Princeton | Columbia, Antero, Shavano, Tabeguache |
| Aspen | Castle, Snowmass, Pyramid, Capitol | Conundrum, Maroon, North Maroon |
| Westcliffe / Crestone | Humboldt, Crestone Needle, Kit Carson | Crestone Peak, Challenger |
| Fort Garland / Blanca | — | Blanca, Ellingwood, Little Bear, Lindsey, Culebra |
| Creede | — | San Luis |
| Lake City | Uncompahgre, Wetterhorn, Handies | Redcloud, Sunshine |
| Ouray | Sneffels | — |
| Telluride | Wilson Peak | Mount Wilson, El Diente |
| Durango / Silverton | — | Windom, Sunlight, Eolus, North Eolus |

### Why the non-featured ones aren't in the default view

They're all still one tick away in the picker — this is about what the map opens with,
not about what's worth climbing:

- **Drive-up summits** — Pikes, Blue Sky. You can park at the top.
- **Loop bumps** — Cameron, Lincoln, Bross, Oxford, Tabeguache, Challenger, Conundrum,
  Sunshine, North Eolus. Worth climbing when you're already there, not worth planning a
  day around; each is noted on the peak it pairs with.
- **The slogs** — Antero (4WD road to 13,800 ft), Columbia (loose, widely disliked),
  Sherman (short but dull), San Luis (remote and mild for the drive).
- **Culebra** — permit-only, paid, booked ahead. The opposite of spontaneous.
- **Little Bear** — the Hourglass is a rockfall funnel with a genuinely bad fatality
  record, and parties above you are the hazard.
- **Chicago Basin** (Windom, Sunlight, Eolus) — superb, but it's a train ride and a
  multi-day backpack rather than a drive-and-climb.
- **Blanca group, Mount Wilson, El Diente, the Maroon Bells** — serious mountaineering
  that wants a dedicated partner and schedule, plus some of the roughest 4WD access in
  the state.

## Local development

It's a static site — no build step needed to view it:

```bash
python3 -m http.server 8000
# open http://localhost:8000
```

## Updating the data

`data.js` is the single source of truth and is edited directly. It holds three arrays:
`CLASS_ORDER`, `RISK_ORDER`, `HUBS` and `PEAKS`.

Each peak record looks like this:

```js
{
 "name": "Mount Elbert",
 "id": 10001,                    // stable; share links key off this (see below)
 "hub": "leadville",             // must match a HUBS id
 "featured": true,               // shown by default
 "note": "…",                    // editorial
 "lat": 39.11774, "lon": -106.44537,
 "elev": 14438, "range": "Sawatch Range", "rank": 1,
 "route": "Mt. Elbert - Northeast Ridge",
 "cls": "Class 1",               // must be one of CLASS_ORDER
 "dist": "9.75 mi", "gain": "4,500'",
 "exposure": "Low", "rockfall": "Low",
 "routefinding": "Low", "commitment": "Low"   // each must be one of RISK_ORDER
}
```

Two constraints worth knowing when editing by hand, since nothing validates them for
you: `cls` must match a `CLASS_ORDER` entry and the four risk fields must match
`RISK_ORDER` entries, or that peak silently drops out of the difficulty and risk
filters. And `id` must stay stable — changing one repoints existing share links at a
different mountain.

## How share links work

There's no backend — the selection travels in the URL fragment, which is why this works
on a static host. It's a bitmask, base64url-encoded, giving codes of about a dozen
characters (`#p=brq8uHCBGw` is the featured 28).

Bit positions are keyed to each peak's **stable `id`**, not to its index in the array.
That matters: if a peak is later added, removed or reordered, old links still resolve to
the same mountains instead of silently shifting by one. A link can only ever lose peaks that
no longer exist. Malformed codes are ignored rather than clobbering the current
selection, and links that arrive after page load (pasted into an open tab) are picked up
via `hashchange`.

## Deploying to GitHub Pages

Push to `main`, then in the repo: **Settings → Pages → Source: Deploy from a branch →
`main` / `root`**. The site is plain HTML/CSS/JS, so it works as-is; `.nojekyll` keeps
Pages from running Jekyll over it.

## Credits

Vector basemaps © [OpenFreeMap](https://openfreemap.org) /
[OpenMapTiles](https://openmaptiles.org); hillshade © [Esri](https://www.esri.com)
(Esri, USGS, NOAA); contour overlay © [OpenTopoMap](https://opentopomap.org) (CC-BY-SA);
map data © [OpenStreetMap](https://www.openstreetmap.org/copyright) contributors.
Mapping library: [MapLibre GL JS](https://maplibre.org).
