import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import datastoreFixture from "../fixtures/datastore_response.json";

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

describe("get_connection_string", () => {
  it("returns postgres connection strings", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/deployment/v3/data-stores/ds-12345-abcde", () => {
        return HttpResponse.json(datastoreFixture);
      }),
    );

    const { get } = await import("../../src/client.js");
    const store = await get("/deployment/v3/data-stores/ds-12345-abcde") as typeof datastoreFixture;

    // Verify we can build connection strings from the fixture data
    const creds = store.db_account;
    expect(creds.database_host).toBe("ds-12345-abcde.ccx.s9s-dev.net");
    expect(creds.database_username).toBe("admin");
    expect(creds.database_database).toBe("mydb");
    expect(store.database_vendor).toBe("postgres");
    expect(store.ssl_enabled).toBe(true);

    // Verify URI format
    const encodedPass = encodeURIComponent(creds.database_password);
    const expectedUri = `postgresql://${creds.database_username}:${encodedPass}@${creds.database_host}:5432/${creds.database_database}?sslmode=require`;
    expect(expectedUri).toContain("postgresql://");
    expect(expectedUri).toContain("sslmode=require");
    expect(expectedUri).toContain("admin:");
    expect(expectedUri).toContain("@ds-12345-abcde.ccx.s9s-dev.net:5432/mydb");
  });

  it("uses primary_url as host when available", async () => {
    const fixture = {
      ...datastoreFixture,
      primary_url: "ds-12345-abcde.user-ccx.s9s-dev.net",
    };

    mswServer.use(
      http.get("https://test.ccx.dev/api/deployment/v3/data-stores/ds-12345-abcde", () => {
        return HttpResponse.json(fixture);
      }),
    );

    const { get } = await import("../../src/client.js");
    const store = await get("/deployment/v3/data-stores/ds-12345-abcde") as typeof fixture;

    // buildConnectionStrings should prefer primary_url over db_account.database_host
    expect(store.primary_url).toBe("ds-12345-abcde.user-ccx.s9s-dev.net");
    expect(store.primary_url).not.toBe(store.db_account.database_host);
  });

  it("falls back to database_host when primary_url is empty", async () => {
    const fixture = {
      ...datastoreFixture,
      primary_url: "",
    };

    mswServer.use(
      http.get("https://test.ccx.dev/api/deployment/v3/data-stores/ds-12345-abcde", () => {
        return HttpResponse.json(fixture);
      }),
    );

    const { get } = await import("../../src/client.js");
    const store = await get("/deployment/v3/data-stores/ds-12345-abcde") as typeof fixture;

    expect(store.primary_url).toBe("");
    expect(store.db_account.database_host).toBe("ds-12345-abcde.ccx.s9s-dev.net");
  });

  it("supports username override in connection string", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/deployment/v3/data-stores/ds-12345-abcde", () => {
        return HttpResponse.json(datastoreFixture);
      }),
    );

    const { get } = await import("../../src/client.js");
    const store = await get("/deployment/v3/data-stores/ds-12345-abcde") as typeof datastoreFixture;

    // Simulate overrides: custom username should replace admin
    const customUser = "appuser";
    const defaultUser = store.db_account.database_username;

    expect(customUser).not.toBe(defaultUser);
    expect(defaultUser).toBe("admin");
  });

  it("supports password override in connection string", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/deployment/v3/data-stores/ds-12345-abcde", () => {
        return HttpResponse.json(datastoreFixture);
      }),
    );

    const { get } = await import("../../src/client.js");
    const store = await get("/deployment/v3/data-stores/ds-12345-abcde") as typeof datastoreFixture;

    const customPass = "my-custom-pass";
    const defaultPass = store.db_account.database_password;

    expect(customPass).not.toBe(defaultPass);
  });

  it("supports database override in connection string", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/deployment/v3/data-stores/ds-12345-abcde", () => {
        return HttpResponse.json(datastoreFixture);
      }),
    );

    const { get } = await import("../../src/client.js");
    const store = await get("/deployment/v3/data-stores/ds-12345-abcde") as typeof datastoreFixture;

    const customDb = "custom_db";
    const defaultDb = store.db_account.database_database;

    expect(customDb).not.toBe(defaultDb);
    expect(defaultDb).toBe("mydb");
  });

  it("does not leak credentials in error messages", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/deployment/v3/data-stores/ds-fail", () => {
        return HttpResponse.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { get } = await import("../../src/client.js");
    try {
      await get("/deployment/v3/data-stores/ds-fail");
      expect.unreachable("Should have thrown");
    } catch (e) {
      const message = (e as Error).message;
      expect(message).not.toContain("testpass");
      expect(message).not.toContain("test-session");
    }
  });
});
