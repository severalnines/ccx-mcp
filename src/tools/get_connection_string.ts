import { z } from "zod";
import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { get } from "../client.js";
import type { DatastoreInfo } from "../types.js";

type Format = "uri" | "psql" | "mysql" | "redis" | "env" | "jdbc";

interface ConnOverrides {
  username?: string;
  password?: string;
  database?: string;
}

const DEFAULT_PORTS: Record<string, number> = {
  postgres: 5432,
  mysql: 3306,
  redis: 6379,
  mssql: 1433,
};

function parseHostPort(
  primaryUrl: string | undefined,
  fallbackHost: string,
  defaultPort: number,
): { host: string; port: number } {
  if (primaryUrl) {
    try {
      const url = new URL(primaryUrl);
      return {
        host: url.hostname,
        port: url.port ? Number(url.port) : defaultPort,
      };
    } catch {
      // Not a URL, treat as bare hostname
      return { host: primaryUrl, port: defaultPort };
    }
  }
  return { host: fallbackHost, port: defaultPort };
}

function shellEscape(s: string): string {
  return "'" + s.replace(/'/g, "'\\''") + "'";
}

function buildConnectionStrings(
  store: DatastoreInfo,
  overrides?: ConnOverrides,
): Record<string, string> {
  const creds = store.db_account;
  if (!store.primary_url && !creds?.database_host) {
    return { error: "Credentials not yet available. The datastore may still be deploying." };
  }

  const user = overrides?.username ?? creds.database_username;
  const pass = overrides?.password ?? creds.database_password;
  const db = overrides?.database ?? creds.database_database;
  const vendor = store.database_vendor?.toLowerCase() ?? "";

  const encodedPass = encodeURIComponent(pass);

  const strings: Record<string, string> = {};

  if (vendor.includes("postgres") || vendor.includes("pgsql")) {
    const { host, port } = parseHostPort(store.primary_url, creds.database_host, DEFAULT_PORTS.postgres);
    const ssl = store.ssl_enabled ? "?sslmode=require" : "";
    strings.uri = `postgresql://${user}:${encodedPass}@${host}:${port}/${db}${ssl}`;
    strings.psql = `PGPASSWORD=${shellEscape(pass)} psql -h ${host} -p ${port} -U ${user} -d ${db}${store.ssl_enabled ? " --set=sslmode=require" : ""}`;
    strings.jdbc = `jdbc:postgresql://${host}:${port}/${db}${ssl}`;
    strings.env = [
      `DATABASE_URL=postgresql://${user}:${encodedPass}@${host}:${port}/${db}${ssl}`,
      `PGHOST=${host}`,
      `PGPORT=${port}`,
      `PGUSER=${user}`,
      `PGPASSWORD=${pass}`,
      `PGDATABASE=${db}`,
    ].join("\n");
  } else if (
    vendor.includes("maria") ||
    vendor.includes("mysql") ||
    vendor.includes("percona")
  ) {
    const { host, port } = parseHostPort(store.primary_url, creds.database_host, DEFAULT_PORTS.mysql);
    const mysqlSsl = store.ssl_enabled ? "?ssl-mode=REQUIRED" : "";
    strings.uri = `mysql://${user}:${encodedPass}@${host}:${port}/${db}${mysqlSsl}`;
    strings.mysql = `mysql -h ${host} -P ${port} -u ${user} -p${shellEscape(pass)} ${db}${store.ssl_enabled ? " --ssl-mode=REQUIRED" : ""}`;
    strings.jdbc = `jdbc:mysql://${host}:${port}/${db}${mysqlSsl}`;
    strings.env = [
      `DATABASE_URL=mysql://${user}:${encodedPass}@${host}:${port}/${db}${mysqlSsl}`,
      `MYSQL_HOST=${host}`,
      `MYSQL_PORT=${port}`,
      `MYSQL_USER=${user}`,
      `MYSQL_PASSWORD=${pass}`,
      `MYSQL_DATABASE=${db}`,
    ].join("\n");
  } else if (vendor.includes("redis") || vendor.includes("valkey")) {
    const { host, port } = parseHostPort(store.primary_url, creds.database_host, DEFAULT_PORTS.redis);
    strings.uri = `redis://${pass ? `:${encodedPass}@` : ""}${host}:${port}`;
    strings.redis = `redis-cli -h ${host} -p ${port}${pass ? ` -a ${shellEscape(pass)}` : ""}${store.ssl_enabled ? " --tls" : ""}`;
    strings.env = [
      `REDIS_URL=redis://${pass ? `:${encodedPass}@` : ""}${host}:${port}`,
      `REDIS_HOST=${host}`,
      `REDIS_PORT=${port}`,
      ...(pass ? [`REDIS_PASSWORD=${pass}`] : []),
    ].join("\n");
  } else if (vendor.includes("microsoft") || vendor.includes("mssql")) {
    const { host, port } = parseHostPort(store.primary_url, creds.database_host, DEFAULT_PORTS.mssql);
    strings.uri = `mssql://${user}:${encodedPass}@${host}:${port}/${db}`;
    strings.jdbc = `jdbc:sqlserver://${host}:${port};databaseName=${db};user=${user};password=${shellEscape(pass)}${store.ssl_enabled ? ";encrypt=true" : ""}`;
    strings.env = [
      `DATABASE_URL=mssql://${user}:${encodedPass}@${host}:${port}/${db}`,
      `MSSQL_HOST=${host}`,
      `MSSQL_PORT=${port}`,
      `MSSQL_USER=${user}`,
      `MSSQL_PASSWORD=${pass}`,
      `MSSQL_DATABASE=${db}`,
    ].join("\n");
  } else {
    return {
      error: `Unsupported database vendor '${store.database_vendor}'. Supported: PostgreSQL, MySQL/MariaDB/Percona, Redis/Valkey, Microsoft SQL Server.`,
    };
  }

  return strings;
}

export function register(server: McpServer) {
  server.tool(
    "ccx_get_connection_string",
    "Get connection strings for a CCX datastore. Returns URI, CLI command, JDBC, and environment variable formats. Useful for configuring applications to connect to the database.",
    {
      datastore_uuid: z
        .string()
        .describe("UUID of the datastore"),
      format: z
        .enum(["uri", "psql", "mysql", "redis", "env", "jdbc", "all"])
        .optional()
        .describe(
          "Output format: 'uri' (connection URI), 'psql'/'mysql'/'redis' (CLI command), 'jdbc' (Java), 'env' (environment variables), 'all' (default: all formats)",
        ),
      username: z
        .string()
        .optional()
        .describe("Database username. Defaults to the datastore's primary user from db_account."),
      password: z
        .string()
        .optional()
        .describe("Database password. Defaults to the datastore's primary user password from db_account."),
      database: z
        .string()
        .optional()
        .describe("Database name. Defaults to the datastore's primary database."),
    },
    async ({ datastore_uuid, format, username, password, database }) => {
      try {
        const raw = await get(`/deployment/v3/data-stores/${datastore_uuid}`);
        const store = raw as DatastoreInfo;

        const strings = buildConnectionStrings(store, { username, password, database });

        if (strings.error) {
          return {
            content: [
              { type: "text" as const, text: strings.error },
            ],
            isError: true,
          };
        }

        const selectedFormat = format ?? "all";

        let output: Record<string, string>;
        if (selectedFormat === "all") {
          output = strings;
        } else if (strings[selectedFormat]) {
          output = { [selectedFormat]: strings[selectedFormat] };
        } else {
          // If the requested format doesn't apply (e.g. psql for redis), show what's available
          return {
            content: [
              {
                type: "text" as const,
                text: `Format '${selectedFormat}' is not available for ${store.database_vendor}. Available formats: ${Object.keys(strings).join(", ")}`,
              },
            ],
            isError: true,
          };
        }

        return {
          content: [
            {
              type: "text" as const,
              text: JSON.stringify(
                {
                  datastore: store.cluster_name,
                  vendor: store.database_vendor,
                  version: store.database_version,
                  ssl_enabled: store.ssl_enabled,
                  connection_strings: output,
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
              text: `Error getting connection string: ${error instanceof Error ? error.message : String(error)}`,
            },
          ],
          isError: true,
        };
      }
    },
  );
}
