import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { Client } from "@modelcontextprotocol/sdk/client/index.js";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { InMemoryTransport } from "@modelcontextprotocol/sdk/inMemory.js";
import { register as registerDeleteDatabase } from "../../src/tools/delete_database.js";
import { register as registerApplyParameterGroup } from "../../src/tools/apply_parameter_group.js";

const BASE = "https://test.ccx.dev";
const DS = "ds-12345-abcde";
const PG = "pg-1";

const mswServer = setupServer(
  http.post(`${BASE}/api/v2/auth/login`, () =>
    HttpResponse.json(
      { user: { id: "u1", login: "t@t.com", first_name: "T", last_name: "U" }, scopes: [{ id: "s1", name: "T", type: "user", role: "admin" }] },
      { headers: { "Set-Cookie": "ccx-session=test-session; Path=/" } },
    ),
  ),
);

let client: Client;
let server: McpServer;

async function call(name: string, args: Record<string, unknown>) {
  const res = await client.callTool({ name, arguments: args });
  const text = (res.content as Array<{ text?: string }>).map((c) => c.text ?? "").join("");
  return { text, isError: res.isError === true };
}

beforeAll(async () => {
  mswServer.listen({ onUnhandledRequest: "error" });
  process.env.CCX_BASE_URL = BASE;
  process.env.CCX_USERNAME = "t@t.com";
  process.env.CCX_PASSWORD = "pw";
  delete process.env.CCX_CLIENT_ID;
  const auth = await import("../../src/auth.js");
  auth.clearSession();
  await auth.login();

  server = new McpServer({ name: "t", version: "0" });
  registerDeleteDatabase(server);
  registerApplyParameterGroup(server);
  const [ct, st] = InMemoryTransport.createLinkedPair();
  await server.connect(st);
  client = new Client({ name: "t", version: "0" });
  await client.connect(ct);
});
afterAll(async () => {
  await client.close();
  await server.close();
  mswServer.close();
});
beforeEach(() => delete process.env.CCX_PROTECT);
afterEach(() => mswServer.resetHandlers());

describe.each([
  {
    tool: "ccx_delete_database",
    args: { datastore_uuid: DS, database_name: "myapp" },
    handler: (onCall: () => void) =>
      http.delete(`${BASE}/api/userdb/api/v1/database/${DS}`, () => { onCall(); return HttpResponse.json({}); }),
  },
  {
    tool: "ccx_apply_parameter_group",
    args: { parameter_group_uuid: PG, datastore_uuid: DS },
    handler: (onCall: () => void) =>
      http.post(`${BASE}/api/db-configuration/v1/parameter-groups/apply/${PG}/${DS}`, () => { onCall(); return HttpResponse.json({ job_id: "j1" }); }),
  },
])("$tool confirm gate", ({ tool, args, handler }) => {
  it("is blocked by protection mode before anything else", async () => {
    let called = false;
    mswServer.use(handler(() => { called = true; }));
    const r = await call(tool, { ...args, confirm: true });
    expect(r.isError).toBe(true);
    expect(r.text).toContain("BLOCKED");
    expect(called).toBe(false);
  });

  it("requires confirm=true even when unprotected", async () => {
    process.env.CCX_PROTECT = "false";
    let called = false;
    mswServer.use(handler(() => { called = true; }));
    const r = await call(tool, { ...args, confirm: false });
    expect(r.isError).toBe(true);
    expect(r.text).toMatch(/'confirm' must be explicitly set to true/);
    expect(called).toBe(false);
  });

  it("rejects a call without the confirm argument", async () => {
    process.env.CCX_PROTECT = "false";
    let called = false;
    mswServer.use(handler(() => { called = true; }));
    const r = await call(tool, args);
    expect(r.isError).toBe(true);
    expect(called).toBe(false);
  });

  it("calls the API when unprotected and confirmed", async () => {
    process.env.CCX_PROTECT = "false";
    let called = false;
    mswServer.use(handler(() => { called = true; }));
    const r = await call(tool, { ...args, confirm: true });
    expect(r.isError).toBe(false);
    expect(called).toBe(true);
  });
});
