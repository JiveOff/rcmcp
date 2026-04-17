import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchPage } from "../lib/fetch.js";
import { parseCoaster } from "../lib/parse-coaster.js";

export function registerGetCoaster(server: McpServer) {
  server.tool(
    "get-coaster",
    "Get full details for a single roller coaster by its RCDB numeric ID. Returns name, park, location, status, type, design, manufacturer, stats (height, speed, drop, length, inversions), elements (the ordered list of track elements), and more.",
    { id: z.number().int().positive().describe("RCDB numeric coaster ID (from the URL, e.g. 594 for Millennium Force)") },
    async ({ id }) => {
      try {
        const html = await fetchPage(`https://rcdb.com/${id}.htm`);
        const coaster = parseCoaster(html, id);
        return { content: [{ type: "text", text: JSON.stringify(coaster, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error fetching coaster ${id}: ${err}` }] };
      }
    }
  );
}
