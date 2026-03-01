import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { del } from "../client.js";
import { isProtected, protectedError } from "../protect.js";
import { validateDatabaseName } from "../validate.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_delete_database",
    "Delete a database from a CCX datastore. This is DESTRUCTIVE and cannot be undone. Blocked by protection mode (CCX_PROTECT) by default.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
      database_name: z
        .string()
        .describe("Name of the database to delete"),
    },
    async ({ datastore_uuid, database_name }) => {
      if (isProtected()) return protectedError("Delete database");

      const validationError = validateDatabaseName(database_name);
      if (validationError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid database name: ${validationError}`,
            },
          ],
          isError: true,
        };
      }

      try {
        await del(
          `/userdb/api/v1/database/${datastore_uuid}`,
          { database_name },
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "deleted",
                  datastore_uuid,
                  database_name,
                  message: "Database deleted successfully.",
                },
                null,
                2,
              ),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error deleting database: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
