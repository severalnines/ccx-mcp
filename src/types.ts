// ── Auth ──

export interface LoginRequest {
  login: string;
  password: string;
}

export interface LoginResponse {
  user: {
    id: string;
    login: string;
    first_name: string;
    last_name: string;
  };
  scopes: Scope[];
}

export interface Scope {
  id: string;
  name: string;
  type: string; // "user" | "org"
  role: string;
}

// ── Wizard ──

export interface DeployWizard {
  database: WizardDatabase;
  cloud: WizardCloud;
  instance: WizardInstance;
  network: WizardNetwork;
}

export interface WizardDatabase {
  vendors: WizardVendor[];
  deployment_types_info: string;
  num_nodes_info: string;
}

export interface WizardVendor {
  name: string;
  code: string;
  version: string;
  versions: string[];
  type?: string;
  num_nodes: number[];
  info: string;
  enabled: boolean;
  beta: boolean;
  types?: WizardClusterType[];
}

export interface WizardClusterType {
  code: string;
  name: string;
  size_hints?: Record<string, { name: string; info: string }>;
}

export interface WizardCloud {
  cloud_providers: WizardCloudProvider[];
  cloud_groups: WizardCloudGroup[];
}

export interface WizardCloudProvider {
  code: string;
  name: string;
  full_name: string;
  type: string;
  logo: string;
  group: string;
  regions: WizardRegion[];
}

export interface WizardRegion {
  code: string;
  display_code: string;
  name: string;
  country_code: string;
  continent_code: string;
  city: string;
}

export interface WizardCloudGroup {
  name: string;
  label: string;
  logo: string;
}

export interface WizardInstance {
  instance_sizes: Record<string, WizardInstanceSize[]>;
  instance_sizes_info: string;
  volume_types: Record<string, WizardVolumeType[]>;
  volume_types_info: string;
  volume_sizes: Record<string, Record<string, WizardVolumeSize>>;
  volume_sizes_info: string;
  volume_iops: Record<string, Record<string, WizardVolumeIOPS>>;
  volume_iops_info: string;
}

export interface WizardInstanceSize {
  name: string;
  code: string;
  type: string;
  cpu: number;
  ram: number;
  disk_size?: number;
  price: number;
}

export interface WizardVolumeType {
  name: string;
  code: string;
  has_iops: boolean;
  info: string;
  price: number;
  iops_price: number;
}

export interface WizardVolumeSize {
  min: number;
  max: number;
  default: number;
  unit: string;
}

export interface WizardVolumeIOPS {
  min: number;
  max: number;
  max_per_gb: number;
  default: number;
}

export interface WizardNetwork {
  network: Record<string, WizardNetworkType[]>;
  network_info: Record<string, string>;
  type_info: Record<string, string>;
  vpc_info: Record<string, string>;
  availability_zones: Record<string, Record<string, WizardAZ[]>>;
}

export interface WizardNetworkType {
  name: string;
  code: string;
  info: string;
  enabled: boolean;
  ha_available: Record<number, boolean>;
  vpc_available: boolean;
  prices?: Record<number, number>;
}

export interface WizardAZ {
  code: string;
  name: string;
}

// ── Create Cluster ──

export interface CreateClusterRequest {
  general: {
    cluster_name: string;
    cluster_size: number;
    db_vendor: string;
    db_version: string;
    cluster_type: string;
    tags?: string[];
  };
  cloud: {
    cloud_provider: string;
    cloud_region: string;
  };
  instance: {
    instance_size: string;
    volume_type?: string;
    volume_size?: number;
    volume_iops?: number;
  };
  network: {
    network_type: string;
    ha_enabled?: boolean;
    vpc_uuid?: string;
    availability_zones?: string[];
  };
  notifications?: {
    enabled: boolean;
    emails: string[];
  };
}

// ── Datastore ──

export interface DatastoreInfo {
  uuid: string;
  cluster_name: string;
  cluster_status: string;
  cluster_status_text: string;
  cluster_type: string;
  cluster_type_name: string;
  cluster_id: number;
  cluster_size: number;
  database_vendor: string;
  database_version: string;
  database_endpoint: string;
  cloud_provider: string;
  region: { code: string; display_code: string; name: string } | null;
  instance_size: string;
  disk_size: number | null;
  disk_type: string | null;
  iops: number | null;
  operable: boolean;
  not_operable_reason: string;
  ssl_enabled: boolean;
  high_availability: boolean;
  tags: string[];
  is_deploying: boolean;
  deploy_progress: number;
  created_at: string;
  updated_at: string;
  db_account: {
    database_username: string;
    database_password: string;
    database_host: string;
    database_database: string;
    database_privileges: string;
  };
  primary_url: string;
  replica_url: string;
  current_job: {
    uuid: string;
    cluster_uuid: string;
    command: string;
    status: string;
    progress: number;
    created_at: string;
  } | null;
}

export interface DatastoreListResponse {
  total: number;
  datastores: DatastoreInfo[];
}

// ── Database Users ──

export interface DbUser {
  user_name: string;
  grants: string;
  host_allow: string;
  auth_plugin: string;
}

export interface CreateDbUserRequest {
  database_username: string;
  database_password: string;
  database_host?: string;
  database_name?: string;
  database_privileges?: string;
  create_admin_user?: boolean;
  auth_plugin?: string;
  own_database?: boolean;
}

// ── Databases ──

export interface DbDatabase {
  database_name: string;
  database_owner: string;
  database_size: number;
  number_of_tables: number;
  status: string;
}

// ── Firewall / Trusted Sources ──

export interface RuleSet {
  source: string;
  description: string;
  ports: RulePort[];
}

export interface RulePort {
  port: string;
  port_no: number;
}

export interface AccessRequest {
  source: string;
  description: string;
}

// ── Backups ──

export interface Backup {
  backup_id: string;
  parent_id: string;
  backup_method: string;
  backup_type: string;
  status: string;
  size: number;
  started_at: string | null;
  ended_at: string | null;
}

export interface BackupsResponse {
  backups: Backup[];
  total: number;
}

// ── Top Queries ──

export interface TopQueriesResponse {
  timestamp: number;
  data: DbQuery[];
}

export interface DbQuery {
  instance: string;
  database: string;
  digest_text: string;
  sum_time: number;
  max_time: number;
  min_time: number;
  avg_time: number;
  count_star: number;
  first_seen: string;
  last_seen: string;
  affected_rows: number;
  examined_rows: number;
  sent_rows: number;
}

// ── Nodes ──

export interface NodeInfo {
  host_uuid: string;
  hostname: string;
  role: string;
  status: string;
  port: number;
  private_ip: string;
  public_ip: string;
  maintenance_mode_active: boolean;
}
