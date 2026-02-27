import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import type { NodeInfo } from "../types.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_get_nodes",
    "Get the list of nodes for a specific CCX datastore, including their roles, status, and IP addresses",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
    },
    async ({ datastore_uuid }) => {
      try {
        const raw = await get(
          `/deployment/v2/data-stores/${datastore_uuid}/nodes`,
        ) as { database_nodes?: NodeInfo[] };
        const nodes = raw.database_nodes ?? [];

        if (nodes.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No nodes found for this datastore. It may still be deploying.",
              },
            ],
          };
        }

        const result = nodes.map((n) => ({
          host_uuid: n.host_uuid,
          hostname: n.hostname,
          role: n.role,
          status: n.host_status,
          port: n.port,
          private_ip: n.private_ip,
          public_ip: n.public_ip,
          availability_zone: n.host_az,
          readonly: n.readonly,
        }));

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
              text: `Error getting nodes: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
