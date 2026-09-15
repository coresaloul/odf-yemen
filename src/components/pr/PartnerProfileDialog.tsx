import { useState } from "react";
import { Link } from "@tanstack/react-router";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  FileCheck,
  FileDown,
  FileText,
  Flame,
  Globe,
  Handshake,
  HeartHandshake,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  Printer,
  Sparkles,
  Trash2,
  UserCheck,
} from "lucide-react";
import {
  PARTNER_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  INTERACTION_TYPE_LABELS,
  AGREEMENT_STATUS_LABELS,
  GRANT_SECTOR_LABELS,
  GRANT_STAGE_LABELS,
  DONATION_TYPE_LABELS,
  calculateDonorHealth,
  type AgreementRow,
  type DonationRow,
  type GrantOpportunityRow,
  type InteractionRow,
  type PartnerRow,
} from "@/lib/pr-crm";
import { exportPdf, exportWord, type ReportDoc } from "@/lib/report-export";
import { useBranding } from "@/hooks/useBranding";
import { toast } from "sonner";

interface PartnerProfileDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: PartnerRow | null;
  donations: DonationRow[];
  agreements: AgreementRow[];
  grants: GrantOpportunityRow[];
  interactions: InteractionRow[];
  onEdit: (partner: PartnerRow) => void;
  onDelete: (partner: PartnerRow) => void;
  onAddDonation: (partnerId: string) => void;
  onAddInteraction: (partnerId: string) => void;
  onAddGrant: (partnerId: string) => void;
  onOpenCatalog: (partner: PartnerRow) => void;
}

export function PartnerProfileDialog({
  open,
  onOpenChange,
  partner,
  donations,
  agreements,
  grants,
  interactions,
  onEdit,
  onDelete,
  onAddDonation,
  onAddInteraction,
  onAddGrant,
  onOpenCatalog,
}: PartnerProfileDialogProps) {
  const branding = useBranding();
  const [activeTab, setActiveTab] = useState("donations");

  if (!partner) return null;

  // Partner-specific data
  const partnerDonations = donations.filter((d) => d.partner_id === partner.id);
  const partnerAgreements = agreements.filter((a) => a.partner_id === partner.id);
  const partnerGrants = grants.filter((g) => g.partner_id === partner.id);
  const partnerInteractions = interactions.filter((i) => i.partner_id === partner.id);

  const lastInteraction = partnerInteractions[0];
  const health = calculateDonorHealth(partner, lastInteraction?.interaction_date);

  const totalUsd = partnerDonations
    .filter((d) => d.currency === "USD")
    .reduce((s, d) => s + Number(d.amount), 0);
  const totalYer = partnerDonations
    .filter((d) => d.currency === "YER")
    .reduce((s, d) => s + Number(d.amount), 0);

  // Generate Donor Impact Report Document
  const generateImpactReportDoc = (): ReportDoc => {
    return {
      title: `تقرير أثر المانح والشريك: ${partner.name}`,
      subtitle: "مؤسسة اليتيم التنموية - إدارة العلاقات العامة وحشد الموارد",
      periodLabel: `تاريخ التقرير: ${new Date().toLocaleDateString("ar-EG")}`,
      meta: [
        { label: "اسم الشريك", value: partner.name },
        { label: "تصنيف الجهة", value: PARTNER_TYPE_LABELS[partner.type] },
        { label: "حالة العلاقة", value: PARTNER_STATUS_LABELS[partner.status] },
        { label: "المسؤول المؤسسي", value: partner.assigned_employee_name || "غير محدد" },
        { label: "إجمالي الدعم النقدي (USD)", value: `$${totalUsd.toLocaleString()}` },
        { label: "إجمالي الدعم النقدي (YER)", value: `${totalYer.toLocaleString()} YER` },
      ],
      sections: [
        {
          heading: "1. ملخص مسيرة الشراكة والأثر التنموي",
          paragraphs: [
            `تمثل الشراكة الاستراتيجية مع (${partner.name}) أحد أهم الروافد التنموية الداعمة لمشاريع رعاية وتعليم وتدريب الأيتام في مؤسسة اليتيم التنموية. أسهمت هذه الشراكة في تمكين مئات الأيتام وفتح آفاق مستقبلية واعدة لهم عبر برامج التعليم الحرفي والتمكين الاقتصادي والرعاية المعيشية.`,
            `تثمن المؤسسة عالياً هذا الدور الإنساني الرائد، وتؤكد التزامها التام بمبادئ الشفافية والمساءلة وتوجيه كافة التبرعات والمساهمات إلى مصارفها التنموية المستهدفة بدقة ومهنية.`,
          ],
        },
        {
          heading: "2. سجل التبرعات والمساهمات المقدمة",
          paragraphs: [
            `إجمالي المساهمات المسجلة: ${partnerDonations.length} مساهمة (نقدية وعينية).`,
          ],
          table: {
            columns: ["تاريخ الاستلام", "نوع التبرع", "القيمة / الوصف", "المشروع المستهدف", "رقم السند"],
            rows: partnerDonations.map((d) => [
              d.received_date,
              DONATION_TYPE_LABELS[d.donation_type],
              d.donation_type === "cash"
                ? `${Number(d.amount).toLocaleString()} ${d.currency}`
                : d.in_kind_description || "منحة عينية",
              d.target_project,
              d.receipt_no || "—",
            ]),
          },
        },
        {
          heading: "3. مذكرات التفاهم وبروتوكولات التعاون المشترك",
          table: {
            columns: ["رقم الوثيقة", "عنوان الاتفاقية", "تاريخ البدء", "تاريخ الانتهاء", "الحالة"],
            rows: partnerAgreements.map((a) => [
              a.reference_no || "—",
              a.title,
              a.start_date,
              a.end_date || "مفتوح",
              AGREEMENT_STATUS_LABELS[a.status],
            ]),
          },
        },
      ],
      branding: {
        org_name: branding.org_name || "مؤسسة اليتيم التنموية",
        system_name: branding.system_name || "نظام مدير",
        logoUrl: branding.logoUrl || null,
      },
    };
  };

  const handleExportWord = () => {
    try {
      const doc = generateImpactReportDoc();
      exportWord(doc, `تقرير-أثر-${partner.name}`);
      toast.success("تم تصدير تقرير أثر المانح بصيغة Word بنجاح");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  const handleExportPdf = () => {
    try {
      const doc = generateImpactReportDoc();
      exportPdf(doc);
      toast.success("تم فتح نافذة طباعة وتصدير تقرير أثر المانح (PDF)");
    } catch (e: any) {
      toast.error(e.message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-5xl max-h-[92vh] overflow-y-auto" dir="rtl">
        <DialogHeader className="pb-3 border-b space-y-3">
          <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <DialogTitle className="text-xl font-bold text-foreground">
                  {partner.name}
                </DialogTitle>
                <Badge variant="outline" className="text-xs">
                  {PARTNER_TYPE_LABELS[partner.type]}
                </Badge>
                <Badge
                  variant="secondary"
                  className={
                    partner.status === "active"
                      ? "bg-emerald-100 text-emerald-800"
                      : "bg-muted text-muted-foreground"
                  }
                >
                  {PARTNER_STATUS_LABELS[partner.status]}
                </Badge>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                مسؤول الحساب: {partner.assigned_employee_name || "غير محدد"} | تاريخ التسجيل: {partner.created_at?.split("T")[0]}
              </p>
            </div>

            {/* أزرار الإجراءات السريعة */}
            <div className="flex flex-wrap items-center gap-1.5">
              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1"
                onClick={() => onOpenCatalog(partner)}
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                كتالوج المشاريع
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1"
                onClick={handleExportWord}
              >
                <FileDown className="w-3.5 h-3.5 text-blue-600" />
                تقرير أثر (Word)
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1"
                onClick={handleExportPdf}
              >
                <Printer className="w-3.5 h-3.5 text-emerald-600" />
                طباعة (PDF)
              </Button>

              <Button
                variant="outline"
                size="sm"
                className="text-xs h-8 gap-1"
                onClick={() => {
                  onEdit(partner);
                  onOpenChange(false);
                }}
              >
                <Pencil className="w-3.5 h-3.5" />
                تعديل
              </Button>

              <Button
                variant="ghost"
                size="sm"
                className="text-xs h-8 text-destructive hover:bg-destructive/10"
                onClick={() => {
                  onDelete(partner);
                  onOpenChange(false);
                }}
              >
                <Trash2 className="w-3.5 h-3.5" />
              </Button>
            </div>
          </div>

          {/* بطاقات المؤشرات والاتصال */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 pt-1">
            <div className="p-3 bg-muted/40 rounded-xl border space-y-1">
              <span className="text-[11px] text-muted-foreground">مؤشر تفاعل المانح</span>
              <div className="flex items-center gap-1.5">
                <span className={`text-lg font-bold ${health.color}`}>{health.score}%</span>
                <span className="text-xs text-muted-foreground">({health.label})</span>
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border space-y-1">
              <span className="text-[11px] text-muted-foreground">إجمالي المساهمات (USD)</span>
              <div className="text-lg font-bold text-emerald-600">
                ${totalUsd.toLocaleString()}
                {totalYer > 0 && (
                  <span className="text-xs font-normal text-muted-foreground block">
                    +{totalYer.toLocaleString()} YER
                  </span>
                )}
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border space-y-1">
              <span className="text-[11px] text-muted-foreground">مذكرات التفاهم والعقود</span>
              <div className="text-lg font-bold text-blue-600">
                {partnerAgreements.length}{" "}
                <span className="text-xs text-muted-foreground font-normal">وثائق</span>
              </div>
            </div>

            <div className="p-3 bg-muted/40 rounded-xl border space-y-1">
              <span className="text-[11px] text-muted-foreground">بيانات الاتصال</span>
              <div className="text-xs space-y-0.5 truncate">
                {partner.contact_person && <div>الممثل: {partner.contact_person}</div>}
                {partner.phone && <div dir="ltr" className="text-right">{partner.phone}</div>}
              </div>
            </div>
          </div>
        </DialogHeader>

        {/* التبويبات الداخلية للملف التعريفي */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4 pt-2">
          <div className="flex justify-between items-center">
            <TabsList className="grid grid-cols-4 w-full md:w-auto">
              <TabsTrigger value="donations" className="text-xs gap-1">
                <Coins className="w-3.5 h-3.5" />
                المساهمات ({partnerDonations.length})
              </TabsTrigger>
              <TabsTrigger value="grants" className="text-xs gap-1">
                <Sparkles className="w-3.5 h-3.5" />
                المقترحات ({partnerGrants.length})
              </TabsTrigger>
              <TabsTrigger value="interactions" className="text-xs gap-1">
                <Calendar className="w-3.5 h-3.5" />
                الزيارات واللقاءات ({partnerInteractions.length})
              </TabsTrigger>
              <TabsTrigger value="agreements" className="text-xs gap-1">
                <FileCheck className="w-3.5 h-3.5" />
                مذكرات التفاهم ({partnerAgreements.length})
              </TabsTrigger>
            </TabsList>

            {/* أزرار إضافة مرتبطة بالشريك */}
            {activeTab === "donations" && (
              <Button
                size="sm"
                onClick={() => onAddDonation(partner.id)}
                className="text-xs h-8 gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                تسجيل تبرع
              </Button>
            )}
            {activeTab === "grants" && (
              <Button
                size="sm"
                onClick={() => onAddGrant(partner.id)}
                className="text-xs h-8 gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                فرصة تمويل
              </Button>
            )}
            {activeTab === "interactions" && (
              <Button
                size="sm"
                onClick={() => onAddInteraction(partner.id)}
                className="text-xs h-8 gap-1"
              >
                <Plus className="w-3.5 h-3.5" />
                توثيق لقاء
              </Button>
            )}
          </div>

          {/* 1. المساهمات والتبرعات */}
          <TabsContent value="donations" className="space-y-3">
            {partnerDonations.map((d) => (
              <Card key={d.id} className="p-3 text-xs flex justify-between items-center">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-foreground">
                      {d.donation_type === "cash"
                        ? `${Number(d.amount).toLocaleString()} ${d.currency}`
                        : DONATION_TYPE_LABELS[d.donation_type]}
                    </span>
                    <Badge variant="outline" className="text-[10px]">
                      {d.target_project}
                    </Badge>
                  </div>
                  {d.in_kind_description && (
                    <p className="text-muted-foreground">{d.in_kind_description}</p>
                  )}
                  <p className="text-[10px] text-muted-foreground">
                    تاريخ الاستلام: {d.received_date} {d.receipt_no && `| رقم السند: ${d.receipt_no}`}
                  </p>
                </div>
                {d.thank_you_task_id && (
                  <Badge variant="secondary" className="text-[10px] bg-emerald-50 text-emerald-700">
                    تم توليد مهمة شكر ✓
                  </Badge>
                )}
              </Card>
            ))}
            {partnerDonations.length === 0 && (
              <p className="text-center py-8 text-xs text-muted-foreground">
                لم يتم تسجيل أي تبرعات أو مساهمات لهذا الشريك بعد.
              </p>
            )}
          </TabsContent>

          {/* 2. المقترحات وقمع التمويل */}
          <TabsContent value="grants" className="space-y-3">
            {partnerGrants.map((g) => (
              <Card key={g.id} className="p-3 text-xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{g.project_title}</h4>
                    <p className="text-muted-foreground text-[11px]">
                      القطاع: {GRANT_SECTOR_LABELS[g.target_sector]}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {GRANT_STAGE_LABELS[g.stage]}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-muted-foreground pt-1 border-t text-[11px]">
                  <span className="font-bold text-primary">
                    المبلغ: ${Number(g.estimated_amount).toLocaleString()} {g.currency}
                  </span>
                  <span>المسؤول: {g.lead_writer_name || "غير محدد"}</span>
                </div>
              </Card>
            ))}
            {partnerGrants.length === 0 && (
              <p className="text-center py-8 text-xs text-muted-foreground">
                لا توجد مقترحات تمويل مسجلة لهذا الشريك. يمكنك تقديم مشروع من الكتالوج.
              </p>
            )}
          </TabsContent>

          {/* 3. الزيارات والتفاعلات */}
          <TabsContent value="interactions" className="space-y-3">
            {partnerInteractions.map((i) => (
              <Card key={i.id} className="p-3 text-xs space-y-2">
                <div className="flex justify-between items-start">
                  <div className="flex items-center gap-2">
                    <Badge variant="secondary" className="text-[10px]">
                      {INTERACTION_TYPE_LABELS[i.interaction_type]}
                    </Badge>
                    <span className="font-bold text-foreground">{i.title}</span>
                  </div>
                  <span className="text-[10px] text-muted-foreground">{i.interaction_date}</span>
                </div>
                {i.summary && <p className="text-muted-foreground">{i.summary}</p>}
                {i.next_action && (
                  <div className="p-2 rounded bg-primary/5 text-primary text-[11px] font-medium">
                    الإجراء التالي: {i.next_action}
                  </div>
                )}
              </Card>
            ))}
            {partnerInteractions.length === 0 && (
              <p className="text-center py-8 text-xs text-muted-foreground">
                لا توجد لقاءات أو زيارات ميدانية مسجلة حتى الآن.
              </p>
            )}
          </TabsContent>

          {/* 4. مذكرات التفاهم */}
          <TabsContent value="agreements" className="space-y-3">
            {partnerAgreements.map((a) => (
              <Card key={a.id} className="p-3 text-xs space-y-2">
                <div className="flex justify-between items-start">
                  <div>
                    <h4 className="font-bold text-sm text-foreground">{a.title}</h4>
                    <p className="text-[10px] text-muted-foreground">الكود: {a.reference_no || "—"}</p>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {AGREEMENT_STATUS_LABELS[a.status]}
                  </Badge>
                </div>
                <div className="flex justify-between items-center text-muted-foreground pt-1 border-t text-[11px]">
                  <span>تاريخ السريان: {a.start_date} إلى {a.end_date || "مفتوح"}</span>
                  {Number(a.total_value) > 0 && (
                    <span className="font-bold text-primary">
                      القيمة: {Number(a.total_value).toLocaleString()} {a.currency}
                    </span>
                  )}
                </div>
              </Card>
            ))}
            {partnerAgreements.length === 0 && (
              <p className="text-center py-8 text-xs text-muted-foreground">
                لا توجد مذكرات تفاهم أو عقود مسجلة لهذا الشريك.
              </p>
            )}
          </TabsContent>
        </Tabs>

        <div className="pt-4 border-t flex items-center justify-between">
          <Link
            to="/correspondence"
            className="text-xs text-primary hover:underline flex items-center gap-1"
          >
            <Mail className="w-3.5 h-3.5" />
            فتح سجل المراسلات الإدارية والصادر والوارد لمتابعة الخطابات الرسمية
          </Link>
          <Button variant="outline" size="sm" onClick={() => onOpenChange(false)}>
            إغلاق
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
