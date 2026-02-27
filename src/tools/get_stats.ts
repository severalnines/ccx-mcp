import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_get_stats",
    "Get performance metrics for a CCX datastore. Use this to check database health, diagnose performance issues, or monitor resource usage. Available stats: cpustat, memorystat, diskstat, netstat, sqlstat, dbstat.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
      stat_name: z
        .enum(["cpustat", "memorystat", "diskstat", "netstat", "sqlstat", "dbstat"])
        .describe("Metric to retrieve: cpustat (CPU usage), memorystat (memory/RAM), diskstat (disk I/O), netstat (network), sqlstat (SQL server stats), dbstat (database stats)"),
    },
    async ({ datastore_uuid, stat_name }) => {
      try {
        const raw = await get(
          `/stat/api/v1/stat/${datastore_uuid}/${stat_name}/aggregate`,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(raw, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting stats: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
