import { Link } from "@tanstack/react-router";
import {
  CalendarDays,
  FileText,
  Clock,
  Wallet,
  PlusCircle,
  Users,
  Archive,
  Star,
  Package,
} from "lucide-react";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";

export function QuickActionsBar() {
  const { isDirector, isHR, isManager, isSecretariat } = useAuth();

  return (
    <div className="rounded-xl border bg-card/60 p-3 shadow-xs backdrop-blur-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 pb-2">
        <p className="text-xs font-semibold text-muted-foreground">⚡ وصول سريع للإجراءات الأكثر استخداماً</p>
      </div>

      <div className="flex flex-wrap gap-2">
        {/* إجراءات الموظف والجميع */}
        <Button asChild variant="outline" size="sm" className="gap-1.5 hover:bg-primary/10 hover:text-primary">
          <Link to="/leaves">
            <CalendarDays className="size-3.5 text-primary" />
            <span>طلب إجازة</span>
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm" className="gap-1.5 hover:bg-primary/10 hover:text-primary">
          <Link to="/requests">
            <FileText className="size-3.5 text-primary" />
            <span>تقديم نموذج</span>
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm" className="gap-1.5 hover:bg-primary/10 hover:text-primary">
          <Link to="/approvals">
            <Clock className="size-3.5 text-amber-500" />
            <span>تصحيح حضور</span>
          </Link>
        </Button>

        <Button asChild variant="outline" size="sm" className="gap-1.5 hover:bg-primary/10 hover:text-primary">
          <Link to="/payroll">
            <Wallet className="size-3.5 text-emerald-500" />
            <span>قسائم الرواتب</span>
          </Link>
        </Button>

        {/* إجراءات السكرتارية */}
        {(isSecretariat || isDirector) && (
          <Button asChild variant="outline" size="sm" className="gap-1.5 border-purple-200 bg-purple-50/50 text-purple-700 hover:bg-purple-100 dark:border-purple-900/50 dark:bg-purple-950/20 dark:text-purple-300">
            <Link to="/correspondence">
              <Archive className="size-3.5" />
              <span>معاملة صادر/وارد</span>
            </Link>
          </Button>
        )}

        {/* إجراءات المدير المباشر */}
        {isManager && (
          <>
            <Button asChild variant="outline" size="sm" className="gap-1.5 border-blue-200 bg-blue-50/50 text-blue-700 hover:bg-blue-100 dark:border-blue-900/50 dark:bg-blue-950/20 dark:text-blue-300">
              <Link to="/tasks">
                <PlusCircle className="size-3.5" />
                <span>تكليف مهمة</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 border-amber-200 bg-amber-50/50 text-amber-700 hover:bg-amber-100 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-300">
              <Link to="/evaluations">
                <Star className="size-3.5" />
                <span>تقييم الأداء</span>
              </Link>
            </Button>
          </>
        )}

        {/* إجراءات الموارد البشرية والمدير التنفيذي */}
        {(isHR || isDirector) && (
          <>
            <Button asChild variant="outline" size="sm" className="gap-1.5 border-emerald-200 bg-emerald-50/50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-900/50 dark:bg-emerald-950/20 dark:text-emerald-300">
              <Link to="/employees">
                <Users className="size-3.5" />
                <span>سجل الموظفين</span>
              </Link>
            </Button>
            <Button asChild variant="outline" size="sm" className="gap-1.5 border-indigo-200 bg-indigo-50/50 text-indigo-700 hover:bg-indigo-100 dark:border-indigo-900/50 dark:bg-indigo-950/20 dark:text-indigo-300">
              <Link to="/custody">
                <Package className="size-3.5" />
                <span>العهد والممتلكات</span>
              </Link>
            </Button>
          </>
        )}
      </div>
    </div>
  );
}
