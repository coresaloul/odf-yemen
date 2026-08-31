import logoAsset from "@/assets/mider-logo.jpg.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="شعار نظام ميدير — نظام إدارة الموارد البشرية والخطط والتقارير"
      className={cn("h-12 w-auto rounded-md object-contain", className)}
      loading="lazy"
    />
  );
}
