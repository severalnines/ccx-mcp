#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { login } from "./auth.js";
import { load as loadWizard } from "./wizard.js";
import { isProtected } from "./protect.js";

import { register as registerListClouds } from "./tools/list_clouds.js";
import { register as registerListPlans } from "./tools/list_plans.js";
import { register as registerCreateDatastore } from "./tools/create_datastore.js";
import { register as registerListDatastores } from "./tools/list_datastores.js";
import { register as registerGetDatastore } from "./tools/get_datastore.js";
import { register as registerDeleteDatastore } from "./tools/delete_datastore.js";
import { register as registerGetNodes } from "./tools/get_nodes.js";
import { register as registerGetConnectionString } from "./tools/get_connection_string.js";
import { register as registerListDbUsers } from "./tools/list_db_users.js";
import { register as registerCreateDbUser } from "./tools/create_db_user.js";
import { register as registerListDatabases } from "./tools/list_databases.js";
import { register as registerCreateDatabase } from "./tools/create_database.js";
import { register as registerListFirewallRules } from "./tools/list_firewall_rules.js";
import { register as registerCreateFirewallRule } from "./tools/create_firewall_rule.js";
import { register as registerDeleteFirewallRule } from "./tools/delete_firewall_rule.js";
import { register as registerDeleteDbUser } from "./tools/delete_db_user.js";
import { register as registerScaleDatastore } from "./tools/scale_datastore.js";
import { register as registerListBackups } from "./tools/list_backups.js";
import { register as registerRestoreBackup } from "./tools/restore_backup.js";
import { register as registerGetTopQueries } from "./tools/get_top_queries.js";
import { register as registerGetStats } from "./tools/get_stats.js";
import { register as registerAddNode } from "./tools/add_node.js";
import { register as registerDeleteDatabase } from "./tools/delete_database.js";
import { register as registerListParameterGroups } from "./tools/list_parameter_groups.js";
import { register as registerGetParameterGroup } from "./tools/get_parameter_group.js";
import { register as registerListDefaultParameters } from "./tools/list_default_parameters.js";
import { register as registerCreateParameterGroup } from "./tools/create_parameter_group.js";
import { register as registerUpdateParameterGroup } from "./tools/update_parameter_group.js";
import { register as registerDeleteParameterGroup } from "./tools/delete_parameter_group.js";
import { register as registerApplyParameterGroup } from "./tools/apply_parameter_group.js";

const USAGE = `Usage: ccx-mcp [options]

Options:
  --endpoint <url>           CCX base URL (e.g. https://app.myccx.io)
  --client-id <id>           OAuth2 client ID
  --client-secret <secret>   OAuth2 client secret
  --username <email>         Account email (password auth)
  --password <password>      Account password (password auth)
  --protect <true|false>     Protection mode for destructive ops (default: true)
  -h, --help                 Show this help and exit

Environment variables (used when a flag is not given):
  CCX_BASE_URL, CCX_CLIENT_ID, CCX_CLIENT_SECRET,
  CCX_USERNAME, CCX_PASSWORD, CCX_PROTECT

Authentication:
  OAuth2 (recommended): pass --client-id and --client-secret.
  Password: pass --username and --password.
`;

function parseArgs(argv: string[]): Record<string, string> {
  const flags: Record<string, string> = {};
  const aliases: Record<string, string> = {
    endpoint: "CCX_BASE_URL",
    "client-id": "CCX_CLIENT_ID",
    "client-secret": "CCX_CLIENT_SECRET",
    username: "CCX_USERNAME",
    password: "CCX_PASSWORD",
    protect: "CCX_PROTECT",
  };

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === "-h" || arg === "--help") {
      process.stdout.write(USAGE);
      process.exit(0);
    }
    if (!arg.startsWith("--")) {
      process.stderr.write(`Unknown argument: ${arg}\n\n${USAGE}`);
      process.exit(2);
    }

    const eq = arg.indexOf("=");
    const name = eq >= 0 ? arg.slice(2, eq) : arg.slice(2);
    const envName = aliases[name];
    if (!envName) {
      process.stderr.write(`Unknown flag: --${name}\n\n${USAGE}`);
      process.exit(2);
    }

    let value: string | undefined;
    if (eq >= 0) {
      value = arg.slice(eq + 1);
    } else {
      value = argv[i + 1];
      if (value === undefined || value.startsWith("--")) {
        process.stderr.write(`Missing value for --${name}\n\n${USAGE}`);
        process.exit(2);
      }
      i++;
    }

    flags[envName] = value;
  }

  return flags;
}

async function main() {
  // Parse CLI flags and apply to env (flags override env vars)
  const flags = parseArgs(process.argv.slice(2));
  for (const [key, value] of Object.entries(flags)) {
    process.env[key] = value;
  }

  // Validate env vars
  const required = ["CCX_BASE_URL"];
  const authMethod = process.env.CCX_CLIENT_ID ? "oauth2" : "password";

  if (authMethod === "password") {
    required.push("CCX_USERNAME", "CCX_PASSWORD");
  } else {
    required.push("CCX_CLIENT_ID", "CCX_CLIENT_SECRET");
  }

  const missing = required.filter((v) => !process.env[v]);
  if (missing.length > 0) {
    process.stderr.write(
      `Error: Missing required configuration: ${missing.join(", ")}\n` +
        `\nFor OAuth2 auth, pass --endpoint, --client-id, --client-secret.` +
        `\nFor password auth, pass --endpoint, --username, --password.\n` +
        `\nRun with --help for usage.\n`,
    );
    process.exit(1);
  }

  const server = new McpServer({
    name: "ccx",
    version: "0.1.0",
  });

  // Login and load wizard data
  process.stderr.write("CCX MCP: Logging in...\n");
  await login();
  process.stderr.write("CCX MCP: Loading deployment wizard...\n");
  await loadWizard();
  process.stderr.write(
    `CCX MCP: Protection mode: ${isProtected() ? "ON" : "OFF"}\n`,
  );
  process.stderr.write("CCX MCP: Ready.\n");

  // Register tools
  registerListClouds(server);
  registerListPlans(server);
  registerCreateDatastore(server);
  registerListDatastores(server);
  registerGetDatastore(server);
  registerDeleteDatastore(server);
  registerGetNodes(server);
  registerGetConnectionString(server);
  registerListDbUsers(server);
  registerCreateDbUser(server);
  registerListDatabases(server);
  registerCreateDatabase(server);
  registerListFirewallRules(server);
  registerCreateFirewallRule(server);
  registerDeleteFirewallRule(server);
  registerDeleteDbUser(server);
  registerScaleDatastore(server);
  registerListBackups(server);
  registerRestoreBackup(server);
  registerGetTopQueries(server);
  registerGetStats(server);
  registerAddNode(server);
  registerDeleteDatabase(server);
  registerListParameterGroups(server);
  registerGetParameterGroup(server);
  registerListDefaultParameters(server);
  registerCreateParameterGroup(server);
  registerUpdateParameterGroup(server);
  registerDeleteParameterGroup(server);
  registerApplyParameterGroup(server);

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`CCX MCP fatal error: ${err}\n`);
  process.exit(1);
});
