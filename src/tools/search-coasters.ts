import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchPage } from "../lib/fetch.js";
import { parseSearch } from "../lib/parse-search.js";

const SORT_ORDER: Record<string, number> = {
  height: 20,
  speed: 19,
  length: 22,
  drop: 21,
  inversions: 24,
  angle: 23,
  duration: 27,
  opened: 8,
  name: 1,
};

const TYPE_ID: Record<string, number> = { Steel: 1, Wood: 2 };

const DESIGN_ID: Record<string, number> = {
  "Sit Down": 6,
  Inverted: 5,
  Suspended: 8,
  Wing: 67,
  Flying: 4,
  "Stand Up": 7,
  Bobsled: 3,
  Pipeline: 73,
};

const SCALE_ID: Record<string, number> = {
  Kiddie: 21,
  Family: 22,
  Thrill: 23,
  Extreme: 20,
};

const STATUS_ID: Record<string, number> = {
  Operating: 93,
  "Under Construction": 310,
  SBNO: 311,
  "In Storage": 312,
};

const CLASSIFICATION_ID: Record<string, number> = {
  "Roller Coaster": 277,
  "Powered Coaster": 278,
  "Mountain Coaster": 279,
};

export function registerSearchCoasters(server: McpServer) {
  server.tool(
    "rcdb-search-coasters",
    `Search roller coasters on RCDB with filters and sorting. Returns a paginated list of coasters.

Call rcdb-get-search-filters first when you need a manufacturerId, or when the user asks about a specific element, category, layout, or designer — that tool returns the full list of valid IDs for those fields.
Call rcdb-get-location first when you need a locationId for a country or region by name.

Parameters:
- query: text search across name and related fields
- locationId: RCDB location ID for a country or state (e.g. 59 = United States, 17255 = Ohio). Use get-location to resolve names to IDs.
- manufacturerId: RCDB manufacturer ID — use get-search-filters to find IDs by name (e.g. 6831 = Bolliger & Mabillard, 6837 = Intamin)
- existingOnly: if true, only return operating/existing coasters
- status: filter by status — "Operating", "Under Construction", "SBNO", "In Storage"
- type: filter by track material — "Steel" or "Wood"
- design: filter by ride design — "Sit Down", "Inverted", "Suspended", "Wing", "Flying", "Stand Up", "Bobsled", "Pipeline"
- scale: filter by scale — "Kiddie", "Family", "Thrill", "Extreme"
- classification: filter by classification — "Roller Coaster", "Powered Coaster", "Mountain Coaster"
- openedYear: filter by opening year (e.g. 2023)
- closedYear: filter by closing year
- sortBy: "height" | "speed" | "length" | "drop" | "inversions" | "angle" | "duration" | "opened" | "name"
- sortDir: "asc" | "desc" (default: desc for stats, asc for name)
- page: page number, 1-indexed (24 results per page)`,
    {
      query: z.string().optional().describe("Text search (coaster name or related fields)"),
      locationId: z.number().int().optional().describe("RCDB location ID — country or state (e.g. 59 = United States)"),
      manufacturerId: z.number().int().optional().describe("RCDB manufacturer ID"),
      existingOnly: z.boolean().optional().describe("Only return operating/existing coasters"),
      status: z
        .enum(["Operating", "Under Construction", "SBNO", "In Storage"])
        .optional()
        .describe("Filter by coaster status"),
      type: z.enum(["Steel", "Wood"]).optional().describe("Filter by track material"),
      design: z
        .enum(["Sit Down", "Inverted", "Suspended", "Wing", "Flying", "Stand Up", "Bobsled", "Pipeline"])
        .optional()
        .describe("Filter by ride design"),
      scale: z.enum(["Kiddie", "Family", "Thrill", "Extreme"]).optional().describe("Filter by scale"),
      classification: z
        .enum(["Roller Coaster", "Powered Coaster", "Mountain Coaster"])
        .optional()
        .describe("Filter by classification"),
      openedYear: z.number().int().optional().describe("Filter by opening year (e.g. 2023)"),
      closedYear: z.number().int().optional().describe("Filter by closing year"),
      sortBy: z
        .enum(["height", "speed", "length", "drop", "inversions", "angle", "duration", "opened", "name"])
        .optional()
        .describe("Sort field"),
      sortDir: z.enum(["asc", "desc"]).optional().describe("Sort direction (default: desc for stats, asc for name)"),
      page: z.number().int().min(1).optional().describe("Page number, 1-indexed (24 results per page)"),
    },
    async ({ query, locationId, manufacturerId, existingOnly, status, type, design, scale, classification, openedYear, closedYear, sortBy, sortDir, page }) => {
      try {
        const params = new URLSearchParams({ ot: "2" });

        if (existingOnly) params.set("ex", "on");
        if (locationId) params.set("ol", String(locationId));
        if (manufacturerId) params.set("mk", String(manufacturerId));
        if (query) params.set("nc", query);
        if (page && page > 1) params.set("page", String(page));
        if (status) params.set("st", String(STATUS_ID[status]));
        if (type) params.set("ty", String(TYPE_ID[type]));
        if (design) params.set("de", String(DESIGN_ID[design]));
        if (scale) params.set("sc", String(SCALE_ID[scale]));
        if (classification) params.set("cs", String(CLASSIFICATION_ID[classification]));
        if (openedYear) params.set("op", String(openedYear));
        if (closedYear) params.set("cl", String(closedYear));

        if (sortBy) {
          const base = SORT_ORDER[sortBy] ?? 1;
          // For name, default asc; for stats, default desc (positive = desc in RCDB)
          const defaultDesc = sortBy !== "name";
          const descending = sortDir ? sortDir === "desc" : defaultDesc;
          params.set("order", String(descending ? base : -base));
        }

        const url = `https://rcdb.com/r.htm?${params.toString()}`;
        const html = await fetchPage(url);
        const result = parseSearch(html);

        return {
          content: [
            {
              type: "text",
              text: JSON.stringify(
                {
                  total: result.total,
                  page: page ?? 1,
                  totalPages: result.totalPages,
                  results: result.results,
                },
                null,
                2
              ),
            },
          ],
        };
      } catch (err) {
        return { content: [{ type: "text", text: `Error searching coasters: ${err}` }] };
      }
    }
  );
}
