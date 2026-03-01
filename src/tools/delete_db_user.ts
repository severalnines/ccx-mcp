import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { del } from "../client.js";
import { isProtected, protectedError } from "../protect.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_delete_db_user",
    "Delete a database user from a CCX datastore. This is DESTRUCTIVE and may break applications using this user. You must set confirm to true. Use ccx_list_db_users first to see existing users and their host restrictions. Blocked by protection mode (CCX_PROTECT) by default.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
      username: z
        .string()
        .describe("Username to delete"),
      host: z
        .string()
        .optional()
        .describe("Host restriction of the user to delete (e.g. '%' or 'localhost'). Defaults to '%'."),
      confirm: z
        .boolean()
        .describe("Must be explicitly set to true to confirm deletion"),
    },
    async ({ datastore_uuid, username, host, confirm }) => {
      if (isProtected()) return protectedError("Delete database user");

      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Deletion aborted: 'confirm' must be explicitly set to true. Deleting a database user may break applications that rely on these credentials.",
            },
          ],
          isError: true,
        };
      }

      try {
        await del(
          `/userdb/api/v1/user/${datastore_uuid}`,
          {
            database_username: username,
            database_host: host ?? "%",
          },
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "deleted",
                  username,
                  host: host ?? "%",
                  message: `Database user '${username}'@'${host ?? "%"}' deleted from datastore ${datastore_uuid}.`,
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
              text: `Error deleting database user: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
