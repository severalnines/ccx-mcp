import { describe, it, expect, afterEach } from "vitest";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { isProtected } from "../src/protect.js";
import { registerTools } from "../src/register.js";

describe("isProtected", () => {
  afterEach(() => {
    delete process.env.CCX_PROTECT;
  });

  it.each([
    [undefined, true],
    ["true", true],
    ["yes", true],
    ["false", false],
    ["FALSE", false],
    ["0", false],
  ])("CCX_PROTECT=%s -> %s", (val, expected) => {
    if (val === undefined) delete process.env.CCX_PROTECT;
    else process.env.CCX_PROTECT = val;
    expect(isProtected()).toBe(expected);
  });
});

const DESTRUCTIVE = [
  "ccx_delete_datastore",
  "ccx_delete_database",
  "ccx_delete_db_user",
  "ccx_delete_firewall_rule",
  "ccx_delete_parameter_group",
  "ccx_apply_parameter_group",
  "ccx_restore_backup",
];

async function toolNames(protect: boolean) {
  const server = new McpServer({ name: "t", version: "0" });
  const { hidden } = registerTools(server, protect);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  const client = new Client({ name: "t", version: "0" });
  await client.connect(ct);
  const names = (await client.listTools()).tools.map((t) => t.name);
  await client.close();
  await server.close();
  return { names, hidden };
}

describe("registerTools", () => {
  it("does not register the destructive tools while protected", async () => {
    const { names, hidden } = await toolNames(true);
    for (const name of DESTRUCTIVE) expect(names).not.toContain(name);
    expect(names).toContain("ccx_list_datastores");
    expect(hidden).toBe(DESTRUCTIVE.length);
  });

  it("registers everything when unprotected", async () => {
    const { names, hidden } = await toolNames(false);
    for (const name of DESTRUCTIVE) expect(names).toContain(name);
    expect(hidden).toBe(0);
    expect(names).toHaveLength(30);
  });
});
