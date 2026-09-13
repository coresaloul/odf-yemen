import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Eye,
  Pencil,
  Trash2,
  Coins,
  Calendar,
  Sparkles,
} from "lucide-react";
import {
  PARTNER_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  calculateDonorHealth,
  type InteractionRow,
  type PartnerRow,
} from "@/lib/pr-crm";

interface PartnerTableViewProps {
  partners: PartnerRow[];
  interactions: InteractionRow[];
  onViewProfile: (partner: PartnerRow) => void;
  onEdit: (partner: PartnerRow) => void;
  onDelete: (partner: PartnerRow) => void;
  onAddDonation: (partnerId: string) => void;
  onAddInteraction: (partnerId: string) => void;
}

export function PartnerTableView({
  partners,
  interactions,
  onViewProfile,
  onEdit,
  onDelete,
  onAddDonation,
  onAddInteraction,
}: PartnerTableViewProps) {
  return (
    <Card className="overflow-hidden p-0 border">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50">
              <TableHead className="text-right font-bold">اسم الشريك / المانح</TableHead>
              <TableHead className="text-right font-bold">التصنيف</TableHead>
              <TableHead className="text-right font-bold hidden md:table-cell">الممثل / جهة الاتصال</TableHead>
              <TableHead className="text-right font-bold hidden lg:table-cell">الهاتف / التواصل</TableHead>
              <TableHead className="text-right font-bold">حالة العلاقة</TableHead>
              <TableHead className="text-right font-bold">مؤشر التفاعل</TableHead>
              <TableHead className="text-right font-bold hidden xl:table-cell">مسؤول الحساب</TableHead>
              <TableHead className="text-center font-bold">الإجراءات</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {partners.map((p) => {
              const lastInter = interactions.find((i) => i.partner_id === p.id);
              const health = calculateDonorHealth(p, lastInter?.interaction_date);

              return (
                <TableRow key={p.id} className="hover:bg-accent/40 text-xs">
                  <TableCell className="font-medium">
                    <button
                      onClick={() => onViewProfile(p)}
                      className="font-bold text-foreground hover:text-primary transition-colors text-right block"
                    >
                      {p.name}
                    </button>
                    {p.address && (
                      <span className="text-[10px] text-muted-foreground block truncate max-w-[200px]">
                        {p.address}
                      </span>
                    )}
                  </TableCell>

                  <TableCell>
                    <Badge variant="outline" className="text-[11px] whitespace-nowrap">
                      {PARTNER_TYPE_LABELS[p.type]}
                    </Badge>
                  </TableCell>

                  <TableCell className="hidden md:table-cell">
                    {p.contact_person || "—"}
                  </TableCell>

                  <TableCell className="hidden lg:table-cell" dir="ltr">
                    <span className="text-right block">{p.phone || p.email || "—"}</span>
                  </TableCell>

                  <TableCell>
                    <Badge
                      variant="secondary"
                      className={
                        p.status === "active"
                          ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 whitespace-nowrap"
                          : "bg-muted text-muted-foreground whitespace-nowrap"
                      }
                    >
                      {PARTNER_STATUS_LABELS[p.status]}
                    </Badge>
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center gap-1.5 whitespace-nowrap">
                      <span className={`font-bold ${health.color}`}>
                        {health.score}%
                      </span>
                      <span className="text-[10px] text-muted-foreground">({health.label})</span>
                    </div>
                  </TableCell>

                  <TableCell className="hidden xl:table-cell">
                    {p.assigned_employee_name || "—"}
                  </TableCell>

                  <TableCell>
                    <div className="flex items-center justify-center gap-1">
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="عرض الملف الشامل"
                        onClick={() => onViewProfile(p)}
                      >
                        <Eye className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-emerald-600"
                        title="تسجيل تبرع"
                        onClick={() => onAddDonation(p.id)}
                      >
                        <Coins className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-primary"
                        title="توثيق لقاء / زيارة"
                        onClick={() => onAddInteraction(p.id)}
                      >
                        <Calendar className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0"
                        title="تعديل الشريك"
                        onClick={() => onEdit(p)}
                      >
                        <Pencil className="w-3.5 h-3.5" />
                      </Button>

                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                        title="حذف الشريك"
                        onClick={() => onDelete(p)}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}
