import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { patch } from "../client.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_scale_datastore",
    "Scale a CCX datastore by resizing the instance (CPU/RAM) or expanding storage. Use this when a database needs more resources to handle increased load.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore to scale"),
      new_instance_size: z
        .string()
        .optional()
        .describe("New instance size code (e.g. 'small', 'medium'). Use ccx_list_plans to see available sizes."),
      new_volume_size: z
        .number()
        .optional()
        .describe("New volume size in GiB. Must be larger than the current size (storage can only grow)."),
    },
    async ({ datastore_uuid, new_instance_size, new_volume_size }) => {
      if (new_instance_size === undefined && new_volume_size === undefined) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Error: Provide at least one of new_instance_size or new_volume_size.",
            },
          ],
          isError: true,
        };
      }

      try {
        const body: Record<string, unknown> = {};
        if (new_instance_size !== undefined) body.new_instance_size = new_instance_size;
        if (new_volume_size !== undefined) body.new_volume_size = new_volume_size;

        await patch(
          `/prov/api/v2/cluster/${datastore_uuid}`,
          body,
        );

        const changes = [];
        if (new_instance_size !== undefined) changes.push(`instance → ${new_instance_size}`);
        if (new_volume_size !== undefined) changes.push(`volume → ${new_volume_size} GiB`);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "scaling",
                  datastore_uuid,
                  changes,
                  message: "Scaling operation initiated. Use ccx_get_datastore to monitor progress.",
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
              text: `Error scaling datastore: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
