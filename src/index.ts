import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { WebStandardStreamableHTTPServerTransport } from "@modelcontextprotocol/sdk/server/webStandardStreamableHttp.js";
import { registerGetCoaster } from "./tools/get-coaster.js";
import { registerGetLocation } from "./tools/get-location.js";
import { registerGetPark } from "./tools/get-park.js";
import { registerGetSearchFilters } from "./tools/get-search-filters.js";
import { registerGetStats } from "./tools/get-stats.js";
import { registerSearchCoasters } from "./tools/search-coasters.js";

// MCP stdio servers must log to stderr — stdout is reserved for the protocol
const log = (...args: unknown[]) => console.error("[rcmcp]", ...args);

log("Starting rcmcp server v0.1.0");

function createServer() {
  const server = new McpServer({ name: "rcmcp", version: "0.1.0" });
  registerSearchCoasters(server);
  registerGetCoaster(server);
  registerGetPark(server);
  registerGetLocation(server);
  registerGetStats(server);
  registerGetSearchFilters(server);
  return server;
}

const port = process.env.PORT ? parseInt(process.env.PORT) : null;

if (port) {
  // HTTP mode: stateless streamable HTTP transport
  log(`Starting HTTP server on port ${port}`);

  Bun.serve({
    port,
    async fetch(req) {
      const url = new URL(req.url);
      if (url.pathname !== "/mcp") {
        return new Response("Not found", { status: 404 });
      }

      const transport = new WebStandardStreamableHTTPServerTransport({
        sessionIdGenerator: undefined, // stateless
      });

      const server = createServer();
      await server.connect(transport);
      const response = await transport.handleRequest(req);
      return response;
    },
  });

  log(`Server ready at http://0.0.0.0:${port}/mcp`);
} else {
  // Stdio mode: default for Claude Desktop / CLI usage
  const transport = new StdioServerTransport();
  transport.onclose = () => log("Transport closed");
  transport.onerror = (err) => log("Transport error:", err);

  log("Connecting to stdio transport...");
  const server = createServer();
  await server.connect(transport);
  log("Server ready");
}
