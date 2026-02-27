import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import type { DatastoreListResponse, DatastoreInfo } from "../types.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_list_datastores",
    "List all CCX database clusters (datastores) with their status, vendor, and cloud provider",
    {
      limit: z
        .number()
        .min(1)
        .max(100)
        .optional()
        .describe("Max results to return (default 50)"),
      offset: z
        .number()
        .min(0)
        .optional()
        .describe("Offset for pagination"),
    },
    async ({ limit, offset }) => {
      try {
        const params: Record<string, string> = {};
        if (limit !== undefined) params["limit"] = String(limit);
        if (offset !== undefined) params["offset"] = String(offset);

        const raw = await get("/deployment/v3/data-stores", params);
        const response = raw as DatastoreListResponse;
        const stores: DatastoreInfo[] = response.datastores ?? [];

        if (stores.length === 0) {
          return {
            content: [
              {
                type: "text" as const,
                text: "No datastores found. Use ccx_create_datastore to create one.",
              },
            ],
          };
        }

        const summary = stores.map((s) => ({
          uuid: s.uuid,
          name: s.cluster_name,
          status: s.cluster_status,
          vendor: s.database_vendor,
          version: s.database_version,
          cloud_provider: s.cloud_provider,
          region: s.region?.code ?? "unknown",
          size: s.cluster_size,
          is_deploying: s.is_deploying,
          deploy_progress: s.deploy_progress,
          created_at: s.created_at,
        }));

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  total: response.total ?? stores.length,
                  datastores: summary,
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
              text: `Error listing datastores: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
