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

describe("create_firewall_rule", () => {
  it("creates rule with CIDR and description", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/firewall/api/v1/firewall/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/firewall/api/v1/firewall/${DS_UUID}`, {
      source: "10.0.0.0/24",
      description: "Office network",
    });

    expect(capturedBody).toEqual({
      source: "10.0.0.0/24",
      description: "Office network",
    });
  });

  it("creates rule with CIDR only (empty description)", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/firewall/api/v1/firewall/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/firewall/api/v1/firewall/${DS_UUID}`, {
      source: "192.168.1.0/24",
      description: "",
    });

    expect(capturedBody.source).toBe("192.168.1.0/24");
    expect(capturedBody.description).toBe("");
  });

  it("creates rule with single IP (/32)", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/firewall/api/v1/firewall/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/firewall/api/v1/firewall/${DS_UUID}`, {
      source: "1.2.3.4/32",
      description: "Single host",
    });

    expect(capturedBody.source).toBe("1.2.3.4/32");
  });

  it("creates rule with bare IP (no CIDR prefix)", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/firewall/api/v1/firewall/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/firewall/api/v1/firewall/${DS_UUID}`, {
      source: "5.6.7.8",
      description: "Bare IP",
    });

    expect(capturedBody.source).toBe("5.6.7.8");
  });

  it("creates rule with wide CIDR", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/firewall/api/v1/firewall/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/firewall/api/v1/firewall/${DS_UUID}`, {
      source: "10.0.0.0/8",
      description: "Wide internal network",
    });

    expect(capturedBody.source).toBe("10.0.0.0/8");
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/firewall/api/v1/firewall/${DS_UUID}`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/firewall/api/v1/firewall/${DS_UUID}`, {
      source: "10.0.0.0/24",
      description: "",
    });

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
    expect(capturedHeaders["ccx-owner"]).toBe("user:s1");
    expect(capturedHeaders["content-type"]).toContain("application/json");
  });

  it("sends correct Content-Type header", async () => {
    let capturedContentType = "";

    mswServer.use(
      http.post(`https://test.ccx.dev/api/firewall/api/v1/firewall/${DS_UUID}`, ({ request }) => {
        capturedContentType = request.headers.get("content-type") ?? "";
        return HttpResponse.json({}, { status: 201 });
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/firewall/api/v1/firewall/${DS_UUID}`, {
      source: "10.0.0.0/24",
      description: "",
    });

    expect(capturedContentType).toContain("application/json");
  });

  it("surfaces 404 for nonexistent datastore", async () => {
    mswServer.use(
      http.post("https://test.ccx.dev/api/firewall/api/v1/firewall/nonexistent", () => {
        return HttpResponse.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post("/firewall/api/v1/firewall/nonexistent", {
        source: "10.0.0.0/24",
        description: "",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 400 for invalid CIDR", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/firewall/api/v1/firewall/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "invalid CIDR" }, { status: 400 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/firewall/api/v1/firewall/${DS_UUID}`, {
        source: "not-a-cidr",
        description: "",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(400);
    }
  });

  it("surfaces 409 conflict for duplicate rule", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/firewall/api/v1/firewall/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "rule already exists" }, { status: 409 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/firewall/api/v1/firewall/${DS_UUID}`, {
        source: "10.0.0.0/24",
        description: "Duplicate",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(409);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/firewall/api/v1/firewall/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/firewall/api/v1/firewall/${DS_UUID}`, {
        source: "10.0.0.0/24",
        description: "",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });

  it("surfaces 403 forbidden (subscription check)", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/firewall/api/v1/firewall/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "subscription required" }, { status: 403 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/firewall/api/v1/firewall/${DS_UUID}`, {
        source: "10.0.0.0/24",
        description: "",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(403);
    }
  });
});
