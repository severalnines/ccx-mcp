# @severalnines/ccx-mcp

MCP (Model Context Protocol) server for managing [CCX](https://severalnines.com/ccx) database clusters through AI assistants like Claude Code, Claude Desktop, Cursor, and Windsurf.

## Quick Start

### Install from npm

Add this to your MCP client configuration:

```json
{
  "mcpServers": {
    "ccx": {
      "command": "npx",
      "args": ["-y", "@severalnines/ccx-mcp"],
      "env": {
        "CCX_BASE_URL": "https://app.myccx.io",
        "CCX_USERNAME": "your-email@example.com",
        "CCX_PASSWORD": "your-password"
      }
    }
  }
}
```

### Install from source

```bash
git clone https://github.com/severalnines/ccx-mcp.git
cd ccx-mcp
npm install
npm run build
```

Then point your MCP client to the built server:

```json
{
  "mcpServers": {
    "ccx": {
      "command": "node",
      "args": ["/absolute/path/to/ccx-mcp/build/index.js"],
      "env": {
        "CCX_BASE_URL": "https://app.myccx.io",
        "CCX_USERNAME": "your-email@example.com",
        "CCX_PASSWORD": "your-password"
      }
    }
  }
}
```

### Where to put the configuration

| MCP Client | Config file |
|------------|-------------|
| Claude Code | `.mcp.json` in your project root, or `~/.claude/.mcp.json` for global |
| Claude Desktop | `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) |
| Cursor | `.cursor/mcp.json` in your project root |
| Windsurf | `~/.codeium/windsurf/mcp_config.json` |

### `CCX_BASE_URL`

This is the URL of your CCX deployment. If you're using the hosted CCX service, it's typically `https://app.myccx.io`. If you're running a self-hosted CCX instance, use its URL instead.

### Using OAuth2 instead of password

Replace `CCX_USERNAME` and `CCX_PASSWORD` with `CCX_CLIENT_ID` and `CCX_CLIENT_SECRET`:

```json
{
  "mcpServers": {
    "ccx": {
      "command": "npx",
      "args": ["-y", "@severalnines/ccx-mcp"],
      "env": {
        "CCX_BASE_URL": "https://app.myccx.io",
        "CCX_CLIENT_ID": "your-client-id",
        "CCX_CLIENT_SECRET": "your-client-secret"
      }
    }
  }
}
```

You can create OAuth2 credentials in the CCX UI under **Account > Security**.

Then ask your AI assistant things like:

- "List my datastores"
- "Create a PostgreSQL cluster on AWS in eu-west-1"
- "Get the connection string for my production database"
- "Add 10.0.0.0/24 as a trusted source on my cluster"
- "Create a new database user called appuser"
- "Scale my cluster to a medium instance"
- "Show me the slowest queries on my database"
- "List backups for my production cluster"
- "What's the CPU usage on my database?"

## Authentication

### Password Auth

Set `CCX_USERNAME` and `CCX_PASSWORD`:

```json
{
  "env": {
    "CCX_BASE_URL": "https://app.myccx.io",
    "CCX_USERNAME": "your-email@example.com",
    "CCX_PASSWORD": "your-password"
  }
}
```

### OAuth2 (Client Credentials)

For programmatic or CI/CD use, set `CCX_CLIENT_ID` and `CCX_CLIENT_SECRET` instead:

```json
{
  "env": {
    "CCX_BASE_URL": "https://app.myccx.io",
    "CCX_CLIENT_ID": "your-client-id",
    "CCX_CLIENT_SECRET": "your-client-secret"
  }
}
```

## Available Tools

### Datastore Management

| Tool | Description |
|------|-------------|
| `ccx_list_datastores` | List all database clusters with status, vendor, and cloud provider |
| `ccx_get_datastore` | Get detailed cluster info including credentials and job progress |
| `ccx_create_datastore` | Create a new cluster (only vendor, cloud provider, and region required) |
| `ccx_delete_datastore` | Delete a cluster (requires explicit confirmation) |
| `ccx_get_nodes` | Get cluster nodes with roles, status, and IP addresses |
| `ccx_get_connection_string` | Connection strings in URI, CLI, JDBC, and env formats |
| `ccx_scale_datastore` | Scale instance size (CPU/RAM) or expand storage volume |
| `ccx_add_node` | Add a new replica node to a cluster |

### Cloud & Plans

| Tool | Description |
|------|-------------|
| `ccx_list_clouds` | List available cloud providers and regions |
| `ccx_list_plans` | List instance sizes, volume types, and sizes per cloud |

### Database Management

| Tool | Description |
|------|-------------|
| `ccx_list_databases` | List databases on a datastore |
| `ccx_create_database` | Create a new database |
| `ccx_delete_database` | Delete a database |

### Database Users

| Tool | Description |
|------|-------------|
| `ccx_list_db_users` | List database users with grants and auth plugins |
| `ccx_create_db_user` | Create a user with configurable privileges, host, and admin flag |
| `ccx_delete_db_user` | Delete a database user |

### Firewall / Trusted Sources

| Tool | Description |
|------|-------------|
| `ccx_list_firewall_rules` | List trusted source CIDRs and allowed ports |
| `ccx_create_firewall_rule` | Allow a CIDR to connect to the database |
| `ccx_delete_firewall_rule` | Remove a trusted source CIDR |

### Backups & Recovery

| Tool | Description |
|------|-------------|
| `ccx_list_backups` | List available backups with status, type, and timestamps |
| `ccx_restore_backup` | Restore from a backup with optional point-in-time recovery |

### Monitoring & Performance

| Tool | Description |
|------|-------------|
| `ccx_get_top_queries` | Get slowest queries ranked by execution time |
| `ccx_get_stats` | Get performance metrics (CPU, memory, disk, network, SQL, DB stats) |

## Protection Mode

Destructive operations are **blocked by default** to prevent accidental data loss. The following tools are affected:

- `ccx_delete_datastore` — deletes an entire database cluster
- `ccx_delete_db_user` — deletes a database user account
- `ccx_delete_database` — deletes a database
- `ccx_delete_firewall_rule` — removes a firewall access rule
- `ccx_restore_backup` — overwrites current data with a backup

To allow destructive operations, set `CCX_PROTECT=false` in your MCP configuration and restart the server:

```json
{
  "env": {
    "CCX_PROTECT": "false"
  }
}
```

## Supported Databases

- PostgreSQL
- MySQL / Percona
- MariaDB
- Redis
- Valkey
- Microsoft SQL Server

## Development

```bash
# Install dependencies
npm install

# Build
npm run build

# Run tests
npm test

# Watch mode
npm run test:watch
```

## Requirements

- Node.js 18+
- A CCX account at [ccx.severalnines.com](https://severalnines.com/ccx)

## License

Apache-2.0
