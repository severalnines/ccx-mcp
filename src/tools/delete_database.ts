import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { del } from "../client.js";
import { validateDatabaseName } from "../validate.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_delete_database",
    "Delete a database from a CCX datastore. This is DESTRUCTIVE and cannot be undone. You must set confirm to true. Only available when protection mode is off (CCX_PROTECT=false).",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
      database_name: z
        .string()
        .describe("Name of the database to delete"),
      confirm: z
        .boolean()
        .describe("Must be explicitly set to true to confirm deletion"),
    },
    async ({ datastore_uuid, database_name, confirm }) => {

      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Deletion aborted: 'confirm' must be explicitly set to true. Deleting a database destroys its data and cannot be undone.",
            },
          ],
          isError: true,
        };
      }

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
