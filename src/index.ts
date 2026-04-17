import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { registerGetCoaster } from "./tools/get-coaster.js";
import { registerGetLocation } from "./tools/get-location.js";
import { registerGetPark } from "./tools/get-park.js";
import { registerGetSearchFilters } from "./tools/get-search-filters.js";
import { registerGetStats } from "./tools/get-stats.js";
import { registerSearchCoasters } from "./tools/search-coasters.js";

// MCP stdio servers must log to stderr — stdout is reserved for the protocol
const log = (...args: unknown[]) => console.error("[rcmcp]", ...args);

log("Starting rcmcp server v0.1.0");

const server = new McpServer({
  name: "rcmcp",
  version: "0.1.0",
});

registerSearchCoasters(server);
registerGetCoaster(server);
registerGetPark(server);
registerGetLocation(server);
registerGetStats(server);
registerGetSearchFilters(server);

const transport = new StdioServerTransport();

transport.onclose = () => log("Transport closed");
transport.onerror = (err) => log("Transport error:", err);

log("Connecting to stdio transport...");
await server.connect(transport);
log("Server ready");
