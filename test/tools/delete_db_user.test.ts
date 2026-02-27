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

describe("delete_db_user", () => {
  it("sends DELETE with username and default host", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.delete(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const { del } = await import("../../src/client.js");
    await del(`/userdb/api/v1/user/${DS_UUID}`, {
      database_username: "testuser",
      database_host: "%",
    });

    expect(capturedBody).toEqual({
      database_username: "testuser",
      database_host: "%",
    });
  });

  it("sends DELETE with specific host", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.delete(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const { del } = await import("../../src/client.js");
    await del(`/userdb/api/v1/user/${DS_UUID}`, {
      database_username: "myuser",
      database_host: "localhost",
    });

    expect(capturedBody.database_host).toBe("localhost");
  });

  it("surfaces 404 for nonexistent user", async () => {
    mswServer.use(
      http.delete(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "user not found" }, { status: 404 });
      }),
    );

    const { del, ApiError } = await import("../../src/client.js");

    try {
      await del(`/userdb/api/v1/user/${DS_UUID}`, {
        database_username: "ghost",
        database_host: "%",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 403 for permission denied", async () => {
    mswServer.use(
      http.delete(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "forbidden" }, { status: 403 });
      }),
    );

    const { del, ApiError } = await import("../../src/client.js");

    try {
      await del(`/userdb/api/v1/user/${DS_UUID}`, {
        database_username: "admin",
        database_host: "%",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(403);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.delete(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { del, ApiError } = await import("../../src/client.js");

    try {
      await del(`/userdb/api/v1/user/${DS_UUID}`, {
        database_username: "testuser",
        database_host: "%",
      });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });

  it("sends correct auth headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.delete(`https://test.ccx.dev/api/userdb/api/v1/user/${DS_UUID}`, ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const { del } = await import("../../src/client.js");
    await del(`/userdb/api/v1/user/${DS_UUID}`, {
      database_username: "testuser",
      database_host: "%",
    });

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
    expect(capturedHeaders["content-type"]).toContain("application/json");
  });
});
