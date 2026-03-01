import { getBaseUrl, getHeaders, login, clearSession } from "./auth.js";

export class ApiError extends Error {
  constructor(
    public status: number,
    public path: string,
    message: string,
  ) {
    super(`API error ${status} on ${path}: ${message}`);
    this.name = "ApiError";
  }
}

async function request(
  method: string,
  path: string,
  body?: unknown,
  params?: Record<string, string>,
  retried = false,
): Promise<unknown> {
  const baseUrl = getBaseUrl();
  const url = new URL(`${baseUrl}/api${path}`);
  if (params) {
    for (const [key, value] of Object.entries(params)) {
      url.searchParams.set(key, value);
    }
  }

  const headers: Record<string, string> = {
    ...getHeaders(),
    "Content-Type": "application/json",
  };

  const response = await fetch(url.toString(), {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  // Auto-retry on 401
  if (response.status === 401 && !retried) {
    clearSession();
    await login();
    return request(method, path, body, params, true);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new ApiError(response.status, path, text || response.statusText);
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    return response.json();
  }
  return response.text();
}

export async function get(
  path: string,
  params?: Record<string, string>,
): Promise<unknown> {
  return request("GET", path, undefined, params);
}

export async function post(
  path: string,
  body?: unknown,
): Promise<unknown> {
  return request("POST", path, body);
}

export async function patch(
  path: string,
  body?: unknown,
): Promise<unknown> {
  return request("PATCH", path, body);
}

export async function del(
  path: string,
  body?: unknown,
): Promise<unknown> {
  return request("DELETE", path, body);
}
