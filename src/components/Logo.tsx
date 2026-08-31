import logoAsset from "@/assets/mudeer-logo.png.asset.json";
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
