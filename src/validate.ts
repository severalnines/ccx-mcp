const RESERVED_DATABASE_NAMES = new Set([
  // MySQL
  "information_schema",
  "mysql",
  "performance_schema",
  "sys",
  // Postgres
  "postgres",
  "template0",
  "template1",
  // ProxySQL
  "proxydemo",
  // CCX internal
  "ccxdb",
]);

const RESERVED_USERNAMES = new Set([
  // cmon
  "cmon",
  "cmonexporter",
  "cmon_replication",
  // netdata
  "netdata",
  // MySQL
  "system user",
  "root",
  "backupuser",
  "mysql",
  "mariadb.sys",
  "mysql.sys",
  "mysql.session",
  "mysql.infoschema",
  "repl_user",
  "rpl_user",
  "event_scheduler",
  // MariaDB
  "PUBLIC",
  // Percona
  "mysql.pxc.sst.role",
  "mysql.pxc.internal.session",
  "percona.telemetry",
  // Postgres
  "postgres",
  "pg_write_server_files",
  "pg_stat_scan_tables",
  "pg_signal_backend",
  "pg_read_server_files",
  "pg_read_all_stats",
  "pg_read_all_settings",
  "pg_monitor",
  "pg_execute_server_program",
  "s9spostgresqlchk",
  "pg_write_all_data",
  "pg_read_all_data",
  "pg_database_owner",
  "pg_checkpoint",
  "pg_create_subscription",
  "pg_use_reserved_connections",
  // ProxySQL
  "proxysql-monitor",
  "proxysql-demo",
  "proxydemo",
  // haproxy
  "s9smysqlchk",
  // redis
  "default",
  "replica-user",
  "sentinel-user",
]);

const DB_NAME_PATTERN = /^[a-zA-Z_][a-zA-Z0-9_]*$/;
const MAX_NAME_LENGTH = 63;

/**
 * Validates a database name. Returns an error string if invalid, null if OK.
 */
export function validateDatabaseName(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return "Database name cannot be empty.";
  }

  if (name.length > MAX_NAME_LENGTH) {
    return `Database name cannot exceed ${MAX_NAME_LENGTH} characters (got ${name.length}).`;
  }

  if (RESERVED_DATABASE_NAMES.has(name.toLowerCase())) {
    return `"${name}" is a reserved database name and cannot be used.`;
  }

  if (!DB_NAME_PATTERN.test(name)) {
    return `Invalid database name "${name}". Must start with a letter or underscore and contain only letters, digits, and underscores.`;
  }

  return null;
}

/**
 * Validates a database username. Returns an error string if invalid, null if OK.
 */
export function validateUsername(name: string): string | null {
  if (!name || name.trim().length === 0) {
    return "Username cannot be empty.";
  }

  if (name.length > MAX_NAME_LENGTH) {
    return `Username cannot exceed ${MAX_NAME_LENGTH} characters (got ${name.length}).`;
  }

  if (RESERVED_USERNAMES.has(name)) {
    return `"${name}" is a reserved username and cannot be used.`;
  }

  return null;
}
