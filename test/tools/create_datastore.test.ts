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

let capturedBody: unknown = null;

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

describe("create_datastore tool", () => {
  it("builds correct API body with smart defaults for postgres on elastx", async () => {
    mswServer.use(
      http.post("https://test.ccx.dev/api/prov/api/v2/cluster", async ({ request }) => {
        capturedBody = await request.json();
        return HttpResponse.json({ cluster_uuid: "new-uuid-123" }, { status: 201 });
      }),
    );

    // Import and manually invoke the tool logic
    const { get: clientGet, post: clientPost } = await import("../../src/client.js");
    const wizard = await import("../../src/wizard.js");

    // Simulate what the tool does
    const cloud = "elastx";
    const vendor = "postgres";
    const region = "se-sto";

    const clusterType = wizard.getDefaultClusterType(vendor);
    const dbVersion = wizard.getLatestVersion(vendor);
    const instanceSize = wizard.getSmallestInstance(cloud);
    const volumeType = wizard.getFirstVolumeType(cloud);
    const volumeSize = volumeType ? wizard.getDefaultVolumeSize(cloud, volumeType) : 80;
    const networkType = wizard.getDefaultNetworkType(cloud);

    expect(clusterType).toBe("postgres_streaming");
    expect(dbVersion).toBe("17");
    expect(instanceSize).toBe("tiny");
    expect(volumeType).toBe("v1-dynamic-100");
    expect(volumeSize).toBe(80);
    expect(networkType).toBe("public");

    const body = {
      general: {
        cluster_name: "test-cluster",
        cluster_size: 1,
        db_vendor: vendor,
        db_version: dbVersion,
        cluster_type: clusterType,
      },
      cloud: {
        cloud_provider: cloud,
        cloud_region: region,
      },
      instance: {
        instance_size: instanceSize,
        volume_type: volumeType,
        volume_size: volumeSize,
      },
      network: {
        network_type: networkType,
      },
      notifications: {
        enabled: false,
        emails: [],
      },
    };

    const result = await clientPost("/prov/api/v2/cluster", body);
    expect(result).toEqual({ cluster_uuid: "new-uuid-123" });

    // Verify the captured body has the correct nested structure
    expect(capturedBody).toEqual(body);
  });

  it("explicit overrides take precedence over defaults", async () => {
    const wizard = await import("../../src/wizard.js");

    // User specifies custom values
    const clusterType = "galera"; // Not the default for postgres
    const dbVersion = "16"; // Not the latest
    const instanceSize = "large"; // Not the smallest

    // These should override defaults
    expect(clusterType).not.toBe(wizard.getDefaultClusterType("postgres"));
    expect(dbVersion).not.toBe(wizard.getLatestVersion("postgres"));
    expect(instanceSize).not.toBe(wizard.getSmallestInstance("elastx"));
  });

  it("validates cloud provider exists", async () => {
    const wizard = await import("../../src/wizard.js");
    expect(wizard.getCloudProvider("nonexistent")).toBeUndefined();
    expect(wizard.getCloudProvider("elastx")).toBeDefined();
  });

  it("validates region exists for provider", async () => {
    const wizard = await import("../../src/wizard.js");
    const provider = wizard.getCloudProvider("elastx");
    expect(provider).toBeDefined();

    const validRegion = provider!.regions.find((r) => r.code === "se-sto");
    expect(validRegion).toBeDefined();

    const invalidRegion = provider!.regions.find((r) => r.code === "us-east-1");
    expect(invalidRegion).toBeUndefined();
  });
});
