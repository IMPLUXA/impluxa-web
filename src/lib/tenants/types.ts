export type TenantStatus = "draft" | "published" | "suspended";
export type MemberRole = "owner" | "editor";

export interface Tenant {
  id: string;
  slug: string;
  name: string;
  template_key: string;
  custom_domain: string | null;
  status: TenantStatus;
  trial_ends_at: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface TenantMember {
  tenant_id: string;
  user_id: string;
  role: MemberRole;
  created_at: string;
}

export interface Site {
  tenant_id: string;
  content_json: Record<string, unknown>;
  design_json: Record<string, unknown>;
  media_json: Record<string, unknown>;
  seo_json: Record<string, unknown>;
  published_at: string | null;
  updated_at: string;
}
