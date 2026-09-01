import { useBranding } from "@/hooks/useBranding";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  const branding = useBranding();
  return (
    <img
      src={branding.logoUrl ?? "/favicon.png"}
      alt={`شعار ${branding.org_name}`}
      className={cn("h-12 w-auto rounded-md object-contain", className)}
      loading="lazy"
    />
  );
}
