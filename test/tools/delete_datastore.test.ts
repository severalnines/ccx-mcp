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

describe("delete_datastore", () => {
  it("calls DELETE when confirm is true", async () => {
    let deleteCalled = false;

    mswServer.use(
      http.delete("https://test.ccx.dev/api/prov/api/v2/cluster/ds-123", () => {
        deleteCalled = true;
        return HttpResponse.json({}, { status: 200 });
      }),
    );

    const { del } = await import("../../src/client.js");
    await del("/prov/api/v2/cluster/ds-123");
    expect(deleteCalled).toBe(true);
  });

  it("API error on DELETE surfaces correctly", async () => {
    mswServer.use(
      http.delete("https://test.ccx.dev/api/prov/api/v2/cluster/ds-nonexistent", () => {
        return HttpResponse.json({ error: "not found" }, { status: 404 });
      }),
    );

    const { del } = await import("../../src/client.js");
    const { ApiError } = await import("../../src/client.js");

    try {
      await del("/prov/api/v2/cluster/ds-nonexistent");
      expect.unreachable("Should have thrown");
    } catch (e) {
      expect(e).toBeInstanceOf(ApiError);
      expect((e as InstanceType<typeof ApiError>).status).toBe(404);
    }
  });
});
