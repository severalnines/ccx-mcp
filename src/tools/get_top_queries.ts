import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import type { TopQueriesResponse } from "../types.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_get_top_queries",
    "Get the slowest queries running on a CCX datastore, ranked by total execution time. Use this to diagnose performance problems, identify queries that need optimization, or find missing indexes.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
    },
    async ({ datastore_uuid }) => {
      try {
        const raw = await get(
          `/qmon/api/v1/qmon/${datastore_uuid}/topqueries`,
        );
        const response = raw as TopQueriesResponse;
        const queries = response.data ?? [];

        if (queries.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No query data available. Query monitoring may not be active on this datastore.",
              },
            ],
          };
        }

        const summary = queries.map((q) => ({
          query: q.digest_text,
          database: q.database,
          total_time: q.sum_time,
          avg_time: q.avg_time,
          max_time: q.max_time,
          executions: q.count_star,
          rows_examined: q.examined_rows,
          rows_sent: q.sent_rows,
          last_seen: q.last_seen,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(summary, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error getting top queries: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
