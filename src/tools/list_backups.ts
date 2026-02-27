import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import type { BackupsResponse } from "../types.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_list_backups",
    "List available backups for a CCX datastore. Use this to check backup history, find a backup to restore, or verify that backups are running successfully.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
      limit: z
        .number()
        .optional()
        .describe("Maximum number of backups to return (default: 20)"),
      offset: z
        .number()
        .optional()
        .describe("Offset for pagination"),
    },
    async ({ datastore_uuid, limit, offset }) => {
      try {
        const params: Record<string, string> = {};
        if (limit !== undefined) params.limit = String(limit);
        if (offset !== undefined) params.offset = String(offset);

        const raw = await get(
          `/backup/api/v1/backups/${datastore_uuid}`,
          Object.keys(params).length > 0 ? params : undefined,
        );

        const response = raw as BackupsResponse;
        const backups = response.backups ?? [];

        if (backups.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No backups found for this datastore.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                { total: response.total, backups },
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
              text: `Error listing backups: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
