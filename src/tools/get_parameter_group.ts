import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_get_parameter_group",
    "Get a single parameter group with its full list of parameters. Use this to inspect the current configuration values for a parameter group.",
    {
      uuid: z
        .string()
        .describe("UUID of the parameter group"),
    },
    async ({ uuid }) => {
      try {
        const result = await get(
          `/db-configuration/v1/parameter-groups/${uuid}`,
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
              text: `Error getting parameter group: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
