import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { post } from "../client.js";
import type { DbDatabase } from "../types.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_create_database",
    "Create a new database on a CCX datastore",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
      database_name: z
        .string()
        .describe("Name for the new database"),
    },
    async ({ datastore_uuid, database_name }) => {
      try {
        const result = await post(
          `/userdb/api/v1/database/${datastore_uuid}`,
          { database_name },
        ) as DbDatabase;

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(result, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error creating database: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
