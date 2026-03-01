import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const mswServer = setupServer(
  http.post("https://test.ccx.dev/api/v2/auth/login", () => {
    return HttpResponse.json(
      {
        user: { id: "u1", login: "test@test.com", first_name: "Test", last_name: "User" },
        scopes: [{ id: "s1", name: "Test", type: "user", role: "admin" }],
      },
      { headers: { "Set-Cookie": "ccx-session=test-session; Path=/" } },
    );
  }),
);

beforeAll(async () => {
  mswServer.listen({ onUnhandledRequest: "error" });
  process.env.CCX_BASE_URL = "https://test.ccx.dev";
  process.env.CCX_USERNAME = "test@test.com";
  process.env.CCX_PASSWORD = "testpass";
  delete process.env.CCX_CLIENT_ID;

  const auth = await import("../../src/auth.js");
  auth.clearSession();
  await auth.login();

});

afterAll(() => {
  mswServer.close();
});

const DS_UUID = "ds-12345-abcde";

describe("list_db_users", () => {
  it("returns list of database users", async () => {
    const users = [
      {
        user_name: "ccxadmin",
        grants: "ALL PRIVILEGES",
        host_allow: "%",
        auth_plugin: "caching_sha2_password",
      },
      {
        user_name: "readonly",
        grants: "SELECT",
        host_allow: "10.0.0.0/24",
        auth_plugin: "caching_sha2_password",
      },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/users/${DS_UUID}`, () => {
        return HttpResponse.json(users);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/userdb/api/v1/users/${DS_UUID}`);
    const result = raw as typeof users;

    expect(result).toHaveLength(2);
    expect(result[0].user_name).toBe("ccxadmin");
    expect(result[0].grants).toBe("ALL PRIVILEGES");
    expect(result[0].host_allow).toBe("%");
    expect(result[0].auth_plugin).toBe("caching_sha2_password");
    expect(result[1].user_name).toBe("readonly");
    expect(result[1].host_allow).toBe("10.0.0.0/24");
  });

  it("returns empty array when no users exist", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/users/${DS_UUID}`, () => {
        return HttpResponse.json([]);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/userdb/api/v1/users/${DS_UUID}`);
    expect(raw).toEqual([]);
  });

  it("handles single user with complex grants", async () => {
    const users = [
      {
        user_name: "ccxadmin",
        grants:
          "SELECT,INSERT,UPDATE,DELETE,CREATE,DROP;ccxdb:ALL PRIVILEGES,GRANT OPTION;mysql:INSERT,UPDATE",
        host_allow: "%",
        auth_plugin: "caching_sha2_password",
      },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/users/${DS_UUID}`, () => {
        return HttpResponse.json(users);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/userdb/api/v1/users/${DS_UUID}`) as typeof users;

    expect(raw).toHaveLength(1);
    expect(raw[0].grants).toContain("ALL PRIVILEGES");
    expect(raw[0].grants).toContain("ccxdb:");
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/users/${DS_UUID}`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json([]);
      }),
    );

    const { get } = await import("../../src/client.js");
    await get(`/userdb/api/v1/users/${DS_UUID}`);

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
    expect(capturedHeaders["ccx-owner"]).toBe("user:s1");
  });

  it("surfaces 404 error for nonexistent datastore", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/userdb/api/v1/users/nonexistent", () => {
        return HttpResponse.json({ error: "datastore not found" }, { status: 404 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get("/userdb/api/v1/users/nonexistent");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/users/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get(`/userdb/api/v1/users/${DS_UUID}`);
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });

  it("handles users with different auth plugins", async () => {
    const users = [
      { user_name: "user1", grants: "SELECT", host_allow: "%", auth_plugin: "mysql_native_password" },
      { user_name: "user2", grants: "SELECT", host_allow: "%", auth_plugin: "caching_sha2_password" },
      { user_name: "user3", grants: "SELECT", host_allow: "%", auth_plugin: "sha256_password" },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/users/${DS_UUID}`, () => {
        return HttpResponse.json(users);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/userdb/api/v1/users/${DS_UUID}`) as typeof users;

    expect(raw).toHaveLength(3);
    expect(raw[0].auth_plugin).toBe("mysql_native_password");
    expect(raw[1].auth_plugin).toBe("caching_sha2_password");
    expect(raw[2].auth_plugin).toBe("sha256_password");
  });

  it("handles users with localhost-only access", async () => {
    const users = [
      { user_name: "monitor", grants: "SELECT,PROCESS", host_allow: "localhost", auth_plugin: "caching_sha2_password" },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/users/${DS_UUID}`, () => {
        return HttpResponse.json(users);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/userdb/api/v1/users/${DS_UUID}`) as typeof users;

    expect(raw[0].host_allow).toBe("localhost");
  });
});
