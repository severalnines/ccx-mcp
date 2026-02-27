import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { post } from "../client.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_restore_backup",
    "Restore a CCX datastore from a backup. This is a DESTRUCTIVE operation that replaces current data with the backup contents. Use ccx_list_backups first to find available backup IDs.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore to restore"),
      backup_id: z
        .string()
        .describe("ID of the backup to restore from. Use ccx_list_backups to find available backups."),
      pitr_stop_time: z
        .string()
        .optional()
        .describe("Optional point-in-time recovery target in ISO 8601 format (e.g. '2026-02-27T15:00:00Z'). Restores to the exact backup time if omitted."),
      confirm: z
        .boolean()
        .describe("Must be explicitly set to true to confirm the restore. This operation replaces current data."),
    },
    async ({ datastore_uuid, backup_id, pitr_stop_time, confirm }) => {
      if (!confirm) {
        return {
          content: [
            {
              type: "text" as const,
              text: "Restore aborted: 'confirm' must be explicitly set to true. This operation is destructive and will replace current data with the backup contents.",
            },
          ],
          isError: true,
        };
      }

      try {
        const body: Record<string, unknown> = {};
        if (pitr_stop_time) body.pitr_stop_time = pitr_stop_time;

        const result = await post(
          `/backup/api/v1/backups/${datastore_uuid}/${backup_id}/restore`,
          body,
        );

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  status: "restoring",
                  datastore_uuid,
                  backup_id,
                  ...(pitr_stop_time ? { pitr_stop_time } : {}),
                  message: "Backup restore initiated. Use ccx_get_datastore to monitor progress.",
                  result,
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
              text: `Error restoring backup: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
