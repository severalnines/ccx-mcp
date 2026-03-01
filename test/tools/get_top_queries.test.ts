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

describe("get_top_queries", () => {
  it("returns top queries with expected fields", async () => {
    const mockResponse = {
      timestamp: 1740700000,
      data: [
        {
          instance: "node1",
          database: "mydb",
          digest_text: "SELECT * FROM users WHERE id = ?",
          sum_time: 15.5,
          max_time: 2.1,
          min_time: 0.001,
          avg_time: 0.31,
          count_star: 50,
          first_seen: "2026-02-27T00:00:00Z",
          last_seen: "2026-02-27T12:00:00Z",
          affected_rows: 0,
          examined_rows: 500,
          sent_rows: 50,
        },
        {
          instance: "node1",
          database: "mydb",
          digest_text: "UPDATE orders SET status = ? WHERE id = ?",
          sum_time: 8.2,
          max_time: 1.5,
          min_time: 0.01,
          avg_time: 0.164,
          count_star: 50,
          first_seen: "2026-02-27T01:00:00Z",
          last_seen: "2026-02-27T11:00:00Z",
          affected_rows: 50,
          examined_rows: 100,
          sent_rows: 0,
        },
      ],
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/qmon/api/v1/qmon/${DS_UUID}/topqueries`, () => {
        return HttpResponse.json(mockResponse);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/qmon/api/v1/qmon/${DS_UUID}/topqueries`) as { data: unknown[] };

    expect(result.data).toHaveLength(2);
  });

  it("returns empty data when no queries", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/qmon/api/v1/qmon/${DS_UUID}/topqueries`, () => {
        return HttpResponse.json({ timestamp: 1740700000, data: [] });
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/qmon/api/v1/qmon/${DS_UUID}/topqueries`) as { data: unknown[] };

    expect(result.data).toHaveLength(0);
  });

  it("returns null data when monitoring inactive", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/qmon/api/v1/qmon/${DS_UUID}/topqueries`, () => {
        return HttpResponse.json({ timestamp: 0, data: null });
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/qmon/api/v1/qmon/${DS_UUID}/topqueries`) as { data: unknown[] | null };

    expect(result.data).toBeNull();
  });

  it("surfaces 404 for nonexistent datastore", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/qmon/api/v1/qmon/nonexistent/topqueries", () => {
        return HttpResponse.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get("/qmon/api/v1/qmon/nonexistent/topqueries");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/qmon/api/v1/qmon/${DS_UUID}/topqueries`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get(`/qmon/api/v1/qmon/${DS_UUID}/topqueries`);
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.get(`https://test.ccx.dev/api/qmon/api/v1/qmon/${DS_UUID}/topqueries`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({ timestamp: 0, data: [] });
      }),
    );

    const { get } = await import("../../src/client.js");
    await get(`/qmon/api/v1/qmon/${DS_UUID}/topqueries`);

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
  });
});
