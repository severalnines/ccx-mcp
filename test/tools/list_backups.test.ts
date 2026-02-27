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

describe("list_backups", () => {
  it("returns backups list", async () => {
    const mockBackups = {
      total: 2,
      backups: [
        {
          backup_id: "b1",
          parent_id: "",
          backup_method: "pg_basebackup",
          backup_type: "full",
          status: "completed",
          size: 1073741824,
          started_at: "2026-02-27T01:00:00Z",
          ended_at: "2026-02-27T01:15:00Z",
        },
        {
          backup_id: "b2",
          parent_id: "b1",
          backup_method: "pg_basebackup",
          backup_type: "incremental",
          status: "completed",
          size: 104857600,
          started_at: "2026-02-27T02:00:00Z",
          ended_at: "2026-02-27T02:05:00Z",
        },
      ],
    };

    mswServer.use(
      http.get(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}`, () => {
        return HttpResponse.json(mockBackups);
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/backup/api/v1/backups/${DS_UUID}`) as { total: number; backups: unknown[] };

    expect(result.total).toBe(2);
    expect(result.backups).toHaveLength(2);
  });

  it("returns empty backups array", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}`, () => {
        return HttpResponse.json({ total: 0, backups: [] });
      }),
    );

    const { get } = await import("../../src/client.js");
    const result = await get(`/backup/api/v1/backups/${DS_UUID}`) as { total: number; backups: unknown[] };

    expect(result.total).toBe(0);
    expect(result.backups).toHaveLength(0);
  });

  it("passes query params for pagination", async () => {
    let capturedUrl = "";

    mswServer.use(
      http.get(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}`, ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ total: 0, backups: [] });
      }),
    );

    const { get } = await import("../../src/client.js");
    await get(`/backup/api/v1/backups/${DS_UUID}`, { limit: "5", offset: "10" });

    const url = new URL(capturedUrl);
    expect(url.searchParams.get("limit")).toBe("5");
    expect(url.searchParams.get("offset")).toBe("10");
  });

  it("surfaces 404 for nonexistent datastore", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/backup/api/v1/backups/nonexistent", () => {
        return HttpResponse.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get("/backup/api/v1/backups/nonexistent");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.get(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { get, ApiError } = await import("../../src/client.js");

    try {
      await get(`/backup/api/v1/backups/${DS_UUID}`);
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.get(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({ total: 0, backups: [] });
      }),
    );

    const { get } = await import("../../src/client.js");
    await get(`/backup/api/v1/backups/${DS_UUID}`);

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
  });
});
