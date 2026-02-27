import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import type { DbUser } from "../types.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_list_db_users",
    "List database users for a specific CCX datastore",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
    },
    async ({ datastore_uuid }) => {
      try {
        const raw = await get(
          `/userdb/api/v1/users/${datastore_uuid}`,
        );
        const users = (Array.isArray(raw) ? raw : []) as DbUser[];

        if (users.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No database users found for this datastore.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(users, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing database users: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
