import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { patch } from "../client.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_add_node",
    "Add a new node to a CCX datastore (horizontal scale-out). The new node will be provisioned with the same or specified instance size and join the cluster as a replica.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore to add a node to"),
      instance_size: z
        .string()
        .optional()
        .describe("Instance size for the new node (e.g. 'v1-small-1'). Uses the cluster's current instance size if omitted."),
      availability_zone: z
        .string()
        .optional()
        .describe("Availability zone for the new node. Uses the provider's default if omitted."),
    },
    async ({ datastore_uuid, instance_size, availability_zone }) => {
      try {
        const spec: Record<string, string> = {};
        if (instance_size) spec.instance_size = instance_size;
        if (availability_zone) spec.availability_zone = availability_zone;

        await patch(`/prov/api/v2/cluster/${datastore_uuid}`, {
          add_nodes: {
            specs: [spec],
          },
        });

        const details = [];
        if (instance_size) details.push(`instance_size: ${instance_size}`);
        if (availability_zone) details.push(`az: ${availability_zone}`);

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "adding_node",
                  datastore_uuid,
                  ...(details.length > 0 ? { details } : {}),
                  message: "Node addition initiated. Use ccx_get_datastore to monitor progress.",
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
              text: `Error adding node: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
