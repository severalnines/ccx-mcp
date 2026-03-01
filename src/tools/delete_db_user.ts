import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { del } from "../client.js";
import { isProtected, protectedError } from "../protect.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_delete_db_user",
    "Delete a database user from a CCX datastore. Use ccx_list_db_users first to see existing users and their host restrictions. Blocked by protection mode (CCX_PROTECT) by default.",
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
    },
    async ({ datastore_uuid, username, host }) => {
      if (isProtected()) return protectedError("Delete database user");

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
