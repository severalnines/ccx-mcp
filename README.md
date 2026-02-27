# @severalnines/ccx-mcp

MCP (Model Context Protocol) server for managing [CCX](https://ccx.severalnines.com) database clusters through AI assistants like Claude Code, Claude Desktop, Cursor, and Windsurf.

## Quick Start

Add this to your MCP client configuration (e.g. `.mcp.json` for Claude Code):

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

Then ask your AI assistant things like:

- "List my datastores"
- "Create a PostgreSQL cluster on AWS in eu-west-1"
- "Get the connection string for my production database"
- "Add 10.0.0.0/24 as a trusted source on my cluster"
- "Create a new database user called appuser"

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

### Database Users

| Tool | Description |
|------|-------------|
| `ccx_list_db_users` | List database users with grants and auth plugins |
| `ccx_create_db_user` | Create a user with configurable privileges, host, and admin flag |

### Firewall / Trusted Sources

| Tool | Description |
|------|-------------|
| `ccx_list_firewall_rules` | List trusted source CIDRs and allowed ports |
| `ccx_create_firewall_rule` | Allow a CIDR to connect to the database |

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
- A CCX account at [ccx.severalnines.com](https://ccx.severalnines.com)

## License

Apache-2.0
