import { parse } from "node-html-parser";

export interface CoasterSummary {
  id: number;
  name: string;
  type: string | null;
  design: string | null;
  scale: string | null;
  status: "Operating" | "Defunct";
  opened: string | null;
  closed: string | null;
}

export interface Park {
  id: number;
  name: string;
  location: {
    city: string | null;
    state: string | null;
    country: string | null;
    stateId: number | null;
    countryId: number | null;
  };
  status: string | null;
  coasters: CoasterSummary[];
  rcdbUrl: string;
}

const OBJECT_ID_RE = /\/(\d+)\.htm/;
const LOCATION_ID_RE = /\/location\.htm\?id=(\d+)/;
const STRIP_TAGS_RE = /<[^>]+>/g;

function stripTags(s: string) {
  return s.replace(STRIP_TAGS_RE, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

export function parsePark(html: string, id: number): Park {
  const root = parse(html);

  const name = root.querySelector("h1")?.text.trim() ?? "Unknown";

  // Location
  const locationLinks = root.querySelectorAll('a[href*="/location.htm?id="]');
  const city = locationLinks[0]?.text.trim() ?? null;
  const state = locationLinks[1]?.text.trim() ?? null;
  const country = locationLinks[2]?.text.trim() ?? null;

  const stateIdMatch = locationLinks[1]?.getAttribute("href")?.match(LOCATION_ID_RE) ?? null;
  const countryIdMatch = locationLinks[2]?.getAttribute("href")?.match(LOCATION_ID_RE) ?? null;
  const stateId = stateIdMatch ? parseInt(stateIdMatch[1]!) : null;
  const countryId = countryIdMatch ? parseInt(countryIdMatch[1]!) : null;

  // Status
  let status: string | null = null;
  for (const a of root.querySelectorAll('a[href^="/g.htm"]')) {
    const t = a.text.trim();
    if (["Operating", "SBNO", "Closed"].includes(t)) {
      status = t;
      break;
    }
  }

  // Parse coaster tables via regex — node-html-parser loses state on these pages
  // Coaster tables are in <div class="stdtbl ..."><table>...</table></div>
  // preceded by an <h4> with "Operating" or "Defunct"
  const coasters: CoasterSummary[] = [];

  // Split HTML into sections by <section> tags to handle operating vs defunct
  const sectionRe = /<section>([\s\S]*?)<\/section>/gi;
  let sectionMatch: RegExpExecArray | null;

  while ((sectionMatch = sectionRe.exec(html)) !== null) {
    const section = sectionMatch[1]!;

    // Check if this section has coaster table
    const h4Match = section.match(/<h4>(.*?)<\/h4>/i);
    if (!h4Match) continue;
    const h4Text = stripTags(h4Match[1]!).toLowerCase();

    const isCoasterSection =
      h4Text.includes("roller coaster") ||
      h4Text.includes("powered coaster") ||
      h4Text.includes("mountain coaster");
    if (!isCoasterSection) continue;

    const isDefunct = h4Text.includes("defunct") || h4Text.includes("former");
    const coasterStatus: "Operating" | "Defunct" = isDefunct ? "Defunct" : "Operating";

    // Parse rows: <tr><td>...</td><td>...</td>...</tr>
    const rowRe = /<tr[^>]*>([\s\S]*?)(?=<tr|<\/tbody|<\/table)/gi;
    let rowMatch: RegExpExecArray | null;

    while ((rowMatch = rowRe.exec(section)) !== null) {
      const rowHtml = rowMatch[1]!;
      // Extract all <td> cells
      const cellRe = /<td[^>]*>([\s\S]*?)(?=<td|<\/tr|$)/gi;
      const cells: string[] = [];
      let cellMatch: RegExpExecArray | null;
      while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
        cells.push(cellMatch[1]!);
      }

      if (cells.length < 3) continue; // need at least icon + name + type

      // Cell 0: camera icon (skip)
      // Cell 1: coaster name link
      const nameCell = cells[1]!;
      const nameHrefMatch = nameCell.match(/href=(?:"([^"]+)"|([^\s>]+))/i);
      if (!nameHrefMatch) continue;
      const nameHref = nameHrefMatch[1] ?? nameHrefMatch[2] ?? "";
      const idMatch = nameHref.match(OBJECT_ID_RE);
      if (!idMatch) continue;

      const coasterId = parseInt(idMatch[1]!);
      const coasterName = stripTags(nameCell);

      // Remaining cells: type, design, scale, opened (and closed for defunct)
      let type: string | null = null;
      let design: string | null = null;
      let scale: string | null = null;
      let opened: string | null = null;
      let closed: string | null = null;

      for (let c = 2; c < cells.length; c++) {
        const cellText = stripTags(cells[c]!);
        if (!cellText) continue;
        if (cellText === "Steel" || cellText === "Wood") {
          type = cellText;
        } else if (!design && cells[c]!.includes("/g.htm")) {
          design = cellText;
        } else if (!scale && cells[c]!.includes("/g.htm")) {
          scale = cellText;
        } else if (/^\d{4}/.test(cellText)) {
          if (!opened) opened = cellText;
          else if (!closed) closed = cellText;
        }
      }

      coasters.push({ id: coasterId, name: coasterName, type, design, scale, status: coasterStatus, opened, closed });
    }
  }

  return {
    id,
    name,
    location: { city, state, country, stateId, countryId },
    status,
    coasters,
    rcdbUrl: `https://rcdb.com/${id}.htm`,
  };
}
