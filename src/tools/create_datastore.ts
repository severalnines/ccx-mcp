import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { post } from "../client.js";
import type { CreateClusterRequest } from "../types.js";
import {
  getDefaultClusterType,
  getLatestVersion,
  getSmallestInstance,
  getFirstVolumeType,
  getDefaultVolumeSize,
  getDefaultNetworkType,
  getCloudProvider,
} from "../wizard.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_create_datastore",
    "Create a new CCX database cluster. Requires db_vendor, cloud_provider, and cloud_region. All other options have smart defaults from the deployment wizard.",
    {
      db_vendor: z
        .string()
        .describe(
          "Database vendor: 'postgres', 'mariadb', 'percona', 'redis', 'valkey', 'microsoft'",
        ),
      cloud_provider: z
        .string()
        .describe("Cloud provider code (e.g. 'elastx', 'aws')"),
      cloud_region: z
        .string()
        .describe("Cloud region code (e.g. 'se-sto', 'eu-west-1')"),
      cluster_name: z
        .string()
        .max(64)
        .optional()
        .describe("Cluster name (max 64 chars). Auto-generated if omitted."),
      db_version: z
        .string()
        .optional()
        .describe("Database version. Uses latest if omitted."),
      cluster_type: z
        .string()
        .optional()
        .describe(
          "Cluster type (e.g. 'postgres_streaming', 'replication', 'galera'). Defaults per vendor.",
        ),
      cluster_size: z
        .number()
        .min(1)
        .max(3)
        .optional()
        .describe("Number of nodes (1-3). Defaults to 1."),
      instance_size: z
        .string()
        .optional()
        .describe("Instance size code (e.g. 'tiny', 'small'). Uses smallest available if omitted."),
      volume_type: z
        .string()
        .optional()
        .describe("Volume type code (e.g. 'gp2', 'v1-dynamic-100'). Uses first available if omitted."),
      volume_size: z
        .number()
        .optional()
        .describe("Volume size in GiB. Uses provider default if omitted."),
      network_type: z
        .enum(["public", "private"])
        .optional()
        .describe("Network type. Defaults to 'public'."),
      tags: z
        .array(z.string())
        .optional()
        .describe("Optional tags for the cluster."),
    },
    async (args) => {
      try {
        const cloud = args.cloud_provider.toLowerCase();

        // Validate cloud provider exists
        const provider = getCloudProvider(cloud);
        if (!provider) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Unknown cloud provider '${args.cloud_provider}'. Use ccx_list_clouds to see available providers.`,
              },
            ],
            isError: true,
          };
        }

        // Validate region exists
        const region = provider.regions.find(
          (r) => r.code.toLowerCase() === args.cloud_region.toLowerCase(),
        );
        if (!region) {
          return {
            content: [
              {
                type: "text" as const,
                text: `Unknown region '${args.cloud_region}' for provider '${cloud}'. Available regions: ${provider.regions.map((r) => r.code).join(", ")}`,
              },
            ],
            isError: true,
          };
        }

        // Resolve defaults
        const vendor = args.db_vendor.toLowerCase();
        const clusterType =
          args.cluster_type ?? getDefaultClusterType(vendor) ?? vendor;
        const dbVersion =
          args.db_version ?? getLatestVersion(vendor) ?? "latest";
        const clusterSize = args.cluster_size ?? 1;
        const instanceSize =
          args.instance_size ?? getSmallestInstance(cloud) ?? "tiny";
        const volumeType =
          args.volume_type ?? getFirstVolumeType(cloud);
        const volumeSize =
          args.volume_size ??
          (volumeType ? getDefaultVolumeSize(cloud, volumeType) : undefined) ??
          80;
        const networkType =
          args.network_type ?? getDefaultNetworkType(cloud);
        const clusterName =
          args.cluster_name ??
          `${vendor}-${cloud}-${Date.now().toString(36)}`;

        const body: CreateClusterRequest = {
          general: {
            cluster_name: clusterName,
            cluster_size: clusterSize,
            db_vendor: vendor,
            db_version: dbVersion,
            cluster_type: clusterType,
            tags: args.tags,
          },
          cloud: {
            cloud_provider: cloud,
            cloud_region: region.code,
          },
          instance: {
            instance_size: instanceSize,
            ...(volumeType && { volume_type: volumeType }),
            volume_size: volumeSize,
          },
          network: {
            network_type: networkType,
          },
          notifications: {
            enabled: false,
            emails: [],
          },
        };

        const result = await post("/prov/api/v2/cluster", body);

        const response = result as Record<string, unknown>;
        const uuid =
          (response.cluster_uuid as string) ??
          (response.uuid as string) ??
          "unknown";

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "created",
                  cluster_uuid: uuid,
                  cluster_name: clusterName,
                  db_vendor: vendor,
                  db_version: dbVersion,
                  cluster_type: clusterType,
                  cluster_size: clusterSize,
                  cloud_provider: cloud,
                  cloud_region: region.code,
                  instance_size: instanceSize,
                  volume_type: volumeType,
                  volume_size: volumeSize,
                  network_type: networkType,
                  message:
                    "Cluster creation initiated. Use ccx_get_datastore or ccx_list_datastores to monitor progress.",
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
              text: `Error creating datastore: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
