#!/usr/bin/env node

import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { login } from "./auth.js";
import { load as loadWizard } from "./wizard.js";
import { isProtected } from "./protect.js";
import { registerTools } from "./register.js";


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
  process.stderr.write(`CCX MCP: Protection mode: ${isProtected() ? "ON" : "OFF"}\n`);
  process.stderr.write("CCX MCP: Ready.\n");

  const { hidden } = registerTools(server, isProtected());
  if (hidden > 0) {
    process.stderr.write(`CCX MCP: ${hidden} destructive tools not registered (set CCX_PROTECT=false to enable them; each then requires confirm=true).\n`);
  }

  // Start stdio transport
  const transport = new StdioServerTransport();
  await server.connect(transport);
}

main().catch((err) => {
  process.stderr.write(`CCX MCP fatal error: ${err}\n`);
  process.exit(1);
});
