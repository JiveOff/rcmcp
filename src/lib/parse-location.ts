const STRIP_TAGS_RE = /<[^>]+>/g;
const LOCATION_ID_RE = /\/location\.htm\?id=(\d+)/;

function stripTags(s: string) {
  return s.replace(STRIP_TAGS_RE, "").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
}

export interface LocationBreadcrumb {
  name: string;
  id: number | null; // null for World root
}

export interface LocationStats {
  extantCoasters: number | null;
  defunctCoasters: number | null;
  extantParks: number | null;
  defunctParks: number | null;
}

export interface LocationChild {
  id: number;
  name: string;
  extantCoasters: number | null;
}

export interface Location {
  id: number | null; // null = World root
  name: string;
  breadcrumb: LocationBreadcrumb[];
  stats: LocationStats;
  children: LocationChild[];
  rcdbUrl: string;
}

export function parseLocation(html: string, id: number | null): Location {
  // Name
  const nameMatch = html.match(/<h1>([^<]+)<\/h1>/);
  const name = nameMatch ? nameMatch[1]!.trim() : "Unknown";

  // Breadcrumb from <div class=arrow>
  const breadcrumb: LocationBreadcrumb[] = [];
  const arrowMatch = html.match(/<div class=arrow>([\s\S]*?)<\/div>/);
  if (arrowMatch) {
    const spanRe = /<span>([\s\S]*?)<\/span>/g;
    let spanM: RegExpExecArray | null;
    while ((spanM = spanRe.exec(arrowMatch[1]!)) !== null) {
      const spanHtml = spanM[1]!;
      const linkMatch = spanHtml.match(/<a[^>]*href="?([^">\s]+)"?[^>]*>([^<]+)<\/a>/);
      if (linkMatch) {
        const href = linkMatch[1]!;
        const text = linkMatch[2]!.trim();
        const idMatch = href.match(LOCATION_ID_RE);
        breadcrumb.push({ name: text, id: idMatch ? parseInt(idMatch[1]!) : null });
      } else {
        breadcrumb.push({ name: stripTags(spanHtml), id });
      }
    }
  }

  // Stats from <table id=counts>
  const stats: LocationStats = {
    extantCoasters: null,
    defunctCoasters: null,
    extantParks: null,
    defunctParks: null,
  };

  const countsMatch = html.match(/<table id=counts>([\s\S]*?)<\/table>/);
  if (countsMatch) {
    const rowRe = /<tr[^>]*>([\s\S]*?)(?=<tr|<\/table)/gi;
    let rowM: RegExpExecArray | null;
    while ((rowM = rowRe.exec(countsMatch[1]!)) !== null) {
      const rowHtml = rowM[1]!;
      const cellRe = /<td[^>]*>([\s\S]*?)(?=<td|<\/tr|$)/gi;
      const cells: string[] = [];
      let cellM: RegExpExecArray | null;
      while ((cellM = cellRe.exec(rowHtml)) !== null) {
        cells.push(cellM[1]!);
      }
      if (cells.length < 2) continue;
      const label = stripTags(cells[1]!).toLowerCase();
      const value = parseInt(stripTags(cells[0]!).replace(/,/g, ""));
      if (isNaN(value)) continue;
      if (label.includes("extant") && label.includes("roller coaster")) stats.extantCoasters = value;
      else if (label.includes("defunct") && label.includes("roller coaster")) stats.defunctCoasters = value;
      else if (label.includes("extant") && label.includes("amusement park")) stats.extantParks = value;
      else if (label.includes("defunct") && label.includes("amusement park")) stats.defunctParks = value;
    }
  }

  // Children from stdtbl table
  const children: LocationChild[] = [];
  const tbodyMatch = html.match(/<div class="stdtbl cen">([\s\S]*?)<\/div>/);
  if (tbodyMatch) {
    const tbody = tbodyMatch[1]!;
    const rowRe = /<tr[^>]*>([\s\S]*?)(?=<tr|<\/tbody|$)/gi;
    let rowM: RegExpExecArray | null;
    while ((rowM = rowRe.exec(tbody)) !== null) {
      const rowHtml = rowM[1]!;
      // First cell: location link
      const locLinkMatch = rowHtml.match(/href="?\/location\.htm\?id=(\d+)"?[^>]*>([^<]+)<\/a>/);
      if (!locLinkMatch) continue;
      const childId = parseInt(locLinkMatch[1]!);
      const childName = locLinkMatch[2]!.trim();

      // Second cell: extant coaster count (integer link) or "-"
      // Look for <a class=int href="/r.htm?ot=2&ol=...&ex">N</a>
      const coasterCountMatch = rowHtml.match(/href="?\/r\.htm[^"]*ot=2[^"]*ex[^"]*"?[^>]*>(\d+)<\/a>/);
      const extantCoasters = coasterCountMatch ? parseInt(coasterCountMatch[1]!) : null;

      children.push({ id: childId, name: childName, extantCoasters });
    }
  }

  const rcdbUrl = id !== null ? `https://rcdb.com/location.htm?id=${id}` : "https://rcdb.com/location.htm";
  return { id, name, breadcrumb, stats, children, rcdbUrl };
}
