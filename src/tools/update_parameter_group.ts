import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { put } from "../client.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_update_parameter_group",
    "Update a parameter group's name, description, and/or parameters. Optionally sync changes to all associated datastores.",
    {
      uuid: z
        .string()
        .describe("UUID of the parameter group to update"),
      name: z
        .string()
        .optional()
        .describe("New name for the parameter group"),
      description: z
        .string()
        .optional()
        .describe("New description"),
      parameters: z
        .record(z.string())
        .optional()
        .describe("Map of parameter name to new value (e.g. {'max_connections': '200'})"),
      sync: z
        .boolean()
        .optional()
        .describe("If true, push changes to all associated datastores (creates jobs on clusters)"),
    },
    async ({ uuid, name, description, parameters, sync }) => {
      try {
        const body: Record<string, unknown> = {};
        if (name !== undefined) body.name = name;
        if (description !== undefined) body.description = description;
        if (parameters !== undefined) body.parameters = parameters;

        const params: Record<string, string> = {};
        if (sync) params.sync = "true";

        const result = await put(
          `/db-configuration/v1/parameter-groups/${uuid}`,
          body,
          Object.keys(params).length > 0 ? params : undefined,
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
              text: `Error updating parameter group: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
