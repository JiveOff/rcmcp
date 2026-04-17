import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { fetchPage } from "../lib/fetch.js";
import { parsePark } from "../lib/parse-park.js";

export function registerGetPark(server: McpServer) {
  server.tool(
    "get-park",
    "Get full details for an amusement park by its RCDB numeric ID, including its complete roller coaster roster (operating and defunct). Use search-coasters with a query to find a park's ID first.",
    { id: z.number().int().positive().describe("RCDB numeric park ID (from the URL, e.g. 4529 for Cedar Point)") },
    async ({ id }) => {
      try {
        const html = await fetchPage(`https://rcdb.com/${id}.htm`);
        const park = parsePark(html, id);
        return { content: [{ type: "text", text: JSON.stringify(park, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error fetching park ${id}: ${err}` }] };
      }
    }
  );
}
