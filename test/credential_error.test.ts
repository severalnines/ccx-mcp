import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import wizardFixture from "./fixtures/wizard_response.json";

const BASE = "https://test.ccx.dev";
const CREDENTIAL_MESSAGE =
  "CCX credential expired, revoked or invalid. Generate a new one at https://test.ccx.dev/settings/credentials";

const mswServer = setupServer();

let tokenRequests = 0;

// Shape returned by the token endpoint on staging, for valid and revoked clients alike.
function tokenHandler(accessToken: string, expiresIn = 14400) {
  return http.post(`${BASE}/api/auth/oauth2/token`, () => {
    tokenRequests++;
    return HttpResponse.json({
      access_token: accessToken,
      expires_in: expiresIn,
      refresh_token: "refresh-token",
      token_type: "Bearer",
    });
  });
}

const checkHandler = http.get(`${BASE}/api/v2/auth/check`, () => {
  return HttpResponse.json({
    user: { id: "u1", login: "api-user", first_name: "API", last_name: "User" },
    scopes: [{ id: "scope-2", name: "API Scope", type: "org", role: "admin" }],
  });
});

// Body returned on staging by an API call made with a revoked client's token.
const unauthorizedBody = { code: 401, error: "unauthorized" };

beforeEach(async () => {
  mswServer.listen({ onUnhandledRequest: "error" });
  tokenRequests = 0;
  process.env.CCX_BASE_URL = "https://test.ccx.dev/";
  process.env.CCX_CLIENT_ID = "my-client-id";
  process.env.CCX_CLIENT_SECRET = "my-client-secret";
  delete process.env.CCX_USERNAME;
  delete process.env.CCX_PASSWORD;

  const auth = await import("../src/auth.js");
  auth.clearSession();
});

afterEach(() => {
  mswServer.close();
  mswServer.resetHandlers();
  delete process.env.CCX_BASE_URL;
  delete process.env.CCX_CLIENT_ID;
  delete process.env.CCX_CLIENT_SECRET;
  delete process.env.CCX_USERNAME;
  delete process.env.CCX_PASSWORD;
});

describe("revoked credential", () => {
  it("API 401 retries the token exchange once, then fails with the credential message", async () => {
    let apiCalls = 0;
    mswServer.use(
      tokenHandler("revoked-token"),
      http.get(`${BASE}/api/v2/auth/check`, () => HttpResponse.json(unauthorizedBody, { status: 401 })),
      http.get(`${BASE}/api/test/protected`, () => {
        apiCalls++;
        return HttpResponse.json(unauthorizedBody, { status: 401 });
      }),
    );

    const auth = await import("../src/auth.js");
    await auth.login();
    const { get } = await import("../src/client.js");

    await expect(get("/test/protected")).rejects.toThrow(CREDENTIAL_MESSAGE);
    expect(apiCalls).toBe(2);
    expect(tokenRequests).toBe(2);
  });

  it("the startup deploy-wizard load fails with the credential message", async () => {
    mswServer.use(
      tokenHandler("revoked-token"),
      http.get(`${BASE}/api/v2/auth/check`, () => HttpResponse.json(unauthorizedBody, { status: 401 })),
      http.get(`${BASE}/api/content/api/v1/deploy-wizard`, () =>
        HttpResponse.json(unauthorizedBody, { status: 401 }),
      ),
    );

    const auth = await import("../src/auth.js");
    await auth.login();
    const wizard = await import("../src/wizard.js");

    await expect(wizard.load()).rejects.toThrow(CREDENTIAL_MESSAGE);
  });
});

describe("rejected token request", () => {
  it("a 4xx from the token endpoint gives the credential message", async () => {
    // Expired clients are rejected with a 400 whose body has not been observed.
    mswServer.use(
      http.post(`${BASE}/api/auth/oauth2/token`, () => new HttpResponse(null, { status: 400 })),
    );

    const auth = await import("../src/auth.js");
    await expect(auth.login()).rejects.toThrow(CREDENTIAL_MESSAGE);
  });

  it("a wrong secret gives the credential message", async () => {
    // Response observed on staging for a known client id with a wrong secret.
    mswServer.use(
      http.post(`${BASE}/api/auth/oauth2/token`, () =>
        HttpResponse.json(
          { error: "invalid_client", error_description: "Client authentication failed" },
          { status: 401 },
        ),
      ),
    );

    const auth = await import("../src/auth.js");
    await expect(auth.login()).rejects.toThrow(CREDENTIAL_MESSAGE);
  });
});

describe("endpoint failures stay distinct", () => {
  it("a 5xx from the token endpoint reports the endpoint, not the credential", async () => {
    mswServer.use(
      http.post(`${BASE}/api/auth/oauth2/token`, () =>
        HttpResponse.json({ error: "server_error" }, { status: 503 }),
      ),
    );

    const auth = await import("../src/auth.js");
    const error = await auth.login().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(auth.EndpointError);
    expect((error as Error).message).toMatch(
      /^CCX endpoint unreachable or failing at https:\/\/test\.ccx\.dev: token request returned 503/,
    );
    expect((error as Error).message).not.toContain("credential");
  });

  it("a network error on the token request reports the endpoint", async () => {
    mswServer.use(http.post(`${BASE}/api/auth/oauth2/token`, () => HttpResponse.error()));

    const auth = await import("../src/auth.js");
    const error = await auth.login().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(auth.EndpointError);
    expect((error as Error).message).toMatch(/^CCX endpoint unreachable or failing at https:\/\/test\.ccx\.dev: /);
  });

  it("a network error on an API call reports the endpoint", async () => {
    mswServer.use(
      tokenHandler("valid-token"),
      checkHandler,
      http.get(`${BASE}/api/test/path`, () => HttpResponse.error()),
    );

    const auth = await import("../src/auth.js");
    await auth.login();
    const { get } = await import("../src/client.js");

    const error = await get("/test/path").catch((e: unknown) => e);
    expect(error).toBeInstanceOf(auth.EndpointError);
  });
});

describe("valid credential", () => {
  it("an expired access token is renewed before the call", async () => {
    const seenTokens: string[] = [];
    let issued = 0;
    mswServer.use(
      http.post(`${BASE}/api/auth/oauth2/token`, () => {
        tokenRequests++;
        issued++;
        // The first token is already inside the 60s safety buffer, so it counts as expired.
        return HttpResponse.json({
          access_token: `token-${issued}`,
          expires_in: issued === 1 ? 30 : 14400,
          refresh_token: "refresh-token",
          token_type: "Bearer",
        });
      }),
      checkHandler,
      http.get(`${BASE}/api/test/path`, ({ request }) => {
        seenTokens.push(request.headers.get("authorization") ?? "");
        return HttpResponse.json({ ok: true });
      }),
    );

    const auth = await import("../src/auth.js");
    await auth.login();
    const { get } = await import("../src/client.js");

    expect(await get("/test/path")).toEqual({ ok: true });
    expect(tokenRequests).toBe(2);
    expect(seenTokens).toEqual(["Bearer token-2"]);
  });

  it("a single 401 is recovered by a fresh token", async () => {
    let apiCalls = 0;
    mswServer.use(
      tokenHandler("valid-token"),
      checkHandler,
      http.get(`${BASE}/api/content/api/v1/deploy-wizard`, () => {
        apiCalls++;
        if (apiCalls === 1) {
          return HttpResponse.json(unauthorizedBody, { status: 401 });
        }
        return HttpResponse.json(wizardFixture);
      }),
    );

    const auth = await import("../src/auth.js");
    await auth.login();
    const wizard = await import("../src/wizard.js");

    await wizard.load();
    expect(wizard.getWizard()).toBeDefined();
    expect(apiCalls).toBe(2);
    expect(tokenRequests).toBe(2);
  });
});

describe("password auth", () => {
  beforeEach(() => {
    delete process.env.CCX_CLIENT_ID;
    delete process.env.CCX_CLIENT_SECRET;
    process.env.CCX_USERNAME = "user@test.com";
    process.env.CCX_PASSWORD = "wrong";
  });

  it("a rejected login says so without pointing at the credentials page", async () => {
    mswServer.use(
      http.post(`${BASE}/api/v2/auth/login`, () =>
        HttpResponse.json({ error: "Invalid credentials" }, { status: 401 }),
      ),
    );

    const auth = await import("../src/auth.js");
    const error = await auth.login().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(auth.CredentialError);
    expect((error as Error).message).toMatch(/^CCX login rejected: .*CCX_USERNAME and CCX_PASSWORD/);
    expect((error as Error).message).not.toContain("/settings/credentials");
  });

  it("a 5xx from the login endpoint reports the endpoint", async () => {
    mswServer.use(
      http.post(`${BASE}/api/v2/auth/login`, () => new HttpResponse("bad gateway", { status: 502 })),
    );

    const auth = await import("../src/auth.js");
    const error = await auth.login().catch((e: unknown) => e);
    expect(error).toBeInstanceOf(auth.EndpointError);
    expect((error as Error).message).toContain("login request returned 502: bad gateway");
  });
});
