import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { validateUsername } from "../../src/validate.js";

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

describe("create_db_user", () => {
  it("creates user with username and password only", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { user_name: "newuser", grants: "", host_allow: "%", auth_plugin: "caching_sha2_password" },
          { status: 201 },
        );
      }),
    );

    const { post } = await import("../../src/client.js");
    const result = await post(`/userdb/api/v1/user/${DS_UUID}`, {
      database_username: "newuser",
      database_password: "s3cretP@ss",
    });

    expect(capturedBody).toEqual({
      database_username: "newuser",
      database_password: "s3cretP@ss",
    });
    expect(result).toHaveProperty("user_name", "newuser");
  });

  it("creates user with database and privileges", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { user_name: "appuser", grants: "ALL PRIVILEGES", host_allow: "%", auth_plugin: "caching_sha2_password" },
          { status: 201 },
        );
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/userdb/api/v1/user/${DS_UUID}`, {
      database_username: "appuser",
      database_password: "p@ssw0rd",
      database_name: "myappdb",
      database_privileges: "ALL PRIVILEGES",
    });

    expect(capturedBody).toEqual({
      database_username: "appuser",
      database_password: "p@ssw0rd",
      database_name: "myappdb",
      database_privileges: "ALL PRIVILEGES",
    });
  });

  it("creates user with specific host restriction", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { user_name: "restricted", grants: "SELECT", host_allow: "10.0.0.0/24", auth_plugin: "caching_sha2_password" },
          { status: 201 },
        );
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/userdb/api/v1/user/${DS_UUID}`, {
      database_username: "restricted",
      database_password: "pass123",
      database_host: "10.0.0.0/24",
    });

    expect(capturedBody.database_host).toBe("10.0.0.0/24");
  });

  it("creates admin user", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { user_name: "newadmin", grants: "ALL PRIVILEGES,GRANT OPTION", host_allow: "%", auth_plugin: "caching_sha2_password" },
          { status: 201 },
        );
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/userdb/api/v1/user/${DS_UUID}`, {
      database_username: "newadmin",
      database_password: "Adm!nP@ss",
      create_admin_user: true,
    });

    expect(capturedBody.create_admin_user).toBe(true);
  });

  it("creates user with all optional fields", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { user_name: "fulluser", grants: "SELECT,INSERT", host_allow: "192.168.1.0/24", auth_plugin: "caching_sha2_password" },
          { status: 201 },
        );
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/userdb/api/v1/user/${DS_UUID}`, {
      database_username: "fulluser",
      database_password: "FullP@ss",
      database_name: "testdb",
      database_privileges: "SELECT,INSERT",
      database_host: "192.168.1.0/24",
      create_admin_user: false,
    });

    expect(capturedBody).toEqual({
      database_username: "fulluser",
      database_password: "FullP@ss",
      database_name: "testdb",
      database_privileges: "SELECT,INSERT",
      database_host: "192.168.1.0/24",
      create_admin_user: false,
    });
  });

  it("rejects reserved username", () => {
    const err = validateUsername("root");
    expect(err).toContain("reserved");
  });

  it("rejects empty username", () => {
    const err = validateUsername("");
    expect(err).toContain("cannot be empty");
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json(
          { user_name: "test", grants: "", host_allow: "%", auth_plugin: "caching_sha2_password" },
          { status: 201 },
        );
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/userdb/api/v1/user/${DS_UUID}`, {
      database_username: "test",
      database_password: "pass",
    });

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
    expect(capturedHeaders["ccx-owner"]).toBe("user:s1");
    expect(capturedHeaders["content-type"]).toContain("application/json");
  });

  it("surfaces 409 conflict for duplicate user", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "user already exists" }, { status: 409 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/userdb/api/v1/user/${DS_UUID}`, {
        database_username: "existing",
        database_password: "pass",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(409);
    }
  });

  it("surfaces 404 for nonexistent datastore", async () => {
    mswServer.use(
      http.post("https://test.ccx.dev/api/userdb/api/v1/user/nonexistent", () => {
        return HttpResponse.json({ error: "datastore not found" }, { status: 404 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post("/userdb/api/v1/user/nonexistent", {
        database_username: "test",
        database_password: "pass",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 400 for invalid request", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "invalid password: too short" }, { status: 400 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/userdb/api/v1/user/${DS_UUID}`, {
        database_username: "test",
        database_password: "x",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(400);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/userdb/api/v1/user/${DS_UUID}`, {
        database_username: "test",
        database_password: "pass",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });
});
