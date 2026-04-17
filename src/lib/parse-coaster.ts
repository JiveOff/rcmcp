import { parse } from "node-html-parser";

export interface CoasterStats {
  height: number | null; // meters
  drop: number | null; // meters
  length: number | null; // meters
  speed: number | null; // km/h
  duration: number | null; // seconds
  angle: number | null; // degrees
  inversions: number | null;
}

export interface CoasterElement {
  id: number;
  name: string;
}

export interface Coaster {
  id: number;
  name: string;
  park: { id: number; name: string } | null;
  location: {
    city: string | null;
    cityId: number | null;
    state: string | null;
    stateId: number | null;
    country: string | null;
    countryId: number | null;
  };
  status: string | null;
  type: string | null;
  design: string | null;
  classification: string | null;
  scale: string | null;
  manufacturer: { id: number; name: string } | null;
  model: string | null;
  opened: string | null;
  closed: string | null;
  stats: CoasterStats;
  elements: CoasterElement[];
  rcdbUrl: string;
}

const OBJECT_ID_RE = /^\/(\d+)\.htm$/;
const LOCATION_ID_RE = /\/location\.htm\?id=(\d+)/;

function ftToM(ft: number) {
  return Math.round(ft * 0.3048 * 10) / 10;
}

function mphToKmh(mph: number) {
  return Math.round(mph * 1.60934 * 10) / 10;
}

function parseDurationToSeconds(s: string): number | null {
  // "2:20" → 140, "1:30:00" → 5400
  const parts = s.trim().split(":").map(Number);
  if (parts.some(isNaN)) return null;
  if (parts.length === 2) return (parts[0] ?? 0) * 60 + (parts[1] ?? 0);
  if (parts.length === 3) return (parts[0] ?? 0) * 3600 + (parts[1] ?? 0) * 60 + (parts[2] ?? 0);
  return null;
}

function parseStat(raw: string): number | null {
  // "310 ft" → 310, "93 mph" → 93, "6,595 ft" → 6595
  const n = parseFloat(raw.replace(/,/g, ""));
  return isNaN(n) ? null : n;
}

// Known g.htm IDs for design/type/scale classification
const DESIGN_TERMS = new Set([
  "Sit Down", "Inverted", "Suspended", "Wing", "Flying",
  "Stand Up", "Bobsled", "Pipeline", "Spinning", "Mine Train",
]);
const TYPE_TERMS = new Set(["Steel", "Wood"]);
const SCALE_TERMS = new Set(["Kiddie", "Family", "Thrill", "Extreme"]);
const CLASSIFICATION_TERMS = new Set([
  "Roller Coaster", "Powered Coaster", "Mountain Coaster",
]);

export function parseCoaster(html: string, id: number): Coaster {
  const root = parse(html);

  const name = root.querySelector("h1")?.text.trim() ?? "Unknown";

  // Park and location links
  let park: { id: number; name: string } | null = null;
  const location = {
    city: null as string | null,
    cityId: null as number | null,
    state: null as string | null,
    stateId: null as number | null,
    country: null as string | null,
    countryId: null as number | null,
  };

  // Location links
  const locationLinks = root.querySelectorAll('a[href*="/location.htm?id="]');
  if (locationLinks.length >= 1) {
    location.city = locationLinks[0]!.text.trim();
    const m = locationLinks[0]!.getAttribute("href")?.match(LOCATION_ID_RE);
    if (m) location.cityId = parseInt(m[1]!);
  }
  if (locationLinks.length >= 2) {
    location.state = locationLinks[1]!.text.trim();
    const m = locationLinks[1]!.getAttribute("href")?.match(LOCATION_ID_RE);
    if (m) location.stateId = parseInt(m[1]!);
  }
  if (locationLinks.length >= 3) {
    location.country = locationLinks[2]!.text.trim();
    const m = locationLinks[2]!.getAttribute("href")?.match(LOCATION_ID_RE);
    if (m) location.countryId = parseInt(m[1]!);
  }

  // Park: first object link in the page (before stats)
  for (const a of root.querySelectorAll("a")) {
    const href = a.getAttribute("href") ?? "";
    const m = href.match(OBJECT_ID_RE);
    if (m) {
      park = { id: parseInt(m[1]!), name: a.text.trim() };
      break;
    }
  }

  // Status and opened/closed
  let status: string | null = null;
  let opened: string | null = null;
  let closed: string | null = null;

  // Status is in a <p> (or sometimes <li>): e.g.
  // <p><a href="/g.htm?id=93">Operating</a> since <time datetime="2000-05-13"></time></p>
  const STATUS_TERMS = ["Operating", "SBNO", "Removed", "Under Construction", "In Storage"];
  for (const el of root.querySelectorAll("p, li")) {
    const a = el.querySelector('a[href^="/g.htm"]');
    if (!a) continue;
    const aText = a.text.trim();
    if (STATUS_TERMS.includes(aText)) {
      status = aText;
      // Opened date: prefer <time datetime="..."> attribute, fall back to text
      const timeEl = el.querySelector("time");
      if (timeEl) {
        opened = (timeEl.getAttribute("datetime") ?? timeEl.text.trim()) || null;
      } else {
        const sinceMatch = el.text.match(/since\s+(\w[\w\s,]*)/);
        if (sinceMatch) opened = sinceMatch[1]!.trim();
      }
      // Closed date: second <time> element if present
      const timeEls = el.querySelectorAll("time");
      if (timeEls.length >= 2) {
        closed = (timeEls[1]!.getAttribute("datetime") ?? timeEls[1]!.text.trim()) || null;
      } else {
        const untilMatch = el.text.match(/until\s+(\w[\w\s,]*)/);
        if (untilMatch) closed = untilMatch[1]!.trim();
      }
      break;
    }
  }

  // Classification tags from ul.ll
  let type: string | null = null;
  let design: string | null = null;
  let scale: string | null = null;
  let classification: string | null = null;

  for (const a of root.querySelectorAll("ul.ll li a")) {
    const t = a.text.trim();
    if (TYPE_TERMS.has(t)) type = t;
    else if (DESIGN_TERMS.has(t)) design = t;
    else if (SCALE_TERMS.has(t)) scale = t;
    else if (CLASSIFICATION_TERMS.has(t)) classification = t;
  }

  // Manufacturer: find "Make:" text node, then the next object link
  let manufacturer: { id: number; name: string } | null = null;
  let model: string | null = null;

  const bodyText = root.innerHTML;
  const makeIdx = bodyText.indexOf("Make:");
  if (makeIdx !== -1) {
    // Find all object links after "Make:" in the HTML
    const afterMake = bodyText.slice(makeIdx);
    const makeLinks = parse(afterMake).querySelectorAll('a[href]').slice(0, 3);
    for (const a of makeLinks) {
      const href = a.getAttribute("href") ?? "";
      const m = href.match(OBJECT_ID_RE);
      if (m) {
        if (!manufacturer) {
          manufacturer = { id: parseInt(m[1]!), name: a.text.trim() };
        } else if (!model) {
          model = a.text.trim();
          break;
        }
      }
    }
  }

  // Stats table — node-html-parser sometimes fails on the full page due to malformed
  // HTML earlier in the document, so parse stats tables with regex on raw HTML.
  const stats: CoasterStats = {
    height: null, drop: null, length: null,
    speed: null, duration: null, angle: null, inversions: null,
  };
  const elements: CoasterElement[] = [];

  // Extract text content of a <td> cell (strip tags, collapse whitespace)
  const stripTags = (s: string) => s.replace(/<[^>]+>/g, "").replace(/\s+/g, " ").trim();

  // Find the first stat-tbl table (the main track stats, not arrangement/cost)
  const statTableMatch = html.match(/<table class=stat-tbl>([\s\S]*?)<\/table>/);
  if (statTableMatch) {
    const tableHtml = statTableMatch[1]!;
    const rowRe = /<tr[^>]*><th>(.*?)<td>(.*?)(?=<tr|<\/table|$)/gis;
    let m: RegExpExecArray | null;
    while ((m = rowRe.exec(tableHtml)) !== null) {
      const th = stripTags(m[1]!).toLowerCase();
      const td = stripTags(m[2]!);
      if (!td) continue;
      if (th === "height") {
        const n = parseStat(td);
        stats.height = n !== null ? (td.includes("ft") ? ftToM(n) : n) : null;
      } else if (th === "drop") {
        const n = parseStat(td);
        stats.drop = n !== null ? (td.includes("ft") ? ftToM(n) : n) : null;
      } else if (th === "length") {
        const n = parseStat(td);
        stats.length = n !== null ? (td.includes("ft") ? ftToM(n) : n) : null;
      } else if (th === "speed") {
        const n = parseStat(td);
        stats.speed = n !== null ? (td.includes("mph") ? mphToKmh(n) : n) : null;
      } else if (th === "inversions") {
        stats.inversions = parseInt(td) || 0;
      } else if (th === "vertical angle") {
        stats.angle = parseStat(td);
      } else if (th === "duration") {
        stats.duration = parseDurationToSeconds(td);
      } else if (th === "elements") {
        // Elements are <a href=/{id}.htm>Name</a> links in the td
        const elRe = /<a href=\/(\d+)\.htm>([^<]+)<\/a>/gi;
        let em: RegExpExecArray | null;
        while ((em = elRe.exec(m[2]!)) !== null) {
          elements.push({ id: parseInt(em[1]!), name: em[2]!.trim() });
        }
      }
    }
  }

  return {
    id,
    name,
    park,
    location,
    status,
    type,
    design,
    classification,
    scale,
    manufacturer,
    model,
    opened,
    closed,
    stats,
    elements,
    rcdbUrl: `https://rcdb.com/${id}.htm`,
  };
}
