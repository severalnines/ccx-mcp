import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

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

/** Tools that change or destroy data; every one of them requires confirm=true. */
const DESTRUCTIVE = [
  registerDeleteDatastore,
  registerDeleteDatabase,
  registerDeleteDbUser,
  registerDeleteFirewallRule,
  registerDeleteParameterGroup,
  registerApplyParameterGroup,
  registerRestoreBackup,
];

const SAFE = [
  registerListClouds,
  registerListPlans,
  registerCreateDatastore,
  registerListDatastores,
  registerGetDatastore,
  registerGetNodes,
  registerGetConnectionString,
  registerListDbUsers,
  registerCreateDbUser,
  registerListDatabases,
  registerCreateDatabase,
  registerListFirewallRules,
  registerCreateFirewallRule,
  registerScaleDatastore,
  registerListBackups,
  registerGetTopQueries,
  registerGetStats,
  registerAddNode,
  registerListParameterGroups,
  registerGetParameterGroup,
  registerListDefaultParameters,
  registerCreateParameterGroup,
  registerUpdateParameterGroup,
];

/**
 * Registers the tool set for one server. With protect=true the destructive
 * tools are left out entirely rather than registered-and-blocked, so a client
 * cannot even attempt them. Returns how many were left out.
 */
export function registerTools(server: McpServer, protect: boolean): { hidden: number } {
  for (const register of SAFE) register(server);
  if (!protect) for (const register of DESTRUCTIVE) register(server);
  return { hidden: protect ? DESTRUCTIVE.length : 0 };
}
