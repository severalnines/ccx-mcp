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

  return () => {
    mswServer.close();
    delete process.env.CCX_BASE_URL;
    delete process.env.CCX_USERNAME;
    delete process.env.CCX_PASSWORD;
  };
});

afterAll(() => {
  mswServer.close();
});

const DS_UUID = "ds-12345-abcde";

describe("list_databases", () => {
  it("returns list of databases", async () => {
    const databases = [
      {
        database_name: "ccxdb",
        database_owner: "ccxadmin",
        database_size: 36727242752,
        number_of_tables: 15,
        status: "created",
      },
      {
        database_name: "appdb",
        database_owner: "ccxadmin",
        database_size: 1048576,
        number_of_tables: 3,
        status: "created",
      },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/databases/${DS_UUID}`, () => {
        return HttpResponse.json(databases);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/userdb/api/v1/databases/${DS_UUID}`) as typeof databases;

    expect(raw).toHaveLength(2);
    expect(raw[0].database_name).toBe("ccxdb");
    expect(raw[0].database_owner).toBe("ccxadmin");
    expect(raw[0].database_size).toBe(36727242752);
    expect(raw[0].number_of_tables).toBe(15);
    expect(raw[0].status).toBe("created");
    expect(raw[1].database_name).toBe("appdb");
  });

  it("returns empty array when no databases exist", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/databases/${DS_UUID}`, () => {
        return HttpResponse.json([]);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/userdb/api/v1/databases/${DS_UUID}`);
    expect(raw).toEqual([]);
  });

  it("handles single database", async () => {
    const databases = [
      {
        database_name: "mydb",
        database_owner: "admin",
        database_size: 0,
        number_of_tables: 0,
        status: "created",
      },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/databases/${DS_UUID}`, () => {
        return HttpResponse.json(databases);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/userdb/api/v1/databases/${DS_UUID}`) as typeof databases;

    expect(raw).toHaveLength(1);
    expect(raw[0].database_size).toBe(0);
    expect(raw[0].number_of_tables).toBe(0);
  });

  it("handles database with large size values", async () => {
    const databases = [
      {
        database_name: "bigdb",
        database_owner: "ccxadmin",
        database_size: 1099511627776, // 1 TB
        number_of_tables: 500,
        status: "created",
      },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/databases/${DS_UUID}`, () => {
        return HttpResponse.json(databases);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/userdb/api/v1/databases/${DS_UUID}`) as typeof databases;

    expect(raw[0].database_size).toBe(1099511627776);
    expect(raw[0].number_of_tables).toBe(500);
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/databases/${DS_UUID}`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json([]);
      }),
    );

    const { get } = await import("../../src/client.js");
    await get(`/userdb/api/v1/databases/${DS_UUID}`);

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
    expect(capturedHeaders["ccx-owner"]).toBe("user:s1");
  });

  it("surfaces 404 error for nonexistent datastore", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/userdb/api/v1/databases/nonexistent", () => {
        return HttpResponse.json({ error: "datastore not found" }, { status: 404 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get("/userdb/api/v1/databases/nonexistent");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/databases/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get(`/userdb/api/v1/databases/${DS_UUID}`);
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });

  it("handles multiple databases with different owners", async () => {
    const databases = [
      { database_name: "db1", database_owner: "ccxadmin", database_size: 100, number_of_tables: 1, status: "created" },
      { database_name: "db2", database_owner: "appuser", database_size: 200, number_of_tables: 2, status: "created" },
      { database_name: "db3", database_owner: "readonly", database_size: 300, number_of_tables: 3, status: "created" },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/userdb/api/v1/databases/${DS_UUID}`, () => {
        return HttpResponse.json(databases);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/userdb/api/v1/databases/${DS_UUID}`) as typeof databases;

    expect(raw).toHaveLength(3);
    expect(raw.map((d) => d.database_owner)).toEqual(["ccxadmin", "appuser", "readonly"]);
  });
});
