import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { ORG_NAME } from "@/lib/hr";

export type Branding = {
  org_name: string;
  system_name: string;
  logo_path: string | null;
  copyright: string;
  logoUrl: string | null;
};

export const BRANDING_DEFAULTS: Branding = {
  org_name: ORG_NAME,
  system_name: "مدير | نظام الموارد البشرية والتخطيط والتقارير",
  logo_path: null,
  copyright: "© جميع الحقوق محفوظة",
  logoUrl: null,
};

export const BRANDING_QUERY_KEY = ["org-branding"] as const;

export async function fetchBranding(): Promise<Branding> {
  const { data } = await supabase
    .from("org_branding")
    .select("org_name, system_name, logo_path, copyright")
    .maybeSingle();

  if (!data) return BRANDING_DEFAULTS;

  let logoUrl: string | null = null;
  if (data.logo_path) {
    const { data: signed } = await supabase.storage
      .from("branding")
      .createSignedUrl(data.logo_path, 60 * 60 * 24);
    logoUrl = signed?.signedUrl ?? null;
  }

  return {
    org_name: data.org_name || BRANDING_DEFAULTS.org_name,
    system_name: data.system_name || BRANDING_DEFAULTS.system_name,
    logo_path: data.logo_path,
    copyright: data.copyright || BRANDING_DEFAULTS.copyright,
    logoUrl,
  };
}

export function useBranding() {
  const { data } = useQuery({
    queryKey: BRANDING_QUERY_KEY,
    queryFn: fetchBranding,
    staleTime: 5 * 60 * 1000,
  });
  return data ?? BRANDING_DEFAULTS;
}

export function useRefreshBranding() {
  const qc = useQueryClient();
  return () => qc.invalidateQueries({ queryKey: BRANDING_QUERY_KEY });
}
