import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const mswServer = setupServer();

beforeEach(async () => {
  mswServer.listen({ onUnhandledRequest: "error" });
  process.env.CCX_BASE_URL = "https://test.ccx.dev";
  process.env.CCX_USERNAME = "user@test.com";
  process.env.CCX_PASSWORD = "testpass";
  delete process.env.CCX_CLIENT_ID;
  delete process.env.CCX_CLIENT_SECRET;

  // Set up default login handler
  mswServer.use(
    http.post("https://test.ccx.dev/api/v2/auth/login", () => {
      return HttpResponse.json(
        {
          user: { id: "u1", login: "user@test.com", first_name: "Test", last_name: "User" },
          scopes: [{ id: "scope-1", name: "Test", type: "user", role: "admin" }],
        },
        { headers: { "Set-Cookie": "ccx-session=test-session; Path=/; HttpOnly" } },
      );
    }),
  );

  const auth = await import("../src/auth.js");
  auth.clearSession();
  await auth.login();
});

afterEach(() => {
  mswServer.close();
  mswServer.resetHandlers();
  delete process.env.CCX_BASE_URL;
  delete process.env.CCX_USERNAME;
  delete process.env.CCX_PASSWORD;
});

describe("HTTP client", () => {
  it("GET sends correct headers", async () => {
    let capturedHeaders: Record<string, string> = {};

    mswServer.use(
      http.get("https://test.ccx.dev/api/test/path", ({ request }) => {
        capturedHeaders = Object.fromEntries(request.headers.entries());
        return HttpResponse.json({ ok: true });
      }),
    );

    const { get } = await import("../src/client.js");
    await get("/test/path");

    expect(capturedHeaders["cookie"]).toContain("ccx-session=test-session");
    expect(capturedHeaders["ccx-owner"]).toBe("user:scope-1");
  });

  it("GET passes query params", async () => {
    let capturedUrl = "";

    mswServer.use(
      http.get("https://test.ccx.dev/api/test/path", ({ request }) => {
        capturedUrl = request.url;
        return HttpResponse.json({ ok: true });
      }),
    );

    const { get } = await import("../src/client.js");
    await get("/test/path", { page: "1", per_page: "10" });

    expect(capturedUrl).toContain("page=1");
    expect(capturedUrl).toContain("per_page=10");
  });

  it("POST sends body as JSON", async () => {
    let capturedBody: unknown = null;

    mswServer.use(
      http.post("https://test.ccx.dev/api/test/create", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ id: "new-1" }, { status: 201 });
      }),
    );

    const { post } = await import("../src/client.js");
    const result = await post("/test/create", { name: "test-cluster" });

    expect(capturedBody).toEqual({ name: "test-cluster" });
    expect(result).toEqual({ id: "new-1" });
  });

  it("non-2xx throws ApiError with status and path", async () => {
    mswServer.use(
      http.get("https://test.ccx.dev/api/test/fail", () => {
        return HttpResponse.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { get } = await import("../src/client.js");
    const { ApiError } = await import("../src/client.js");

    try {
      await get("/test/fail");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
      expect((e as InstanceType<typeof ApiError>).path).toBe("/test/fail");
    }
  });

  it("401 triggers re-login and retry", async () => {
    let callCount = 0;

    mswServer.use(
      http.get("https://test.ccx.dev/api/test/protected", () => {
        callCount++;
        if (callCount === 1) {
          return HttpResponse.json({ error: "unauthorized" }, { status: 401 });
        }
        return HttpResponse.json({ ok: true });
      }),
    );

    const { get } = await import("../src/client.js");
    const result = await get("/test/protected");

    expect(callCount).toBe(2);
    expect(result).toEqual({ ok: true });
  });
});
