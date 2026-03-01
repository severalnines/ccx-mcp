import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { validateDatabaseName } from "../../src/validate.js";

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

describe("create_database", () => {
  it("creates database with given name", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/database/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          {
            database_name: "myapp",
            database_owner: "ccxadmin",
            database_size: 0,
            number_of_tables: 0,
            status: "created",
          },
          { status: 201 },
        );
      }),
    );

    const { post } = await import("../../src/client.js");
    const result = await post(`/userdb/api/v1/database/${DS_UUID}`, {
      database_name: "myapp",
    }) as Record<string, unknown>;

    expect(capturedBody).toEqual({ database_name: "myapp" });
    expect(result.database_name).toBe("myapp");
    expect(result.database_owner).toBe("ccxadmin");
    expect(result.database_size).toBe(0);
    expect(result.status).toBe("created");
  });

  it("sends only database_name in request body", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/database/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { database_name: "testdb", database_owner: "ccxadmin", database_size: 0, number_of_tables: 0, status: "created" },
          { status: 201 },
        );
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/userdb/api/v1/database/${DS_UUID}`, { database_name: "testdb" });

    expect(Object.keys(capturedBody)).toEqual(["database_name"]);
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/database/${DS_UUID}`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json(
          { database_name: "test", database_owner: "ccxadmin", database_size: 0, number_of_tables: 0, status: "created" },
          { status: 201 },
        );
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/userdb/api/v1/database/${DS_UUID}`, { database_name: "test" });

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
    expect(capturedHeaders["ccx-owner"]).toBe("user:s1");
    expect(capturedHeaders["content-type"]).toContain("application/json");
  });

  it("surfaces 409 conflict for duplicate database", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/database/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "database already exists" }, { status: 409 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/userdb/api/v1/database/${DS_UUID}`, { database_name: "existing" });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(409);
    }
  });

  it("surfaces 404 for nonexistent datastore", async () => {
    mswServer.use(
      http.post("https://test.ccx.dev/api/userdb/api/v1/database/nonexistent", () => {
        return HttpResponse.json({ error: "datastore not found" }, { status: 404 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post("/userdb/api/v1/database/nonexistent", { database_name: "test" });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 400 for invalid database name", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/database/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "invalid database name" }, { status: 400 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/userdb/api/v1/database/${DS_UUID}`, { database_name: "invalid name!" });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(400);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/database/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/userdb/api/v1/database/${DS_UUID}`, { database_name: "test" });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });

  it("rejects reserved database name", () => {
    const err = validateDatabaseName("mysql");
    expect(err).toContain("reserved");
  });

  it("rejects empty database name", () => {
    const err = validateDatabaseName("");
    expect(err).toContain("cannot be empty");
  });

  it("handles database name with underscores and numbers", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/userdb/api/v1/database/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json(
          { database_name: "my_app_db_v2", database_owner: "ccxadmin", database_size: 0, number_of_tables: 0, status: "created" },
          { status: 201 },
        );
      }),
    );

    const { post } = await import("../../src/client.js");
    const result = await post(`/userdb/api/v1/database/${DS_UUID}`, {
      database_name: "my_app_db_v2",
    }) as Record<string, unknown>;

    expect(capturedBody.database_name).toBe("my_app_db_v2");
    expect(result.database_name).toBe("my_app_db_v2");
  });
});
