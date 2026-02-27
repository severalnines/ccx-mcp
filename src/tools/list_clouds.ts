import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getCloudProviders } from "../wizard.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_list_clouds",
    "List available cloud providers and their regions for deploying CCX database clusters",
    {},
    async () => {
      try {
        const providers = getCloudProviders();

        const result = providers.map((p) => ({
          code: p.code,
          name: p.name,
          full_name: p.full_name,
          type: p.type,
          regions: p.regions.map((r) => ({
            code: r.code,
            name: r.name,
            city: r.city,
            country_code: r.country_code,
          })),
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
              text: `Error listing clouds: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
