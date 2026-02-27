import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import type { RuleSet } from "../types.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_list_firewall_rules",
    "List trusted sources (firewall rules) for a CCX datastore. Shows which CIDRs are allowed to connect.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
    },
    async ({ datastore_uuid }) => {
      try {
        const raw = await get(
          `/firewall/api/v1/firewalls/${datastore_uuid}`,
        );
        const rules = (Array.isArray(raw) ? raw : []) as RuleSet[];

        if (rules.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No trusted sources configured. The datastore is not accessible from any external IPs.",
              },
            ],
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(rules, null, 2),
            },
          ],
        };
      } catch (error) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Error listing firewall rules: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
