# rcmcp — Specification

MCP server exposing structured roller coaster data from [rcdb.com](https://rcdb.com) to AI assistants, removing the need to scrape HTML at query time.

---

## Goals

- Let an AI answer questions like "what's the tallest steel coaster in Europe?" or "which parks in Ohio have wooden coasters?" without scraping the live website.
- Provide stable, structured data: names, stats, park info, location, rankings, status.
- Keep tools composable: search first, then drill down with IDs.

---

## Data Model

### Coaster

| Field | Type | Description |
|---|---|---|
| `id` | `number` | RCDB numeric ID (URL: `rcdb.com/{id}.htm`) |
| `name` | `string` | Coaster name |
| `park` | `Park` | Parent park (nested object) |
| `status` | `string` | `"Operating"`, `"SBNO"`, `"Under Construction"`, `"In Storage"`, `"Removed"` |
| `type` | `string` | Track material: `"Steel"` or `"Wood"` |
| `design` | `string` | Ride design: `"Sit Down"`, `"Inverted"`, `"Suspended"`, `"Wing"`, `"Flying"`, `"Stand Up"`, `"Bobsled"`, `"Pipeline"` |
| `classification` | `string` | `"Roller Coaster"`, `"Powered Coaster"`, `"Mountain Coaster"` |
| `scale` | `string \| null` | `"Kiddie"`, `"Family"`, `"Thrill"`, `"Extreme"` |
| `manufacturer` | `{ id: number; name: string } \| null` | Manufacturer with their RCDB ID |
| `model` | `string \| null` | Manufacturer model/track type if known |
| `stats` | `CoasterStats` | Physical dimensions and ride data |
| `opened` | `string \| null` | Opening year or full date |
| `closed` | `string \| null` | Closing year or full date (if applicable) |
| `rcdbUrl` | `string` | Canonical RCDB page URL |

### CoasterStats

All stats are stored in RCDB's display units (imperial) and converted to metric on output.

| Field | Type | Unit |
|---|---|---|
| `height` | `number \| null` | meters |
| `drop` | `number \| null` | meters |
| `length` | `number \| null` | meters |
| `speed` | `number \| null` | km/h |
| `duration` | `number \| null` | seconds |
| `angle` | `number \| null` | degrees |
| `inversions` | `number \| null` | count |

### Park

| Field | Type | Description |
|---|---|---|
| `id` | `number` | RCDB numeric ID (URL: `rcdb.com/{id}.htm`) |
| `name` | `string` | Park name |
| `country` | `string` | Country name |
| `countryId` | `number` | RCDB location ID for country |
| `state` | `string \| null` | State/province name |
| `stateId` | `number \| null` | RCDB location ID for state |
| `city` | `string \| null` | City name |
| `status` | `string` | `"Operating"`, `"SBNO"`, `"Closed"` |
| `rcdbUrl` | `string` | Canonical RCDB page URL |

---

## RCDB URL Scheme

All objects (coasters, parks, manufacturers) share a single numeric ID namespace. Pages follow the pattern `rcdb.com/{id}.htm`.

**Search/list pages** live at `rcdb.com/r.htm` and accept query parameters:

| Parameter | Values | Description |
|---|---|---|
| `ot` | `2` = coasters, `3` = parks | Object type (required) |
| `nc` | text string | Name/text search (fuzzy multi-field match) |
| `ex` | `on` | Show only existing/operating records |
| `df` | `on` | Show only defunct records |
| `st` | status ID | Filter by status: `93`=Operating, `310`=Under Construction, `311`=SBNO, `312`=In Storage |
| `ty` | type ID | Filter by track material: `1`=Steel, `2`=Wood |
| `de` | design ID | Filter by design: `6`=Sit Down, `5`=Inverted, `8`=Suspended, `67`=Wing, `4`=Flying, `7`=Stand Up, `3`=Bobsled, `73`=Pipeline |
| `sc` | scale ID | Filter by scale: `21`=Kiddie, `22`=Family, `23`=Thrill, `20`=Extreme |
| `cs` | classification ID | Filter by classification: `277`=Roller Coaster, `278`=Powered Coaster, `279`=Mountain Coaster |
| `op` | year | Filter by opening year (e.g. `2023`) |
| `cl` | year | Filter by closing year |
| `mk` | manufacturer ID | Filter by manufacturer (same ID as their profile page) |
| `ol` | location ID | Filter by location (country or state) from `rcdb.com/location.htm?id=N` |
| `order` | see below | Sort column; positive = descending, negative = ascending |
| `page` | integer | Pagination (~24 results per page) |

**Known `order=` values:**

| Value | Column |
|---|---|
| ±1 | Coaster name |
| ±4 | Amusement park name |
| ±8 | Opened |
| ±9 | Closed |
| ±13 | Type |
| ±14 | Design |
| ±15 | Classification |
| ±17 | Model |
| ±19 | Speed |
| ±20 | Height |
| ±21 | Drop |
| ±22 | Length |
| ±23 | Angle |
| ±24 | Inversions |
| ±26 | Scale |
| ±27 | Duration |
| ±29 | Status |

**Positive = descending (biggest first), Negative = ascending (smallest first).**

**Location IDs** are discovered via `rcdb.com/location.htm?id=N`. Known values:
- `59` = United States

To get location IDs for other countries/states, fetch the location page for a known country and follow the state links, or parse the location links on any coaster or park page.

**Individual object pages:**
- `rcdb.com/{coasterId}.htm` — coaster detail (stats, park, manufacturer, elements)
- `rcdb.com/{parkId}.htm` — park detail (location, coaster roster with IDs)
- `rcdb.com/{manufacturerId}.htm` — manufacturer detail (coaster count, search links)
- `rcdb.com/location.htm?id={N}` — location stats and links to regional search

---

## Tools

### `search-coasters`

Search coasters with filters and sorting. Maps directly to `r.htm?ot=2` with composable parameters.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | no | Text search across name and related fields (`nc=`) |
| `locationId` | `number` | no | RCDB location ID for country or state (`ol=`) |
| `manufacturerId` | `number` | no | RCDB manufacturer ID (`mk=`) |
| `existingOnly` | `boolean` | no | If true, only return operating/existing coasters (`ex=on`) |
| `status` | `string` | no | `"Operating"` \| `"Under Construction"` \| `"SBNO"` \| `"In Storage"` (`st=`) |
| `type` | `string` | no | `"Steel"` \| `"Wood"` (`ty=`) |
| `design` | `string` | no | `"Sit Down"` \| `"Inverted"` \| `"Suspended"` \| `"Wing"` \| `"Flying"` \| `"Stand Up"` \| `"Bobsled"` \| `"Pipeline"` (`de=`) |
| `scale` | `string` | no | `"Kiddie"` \| `"Family"` \| `"Thrill"` \| `"Extreme"` (`sc=`) |
| `classification` | `string` | no | `"Roller Coaster"` \| `"Powered Coaster"` \| `"Mountain Coaster"` (`cs=`) |
| `openedYear` | `number` | no | Filter by opening year, e.g. `2023` (`op=`) |
| `closedYear` | `number` | no | Filter by closing year (`cl=`) |
| `sortBy` | `string` | no | `"height"` \| `"speed"` \| `"length"` \| `"drop"` \| `"inversions"` \| `"angle"` \| `"duration"` \| `"opened"` \| `"name"` |
| `sortDir` | `string` | no | `"asc"` \| `"desc"` (default: `"desc"` for numeric/date, `"asc"` for name) |
| `page` | `number` | no | Page number, 1-indexed (default: `1`) |

**Returns:** Array of coaster summaries (id, name, park, type, design, status, opened) plus total count and page info.

**Implementation:** Fetches `r.htm?ot=2` with composable parameters (`nc=`, `ex=on`, `st=`, `ty=`, `de=`, `sc=`, `cs=`, `op=`, `cl=`, `mk=`, `ol=`, `order=`, `page=`), parses the results table.

---

### `get-coaster`

Retrieve full detail for a single coaster by RCDB ID.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `number` | yes | RCDB object ID |

**Returns:** Full `Coaster` object parsed from `rcdb.com/{id}.htm`.

**Note:** The same ID space is shared by parks and manufacturers. If the page is not a coaster, return a clear error.

---

### `search-parks`

Search parks. Maps to `r.htm?ot=3`.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `query` | `string` | no | Text search (`nb=`) |
| `locationId` | `number` | no | RCDB location ID (`ol=`) |
| `existingOnly` | `boolean` | no | Filter to operating parks |
| `sortBy` | `string` | no | `"name"` \| `"opened"` \| `"coasterCount"` |
| `page` | `number` | no | Page number (default: `1`) |

**Returns:** Array of park summaries (id, name, city, state, country, status, coaster count) plus total count.

---

### `get-park`

Retrieve full detail for a park including its coaster roster.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `id` | `number` | yes | RCDB park ID |

**Returns:** Full `Park` object plus `coasters: Coaster[]` (all coasters, including removed), parsed from `rcdb.com/{id}.htm`.

---

### `get-location-id`

Resolve a human-readable country or state name to an RCDB location ID for use in other tools. The location ID system is RCDB-internal (e.g. United States = `59`).

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | yes | Country or state/province name (e.g. `"France"`, `"Ohio"`) |

**Implementation:** Fetches `location.htm?id=59` (US) or similar root location pages, follows geographic hierarchy links, matches by name. Cache location ID results in-process — these never change.

**Returns:** `{ id: number; name: string; type: "country" | "state" }` or a not-found message.

---

### `get-manufacturer-id`

Resolve a manufacturer name to an RCDB ID for use in `search-coasters`.

**Parameters:**
| Name | Type | Required | Description |
|---|---|---|---|
| `name` | `string` | yes | Manufacturer name (e.g. `"Bolliger & Mabillard"`, `"Intamin"`, `"RMC"`) |

**Implementation:** Uses `r.htm?ot=12&nb={name}` (companies search) to find the manufacturer page, returns the numeric ID.

**Returns:** `{ id: number; name: string; coastersBuilt: number }` or a not-found message.

---

## Resources (optional, future)

MCP resources for stable reference data that rarely changes:

| URI | Description |
|---|---|
| `rcdb://locations` | Known country/state names and their RCDB location IDs |
| `rcdb://manufacturers` | Common manufacturer names and their RCDB IDs |

These can be populated lazily and cached in-process.

---

## Data Source Strategy

RCDB does not provide a public API. Their terms of service explicitly prohibit using content to construct derivative databases, websites, or applications without prior written permission. This rules out any persistent scrape-and-store approach.

### Live fetch at query time (only viable approach)
- Each tool fetches and parses the relevant RCDB page when called, exactly as a browser would.
- No data is persisted beyond the current request — no SQLite snapshot, no bulk export.
- Slow (~1–3 s per tool call) and coupled to RCDB's HTML structure, but compliant.
- Lightweight **in-process caching** (a `Map` with a short TTL like 5 minutes) is acceptable to avoid redundant fetches within a session. This cache lives only in the server process and is never written to disk.

### HTML parsing notes
- Stats table uses class `.stat-tbl`.
- Classification/type/design tags use `.mg a` links pointing to `/g.htm?id=N` (glossary).
- RCDB displays stats in imperial units (ft, mph) — convert to metric on output.
- Park coaster lists include both operating and defunct coasters in separate sections.

### Rate limiting
- Add a small delay between outbound requests (~500 ms) when a tool call requires multiple page fetches.
- Send a descriptive `User-Agent` header (e.g. `rcmcp/0.1.0`).

### Contact RCDB
If this server gains real usage, reach out to RCDB for permission or an official data arrangement before growing the user base.

---

## Error Handling

All tools return a `content` array with `type: "text"`. On error, return a human-readable message rather than throwing.

```ts
return {
  content: [{ type: "text", text: "No coaster found with ID 99999." }],
};
```

---

## Non-goals (v1)

- Element/track-layout filtering in search (params identified but not yet exposed as tool parameters)
- User reviews or ratings
- Photos or media
- Real-time queue/wait times
- Writing data back to RCDB
- Authentication
