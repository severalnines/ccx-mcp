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
});

afterAll(() => {
  mswServer.close();
});

describe("list_datastores", () => {
  it("returns formatted datastore list", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/deployment/v3/data-stores", () => {
        return HttpResponse.json({
          pagination: { page: 1, per_page: 50, total: 1 },
          data_stores: [datastoreFixture],
        });
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get("/deployment/v3/data-stores") as {
      pagination: { total: number };
      data_stores: Array<{ uuid: string; cluster_name: string; cluster_status: string }>;
    };

    expect(raw.pagination.total).toBe(1);
    expect(raw.data_stores).toHaveLength(1);
    expect(raw.data_stores[0].uuid).toBe("ds-12345-abcde");
    expect(raw.data_stores[0].cluster_name).toBe("test-postgres");
    expect(raw.data_stores[0].cluster_status).toBe("created");
  });

  it("handles empty datastore list", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/deployment/v3/data-stores", () => {
        return HttpResponse.json({
          pagination: { page: 1, per_page: 50, total: 0 },
          data_stores: [],
        });
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get("/deployment/v3/data-stores") as {
      data_stores: unknown[];
    };

    expect(raw.data_stores).toHaveLength(0);
  });

  it("API error surfaces correctly", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/deployment/v3/data-stores", () => {
        return HttpResponse.json({ error: "server error" }, { status: 500 });
      }),
    );

    const { get } = await import("../../src/client.js");
    const { ApiError } = await import("../../src/client.js");

    try {
      await get("/deployment/v3/data-stores");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });
});
