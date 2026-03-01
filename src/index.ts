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

async function main() {
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
      `Error: Missing required environment variables: ${missing.join(", ")}\n` +
        `\nFor password auth, set: CCX_BASE_URL, CCX_USERNAME, CCX_PASSWORD` +
        `\nFor OAuth2 auth, set: CCX_BASE_URL, CCX_CLIENT_ID, CCX_CLIENT_SECRET` +
        `\n\nRead more at https://github.com/severalnines/ccx-mcp\n`,
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

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`CCX MCP fatal error: ${err}\n`);
  process.exit(1);
});
