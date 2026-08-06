import { Link } from "@tanstack/react-router";
import {
  Award,
  BriefcaseBusiness,
  CalendarCheck,
  ClipboardList,
  FileSignature,
  Gavel,
  ListChecks,
  Package,
  Wallet,
} from "lucide-react";

type ServiceLink = {
  to: string;
  label: string;
  hint: string;
  icon: typeof ListChecks;
};

const SERVICES: ServiceLink[] = [
  { to: "/tasks", label: "المهام", hint: "المهام المكلف بها", icon: ListChecks },
  { to: "/attendance", label: "الدوام", hint: "الحضور والانصراف", icon: CalendarCheck },
  { to: "/leaves", label: "الإجازات", hint: "الطلبات والأرصدة", icon: ClipboardList },
  { to: "/evaluations", label: "التقييم", hint: "تقييم الأداء", icon: Award },
  { to: "/custody", label: "العهد", hint: "العهد والأصول", icon: Package },
  { to: "/requests", label: "الطلبات", hint: "نماذج الموارد البشرية", icon: FileSignature },
  { to: "/discipline", label: "التكريم والجزاءات", hint: "السجل الانضباطي", icon: Gavel },
  { to: "/lifecycle", label: "دورة الحياة", hint: "التعيين والانتقالات", icon: BriefcaseBusiness },
  { to: "/payroll", label: "الرواتب", hint: "المسيّرات والمستحقات", icon: Wallet },
];

export function EmployeeServiceLinks({
  only,
  className,
}: {
  only?: string[];
  className?: string;
}) {
  const items = only ? SERVICES.filter((s) => only.includes(s.to)) : SERVICES;
  return (
    <div className={`grid gap-2 sm:grid-cols-2 lg:grid-cols-3 ${className ?? ""}`}>
      {items.map((s) => (
        <Link
          key={s.to}
          to={s.to}
          className="group flex items-center gap-3 rounded-xl border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent"
        >
          <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
            <s.icon className="size-4" />
          </span>
          <span className="min-w-0">
            <span className="block truncate text-sm font-medium">{s.label}</span>
            <span className="block truncate text-xs text-muted-foreground">{s.hint}</span>
          </span>
        </Link>
      ))}
    </div>
  );
}
