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

describe("list_firewall_rules", () => {
  it("returns list of firewall rules with ports", async () => {
    const rules = [
      {
        source: "10.0.0.0/24",
        description: "Office network",
        ports: [
          { port: "service", port_no: 3306 },
          { port: "node_exporter", port_no: 9100 },
          { port: "mysqld_exporter", port_no: 9104 },
        ],
      },
      {
        source: "192.168.1.100/32",
        description: "Dev machine",
        ports: [
          { port: "service", port_no: 3306 },
          { port: "node_exporter", port_no: 9100 },
          { port: "mysqld_exporter", port_no: 9104 },
        ],
      },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/firewall/api/v1/firewalls/${DS_UUID}`, () => {
        return HttpResponse.json(rules);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/firewall/api/v1/firewalls/${DS_UUID}`) as typeof rules;

    expect(raw).toHaveLength(2);
    expect(raw[0].source).toBe("10.0.0.0/24");
    expect(raw[0].description).toBe("Office network");
    expect(raw[0].ports).toHaveLength(3);
    expect(raw[0].ports[0]).toEqual({ port: "service", port_no: 3306 });
    expect(raw[1].source).toBe("192.168.1.100/32");
    expect(raw[1].description).toBe("Dev machine");
  });

  it("returns empty array when no rules exist", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/firewall/api/v1/firewalls/${DS_UUID}`, () => {
        return HttpResponse.json([]);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/firewall/api/v1/firewalls/${DS_UUID}`);
    expect(raw).toEqual([]);
  });

  it("handles single rule", async () => {
    const rules = [
      {
        source: "0.0.0.0/0",
        description: "Allow all",
        ports: [{ port: "service", port_no: 5432 }],
      },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/firewall/api/v1/firewalls/${DS_UUID}`, () => {
        return HttpResponse.json(rules);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/firewall/api/v1/firewalls/${DS_UUID}`) as typeof rules;

    expect(raw).toHaveLength(1);
    expect(raw[0].source).toBe("0.0.0.0/0");
  });

  it("handles postgres ports", async () => {
    const rules = [
      {
        source: "10.0.0.0/8",
        description: "Internal",
        ports: [
          { port: "service", port_no: 5432 },
          { port: "node_exporter", port_no: 9100 },
          { port: "pg_exporter", port_no: 9187 },
        ],
      },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/firewall/api/v1/firewalls/${DS_UUID}`, () => {
        return HttpResponse.json(rules);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/firewall/api/v1/firewalls/${DS_UUID}`) as typeof rules;

    expect(raw[0].ports.find((p) => p.port === "service")?.port_no).toBe(5432);
  });

  it("handles redis ports", async () => {
    const rules = [
      {
        source: "10.0.0.0/8",
        description: "",
        ports: [
          { port: "service", port_no: 6379 },
          { port: "sentinel", port_no: 26379 },
          { port: "node_exporter", port_no: 9100 },
        ],
      },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/firewall/api/v1/firewalls/${DS_UUID}`, () => {
        return HttpResponse.json(rules);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/firewall/api/v1/firewalls/${DS_UUID}`) as typeof rules;

    expect(raw[0].ports.find((p) => p.port === "service")?.port_no).toBe(6379);
    expect(raw[0].ports.find((p) => p.port === "sentinel")?.port_no).toBe(26379);
  });

  it("handles rules with empty description", async () => {
    const rules = [
      {
        source: "1.2.3.4/32",
        description: "",
        ports: [{ port: "service", port_no: 3306 }],
      },
    ];

    mswServer.use(
      http.get(`https://test.ccx.dev/api/firewall/api/v1/firewalls/${DS_UUID}`, () => {
        return HttpResponse.json(rules);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/firewall/api/v1/firewalls/${DS_UUID}`) as typeof rules;

    expect(raw[0].description).toBe("");
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.get(`https://test.ccx.dev/api/firewall/api/v1/firewalls/${DS_UUID}`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json([]);
      }),
    );

    const { get } = await import("../../src/client.js");
    await get(`/firewall/api/v1/firewalls/${DS_UUID}`);

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
    expect(capturedHeaders["ccx-owner"]).toBe("user:s1");
  });

  it("surfaces 404 for nonexistent datastore", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/firewall/api/v1/firewalls/nonexistent", () => {
        return HttpResponse.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get("/firewall/api/v1/firewalls/nonexistent");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/firewall/api/v1/firewalls/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get(`/firewall/api/v1/firewalls/${DS_UUID}`);
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });

  it("handles many rules", async () => {
    const rules = Array.from({ length: 20 }, (_, i) => ({
      source: `10.0.${i}.0/24`,
      description: `Network ${i}`,
      ports: [{ port: "service", port_no: 3306 }],
    }));

    mswServer.use(
      http.get(`https://test.ccx.dev/api/firewall/api/v1/firewalls/${DS_UUID}`, () => {
        return HttpResponse.json(rules);
      }),
    );

    const { get } = await import("../../src/client.js");
    const raw = await get(`/firewall/api/v1/firewalls/${DS_UUID}`) as typeof rules;

    expect(raw).toHaveLength(20);
    expect(raw[0].source).toBe("10.0.0.0/24");
    expect(raw[19].source).toBe("10.0.19.0/24");
  });
});
