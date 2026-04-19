import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchPage } from "../lib/fetch.js";

interface FilterOption {
  id: number;
  name: string;
}

function parseSelect(html: string, name: string): FilterOption[] {
  const selectRe = new RegExp(`name=${name}[^>]*>([\\s\\S]*?)<\\/select>`);
  const selectMatch = html.match(selectRe);
  if (!selectMatch) return [];

  const options: FilterOption[] = [];
  const optRe = /<option[^>]*value=(\d+)[^>]*>([^<]+)/g;
  let m: RegExpExecArray | null;
  while ((m = optRe.exec(selectMatch[1]!)) !== null) {
    options.push({ id: parseInt(m[1]!), name: m[2]!.trim() });
  }
  return options;
}

function parseYearSelect(html: string, name: string): number[] {
  const selectRe = new RegExp(`name=${name}[^>]*>([\\s\\S]*?)<\\/select>`);
  const selectMatch = html.match(selectRe);
  if (!selectMatch) return [];
  const years: number[] = [];
  const optRe = /<option value=(\d{4})/g;
  let m: RegExpExecArray | null;
  while ((m = optRe.exec(selectMatch[1]!)) !== null) {
    years.push(parseInt(m[1]!));
  }
  return years.sort((a, b) => a - b);
}

export function registerGetSearchFilters(server: McpServer) {
  server.tool(
    "rcdb-get-search-filters",
    `Returns the full catalog of filterable values available in the RCDB coaster search form. Use the returned IDs directly with search-coasters parameters.

Returns:
- manufacturers: {id, name}[] — use id as manufacturerId in search-coasters
- elements: {id, name}[] — individual track elements (inversion types, launches, etc.)
- categories: {id, name}[] — special attributes (Indoor, Floorless, Hybrid, 4th Dimension, etc.)
- layouts: {id, name}[] — track layout patterns (Out and Back, Wild Mouse, Terrain, etc.)
- designers: {id, name}[] — individual people associated with coasters
- openedYears: number[] — all years with at least one opening (for openedYear filter)
- closedYears: number[] — all years with at least one closing (for closedYear filter)`,
    {},
    async () => {
      try {
        const html = await fetchPage("https://rcdb.com/os.htm?ot=2");

        const result = {
          manufacturers: parseSelect(html, "mk"),
          elements: parseSelect(html, "el"),
          categories: parseSelect(html, "ca"),
          layouts: parseSelect(html, "lo"),
          designers: parseSelect(html, "pe"),
          openedYears: parseYearSelect(html, "op"),
          closedYears: parseYearSelect(html, "cl"),
        };

        return { content: [{ type: "text", text: JSON.stringify(result, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error fetching search filters: ${err}` }] };
      }
    }
  );
}
