import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { del } from "../client.js";
import { isProtected, protectedError } from "../protect.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_delete_firewall_rule",
    "Remove a trusted source (firewall rule) from a CCX datastore. Revokes the specified CIDR's access to the database. Blocked by protection mode (CCX_PROTECT) by default.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
      source: z
        .string()
        .describe("CIDR to remove (must match an existing rule exactly, e.g. '10.0.0.0/24')"),
    },
    async ({ datastore_uuid, source }) => {
      if (isProtected()) return protectedError("Delete firewall rule");

      try {
        await del(
          `/firewall/api/v1/firewall/${datastore_uuid}`,
          { source },
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "deleted",
                  source,
                  message: `Trusted source ${source} removed from datastore ${datastore_uuid}.`,
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
              text: `Error deleting firewall rule: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
