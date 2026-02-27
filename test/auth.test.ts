import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";

const mswServer = setupServer();

beforeEach(() => {
  mswServer.listen({ onUnhandledRequest: "error" });
  process.env.CCX_BASE_URL = "https://test.ccx.dev";
  process.env.CCX_USERNAME = "user@test.com";
  process.env.CCX_PASSWORD = "testpass";
  // Clear any OAuth2 vars
  delete process.env.CCX_CLIENT_ID;
  delete process.env.CCX_CLIENT_SECRET;
});

afterEach(() => {
  mswServer.close();
  mswServer.resetHandlers();
  delete process.env.CCX_BASE_URL;
  delete process.env.CCX_USERNAME;
  delete process.env.CCX_PASSWORD;
});

describe("password auth", () => {
  it("login succeeds and stores session + scope", async () => {
    mswServer.use(
      http.post("https://test.ccx.dev/api/v2/auth/login", () => {
        return HttpResponse.json(
          {
            user: { id: "u1", login: "user@test.com", first_name: "Test", last_name: "User" },
            scopes: [{ id: "scope-1", name: "My Scope", type: "user", role: "admin" }],
          },
          { headers: { "Set-Cookie": "ccx-session=abc123; Path=/; HttpOnly" } },
        );
      }),
    );

    // Fresh import to avoid cached state
    const auth = await import("../src/auth.js");
    auth.clearSession();
    await auth.login();

    const headers = auth.getHeaders();
    expect(headers["Cookie"]).toBe("ccx-session=abc123");
    expect(headers["CCX-Owner"]).toBe("user:scope-1");
  });

  it("login failure throws clear error", async () => {
    mswServer.use(
      http.post("https://test.ccx.dev/api/v2/auth/login", () => {
        return HttpResponse.json({ error: "Invalid credentials" }, { status: 401 });
      }),
    );

    const auth = await import("../src/auth.js");
    auth.clearSession();
    await expect(auth.login()).rejects.toThrow(/Login failed \(401\)/);
  });

  it("clearSession resets all auth state", async () => {
    mswServer.use(
      http.post("https://test.ccx.dev/api/v2/auth/login", () => {
        return HttpResponse.json(
          {
            user: { id: "u1", login: "user@test.com", first_name: "Test", last_name: "User" },
            scopes: [{ id: "scope-1", name: "My Scope", type: "user", role: "admin" }],
          },
          { headers: { "Set-Cookie": "ccx-session=abc123; Path=/; HttpOnly" } },
        );
      }),
    );

    const auth = await import("../src/auth.js");
    auth.clearSession();
    await auth.login();
    expect(auth.getHeaders()["Cookie"]).toBeDefined();

    auth.clearSession();
    const headers = auth.getHeaders();
    expect(headers["Cookie"]).toBeUndefined();
    expect(headers["CCX-Owner"]).toBeUndefined();
    expect(headers["Authorization"]).toBeUndefined();
  });
});

describe("oauth2 auth", () => {
  beforeEach(() => {
    delete process.env.CCX_USERNAME;
    delete process.env.CCX_PASSWORD;
    process.env.CCX_CLIENT_ID = "my-client-id";
    process.env.CCX_CLIENT_SECRET = "my-client-secret";
  });

  afterEach(() => {
    delete process.env.CCX_CLIENT_ID;
    delete process.env.CCX_CLIENT_SECRET;
  });

  it("oauth2 login gets bearer token", async () => {
    mswServer.use(
      http.post("https://test.ccx.dev/api/auth/oauth2/token", () => {
        return HttpResponse.json({
          access_token: "bearer-token-xyz",
          token_type: "bearer",
          expires_in: 14400,
          refresh_token: "refresh-abc",
        });
      }),
      http.get("https://test.ccx.dev/api/v2/auth/check", () => {
        return HttpResponse.json({
          user: { id: "u1", login: "api-user", first_name: "API", last_name: "User" },
          scopes: [{ id: "scope-2", name: "API Scope", type: "org", role: "admin" }],
        });
      }),
    );

    const auth = await import("../src/auth.js");
    auth.clearSession();
    expect(auth.getAuthMethod()).toBe("oauth2");

    await auth.login();

    const headers = auth.getHeaders();
    expect(headers["Authorization"]).toBe("Bearer bearer-token-xyz");
    expect(headers["CCX-Owner"]).toBe("org:scope-2");
    expect(headers["Cookie"]).toBeUndefined();
  });

  it("oauth2 login failure throws clear error", async () => {
    mswServer.use(
      http.post("https://test.ccx.dev/api/auth/oauth2/token", () => {
        return HttpResponse.json({ error: "invalid_client" }, { status: 401 });
      }),
    );

    const auth = await import("../src/auth.js");
    auth.clearSession();
    await expect(auth.login()).rejects.toThrow(/OAuth2 token request failed \(401\)/);
  });
});
