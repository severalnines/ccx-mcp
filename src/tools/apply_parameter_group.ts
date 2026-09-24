import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { post } from "../client.js";
import { isProtected, protectedError } from "../protect.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_apply_parameter_group",
    "Apply a parameter group to a datastore. This creates a job on the cluster to update its database configuration, which may restart database processes. You must set confirm to true. Blocked by protection mode (CCX_PROTECT) by default.",
    {
      parameter_group_uuid: z
        .string()
        .describe("UUID of the parameter group to apply"),
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore to apply the parameter group to"),
      confirm: z
        .boolean()
        .describe("Must be explicitly set to true to confirm applying the configuration change"),
    },
    async ({ parameter_group_uuid, datastore_uuid, confirm }) => {
      if (isProtected()) return protectedError("Apply parameter group");

      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Apply aborted: 'confirm' must be explicitly set to true. Applying a parameter group changes the live database configuration and may restart database processes.",
            },
          ],
          isError: true,
        };
      }

      try {
        const result = await post(
          `/db-configuration/v1/parameter-groups/apply/${parameter_group_uuid}/${datastore_uuid}`,
        );

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
              text: `Error applying parameter group: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
