import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { post } from "../client.js";
import type { CreateDbUserRequest, DbUser } from "../types.js";
import { validateUsername } from "../validate.js";

export function register(server: McpServer) {
  server.tool(
    "ccx_create_db_user",
    "Create a new database user on a CCX datastore",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
      username: z
        .string()
        .describe("Username for the new database user"),
      password: z
        .string()
        .describe("Password for the new database user"),
      database: z
        .string()
        .optional()
        .describe("Database to grant access to. If omitted, no specific database is assigned."),
      privileges: z
        .string()
        .optional()
        .describe("Privileges to grant (e.g. 'ALL PRIVILEGES'). Defaults to standard privileges."),
      host: z
        .string()
        .optional()
        .describe("Host to allow connections from (e.g. '%' for any). Defaults to '%'."),
      admin: z
        .boolean()
        .optional()
        .describe("Create as admin user with elevated privileges"),
    },
    async ({ datastore_uuid, username, password, database, privileges, host, admin }) => {
      const validationError = validateUsername(username);
      if (validationError) {
        return {
          content: [
            {
              type: "text" as const,
              text: `Invalid username: ${validationError}`,
            },
          ],
          isError: true,
        };
      }

      try {
        const body: CreateDbUserRequest = {
          database_username: username,
          database_password: password,
        };

        if (database) body.database_name = database;
        if (privileges) body.database_privileges = privileges;
        if (host) body.database_host = host;
        if (admin !== undefined) body.create_admin_user = admin;

        const result = await post(
          `/userdb/api/v1/user/${datastore_uuid}`,
          body,
        ) as DbUser;

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
              text: `Error creating database user: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
