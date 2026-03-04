import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_list_default_parameters",
    "Get the default database parameters for a specific vendor and version. Useful before creating a parameter group to see available parameters, their default values, types, and validation options.",
    {
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
    },
    async ({ database_vendor, database_version, database_type }) => {
      try {
        const params: Record<string, string> = {
          database_vendor,
          database_version,
        };
        if (database_type !== undefined) params.database_type = database_type;

        const result = await get(
          "/db-configuration/v1/parameter-groups/defaults",
          params,
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
              text: `Error listing default parameters: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
