import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchPage } from "../lib/fetch.js";
import { parseLocation } from "../lib/parse-location.js";

export function registerGetLocation(server: McpServer) {
  server.tool(
    "get-location",
    `Browse the RCDB location hierarchy. Fetches a location page and returns its name, breadcrumb path, coaster/park counts, and child locations with their IDs.

Use id=0 (or omit) to start at the World root. Then drill down using the child location IDs returned.

Each child has an \`extantCoasters\` count (null means zero or unknown). Use the child \`id\` with \`search-coasters\` (locationId parameter) to list coasters in that region.

Typical workflow:
1. Call get-location with no id → get world countries
2. Call get-location with a country id → get states/regions
3. Call search-coasters with locationId → list coasters in that area`,
    {
      id: z
        .number()
        .int()
        .nonnegative()
        .optional()
        .describe("RCDB location ID. Omit or use 0 for the World root."),
    },
    async ({ id }) => {
      try {
        const locationId = id && id > 0 ? id : null;
        const url =
          locationId !== null
            ? `https://rcdb.com/location.htm?id=${locationId}`
            : "https://rcdb.com/location.htm";
        const html = await fetchPage(url);
        const location = parseLocation(html, locationId);
        return { content: [{ type: "text", text: JSON.stringify(location, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error fetching location: ${err}` }] };
      }
    }
  );
}
