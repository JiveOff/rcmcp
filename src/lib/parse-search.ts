export interface SearchResult {
  id: number;
  name: string;
  park: { id: number; name: string } | null;
  type: string | null;
  design: string | null;
  status: string | null;
  opened: string | null;
  statValue: string | null; // raw stat value shown when sorting by a numeric field
}

export interface SearchPage {
  results: SearchResult[];
  total: number;
  totalPages: number;
}

const STRIP_TAGS_RE = /<[^>]+>/g;

function stripTags(s: string) {
  return s.replace(STRIP_TAGS_RE, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

function extractHref(html: string): string {
  const m = html.match(/href=(?:"([^"]+)"|'([^']+)'|([^\s>]+))/i);
  return (m?.[1] ?? m?.[2] ?? m?.[3] ?? "").replace(/&amp;/g, "&");
}

function extractObjectId(href: string): number | null {
  const m = href.match(/\/(\d+)\.htm/);
  return m ? parseInt(m[1]!) : null;
}

export function parseSearch(html: string): SearchPage {
  // Total: "Found: 6822 (Page 1 of 285)"
  let total = 0;
  let totalPages = 1;

  const foundMatch = html.match(/Found:.*?<span[^>]*>([\d,]+)<\/span>\s*\(Page\s*\d+\s*of\s*(\d+)\)/i);
  if (foundMatch) {
    total = parseInt(foundMatch[1]!.replace(/,/g, ""));
    totalPages = parseInt(foundMatch[2]!);
  } else {
    const simpleFound = html.match(/Found:.*?<span[^>]*>([\d,]+)<\/span>/i);
    if (simpleFound) total = parseInt(simpleFound[1]!.replace(/,/g, ""));
  }

  const results: SearchResult[] = [];

  // Find the results table (inside div.stdtbl)
  const tbodyMatch = html.match(/<tbody>([\s\S]*?)<\/tbody>/i);
  if (!tbodyMatch) return { results, total, totalPages };

  const tbody = tbodyMatch[1]!;

  // Split into rows
  const rowRe = /<tr[^>]*>([\s\S]*?)(?=<tr|$)/gi;
  let rowMatch: RegExpExecArray | null;

  while ((rowMatch = rowRe.exec(tbody)) !== null) {
    const rowHtml = rowMatch[1]!;

    // Extract cells
    const cellRe = /<td[^>]*>([\s\S]*?)(?=<td|<\/tr|$)/gi;
    const cells: string[] = [];
    let cellMatch: RegExpExecArray | null;
    while ((cellMatch = cellRe.exec(rowHtml)) !== null) {
      cells.push(cellMatch[1]!);
    }

    if (cells.length < 6) continue;

    // Cell 0: camera icon (skip)
    // Cell 1: coaster name
    const nameCell = cells[1]!;
    const nameHref = extractHref(nameCell);
    const coasterId = extractObjectId(nameHref);
    if (!coasterId) continue;
    const coasterName = stripTags(nameCell);

    // Cell 2: park
    const parkCell = cells[2]!;
    const parkHref = extractHref(parkCell);
    const parkId = extractObjectId(parkHref);
    const park = parkId ? { id: parkId, name: stripTags(parkCell) } : null;

    // Cell 3: type
    const type = stripTags(cells[3]!) || null;

    // Cell 4: design
    const design = stripTags(cells[4]!) || null;

    // Cell 5: status
    const status = stripTags(cells[5]!) || null;

    // Cell 6: opened — may be a <time datetime="..."> element
    let opened: string | null = null;
    if (cells[6]) {
      const timeMatch = cells[6].match(/datetime="([^"]+)"/);
      if (timeMatch) {
        opened = timeMatch[1]!;
      } else {
        opened = stripTags(cells[6]) || null;
      }
    }

    // Cell 7+: stat value (height, speed, etc. when sorting by a numeric field)
    const statValue = cells[7] ? stripTags(cells[7]) || null : null;

    results.push({ id: coasterId, name: coasterName, park, type, design, status, opened, statValue });
  }

  return { results, total, totalPages };
}
