import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { post } from "../client.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_create_parameter_group",
    "Create a new parameter group (database configuration template). Use ccx_list_default_parameters first to see available parameters and their valid values.",
    {
      name: z
        .string()
        .describe("Name for the parameter group"),
      database_vendor: z
        .string()
        .describe("Database vendor (e.g. 'mysql', 'postgresql', 'redis', 'valkey')"),
      database_version: z
        .string()
        .describe("Database version (e.g. '8.4', '16')"),
      database_type: z
        .string()
        .optional()
        .describe("Database type (e.g. 'galera', 'replication')"),
      description: z
        .string()
        .optional()
        .describe("Description of the parameter group"),
      parameters: z
        .record(z.string())
        .optional()
        .describe("Map of parameter name to value (e.g. {'max_connections': '200'})"),
    },
    async ({ name, database_vendor, database_version, database_type, description, parameters }) => {
      try {
        const body: Record<string, unknown> = {
          name,
          database_vendor,
          database_version,
        };
        if (database_type !== undefined) body.database_type = database_type;
        if (description !== undefined) body.description = description;
        if (parameters !== undefined) body.parameters = parameters;

        const result = await post(
          "/db-configuration/v1/parameter-groups",
          body,
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
              text: `Error creating parameter group: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
