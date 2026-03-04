import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_list_parameter_groups",
    "List all parameter groups (database configuration templates). Optionally filter by database vendor, version, or name. Returns a paginated list with name, vendor, version, description, and associated datastores.",
    {
      database_vendor: z
        .string()
        .optional()
        .describe("Filter by database vendor (e.g. 'mysql', 'postgresql', 'redis', 'valkey')"),
      database_version: z
        .string()
        .optional()
        .describe("Filter by database version (e.g. '8.4', '16')"),
      name: z
        .string()
        .optional()
        .describe("Filter by parameter group name (partial match)"),
      page: z
        .number()
        .optional()
        .describe("Page number for pagination"),
      page_size: z
        .number()
        .optional()
        .describe("Number of results per page"),
    },
    async ({ database_vendor, database_version, name, page, page_size }) => {
      try {
        const params: Record<string, string> = {};
        if (database_vendor !== undefined) params.database_vendor = database_vendor;
        if (database_version !== undefined) params.database_version = database_version;
        if (name !== undefined) params.name = name;
        if (page !== undefined) params.page = String(page);
        if (page_size !== undefined) params.page_size = String(page_size);

        const result = await get(
          "/db-configuration/v1/parameter-groups",
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
              text: `Error listing parameter groups: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
