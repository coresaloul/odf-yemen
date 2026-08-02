import logoAsset from "@/assets/odf-logo.png.asset.json";
import { cn } from "@/lib/utils";

export function Logo({ className }: { className?: string }) {
  return (
    <img
      src={logoAsset.url}
      alt="شعار مؤسسة اليتيم التنموية"
      className={cn("h-12 w-auto object-contain", className)}
      loading="lazy"
    />
  );
}
