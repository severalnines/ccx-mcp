import { get } from "./client.js";
import type { DeployWizard, WizardInstanceSize } from "./types.js";

let wizardData: DeployWizard | null = null;

export async function load(): Promise<void> {
  wizardData = (await get("/content/api/v1/deploy-wizard")) as DeployWizard;
}

export function getWizard(): DeployWizard {
  if (!wizardData) {
    throw new Error("Wizard data not loaded. Call load() first.");
  }
  return wizardData;
}

/** Sort instance sizes by CPU then RAM, return the smallest one's code. */
export function getSmallestInstance(cloud: string): string | undefined {
  const sizes = getWizard().instance.instance_sizes[cloud];
  if (!sizes || sizes.length === 0) return undefined;

  const sorted = [...sizes].sort((a: WizardInstanceSize, b: WizardInstanceSize) => {
    if (a.cpu !== b.cpu) return a.cpu - b.cpu;
    return a.ram - b.ram;
  });
  return sorted[0].code;
}

/** Return the first volume type code for a cloud provider. */
export function getFirstVolumeType(cloud: string): string | undefined {
  const types = getWizard().instance.volume_types[cloud];
  if (!types || types.length === 0) return undefined;
  return types[0].code;
}

/** Return the default volume size for a cloud + volume type combo. */
export function getDefaultVolumeSize(
  cloud: string,
  volumeType: string,
): number | undefined {
  const sizes = getWizard().instance.volume_sizes[cloud];
  if (!sizes) return undefined;
  return sizes[volumeType]?.default;
}

/** Map db vendor code to the default cluster type. */
export function getDefaultClusterType(vendor: string): string | undefined {
  const vendorMap: Record<string, string> = {
    mariadb: "replication",
    percona: "replication",
    postgres: "postgres_streaming",
    postgresql: "postgres_streaming",
    pgsql: "postgres_streaming",
    redis: "redis",
    valkey: "valkey_sentinel",
    microsoft: "mssql_single",
    mssql: "mssql_single",
  };
  return vendorMap[vendor.toLowerCase()];
}

/** Return the last (latest) version for a vendor. */
export function getLatestVersion(vendorCode: string): string | undefined {
  const vendor = getWizard().database.vendors.find(
    (v) => v.code === vendorCode,
  );
  if (!vendor || !vendor.versions || vendor.versions.length === 0) {
    return undefined;
  }
  return vendor.versions[vendor.versions.length - 1];
}

/** Return all cloud providers with their regions. */
export function getCloudProviders() {
  return getWizard().cloud.cloud_providers;
}

/** Find a specific cloud provider by code. */
export function getCloudProvider(code: string) {
  return getWizard().cloud.cloud_providers.find(
    (p) => p.code.toLowerCase() === code.toLowerCase(),
  );
}

/** Get the default network type for a cloud provider ("public" if available). */
export function getDefaultNetworkType(cloud: string): string {
  const networks = getWizard().network.network[cloud];
  if (!networks || networks.length === 0) return "public";
  const publicNet = networks.find((n) => n.code === "public" && n.enabled);
  return publicNet ? "public" : networks[0].code;
}
