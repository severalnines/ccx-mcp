import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";

const COMMON_STATS = [
  "loadAverage",
  "cpuUsage",
  "ramUsage",
  "diskSpaceUsage",
  "diskIops",
  "diskIOUtil",
  "diskThroughput",
  "networkUsage",
] as const;

const MYSQL_STATS = [
  "qps",
  "mySqlHandlers",
  "mySqlDbConnections",
  "mySqlQueries",
  "mySqlScanOperations",
  "mySqlTableLocking",
  "mySqlTemporaryTables",
  "mySqlSorting",
  "mySqlAbortedConnections",
  "mySqlMemoryUtilization",
  "replicaLag",
] as const;

const POSTGRES_STATS = [
  "qps",
  "postgreSqlSelectFetched",
  "replicaLag",
] as const;

const ALL_STATS = [...COMMON_STATS, ...MYSQL_STATS, ...POSTGRES_STATS] as const;
// Deduplicate
const UNIQUE_STATS = [...new Set(ALL_STATS)];

export function register(server: McpServer) {
  server.tool(
    "ccx_get_stats",
    `Get performance metrics for a CCX datastore. Use this to check database health, diagnose performance issues, or monitor resource usage.

Common stats (all vendors): ${COMMON_STATS.join(", ")}
MySQL/MariaDB/Percona stats: ${MYSQL_STATS.join(", ")}
PostgreSQL stats: ${POSTGRES_STATS.join(", ")}

Start with cpuUsage, ramUsage, and loadAverage for a health overview.`,
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
      stat_name: z
        .string()
        .describe(`Metric to retrieve. Common: loadAverage, cpuUsage, ramUsage, diskSpaceUsage, diskIops, diskIOUtil, diskThroughput, networkUsage. MySQL/Percona: qps, mySqlDbConnections, mySqlQueries, mySqlHandlers, replicaLag. PostgreSQL: qps, postgreSqlSelectFetched, replicaLag.`),
    },
    async ({ datastore_uuid, stat_name }) => {
      if (!UNIQUE_STATS.includes(stat_name as typeof UNIQUE_STATS[number])) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Unknown stat_name "${stat_name}". Valid options: ${UNIQUE_STATS.join(", ")}`,
            },
          ],
          isError: true,
        };
      }

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
