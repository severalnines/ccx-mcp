import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import type { DatastoreInfo } from "../types.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_get_datastore",
    "Get detailed information about a specific CCX datastore including credentials, status, and current job progress",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore to retrieve"),
    },
    async ({ datastore_uuid }) => {
      try {
        const raw = await get(`/deployment/v3/data-stores/${datastore_uuid}`);
        const store = raw as DatastoreInfo;

        const result = {
          uuid: store.uuid,
          name: store.cluster_name,
          status: store.cluster_status,
          status_text: store.cluster_status_text,
          vendor: store.database_vendor,
          version: store.database_version,
          type: store.cluster_type,
          type_name: store.cluster_type_name,
          size: store.cluster_size,
          cloud_provider: store.cloud_provider,
          region: store.region?.code,
          instance_size: store.instance_size,
          disk_size: store.disk_size,
          disk_type: store.disk_type,
          operable: store.operable,
          ssl_enabled: store.ssl_enabled,
          high_availability: store.high_availability,
          is_deploying: store.is_deploying,
          deploy_progress: store.deploy_progress,
          endpoint: store.database_endpoint,
          primary_url: store.primary_url,
          replica_url: store.replica_url,
          credentials: store.db_account
            ? {
                host: store.db_account.database_host,
                username: store.db_account.database_username,
                password: store.db_account.database_password,
                database: store.db_account.database_database,
              }
            : null,
          current_job: store.current_job
            ? {
                command: store.current_job.command,
                status: store.current_job.status,
                progress: store.current_job.progress,
              }
            : null,
          tags: store.tags,
          created_at: store.created_at,
          updated_at: store.updated_at,
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
              text: `Error getting datastore: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
