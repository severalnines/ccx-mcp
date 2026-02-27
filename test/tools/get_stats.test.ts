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
  it("fetches cpustat aggregate", async () => {
    const mockCpu = {
      cpu_user: 25.5,
      cpu_system: 10.2,
      cpu_idle: 64.3,
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/cpustat/aggregate`, () => {
        return HttpResponse.json(mockCpu);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/cpustat/aggregate`) as Record<string, number>;

    expect(result.cpu_user).toBe(25.5);
    expect(result.cpu_idle).toBe(64.3);
  });

  it("fetches memorystat aggregate", async () => {
    const mockMem = {
      mem_total: 8589934592,
      mem_used: 4294967296,
      mem_free: 4294967296,
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/memorystat/aggregate`, () => {
        return HttpResponse.json(mockMem);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/memorystat/aggregate`) as Record<string, number>;

    expect(result.mem_total).toBe(8589934592);
  });

  it("fetches diskstat aggregate", async () => {
    const mockDisk = {
      disk_read_bytes: 1048576,
      disk_write_bytes: 2097152,
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/diskstat/aggregate`, () => {
        return HttpResponse.json(mockDisk);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/diskstat/aggregate`) as Record<string, number>;

    expect(result.disk_read_bytes).toBe(1048576);
  });

  it("fetches netstat aggregate", async () => {
    const mockNet = {
      net_rx_bytes: 5000000,
      net_tx_bytes: 3000000,
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/netstat/aggregate`, () => {
        return HttpResponse.json(mockNet);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/netstat/aggregate`) as Record<string, number>;

    expect(result.net_rx_bytes).toBe(5000000);
  });

  it("fetches sqlstat aggregate", async () => {
    const mockSql = {
      queries_per_second: 150.5,
      slow_queries: 3,
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/sqlstat/aggregate`, () => {
        return HttpResponse.json(mockSql);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/sqlstat/aggregate`) as Record<string, number>;

    expect(result.queries_per_second).toBe(150.5);
  });

  it("fetches dbstat aggregate", async () => {
    const mockDb = {
      connections_active: 15,
      connections_total: 100,
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/dbstat/aggregate`, () => {
        return HttpResponse.json(mockDb);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/stat/api/v1/stat/${DS_UUID}/dbstat/aggregate`) as Record<string, number>;

    expect(result.connections_active).toBe(15);
  });

  it("surfaces 404 for nonexistent datastore", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/stat/api/v1/stat/nonexistent/cpustat/aggregate", () => {
        return HttpResponse.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get("/stat/api/v1/stat/nonexistent/cpustat/aggregate");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/cpustat/aggregate`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get(`/stat/api/v1/stat/${DS_UUID}/cpustat/aggregate`);
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.get(`https://test.ccx.dev/api/stat/api/v1/stat/${DS_UUID}/cpustat/aggregate`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({});
      }),
    );

    const { get } = await import("../../src/client.js");
    await get(`/stat/api/v1/stat/${DS_UUID}/cpustat/aggregate`);

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
  });
});
