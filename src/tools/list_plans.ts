import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { getWizard } from "../wizard.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_list_plans",
    "List available instance sizes, volume types, and volume sizes for a specific cloud provider",
    {
      cloud_provider: z
        .string()
        .describe("Cloud provider code (e.g. 'elastx', 'aws')"),
    },
    async ({ cloud_provider }) => {
      try {
        const wizard = getWizard();
        const cloud = cloud_provider.toLowerCase();

        const instanceSizes = wizard.instance.instance_sizes[cloud] ?? [];
        const volumeTypes = wizard.instance.volume_types[cloud] ?? [];
        const volumeSizes = wizard.instance.volume_sizes[cloud] ?? {};

        const result = {
          cloud_provider: cloud,
          instance_sizes: instanceSizes.map((s) => ({
            code: s.code,
            name: s.name,
            type: s.type,
            cpu: s.cpu,
            ram: s.ram,
            price: s.price,
          })),
          volume_types: volumeTypes.map((v) => ({
            code: v.code,
            name: v.name,
            has_iops: v.has_iops,
            price: v.price,
          })),
          volume_sizes: Object.fromEntries(
            Object.entries(volumeSizes).map(([type, size]) => [
              type,
              { min: size.min, max: size.max, default: size.default, unit: size.unit },
            ]),
          ),
        };

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
              text: `Error listing plans: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
