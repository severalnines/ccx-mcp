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

describe("get_stats", () => {
  it("fetches cpuUsage aggregate", async () => {
    const mockCpu = {
      all: [{ idle: 64.3, user: 25.5, system: 10.2 }],
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/cpuUsage/aggregate`, () => {
        return HttpResponse.json(mockCpu);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/cpuUsage/aggregate`) as Record<string, unknown>;

    expect(result.all).toBeDefined();
  });

  it("fetches ramUsage aggregate", async () => {
    const mockMem = {
      all: [{ total: 8589934592, used: 4294967296, free: 4294967296 }],
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/ramUsage/aggregate`, () => {
        return HttpResponse.json(mockMem);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/ramUsage/aggregate`) as Record<string, unknown>;

    expect(result.all).toBeDefined();
  });

  it("fetches loadAverage aggregate", async () => {
    const mockLoad = {
      all: [{ loadavg1: 0.5, loadavg5: 0.8, loadavg15: 0.9 }],
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/loadAverage/aggregate`, () => {
        return HttpResponse.json(mockLoad);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/loadAverage/aggregate`) as Record<string, unknown>;

    expect(result.all).toBeDefined();
  });

  it("fetches diskSpaceUsage aggregate", async () => {
    const mockDisk = {
      all: [{ available: 50000000000, used: 30000000000 }],
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/diskSpaceUsage/aggregate`, () => {
        return HttpResponse.json(mockDisk);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/diskSpaceUsage/aggregate`) as Record<string, unknown>;

    expect(result.all).toBeDefined();
  });

  it("fetches networkUsage aggregate", async () => {
    const mockNet = {
      all: [{ transmit_bytes: 5000000, receive_bytes: 3000000 }],
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/networkUsage/aggregate`, () => {
        return HttpResponse.json(mockNet);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/networkUsage/aggregate`) as Record<string, unknown>;

    expect(result.all).toBeDefined();
  });

  it("fetches mySqlDbConnections (vendor-specific)", async () => {
    const mockConns = {
      all: [{ thread_connected: 15, max_connections: 100 }],
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/mySqlDbConnections/aggregate`, () => {
        return HttpResponse.json(mockConns);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/mySqlDbConnections/aggregate`) as Record<string, unknown>;

    expect(result.all).toBeDefined();
  });

  it("surfaces 404 for nonexistent datastore", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/stat/api/v1/stat/nonexistent/cpuUsage/aggregate", () => {
        return HttpResponse.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get("/stat/api/v1/stat/nonexistent/cpuUsage/aggregate");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/cpuUsage/aggregate`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get(`/stat/api/v1/stat/${DS_UUID}/cpuUsage/aggregate`);
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/cpuUsage/aggregate`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({});
      }),
    );

    const { get } = await import("../../src/client.js");
    await get(`/stat/api/v1/stat/${DS_UUID}/cpuUsage/aggregate`);

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
  });
});
