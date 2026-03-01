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

describe("add_node", () => {
  it("sends PATCH with add_nodes and empty spec (defaults)", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.patch(`https://test.ccx.dev/api/prov/api/v2/cluster/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const { patch } = await import("../../src/client.js");
    await patch(`/prov/api/v2/cluster/${DS_UUID}`, {
      add_nodes: { specs: [{}] },
    });

    expect(capturedBody).toEqual({
      add_nodes: { specs: [{}] },
    });
  });

  it("sends PATCH with specific instance_size", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.patch(`https://test.ccx.dev/api/prov/api/v2/cluster/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const { patch } = await import("../../src/client.js");
    await patch(`/prov/api/v2/cluster/${DS_UUID}`, {
      add_nodes: { specs: [{ instance_size: "v1-small-1" }] },
    });

    expect(capturedBody).toEqual({
      add_nodes: { specs: [{ instance_size: "v1-small-1" }] },
    });
  });

  it("sends PATCH with instance_size and availability_zone", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.patch(`https://test.ccx.dev/api/prov/api/v2/cluster/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const { patch } = await import("../../src/client.js");
    await patch(`/prov/api/v2/cluster/${DS_UUID}`, {
      add_nodes: { specs: [{ instance_size: "v1-small-1", availability_zone: "se-sto-1a" }] },
    });

    expect(capturedBody).toEqual({
      add_nodes: { specs: [{ instance_size: "v1-small-1", availability_zone: "se-sto-1a" }] },
    });
  });

  it("surfaces 404 for nonexistent datastore", async () => {
    mswServer.use(
      http.patch("https://test.ccx.dev/api/prov/api/v2/cluster/nonexistent", () => {
        return HttpResponse.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { patch, ApiError } = await import("../../src/client.js");

    try {
      await patch("/prov/api/v2/cluster/nonexistent", {
        add_nodes: { specs: [{}] },
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 409 when job already running", async () => {
    mswServer.use(
      http.patch(`https://test.ccx.dev/api/prov/api/v2/cluster/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "job in progress" }, { status: 409 });
      }),
    );

    const { patch, ApiError } = await import("../../src/client.js");

    try {
      await patch(`/prov/api/v2/cluster/${DS_UUID}`, {
        add_nodes: { specs: [{}] },
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(409);
    }
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.patch(`https://test.ccx.dev/api/prov/api/v2/cluster/${DS_UUID}`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const { patch } = await import("../../src/client.js");
    await patch(`/prov/api/v2/cluster/${DS_UUID}`, {
      add_nodes: { specs: [{}] },
    });

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
    expect(capturedHeaders["content-type"]).toContain("application/json");
  });
});
