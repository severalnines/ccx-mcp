import type { LoginResponse, Scope } from "./types.js";

// Session-based auth state (password login)
let sessionCookie: string | null = null;
let ownerHeader: string | null = null;
let activeScope: Scope | null = null;

// OAuth2 auth state (client credentials)
let accessToken: string | null = null;
let tokenExpiresAt: number | null = null;

type AuthMethod = "password" | "oauth2";

function getEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function getOptionalEnv(name: string): string | undefined {
  return process.env[name] || undefined;
}

export function getAuthMethod(): AuthMethod {
  return getOptionalEnv("CCX_CLIENT_ID") ? "oauth2" : "password";
}

export function getBaseUrl(): string {
  return getEnv("CCX_BASE_URL").replace(/\/+$/, "");
}

export async function login(): Promise<void> {
  if (getAuthMethod() === "oauth2") {
    await loginOAuth2();
  } else {
    await loginPassword();
  }
}

async function loginPassword(): Promise<void> {
  const baseUrl = getBaseUrl();
  const loginUrl = `${baseUrl}/api/v2/auth/login`;

  const response = await fetch(loginUrl, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      login: getEnv("CCX_USERNAME"),
      password: getEnv("CCX_PASSWORD"),
    }),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `Login failed (${response.status}): ${text || response.statusText}`,
    );
  }

  // Extract session cookie from set-cookie header
  const setCookies = response.headers.getSetCookie?.() ?? [];
  for (const cookie of setCookies) {
    const match = cookie.match(/ccx-session=([^;]+)/);
    if (match) {
      sessionCookie = match[1];
      break;
    }
  }

  // Fallback: try raw header if getSetCookie is unavailable
  if (!sessionCookie) {
    const raw = response.headers.get("set-cookie") ?? "";
    const match = raw.match(/ccx-session=([^;]+)/);
    if (match) {
      sessionCookie = match[1];
    }
  }

  if (!sessionCookie) {
    throw new Error("Login succeeded but no ccx-session cookie was returned");
  }

  // Extract scope for CCX-Owner header
  const data = (await response.json()) as LoginResponse;
  if (data.scopes && data.scopes.length > 0) {
    activeScope = data.scopes[0];
    ownerHeader = `${activeScope.type}:${activeScope.id}`;
  } else {
    throw new Error("Login succeeded but no scopes were returned");
  }
}

async function loginOAuth2(): Promise<void> {
  const baseUrl = getBaseUrl();
  const tokenUrl = `${baseUrl}/api/auth/oauth2/token`;

  const clientId = getEnv("CCX_CLIENT_ID");
  const clientSecret = getEnv("CCX_CLIENT_SECRET");

  const body = new URLSearchParams({
    grant_type: "client_credentials",
    client_id: clientId,
    client_secret: clientSecret,
  });

  const response = await fetch(tokenUrl, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(
      `OAuth2 token request failed (${response.status}): ${text || response.statusText}`,
    );
  }

  const data = (await response.json()) as {
    access_token: string;
    token_type: string;
    expires_in: number;
    refresh_token?: string;
  };

  if (!data.access_token) {
    throw new Error("OAuth2 token response missing access_token");
  }

  accessToken = data.access_token;
  // Set expiry with 60s buffer for safety
  tokenExpiresAt = Date.now() + (data.expires_in - 60) * 1000;

  // For OAuth2, we need to get the scopes via the auth check endpoint
  // using the bearer token
  const checkResponse = await fetch(`${baseUrl}/api/v2/auth/check`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });

  if (checkResponse.ok) {
    const checkData = (await checkResponse.json()) as LoginResponse;
    if (checkData.scopes && checkData.scopes.length > 0) {
      activeScope = checkData.scopes[0];
      ownerHeader = `${activeScope.type}:${activeScope.id}`;
    }
  }
  // It's OK if scope extraction fails for OAuth2 — the token carries identity
}

export function getHeaders(): Record<string, string> {
  const headers: Record<string, string> = {};

  if (getAuthMethod() === "oauth2" && accessToken) {
    headers["Authorization"] = `Bearer ${accessToken}`;
  } else if (sessionCookie) {
    headers["Cookie"] = `ccx-session=${sessionCookie}`;
  }

  if (ownerHeader) {
    headers["CCX-Owner"] = ownerHeader;
  }

  return headers;
}

export function clearSession(): void {
  sessionCookie = null;
  accessToken = null;
  tokenExpiresAt = null;
  ownerHeader = null;
  activeScope = null;
}

export function isLoggedIn(): boolean {
  if (getAuthMethod() === "oauth2") {
    return accessToken !== null && (tokenExpiresAt === null || Date.now() < tokenExpiresAt);
  }
  return sessionCookie !== null;
}
