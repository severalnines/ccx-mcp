import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { del } from "../client.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_delete_datastore",
    "Delete a CCX datastore. This is DESTRUCTIVE and cannot be undone. You must set confirm to true.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore to delete"),
      confirm: z
        .boolean()
        .describe("Must be explicitly set to true to confirm deletion"),
    },
    async ({ datastore_uuid, confirm }) => {
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
        await del(`/prov/api/v2/cluster/${datastore_uuid}`);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "deleting",
                  datastore_uuid,
                  message:
                    "Datastore deletion initiated. The cluster will be removed shortly.",
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
              text: `Error deleting datastore: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
