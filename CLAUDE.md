# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project

MCP server exposing tools and resources for [rcdb.com](https://rcdb.com) — a comprehensive database of roller coasters worldwide. The server allows AI assistants to search, browse, and retrieve coaster data.

## Commands

```sh
bun dev          # run with file watching
bun start        # run once
bun test         # run tests
bun typecheck    # type-check without emitting
```

## Stack

- **Runtime**: Bun (not Node.js)
- **Language**: TypeScript (strict mode)
- **MCP SDK**: `@modelcontextprotocol/sdk` — use `McpServer` from `server/mcp.js` and `StdioServerTransport` from `server/stdio.js`
- **Transport**: stdio (standard for MCP servers used via Claude Desktop / CLI)

## Architecture

```
src/
  index.ts        # Server entry point — instantiates McpServer, registers tools, connects transport
  tools/          # One file per MCP tool; each exports a registration function
```

### Patterns

**Registering a tool** in `src/tools/`:

```ts
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";

export function registerMyTool(server: McpServer) {
  server.tool("tool-name", "Description shown to the LLM", {
    param: z.string().describe("What this param does"),
  }, async ({ param }) => ({
    content: [{ type: "text", text: result }],
  }));
}
```

Then call `registerMyTool(server)` in `src/index.ts` before `server.connect(transport)`.

## Logging

Always log to `stderr`, never `stdout`. stdout is reserved for the MCP protocol wire format. Use the `log` helper defined in `src/index.ts` (or re-export it) which prefixes `[rcmcp]` and writes to stderr.

## Bun-specific notes

- Use `bun:sqlite` for SQLite, not `better-sqlite3`
- Use `Bun.file` instead of `fs.readFile/writeFile`
- Bun loads `.env` automatically — no `dotenv` needed
- Use `bun test` with `import { test, expect } from "bun:test"`
