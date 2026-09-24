import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { del } from "../client.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_delete_parameter_group",
    "Delete a parameter group. This is DESTRUCTIVE and cannot be undone. You must set confirm to true. Only available when protection mode is off (CCX_PROTECT=false).",
    {
      uuid: z
        .string()
        .describe("UUID of the parameter group to delete"),
      confirm: z
        .boolean()
        .describe("Must be explicitly set to true to confirm deletion"),
    },
    async ({ uuid, confirm }) => {

      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Deletion aborted: 'confirm' must be explicitly set to true. This action is destructive and cannot be undone.",
            },
          ],
          isError: true,
        };
      }

      try {
        await del(`/db-configuration/v1/parameter-groups/${uuid}`);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "deleted",
                  uuid,
                  message: "Parameter group deleted successfully.",
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
              text: `Error deleting parameter group: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
