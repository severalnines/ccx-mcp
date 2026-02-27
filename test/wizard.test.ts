import { describe, it, expect, beforeAll } from "vitest";
import { http, HttpResponse } from "msw";
import { setupServer } from "msw/node";
import wizardFixture from "./fixtures/wizard_response.json";

// We need to mock the wizard module's internal state.
// We'll do this by calling the HTTP-based load() with msw intercepting.
const mswServer = setupServer(
  http.get("https://test.ccx.dev/api/content/api/v1/deploy-wizard", () => {
    return HttpResponse.json(wizardFixture);
  }),
  http.post("https://test.ccx.dev/api/v2/auth/login", () => {
    return HttpResponse.json(
      { user: { id: "u1", login: "test@test.com", first_name: "Test", last_name: "User" }, scopes: [{ id: "s1", name: "Test", type: "user", role: "admin" }] },
      { headers: { "Set-Cookie": "ccx-session=test-session-id; Path=/; HttpOnly" } },
    );
  }),
);

beforeAll(async () => {
  mswServer.listen({ onUnhandledRequest: "error" });
  process.env.CCX_BASE_URL = "https://test.ccx.dev";
  process.env.CCX_USERNAME = "test@test.com";
  process.env.CCX_PASSWORD = "testpass";

  // Dynamic import after env vars are set
  const auth = await import("../src/auth.js");
  await auth.login();
  const wizard = await import("../src/wizard.js");
  await wizard.load();

  return () => {
    mswServer.close();
    delete process.env.CCX_BASE_URL;
    delete process.env.CCX_USERNAME;
    delete process.env.CCX_PASSWORD;
  };
});

describe("wizard smart defaults", () => {
  it("getSmallestInstance returns the smallest by CPU then RAM", async () => {
    const { getSmallestInstance } = await import("../src/wizard.js");
    expect(getSmallestInstance("elastx")).toBe("tiny"); // cpu=1, ram=2
    expect(getSmallestInstance("aws")).toBe("small"); // cpu=2, ram=4
  });

  it("getSmallestInstance returns undefined for unknown cloud", async () => {
    const { getSmallestInstance } = await import("../src/wizard.js");
    expect(getSmallestInstance("nonexistent")).toBeUndefined();
  });

  it("getFirstVolumeType returns the first volume type for a cloud", async () => {
    const { getFirstVolumeType } = await import("../src/wizard.js");
    expect(getFirstVolumeType("elastx")).toBe("v1-dynamic-100");
    expect(getFirstVolumeType("aws")).toBe("gp3");
  });

  it("getDefaultVolumeSize returns the default size for a cloud + volume type", async () => {
    const { getDefaultVolumeSize } = await import("../src/wizard.js");
    expect(getDefaultVolumeSize("elastx", "v1-dynamic-100")).toBe(80);
    expect(getDefaultVolumeSize("aws", "gp3")).toBe(100);
    expect(getDefaultVolumeSize("aws", "nonexistent")).toBeUndefined();
  });

  it("getDefaultClusterType returns the correct type per vendor", async () => {
    const { getDefaultClusterType } = await import("../src/wizard.js");
    expect(getDefaultClusterType("postgres")).toBe("postgres_streaming");
    expect(getDefaultClusterType("mariadb")).toBe("replication");
    expect(getDefaultClusterType("percona")).toBe("replication");
    expect(getDefaultClusterType("redis")).toBe("redis");
    expect(getDefaultClusterType("valkey")).toBe("valkey_sentinel");
    expect(getDefaultClusterType("microsoft")).toBe("mssql_single");
  });

  it("getDefaultClusterType returns undefined for unknown vendor", async () => {
    const { getDefaultClusterType } = await import("../src/wizard.js");
    expect(getDefaultClusterType("unknown_db")).toBeUndefined();
  });

  it("getLatestVersion returns the last version in the array", async () => {
    const { getLatestVersion } = await import("../src/wizard.js");
    expect(getLatestVersion("mariadb")).toBe("11.8");
    expect(getLatestVersion("postgres")).toBe("17");
    expect(getLatestVersion("redis")).toBe("7");
    expect(getLatestVersion("percona")).toBe("8.4");
  });

  it("getLatestVersion returns undefined for unknown vendor", async () => {
    const { getLatestVersion } = await import("../src/wizard.js");
    expect(getLatestVersion("nonexistent")).toBeUndefined();
  });

  it("getCloudProviders returns all providers", async () => {
    const { getCloudProviders } = await import("../src/wizard.js");
    const providers = getCloudProviders();
    expect(providers).toHaveLength(2);
    expect(providers.map((p) => p.code)).toEqual(["elastx", "aws"]);
  });

  it("getCloudProvider finds by code case-insensitively", async () => {
    const { getCloudProvider } = await import("../src/wizard.js");
    expect(getCloudProvider("elastx")?.code).toBe("elastx");
    expect(getCloudProvider("ELASTX")?.code).toBe("elastx");
    expect(getCloudProvider("nonexistent")).toBeUndefined();
  });

  it("getDefaultNetworkType returns public when available", async () => {
    const { getDefaultNetworkType } = await import("../src/wizard.js");
    expect(getDefaultNetworkType("elastx")).toBe("public");
    expect(getDefaultNetworkType("aws")).toBe("public");
  });
});
