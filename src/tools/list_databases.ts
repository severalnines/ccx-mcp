import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import type { DbDatabase } from "../types.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_list_databases",
    "List databases on a specific CCX datastore",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
    },
    async ({ datastore_uuid }) => {
      try {
        const raw = await get(
          `/userdb/api/v1/databases/${datastore_uuid}`,
        );
        const databases = (Array.isArray(raw) ? raw : []) as DbDatabase[];

        if (databases.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No databases found for this datastore.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(databases, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing databases: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
