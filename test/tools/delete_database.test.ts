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

describe("delete_database protection mode", () => {
  afterEach(() => {
    delete process.env.CCX_PROTECT;
  });

  it("blocks operation when protection mode is on (default)", () => {
    delete process.env.CCX_PROTECT;
    expect(isProtected()).toBe(true);
    const result = protectedError("Delete database");
    expect(result.isError).toBe(true);
    expect(result.content[0].text).toContain("Delete database");
    expect(result.content[0].text).toContain("BLOCKED");
  });

  it("allows operation when CCX_PROTECT=false", () => {
    process.env.CCX_PROTECT = "false";
    expect(isProtected()).toBe(false);
  });
});

describe("delete_database", () => {
  it("calls DELETE with correct body", async () => {
    let capturedBody: Record<string, unknown> = {};

    mswServer.use(
      http.delete(`https://test.ccx.dev/api/userdb/api/v1/database/${DS_UUID}`, async ({ request }) => {
        capturedBody = (await request.json()) as Record<string, unknown>;
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const { del } = await import("../../src/client.js");
    await del(`/userdb/api/v1/database/${DS_UUID}`, { database_name: "myapp" });

    expect(capturedBody).toEqual({ database_name: "myapp" });
  });

  it("surfaces 404 for nonexistent database", async () => {
    mswServer.use(
      http.delete(`https://test.ccx.dev/api/userdb/api/v1/database/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "database not found" }, { status: 404 });
      }),
    );

    const { del, ApiError } = await import("../../src/client.js");

    try {
      await del(`/userdb/api/v1/database/${DS_UUID}`, { database_name: "nonexistent" });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });

  it("surfaces 500 server error", async () => {
    mswServer.use(
      http.delete(`https://test.ccx.dev/api/userdb/api/v1/database/${DS_UUID}`, () => {
        return HttpResponse.json({ error: "internal error" }, { status: 500 });
      }),
    );

    const { del, ApiError } = await import("../../src/client.js");

    try {
      await del(`/userdb/api/v1/database/${DS_UUID}`, { database_name: "myapp" });
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(500);
    }
  });
});
