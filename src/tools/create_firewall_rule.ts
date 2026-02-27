import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { post } from "../client.js";
import type { AccessRequest } from "../types.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_create_firewall_rule",
    "Add a trusted source (firewall rule) to a CCX datastore. Allows the specified CIDR to connect to the database.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
      source: z
        .string()
        .describe("CIDR to allow (e.g. '10.0.0.0/24' or '1.2.3.4' for a single IP)"),
      description: z
        .string()
        .optional()
        .describe("Human-readable description of this trusted source (e.g. 'Office network')"),
    },
    async ({ datastore_uuid, source, description }) => {
      try {
        const body: AccessRequest = {
          source,
          description: description ?? "",
        };

        await post(
          `/firewall/api/v1/firewall/${datastore_uuid}`,
          body,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "created",
                  source,
                  description: description ?? "",
                  message: `Trusted source ${source} added to datastore ${datastore_uuid}.`,
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
              text: `Error creating firewall rule: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
