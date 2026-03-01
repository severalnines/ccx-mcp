import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import wizardFixture from "../fixtures/wizard_response.json";

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
  http.get("https://test.ccx.dev/api/content/api/v1/deploy-wizard", () => {
    return HttpResponse.json(wizardFixture);
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
  const wizard = await import("../../src/wizard.js");
  await wizard.load();

});

afterAll(() => {
  mswServer.close();
});

describe("list_clouds tool", () => {
  it("returns cloud providers with regions from wizard", async () => {
    const wizard = await import("../../src/wizard.js");
    const providers = wizard.getCloudProviders();

    expect(providers).toHaveLength(2);

    const elastx = providers.find((p) => p.code === "elastx");
    expect(elastx).toBeDefined();
    expect(elastx!.name).toBe("Elastx");
    expect(elastx!.regions).toHaveLength(1);
    expect(elastx!.regions[0].code).toBe("se-sto");
    expect(elastx!.regions[0].city).toBe("Stockholm");

    const aws = providers.find((p) => p.code === "aws");
    expect(aws).toBeDefined();
    expect(aws!.regions).toHaveLength(2);
    expect(aws!.regions.map((r) => r.code)).toEqual(["eu-west-1", "us-east-1"]);
  });
});
