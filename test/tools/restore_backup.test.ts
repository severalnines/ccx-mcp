import { describe, it, expect, beforeAll, afterAll, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import { isProtected, protectedError } from "../../src/protect.js";

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
const BACKUP_ID = "backup-001";

describe("restore_backup protection mode", () => {
  afterEach(() => {
    delete process.env.CCX_PROTECT;
  });

  it("blocks operation when protection mode is on (default)", async () => {
    delete process.env.CCX_PROTECT;
    expect(isProtected()).toBe(true);
    const result = protectedError("Restore backup");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Restore backup");
    expect(result.content[0].text).toContain("BLOCKED");
  });

  it("allows operation when CCX_PROTECT=false", () => {
    process.env.CCX_PROTECT = "false";
    expect(isProtected()).toBe(false);
  });
});

describe("restore_backup", () => {
  it("sends POST to restore endpoint", async () => {
    let postCalled = false;

    mswServer.use(
      http.post(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, () => {
        postCalled = true;
        return HttpResponse.json({ status: "restoring" }, { status: 200 });
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, {});

    expect(postCalled).toBe(true);
  });

  it("sends PITR stop time in body", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "restoring" }, { status: 200 });
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, {
      pitr_stop_time: "2026-02-27T15:00:00Z",
    });

    expect(capturedBody.pitr_stop_time).toBe("2026-02-27T15:00:00Z");
  });

  it("sends empty body when no PITR time", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({ status: "restoring" }, { status: 200 });
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, {});

    expect(capturedBody).toEqual({});
  });

  it("surfaces 404 for nonexistent backup", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}/nonexistent/restore`, () => {
        return HttpResponse.json({ error: "backup not found" }, { status: 404 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/backup/api/v1/backups/${DS_UUID}/nonexistent/restore`, {});
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 409 when job already running", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, () => {
        return HttpResponse.json({ error: "job in progress" }, { status: 409 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, {});
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(409);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.post(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { post, ApiError } = await import("../../src/client.js");

    try {
      await post(`/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, {});
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.post(`https://test.ccx.dev/api/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({ status: "restoring" }, { status: 200 });
      }),
    );

    const { post } = await import("../../src/client.js");
    await post(`/backup/api/v1/backups/${DS_UUID}/${BACKUP_ID}/restore`, {});

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
    expect(capturedHeaders["content-type"]).toContain("application/json");
  });
});
