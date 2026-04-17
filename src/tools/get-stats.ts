import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { fetchPage } from "../lib/fetch.js";

export function registerGetStats(server: McpServer) {
  server.tool(
    "get-stats",
    "Returns global RCDB database statistics: total number of roller coasters, amusement parks, pictures, and videos tracked in the database.",
    {},
    async () => {
      try {
        const html = await fetchPage("https://rcdb.com/about.htm?pg=1");

        // Parse <table class="t-list t-top"> rows: <td>Label:<td><span class=int>N</span>
        const stats: Record<string, number> = {};
        const rowRe = /<tr><td>([^<]+)<td><span class=int>([\d,]+)<\/span>/g;
        let m: RegExpExecArray | null;
        while ((m = rowRe.exec(html)) !== null) {
          const label = m[1]!.replace(/:$/, "").trim();
          const value = parseInt(m[2]!.replace(/,/g, ""));
          stats[label] = value;
        }

        return { content: [{ type: "text", text: JSON.stringify(stats, null, 2) }] };
      } catch (err) {
        return { content: [{ type: "text", text: `Error fetching stats: ${err}` }] };
      }
    }
  );
}
