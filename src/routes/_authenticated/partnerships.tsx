import { useState, useMemo } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  Flame,
  Globe,
  Handshake,
  Heart,
  HeartHandshake,
  Layers,
  ListFilter,
  Mail,
  Megaphone,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Sparkles,
  TrendingUp,
  AlertCircle,
  Eye,
  LayoutGrid,
  Table as TableIcon,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import {
  PARTNER_STATUS_LABELS,
  PARTNER_TYPE_LABELS,
  INTERACTION_TYPE_LABELS,
  AGREEMENT_STATUS_LABELS,
  AGREEMENT_TYPE_LABELS,
  GRANT_SECTOR_LABELS,
  GRANT_STAGE_LABELS,
  GRANT_STAGES,
  DONATION_TYPE_LABELS,
  TRANCHE_STATUS_LABELS,
  EVENT_STATUS_LABELS,
  EVENT_TYPE_LABELS,
  calculateDonorHealth,
  type AgreementRow,
  type DonationRow,
  type EventRow,
  type GrantOpportunityRow,
  type InteractionRow,
  type PartnerRow,
  type PaymentTrancheRow,
  type GrantStage,
} from "@/lib/pr-crm";
import {
  checkAndSyncExpiringAgreements,
  recordDonationWithSync,
  recordInteractionWithSync,
  scheduleTrancheWithSync,
  createPrTask,
} from "@/lib/pr-crm.functions";
import { PartnerDialog, type PartnerFormValues } from "@/components/pr/PartnerDialog";
import { InteractionDialog, type InteractionFormValues } from "@/components/pr/InteractionDialog";
import { GrantOpportunityDialog, type GrantFormValues } from "@/components/pr/GrantOpportunityDialog";
import { DonationTrancheDialog, type DonationFormValues } from "@/components/pr/DonationTrancheDialog";
import { AgreementDialog, type AgreementFormValues } from "@/components/pr/AgreementDialog";
import { EventDialog, type EventFormValues } from "@/components/pr/EventDialog";
import { PartnerProfileDialog } from "@/components/pr/PartnerProfileDialog";
import { PartnerDeleteDialog } from "@/components/pr/PartnerDeleteDialog";
import { ProjectPitchCatalogDialog } from "@/components/pr/ProjectPitchCatalogDialog";
import { PartnerTableView } from "@/components/pr/PartnerTableView";
import type { ProjectPitchItem } from "@/lib/pr-catalog";

export const Route = createFileRoute("/_authenticated/partnerships")({
  head: () => ({
    meta: [
      { title: "العلاقات العامة وحشد الموارد | مدير" },
      {
        name: "description",
        content: "إدارة دورة حياة الشركاء والمانحين، قمع فرص التمويل، وجدولة الدفعات والمهام في مؤسسة اليتيم.",
      },
    ],
  }),
  errorComponent: ({ error, reset }) => (
    <div className="p-8 text-center space-y-4 max-w-xl mx-auto my-12" dir="rtl">
      <div className="p-6 bg-destructive/10 border border-destructive/20 text-destructive rounded-2xl space-y-2">
        <h2 className="text-lg font-bold text-foreground">تنبيه: يلزم تطبيق ملف الهجرة على قاعدة بيانات Supabase</h2>
        <p className="text-xs text-muted-foreground leading-relaxed">
          {error?.message || "يرجى التأكد من تطبيق ملف الهجرة `20260914000000_pr_resource_mobilization_suite.sql` على قاعدة بيانات المشروع في Supabase لإنشاء الجداول المخصصة."}
        </p>
      </div>
      <div>
        <Button onClick={() => reset()} variant="outline" size="sm">
          إعادة تحميل الصفحة
        </Button>
      </div>
    </div>
  ),
  component: PartnershipsPage,
});

function PartnershipsPage() {
  const { employee, isDirector, isHR } = useAuth();
  const qc = useQueryClient();

  const [activeTab, setActiveTab] = useState("overview");
  const [partnerSearch, setPartnerSearch] = useState("");
  const [partnerTypeFilter, setPartnerTypeFilter] = useState("all");
  const [partnerStatusFilter, setPartnerStatusFilter] = useState("all");
  const [partnerViewMode, setPartnerViewMode] = useState<"cards" | "table">("cards");

  // Dialogs
  const [partnerDialog, setPartnerDialog] = useState<{ open: boolean; partner?: PartnerRow | null }>({
    open: false,
  });
  const [partnerProfileDialog, setPartnerProfileDialog] = useState<{
    open: boolean;
    partner?: PartnerRow | null;
  }>({
    open: false,
  });
  const [partnerDeleteDialog, setPartnerDeleteDialog] = useState<{
    open: boolean;
    partner?: PartnerRow | null;
  }>({
    open: false,
  });
  const [catalogDialog, setCatalogDialog] = useState<{
    open: boolean;
    partner?: PartnerRow | null;
  }>({
    open: false,
  });
  const [interactionDialog, setInteractionDialog] = useState<{ open: boolean; partnerId?: string }>({
    open: false,
  });
  const [grantDialog, setGrantDialog] = useState<{ open: boolean; opportunity?: GrantOpportunityRow | null }>({
    open: false,
  });
  const [donationDialog, setDonationDialog] = useState<{
    open: boolean;
    kind: "donation" | "tranche";
    partnerId?: string;
  }>({
    open: false,
    kind: "donation",
  });
  const [agreementDialog, setAgreementDialog] = useState<{ open: boolean; agreement?: AgreementRow | null }>({
    open: false,
  });
  const [eventDialog, setEventDialog] = useState<{ open: boolean; eventItem?: EventRow | null }>({
    open: false,
  });

  // Queries
  const { data: employees = [] } = useQuery({
    queryKey: ["employees-lite"],
    queryFn: async () => {
      const { data } = await supabase.from("employees").select("id, full_name").order("full_name");
      return data ?? [];
    },
  });

  const { data: partners = [], isLoading: loadingPartners } = useQuery({
    queryKey: ["pr-partners"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("pr_partners" as any)
          .select("*, assigned_employee:employees!assigned_employee_id(full_name)")
          .order("created_at", { ascending: false });
        if (error) {
          // Fallback without join
          const fb = await supabase.from("pr_partners" as any).select("*").order("created_at", { ascending: false });
          return (fb.data || []) as PartnerRow[];
        }
        return (data || []).map((row: any) => ({
          ...row,
          assigned_employee_name: row.assigned_employee?.full_name || null,
        })) as PartnerRow[];
      } catch {
        return [];
      }
    },
  });

  const { data: interactions = [] } = useQuery({
    queryKey: ["pr-interactions"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("pr_interactions" as any)
          .select("*, pr_partners(name)")
          .order("interaction_date", { ascending: false });
        if (error) {
          const fb = await supabase.from("pr_interactions" as any).select("*").order("interaction_date", { ascending: false });
          return (fb.data || []) as InteractionRow[];
        }
        return (data || []).map((row: any) => ({
          ...row,
          partner_name: row.pr_partners?.name || "",
        })) as InteractionRow[];
      } catch {
        return [];
      }
    },
  });

  const { data: agreements = [] } = useQuery({
    queryKey: ["pr-agreements"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("pr_agreements" as any)
          .select("*, pr_partners(name), assigned_employee:employees!assigned_employee_id(full_name)")
          .order("start_date", { ascending: false });
        if (error) {
          const fb = await supabase.from("pr_agreements" as any).select("*").order("start_date", { ascending: false });
          return (fb.data || []) as AgreementRow[];
        }
        return (data || []).map((row: any) => ({
          ...row,
          partner_name: row.pr_partners?.name || "",
          assigned_employee_name: row.assigned_employee?.full_name || null,
        })) as AgreementRow[];
      } catch {
        return [];
      }
    },
  });

  const { data: grants = [] } = useQuery({
    queryKey: ["pr-grants"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("pr_grant_opportunities" as any)
          .select("*, pr_partners(name), lead_writer:employees!lead_writer_id(full_name)")
          .order("created_at", { ascending: false });
        if (error) {
          const fb = await supabase.from("pr_grant_opportunities" as any).select("*").order("created_at", { ascending: false });
          return (fb.data || []) as GrantOpportunityRow[];
        }
        return (data || []).map((row: any) => ({
          ...row,
          partner_name: row.pr_partners?.name || "",
          lead_writer_name: row.lead_writer?.full_name || null,
        })) as GrantOpportunityRow[];
      } catch {
        return [];
      }
    },
  });

  const { data: donations = [] } = useQuery({
    queryKey: ["pr-donations"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("pr_donations" as any)
          .select("*, pr_partners(name)")
          .order("received_date", { ascending: false });
        if (error) {
          const fb = await supabase.from("pr_donations" as any).select("*").order("received_date", { ascending: false });
          return (fb.data || []) as DonationRow[];
        }
        return (data || []).map((row: any) => ({
          ...row,
          partner_name: row.pr_partners?.name || "",
        })) as DonationRow[];
      } catch {
        return [];
      }
    },
  });

  const { data: tranches = [] } = useQuery({
    queryKey: ["pr-tranches"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("pr_payment_tranches" as any)
          .select("*, pr_partners(name), pr_agreements(title)")
          .order("due_date", { ascending: true });
        if (error) {
          const fb = await supabase.from("pr_payment_tranches" as any).select("*").order("due_date", { ascending: true });
          return (fb.data || []) as PaymentTrancheRow[];
        }
        return (data || []).map((row: any) => ({
          ...row,
          partner_name: row.pr_partners?.name || "",
          agreement_title: row.pr_agreements?.title || "",
        })) as PaymentTrancheRow[];
      } catch {
        return [];
      }
    },
  });

  const { data: events = [] } = useQuery({
    queryKey: ["pr-events"],
    queryFn: async () => {
      try {
        const { data, error } = await supabase
          .from("pr_events" as any)
          .select("*, coordinator:employees!coordinator_id(full_name)")
          .order("event_date", { ascending: false });
        if (error) {
          const fb = await supabase.from("pr_events" as any).select("*").order("event_date", { ascending: false });
          return (fb.data || []) as EventRow[];
        }
        return (data || []).map((row: any) => ({
          ...row,
          coordinator_name: row.coordinator?.full_name || null,
        })) as EventRow[];
      } catch {
        return [];
      }
    },
  });

  // Invalidate helper
  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["pr-partners"] });
    qc.invalidateQueries({ queryKey: ["pr-interactions"] });
    qc.invalidateQueries({ queryKey: ["pr-agreements"] });
    qc.invalidateQueries({ queryKey: ["pr-grants"] });
    qc.invalidateQueries({ queryKey: ["pr-donations"] });
    qc.invalidateQueries({ queryKey: ["pr-tranches"] });
    qc.invalidateQueries({ queryKey: ["pr-events"] });
    qc.invalidateQueries({ queryKey: ["tasks"] });
  };

  // Mutations
  const partnerMutation = useMutation({
    mutationFn: async (v: PartnerFormValues) => {
      const payload = {
        name: v.name.trim(),
        type: v.type,
        contact_person: v.contact_person || null,
        phone: v.phone || null,
        email: v.email || null,
        address: v.address || null,
        website: v.website || null,
        interest_level: v.interest_level,
        influence_level: v.influence_level,
        status: v.status,
        notes: v.notes || null,
        assigned_employee_id: v.assigned_employee_id === "none" ? null : v.assigned_employee_id,
      };

      if (partnerDialog.partner?.id) {
        const { error } = await supabase
          .from("pr_partners" as any)
          .update(payload)
          .eq("id", partnerDialog.partner.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pr_partners" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(partnerDialog.partner ? "تم تحديث بيانات الشريك" : "تمت إضافة الشريك بنجاح");
      setPartnerDialog({ open: false });
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const partnerDeleteMutation = useMutation({
    mutationFn: async (partnerId: string) => {
      const { error } = await supabase.from("pr_partners" as any).delete().eq("id", partnerId);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الشريك وكافة السجلات المرتبطة به بنجاح");
      setPartnerDeleteDialog({ open: false });
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const handleSelectPitch = (pitch: ProjectPitchItem) => {
    setGrantDialog({
      open: true,
      opportunity: {
        id: "",
        partner_id: catalogDialog.partner?.id || partners[0]?.id || "",
        partner_name: catalogDialog.partner?.name || "",
        project_title: pitch.title,
        target_sector: pitch.sector,
        stage: "opportunity",
        estimated_amount: pitch.estimatedAmount,
        currency: pitch.currency,
        submission_deadline: null,
        decision_date: null,
        lead_writer_id: null,
        task_id: null,
        concept_summary: `${pitch.summary}\n\nأبرز المخرجات المتوقعة:\n- ${pitch.keyOutcomes.join("\n- ")}`,
        notes: `المستفيدون المستهدفون: ${pitch.targetBeneficiaries} | المدة الزمنية: ${pitch.durationMonths} أشهر`,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      },
    });
  };

  const interactionMutation = useMutation({
    mutationFn: async (v: InteractionFormValues) => {
      const partner = partners.find((p) => p.id === v.partner_id);
      await recordInteractionWithSync(
        {
          partner_id: v.partner_id,
          interaction_type: v.interaction_type,
          title: v.title.trim(),
          interaction_date: v.interaction_date,
          location: v.location || null,
          summary: v.summary || null,
          minutes: v.minutes || null,
          attendees: v.attendees || null,
          next_action: v.next_action || null,
          created_by: null,
        },
        partner?.name || "الجهة الشريكة",
        v.create_task,
        v.assigned_employee_id
      );
    },
    onSuccess: () => {
      toast.success("تم توثيق التفاعل وتوليد المهام في النظام بنجاح");
      setInteractionDialog({ open: false });
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const grantMutation = useMutation({
    mutationFn: async (v: GrantFormValues) => {
      const partner = partners.find((p) => p.id === v.partner_id);
      let taskId: string | null = null;

      if (v.create_task && v.lead_writer_id) {
        taskId = await createPrTask({
          title: `صياغة مقترح مشروع: ${v.project_title}`,
          description: `المانح: ${partner?.name || "غير محدد"}\nالقطاع: ${GRANT_SECTOR_LABELS[v.target_sector]}\nالمبلغ التقديري: ${v.estimated_amount.toLocaleString()} ${v.currency}\nالموعد النهائي: ${v.submission_deadline || "غير محدد"}\nملخص: ${v.concept_summary || ""}`,
          assignee_id: v.lead_writer_id,
          priority: "high",
          due_date: v.submission_deadline || null,
          weight: 4,
        });
      }

      const payload = {
        partner_id: v.partner_id,
        project_title: v.project_title.trim(),
        target_sector: v.target_sector,
        stage: v.stage,
        estimated_amount: v.estimated_amount,
        currency: v.currency,
        submission_deadline: v.submission_deadline || null,
        decision_date: v.decision_date || null,
        lead_writer_id: v.lead_writer_id || null,
        concept_summary: v.concept_summary || null,
        notes: v.notes || null,
        task_id: taskId,
      };

      if (grantDialog.opportunity?.id) {
        const { error } = await supabase
          .from("pr_grant_opportunities" as any)
          .update(payload)
          .eq("id", grantDialog.opportunity.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pr_grant_opportunities" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم تسجيل فرصة التمويل وإسناد المهام بنجاح");
      setGrantDialog({ open: false });
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const donationTrancheMutation = useMutation({
    mutationFn: async (v: DonationFormValues) => {
      const partner = partners.find((p) => p.id === v.partner_id);
      const partnerName = partner?.name || "الجهة المانحة";

      if (v.kind === "donation") {
        await recordDonationWithSync(
          {
            partner_id: v.partner_id,
            grant_opportunity_id: null,
            donation_type: v.donation_type,
            amount: v.amount,
            currency: v.currency,
            in_kind_description: v.in_kind_description || null,
            target_project: v.target_project.trim(),
            received_date: v.received_date,
            receipt_no: v.receipt_no || null,
            notes: null,
          },
          partnerName,
          v.auto_thank_you_task,
          v.responsible_employee_id
        );
      } else {
        await scheduleTrancheWithSync(
          {
            partner_id: v.partner_id,
            agreement_id: v.agreement_id || null,
            tranche_number: v.tranche_number,
            due_date: v.due_date,
            amount: v.amount,
            currency: v.currency,
            condition_milestone: v.condition_milestone || null,
            status: "scheduled",
            notes: null,
          },
          partnerName,
          v.auto_report_task,
          v.responsible_employee_id
        );
      }
    },
    onSuccess: (_, v) => {
      toast.success(
        v.kind === "donation"
          ? "تم تسجيل التبرع وتوليد مهمة الشكر والإيصال"
          : "تمت جدولة الدفعة وتوليد مهمة التقرير الفني"
      );
      setDonationDialog({ open: false, kind: "donation" });
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const agreementMutation = useMutation({
    mutationFn: async (v: AgreementFormValues) => {
      const payload = {
        partner_id: v.partner_id,
        reference_no: v.reference_no || null,
        title: v.title.trim(),
        agreement_type: v.agreement_type,
        start_date: v.start_date,
        end_date: v.end_date || null,
        total_value: v.total_value,
        currency: v.currency,
        document_url: v.document_url || null,
        status: v.status,
        assigned_employee_id: v.assigned_employee_id || null,
        notes: v.notes || null,
      };

      if (agreementDialog.agreement?.id) {
        const { error } = await supabase
          .from("pr_agreements" as any)
          .update(payload)
          .eq("id", agreementDialog.agreement.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pr_agreements" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم حفظ مذكرة التفاهم / الاتفاقية بنجاح");
      setAgreementDialog({ open: false });
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  const eventMutation = useMutation({
    mutationFn: async (v: EventFormValues) => {
      let prepTaskId: string | null = null;
      if (v.create_prep_task && v.coordinator_id) {
        prepTaskId = await createPrTask({
          title: `تجهيز وتنظيم: ${v.title}`,
          description: `نوع الفعالية: ${EVENT_TYPE_LABELS[v.event_type]}\nالتاريخ: ${v.event_date}\nالموقع: ${v.location || "المقر"}\nالجمهور: ${v.target_audience || ""}\nيرجى التنسيق مع الأقسام المعنية وتجهيز المتطلبات اللوجستية والإعلامية.`,
          assignee_id: v.coordinator_id,
          priority: "urgent",
          due_date: v.event_date,
          weight: 4,
        });
      }

      const payload = {
        title: v.title.trim(),
        event_type: v.event_type,
        event_date: v.event_date,
        location: v.location || null,
        budget: v.budget,
        target_audience: v.target_audience || null,
        media_links: v.media_links || null,
        coordinator_id: v.coordinator_id || null,
        status: v.status,
        notes: v.notes || null,
      };

      if (eventDialog.eventItem?.id) {
        const { error } = await supabase
          .from("pr_events" as any)
          .update(payload)
          .eq("id", eventDialog.eventItem.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("pr_events" as any).insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success("تم تسجيل الفعالية وتكليف فريق التنظيم");
      setEventDialog({ open: false });
      invalidateAll();
    },
    onError: (e: any) => toast.error(e.message),
  });

  // Stage move handler
  const moveGrantStage = async (id: string, newStage: GrantStage) => {
    const { error } = await supabase
      .from("pr_grant_opportunities" as any)
      .update({ stage: newStage })
      .eq("id", id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success(`تم نقل المقترح إلى: ${GRANT_STAGE_LABELS[newStage]}`);
      invalidateAll();
    }
  };

  // Smart scan for expiring MoUs
  const scanAgreements = async () => {
    if (!employee?.id) {
      toast.error("يرجى تسجيل الدخول لتشغيل الفحص");
      return;
    }
    try {
      const count = await checkAndSyncExpiringAgreements(employee.id);
      if (count > 0) {
        toast.success(`تم اكتشاف وتوليد مهام تجديد لـ ${count} اتفاقيات تقترب من الانتهاء`);
      } else {
        toast.info("لا توجد مذكرات تفاهم جديدة تنتهي خلال الـ 30 يوماً القادمة");
      }
      invalidateAll();
    } catch (err: any) {
      toast.error(err.message);
    }
  };

  // Calculations
  const stats = useMemo(() => {
    const totalDonationsUsd = donations
      .filter((d) => d.currency === "USD")
      .reduce((sum, d) => sum + Number(d.amount), 0);
    const totalDonationsYer = donations
      .filter((d) => d.currency === "YER")
      .reduce((sum, d) => sum + Number(d.amount), 0);

    const activePartnersCount = partners.filter((p) => p.status === "active").length;
    const activeAgreementsCount = agreements.filter((a) => a.status === "active").length;
    const openGrantsCount = grants.filter(
      (g) => g.stage !== "rejected" && g.stage !== "awarded"
    ).length;

    const pipelineTotalAmount = grants
      .filter((g) => g.stage !== "rejected")
      .reduce((sum, g) => sum + Number(g.estimated_amount), 0);

    return {
      totalDonationsUsd,
      totalDonationsYer,
      activePartnersCount,
      activeAgreementsCount,
      openGrantsCount,
      pipelineTotalAmount,
    };
  }, [donations, partners, agreements, grants]);

  // Filtered partners
  const filteredPartners = useMemo(() => {
    return partners.filter((p) => {
      const matchSearch =
        p.name.toLowerCase().includes(partnerSearch.toLowerCase()) ||
        (p.contact_person && p.contact_person.toLowerCase().includes(partnerSearch.toLowerCase()));
      const matchType = partnerTypeFilter === "all" || p.type === partnerTypeFilter;
      const matchStatus = partnerStatusFilter === "all" || p.status === partnerStatusFilter;
      return matchSearch && matchType && matchStatus;
    });
  }, [partners, partnerSearch, partnerTypeFilter, partnerStatusFilter]);

  return (
    <div className="space-y-6" dir="rtl">
      <PageHeader
        title="العلاقات العامة وحشد الموارد"
        description="المنظومة المتكاملة لإدارة الشركاء والمانحين، قمع فرص التمويل، وتنسيق الفعاليات والإعلام (ODF PR & Resource Mobilization)"
      >
        <div className="flex flex-wrap items-center gap-2">
          <Button variant="outline" size="sm" onClick={scanAgreements} className="gap-1">
            <RefreshCw className="w-4 h-4" />
            فحص تنبيهات التجديد
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setInteractionDialog({ open: true })}
            className="gap-1"
          >
            <Calendar className="w-4 h-4" />
            توثيق لقاء / زيارة
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setDonationDialog({ open: true, kind: "donation" })}
            className="gap-1"
          >
            <Coins className="w-4 h-4" />
            تسجيل تبرع / منحة
          </Button>

          <Button
            size="sm"
            variant="outline"
            onClick={() => setGrantDialog({ open: true })}
            className="gap-1"
          >
            <Sparkles className="w-4 h-4" />
            فرصة تمويل
          </Button>

          <Button
            size="sm"
            onClick={() => setPartnerDialog({ open: true })}
            className="gap-1 shadow-sm"
          >
            <Plus className="w-4 h-4" />
            إضافة شريك جديد
          </Button>
        </div>
      </PageHeader>

      {/* بطاقات الإحصائيات العامة */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="border-l-4 border-l-emerald-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">التبرعات المحشودة (USD)</p>
              <h3 className="text-2xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">
                ${stats.totalDonationsUsd.toLocaleString()}
              </h3>
              {stats.totalDonationsYer > 0 && (
                <p className="text-xs text-muted-foreground mt-0.5">
                  + {stats.totalDonationsYer.toLocaleString()} YER
                </p>
              )}
            </div>
            <div className="p-2 bg-emerald-100 dark:bg-emerald-950/50 rounded-xl text-emerald-600">
              <Coins className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-primary">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">الشركاء والمانحون النشطون</p>
              <h3 className="text-2xl font-bold text-primary mt-1">
                {stats.activePartnersCount} <span className="text-sm font-normal text-muted-foreground">/ {partners.length}</span>
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">شبكة الدعم المؤسسي</p>
            </div>
            <div className="p-2 bg-primary/10 rounded-xl text-primary">
              <Handshake className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-amber-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">قمع التمويل قيد المتابعة</p>
              <h3 className="text-2xl font-bold text-amber-600 dark:text-amber-400 mt-1">
                ${stats.pipelineTotalAmount.toLocaleString()}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{stats.openGrantsCount} مقترحات نشطة</p>
            </div>
            <div className="p-2 bg-amber-100 dark:bg-amber-950/50 rounded-xl text-amber-600">
              <TrendingUp className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>

        <Card className="border-l-4 border-l-blue-500">
          <CardContent className="p-4 flex items-center justify-between">
            <div>
              <p className="text-xs font-medium text-muted-foreground">مذكرات التفاهم السارية</p>
              <h3 className="text-2xl font-bold text-blue-600 dark:text-blue-400 mt-1">
                {stats.activeAgreementsCount}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">{agreements.length} اتفاقية موثقة</p>
            </div>
            <div className="p-2 bg-blue-100 dark:bg-blue-950/50 rounded-xl text-blue-600">
              <FileCheck className="w-6 h-6" />
            </div>
          </CardContent>
        </Card>
      </div>

      {/* التبويبات الرئيسية */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid grid-cols-2 md:grid-cols-7 w-full h-auto p-1 bg-muted/60">
          <TabsTrigger value="overview" className="gap-1 py-2">
            <Layers className="w-4 h-4" />
            نظرة عامة
          </TabsTrigger>
          <TabsTrigger value="partners" className="gap-1 py-2">
            <Users className="w-4 h-4" />
            سجل الشركاء ({partners.length})
          </TabsTrigger>
          <TabsTrigger value="pipeline" className="gap-1 py-2">
            <TrendingUp className="w-4 h-4" />
            قمع التمويل ({grants.length})
          </TabsTrigger>
          <TabsTrigger value="donations" className="gap-1 py-2">
            <Coins className="w-4 h-4" />
            التبرعات والدفعات
          </TabsTrigger>
          <TabsTrigger value="interactions" className="gap-1 py-2">
            <Calendar className="w-4 h-4" />
            الزيارات واللقاءات ({interactions.length})
          </TabsTrigger>
          <TabsTrigger value="agreements" className="gap-1 py-2">
            <FileText className="w-4 h-4" />
            مذكرات التفاهم ({agreements.length})
          </TabsTrigger>
          <TabsTrigger value="events" className="gap-1 py-2">
            <Megaphone className="w-4 h-4" />
            الفعاليات والإعلام ({events.length})
          </TabsTrigger>
        </TabsList>

        {/* 1. تبويب نظرة عامة (Overview & Dashboard) */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {/* مصفوفة التأثير والاهتمام (Stakeholder Matrix) */}
            <Card className="md:col-span-2">
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <Flame className="w-5 h-5 text-amber-500" />
                  مصفوفة وزن وتأثير الشركاء والمانحين (Power vs. Interest Matrix)
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-2 gap-3 min-h-[220px]">
                  <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-800/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-xs text-emerald-800 dark:text-emerald-300">
                        شركاء استراتيجيون (تأثير واهتمام عالٍ)
                      </span>
                      <Badge variant="outline" className="bg-emerald-100 text-emerald-800 text-[10px]">
                        إدارة وثيقة
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {partners
                        .filter((p) => p.influence_level >= 4 && p.interest_level >= 4)
                        .slice(0, 5)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="text-xs p-1.5 bg-background/80 rounded border flex items-center justify-between"
                          >
                            <span className="font-medium truncate">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {PARTNER_TYPE_LABELS[p.type]}
                            </span>
                          </div>
                        ))}
                      {partners.filter((p) => p.influence_level >= 4 && p.interest_level >= 4).length === 0 && (
                        <p className="text-xs text-muted-foreground text-center py-4">لا يوجد جهات في هذا الربع</p>
                      )}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-blue-50 dark:bg-blue-950/30 border border-blue-200 dark:border-blue-800/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-xs text-blue-800 dark:text-blue-300">
                        مؤثرون رئيسيون (تأثير عالٍ / اهتمام أقل)
                      </span>
                      <Badge variant="outline" className="bg-blue-100 text-blue-800 text-[10px]">
                        إبقاء الرضا
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {partners
                        .filter((p) => p.influence_level >= 4 && p.interest_level < 4)
                        .slice(0, 5)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="text-xs p-1.5 bg-background/80 rounded border flex items-center justify-between"
                          >
                            <span className="font-medium truncate">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {PARTNER_TYPE_LABELS[p.type]}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-purple-50 dark:bg-purple-950/30 border border-purple-200 dark:border-purple-800/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-xs text-purple-800 dark:text-purple-300">
                        داعمون ومتحمسون (اهتمام عالٍ / تأثير أقل)
                      </span>
                      <Badge variant="outline" className="bg-purple-100 text-purple-800 text-[10px]">
                        إبقاء الاطلاع
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {partners
                        .filter((p) => p.influence_level < 4 && p.interest_level >= 4)
                        .slice(0, 5)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="text-xs p-1.5 bg-background/80 rounded border flex items-center justify-between"
                          >
                            <span className="font-medium truncate">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {PARTNER_TYPE_LABELS[p.type]}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/50">
                    <div className="flex justify-between items-center mb-2">
                      <span className="font-bold text-xs text-amber-800 dark:text-amber-300">
                        مستكشفون محتملون (متابعة دورية)
                      </span>
                      <Badge variant="outline" className="bg-amber-100 text-amber-800 text-[10px]">
                        مراقبة وتشبيك
                      </Badge>
                    </div>
                    <div className="space-y-1.5">
                      {partners
                        .filter((p) => p.influence_level < 4 && p.interest_level < 4)
                        .slice(0, 5)
                        .map((p) => (
                          <div
                            key={p.id}
                            className="text-xs p-1.5 bg-background/80 rounded border flex items-center justify-between"
                          >
                            <span className="font-medium truncate">{p.name}</span>
                            <span className="text-[10px] text-muted-foreground">
                              {PARTNER_TYPE_LABELS[p.type]}
                            </span>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* صندوق التنبيهات الذكية ومحرك المهام */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base font-bold flex items-center gap-2">
                  <AlertCircle className="w-5 h-5 text-primary" />
                  محرك التزامن والتنبيهات المباشرة
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* الدفعات القادمة */}
                <div className="p-3 rounded-xl bg-muted/40 border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <Coins className="w-4 h-4 text-emerald-600" />
                      الدفعات المستحقة قريباً:
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {tranches.filter((t) => t.status === "scheduled").length}
                    </Badge>
                  </div>
                  {tranches
                    .filter((t) => t.status === "scheduled")
                    .slice(0, 3)
                    .map((t) => (
                      <div key={t.id} className="text-xs p-2 bg-background rounded border space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>{t.partner_name}</span>
                          <span className="text-emerald-600 font-bold">
                            {Number(t.amount).toLocaleString()} {t.currency}
                          </span>
                        </div>
                        <div className="flex justify-between text-[10px] text-muted-foreground">
                          <span>تاريخ الاستحقاق: {t.due_date}</span>
                          <span>دفعة #{t.tranche_number}</span>
                        </div>
                      </div>
                    ))}
                  {tranches.filter((t) => t.status === "scheduled").length === 0 && (
                    <p className="text-xs text-muted-foreground">لا توجد دفعات مجدولة حالياً</p>
                  )}
                </div>

                {/* الاتفاقيات المنتهية قريباً */}
                <div className="p-3 rounded-xl bg-muted/40 border space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold flex items-center gap-1.5">
                      <FileCheck className="w-4 h-4 text-blue-600" />
                      مذكرات تفاهم تحتاج تجديد:
                    </span>
                    <Badge variant="secondary" className="text-[10px]">
                      {agreements.filter((a) => a.status === "expiring_soon").length}
                    </Badge>
                  </div>
                  {agreements
                    .filter((a) => a.status === "expiring_soon")
                    .slice(0, 3)
                    .map((a) => (
                      <div key={a.id} className="text-xs p-2 bg-background rounded border space-y-1">
                        <div className="flex justify-between font-medium">
                          <span>{a.title}</span>
                          <Badge variant="outline" className="text-[10px] text-amber-600">
                            تنتهي قريباً
                          </Badge>
                        </div>
                        <p className="text-[10px] text-muted-foreground">الشريك: {a.partner_name}</p>
                      </div>
                    ))}
                  {agreements.filter((a) => a.status === "expiring_soon").length === 0 && (
                    <p className="text-xs text-muted-foreground">جميع الاتفاقيات سارية ومستقرة</p>
                  )}
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 2. تبويب سجل الشركاء والمانحين (CRM Directory) */}
        <TabsContent value="partners" className="space-y-4">
          <div className="flex flex-col md:flex-row gap-3 items-center justify-between bg-card p-3 rounded-xl border">
            <div className="relative w-full md:w-80">
              <Search className="w-4 h-4 absolute right-3 top-3 text-muted-foreground" />
              <Input
                placeholder="البحث بالاسم أو ضابط الاتصال..."
                value={partnerSearch}
                onChange={(e) => setPartnerSearch(e.target.value)}
                className="pr-9"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
              <Select value={partnerTypeFilter} onValueChange={setPartnerTypeFilter}>
                <SelectTrigger className="w-[170px]">
                  <SelectValue placeholder="نوع الجهة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الأنواع</SelectItem>
                  {Object.entries(PARTNER_TYPE_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Select value={partnerStatusFilter} onValueChange={setPartnerStatusFilter}>
                <SelectTrigger className="w-[150px]">
                  <SelectValue placeholder="الحالة" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">كل الحالات</SelectItem>
                  {Object.entries(PARTNER_STATUS_LABELS).map(([k, v]) => (
                    <SelectItem key={k} value={k}>
                      {v}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>

              <Button
                variant="outline"
                size="sm"
                className="gap-1 text-xs h-9"
                onClick={() => setCatalogDialog({ open: true })}
              >
                <Sparkles className="w-3.5 h-3.5 text-primary" />
                كتالوج المشاريع
              </Button>

              {/* مبدل نمط العرض: بطاقات / جدول */}
              <div className="flex items-center gap-1 bg-muted/60 p-1 rounded-lg border">
                <Button
                  variant={partnerViewMode === "cards" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPartnerViewMode("cards")}
                  title="عرض البطاقات"
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </Button>
                <Button
                  variant={partnerViewMode === "table" ? "default" : "ghost"}
                  size="sm"
                  className="h-7 px-2 text-xs"
                  onClick={() => setPartnerViewMode("table")}
                  title="عرض الجدول"
                >
                  <TableIcon className="w-3.5 h-3.5" />
                </Button>
              </div>
            </div>
          </div>

          {loadingPartners ? (
            <ListSkeleton />
          ) : filteredPartners.length === 0 ? (
            <EmptyState
              title="لم يتم العثور على شركاء"
              description="أضف شركاء ومانحين جدد لبدء بناء قاعدة بيانات العلاقات وحشد الموارد."
              actionLabel="إضافة شريك جديد"
              onAction={() => setPartnerDialog({ open: true })}
            />
          ) : partnerViewMode === "table" ? (
            <PartnerTableView
              partners={filteredPartners}
              interactions={interactions}
              onViewProfile={(p) => setPartnerProfileDialog({ open: true, partner: p })}
              onEdit={(p) => setPartnerDialog({ open: true, partner: p })}
              onDelete={(p) => setPartnerDeleteDialog({ open: true, partner: p })}
              onAddDonation={(pId) =>
                setDonationDialog({ open: true, kind: "donation", partnerId: pId })
              }
              onAddInteraction={(pId) =>
                setInteractionDialog({ open: true, partnerId: pId })
              }
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {filteredPartners.map((p) => {
                const lastInter = interactions.find((i) => i.partner_id === p.id);
                const health = calculateDonorHealth(p, lastInter?.interaction_date);
                return (
                  <Card key={p.id} className="hover:shadow-md transition-shadow relative">
                    <CardHeader className="pb-2">
                      <div className="flex justify-between items-start">
                        <div className="space-y-1">
                          <button
                            onClick={() => setPartnerProfileDialog({ open: true, partner: p })}
                            className="text-base font-bold text-foreground hover:text-primary transition-colors text-right block"
                          >
                            {p.name}
                          </button>
                          <Badge variant="outline" className="text-xs">
                            {PARTNER_TYPE_LABELS[p.type]}
                          </Badge>
                        </div>
                        <Badge
                          variant="secondary"
                          className={
                            p.status === "active"
                              ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                              : "bg-muted text-muted-foreground"
                          }
                        >
                          {PARTNER_STATUS_LABELS[p.status]}
                        </Badge>
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-3 pt-1">
                      {/* معلومات الاتصال */}
                      <div className="space-y-1 text-xs text-muted-foreground">
                        {p.contact_person && (
                          <div className="flex items-center gap-1.5">
                            <span className="font-semibold text-foreground">ضابط الاتصال:</span>
                            <span>{p.contact_person}</span>
                          </div>
                        )}
                        {p.phone && (
                          <div className="flex items-center gap-1.5">
                            <Phone className="w-3.5 h-3.5 text-muted-foreground" />
                            <span dir="ltr">{p.phone}</span>
                          </div>
                        )}
                        {p.email && (
                          <div className="flex items-center gap-1.5">
                            <Mail className="w-3.5 h-3.5 text-muted-foreground" />
                            <span dir="ltr">{p.email}</span>
                          </div>
                        )}
                      </div>

                      {/* مؤشر العلاقة والصحة */}
                      <div className="p-2.5 rounded-lg bg-muted/40 border flex items-center justify-between text-xs">
                        <span className="text-muted-foreground">درجة تفاعل المانح:</span>
                        <div className="flex items-center gap-1.5">
                          <span className={`font-bold ${health.color}`}>
                            {health.score}% - {health.label}
                          </span>
                        </div>
                      </div>

                      {/* أزرار الإجراءات السريعة */}
                      <div className="flex flex-wrap items-center gap-1.5 pt-2 border-t">
                        <Button
                          variant="outline"
                          size="sm"
                          className="flex-1 text-xs h-8 gap-1"
                          onClick={() => setPartnerProfileDialog({ open: true, partner: p })}
                        >
                          <Eye className="w-3.5 h-3.5 text-primary" />
                          الملف الشامل
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2"
                          title="توثيق لقاء / زيارة"
                          onClick={() => setInteractionDialog({ open: true, partnerId: p.id })}
                        >
                          <Calendar className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2 text-emerald-600"
                          title="تسجيل تبرع"
                          onClick={() =>
                            setDonationDialog({ open: true, kind: "donation", partnerId: p.id })
                          }
                        >
                          <Coins className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          className="h-8 text-xs px-2 text-primary"
                          title="كتالوج المشاريع"
                          onClick={() => setCatalogDialog({ open: true, partner: p })}
                        >
                          <Sparkles className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2"
                          title="تعديل"
                          onClick={() => setPartnerDialog({ open: true, partner: p })}
                        >
                          <Pencil className="w-3.5 h-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-8 px-2 text-destructive hover:bg-destructive/10"
                          title="حذف"
                          onClick={() => setPartnerDeleteDialog({ open: true, partner: p })}
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </TabsContent>

        {/* 3. تبويب قمع فرص التمويل والمقترحات (Grant Pipeline - Kanban) */}
        <TabsContent value="pipeline" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">قمع فرص التمويل والمقترحات المفتوحة (Grant Pipeline)</h3>
              <p className="text-xs text-muted-foreground">
                تتبع مسار المقترحات التنموية للأيتام من الفكرة حتى الترسية والتمويل
              </p>
            </div>
            <Button size="sm" onClick={() => setGrantDialog({ open: true })} className="gap-1">
              <Plus className="w-4 h-4" />
              إضافة فرصة تمويل
            </Button>
          </div>

          {/* لوحة كانبان للقمع */}
          <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-3 min-h-[500px] overflow-x-auto pb-4">
            {GRANT_STAGES.map((stage) => {
              const stageGrants = grants.filter((g) => g.stage === stage);
              const stageTotal = stageGrants.reduce((s, g) => s + Number(g.estimated_amount), 0);
              return (
                <div key={stage} className="bg-muted/40 rounded-xl p-3 border space-y-3 flex flex-col">
                  <div className="space-y-1 pb-2 border-b">
                    <div className="flex justify-between items-center">
                      <span className="font-bold text-xs">{GRANT_STAGE_LABELS[stage]}</span>
                      <Badge variant="secondary" className="text-[10px]">
                        {stageGrants.length}
                      </Badge>
                    </div>
                    <div className="text-[11px] font-medium text-muted-foreground">
                      ${stageTotal.toLocaleString()}
                    </div>
                  </div>

                  <div className="space-y-2 flex-1 overflow-y-auto">
                    {stageGrants.map((grant) => (
                      <Card key={grant.id} className="p-3 space-y-2 text-xs hover:border-primary transition-colors">
                        <div className="flex justify-between items-start gap-1">
                          <span className="font-bold text-foreground leading-tight">
                            {grant.project_title}
                          </span>
                        </div>
                        <p className="text-[11px] text-muted-foreground">{grant.partner_name}</p>
                        <Badge variant="outline" className="text-[10px]">
                          {GRANT_SECTOR_LABELS[grant.target_sector]}
                        </Badge>
                        <div className="flex justify-between items-center text-[11px] pt-1 border-t">
                          <span className="font-bold text-primary">
                            ${Number(grant.estimated_amount).toLocaleString()}
                          </span>
                          {grant.submission_deadline && (
                            <span className="text-[10px] text-muted-foreground">
                              الموعد: {grant.submission_deadline}
                            </span>
                          )}
                        </div>

                        {/* تحريك سريع للمرحلة التالية */}
                        <div className="pt-1 flex items-center justify-between gap-1">
                          <Select
                            value={grant.stage}
                            onValueChange={(newStage) =>
                              moveGrantStage(grant.id, newStage as GrantStage)
                            }
                          >
                            <SelectTrigger className="h-6 text-[10px] px-1.5">
                              <SelectValue placeholder="نقل المرحلة" />
                            </SelectTrigger>
                            <SelectContent>
                              {GRANT_STAGES.map((st) => (
                                <SelectItem key={st} value={st} className="text-xs">
                                  {GRANT_STAGE_LABELS[st]}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="h-6 px-1.5 text-[10px]"
                            onClick={() => setGrantDialog({ open: true, opportunity: grant })}
                          >
                            تفاصيل
                          </Button>
                        </div>
                      </Card>
                    ))}
                    {stageGrants.length === 0 && (
                      <div className="text-center py-8 text-xs text-muted-foreground/60">
                        فارغ
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </TabsContent>

        {/* 4. تبويب التبرعات والدفعات (Donations & Tranches) */}
        <TabsContent value="donations" className="space-y-6">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">سجل التبرعات والمساهمات النقدية والعينية والدفعات المجدولة</h3>
              <p className="text-xs text-muted-foreground">
                إدارة المساهمات مع التوليد التلقائي لمهام خطابات الشكر وتقارير الدفعات
              </p>
            </div>
            <div className="flex gap-2">
              <Button
                size="sm"
                variant="outline"
                onClick={() => setDonationDialog({ open: true, kind: "tranche" })}
                className="gap-1"
              >
                + جدولة دفعة مانح
              </Button>
              <Button
                size="sm"
                onClick={() => setDonationDialog({ open: true, kind: "donation" })}
                className="gap-1"
              >
                + تسجيل تبرع
              </Button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {/* جدول التبرعات المستلمة */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Coins className="w-4 h-4 text-emerald-600" />
                  آخر التبرعات والمساهمات المسجلة ({donations.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {donations.map((d) => (
                  <div key={d.id} className="p-3 bg-muted/30 rounded-xl border text-xs space-y-1.5">
                    <div className="flex justify-between items-start">
                      <span className="font-bold text-foreground">{d.partner_name}</span>
                      <span className="font-bold text-emerald-600">
                        {d.donation_type === "cash"
                          ? `${Number(d.amount).toLocaleString()} ${d.currency}`
                          : DONATION_TYPE_LABELS[d.donation_type]}
                      </span>
                    </div>
                    {d.in_kind_description && (
                      <p className="text-muted-foreground">{d.in_kind_description}</p>
                    )}
                    <div className="flex justify-between items-center text-[10px] text-muted-foreground pt-1 border-t">
                      <span>المشروع: {d.target_project}</span>
                      <span>تاريخ: {d.received_date}</span>
                    </div>
                  </div>
                ))}
                {donations.length === 0 && (
                  <p className="text-center py-6 text-xs text-muted-foreground">لا توجد تبرعات مسجلة حتى الآن</p>
                )}
              </CardContent>
            </Card>

            {/* جدول الدفعات المجدولة (Tranches) */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-bold flex items-center gap-2">
                  <Clock className="w-4 h-4 text-primary" />
                  الدفعات المجدولة والالتزامات المالية ({tranches.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3">
                {tranches.map((t) => (
                  <div key={t.id} className="p-3 bg-muted/30 rounded-xl border text-xs space-y-1.5">
                    <div className="flex justify-between items-start">
                      <div>
                        <span className="font-bold text-foreground">{t.partner_name}</span>
                        <p className="text-[10px] text-muted-foreground">
                          {t.agreement_title || `دفعة رقم #${t.tranche_number}`}
                        </p>
                      </div>
                      <Badge variant="outline" className="text-[10px]">
                        {TRANCHE_STATUS_LABELS[t.status]}
                      </Badge>
                    </div>
                    <div className="flex justify-between items-center pt-1">
                      <span className="font-bold text-primary">
                        {Number(t.amount).toLocaleString()} {t.currency}
                      </span>
                      <span className="text-[10px] text-muted-foreground">استحقاق: {t.due_date}</span>
                    </div>
                    {t.condition_milestone && (
                      <p className="text-[11px] text-muted-foreground bg-background p-1.5 rounded border">
                        شرط الصرف: {t.condition_milestone}
                      </p>
                    )}
                  </div>
                ))}
                {tranches.length === 0 && (
                  <p className="text-center py-6 text-xs text-muted-foreground">لا توجد دفعات مجدولة</p>
                )}
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        {/* 5. تبويب الزيارات واللقاءات (Interactions & Field Visits) */}
        <TabsContent value="interactions" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">سجل اللقاءات والزيارات الميدانية للمراكز والورش</h3>
              <p className="text-xs text-muted-foreground">
                توثيق التفاعلات المباشرة مع المانحين وتحويل محاضر الاجتماع إلى مهام تنفيذية
              </p>
            </div>
            <Button size="sm" onClick={() => setInteractionDialog({ open: true })} className="gap-1">
              <Plus className="w-4 h-4" />
              توثيق لقاء / زيارة
            </Button>
          </div>

          <div className="space-y-3">
            {interactions.map((inter) => (
              <Card key={inter.id} className="p-4">
                <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-2 pb-2 border-b">
                  <div className="space-y-0.5">
                    <div className="flex items-center gap-2">
                      <Badge variant="secondary" className="text-xs">
                        {INTERACTION_TYPE_LABELS[inter.interaction_type]}
                      </Badge>
                      <h4 className="font-bold text-sm text-foreground">{inter.title}</h4>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      الجهة: <span className="font-medium text-foreground">{inter.partner_name}</span> | المكان: {inter.location || "المقر"}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Badge variant="outline" className="text-xs">
                      {inter.interaction_date}
                    </Badge>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-3 text-xs">
                  {inter.summary && (
                    <div>
                      <span className="font-semibold text-muted-foreground">ملخص النقاش:</span>
                      <p className="mt-0.5 text-foreground">{inter.summary}</p>
                    </div>
                  )}
                  {inter.minutes && (
                    <div>
                      <span className="font-semibold text-muted-foreground">المخرجات والاتفاق:</span>
                      <p className="mt-0.5 text-foreground">{inter.minutes}</p>
                    </div>
                  )}
                </div>

                {inter.next_action && (
                  <div className="mt-3 p-2 rounded-lg bg-primary/5 border border-primary/20 text-xs flex justify-between items-center">
                    <span>
                      <span className="font-bold text-primary">الإجراء التالي: </span>
                      {inter.next_action}
                    </span>
                    {inter.task_id && (
                      <Badge variant="outline" className="text-[10px] bg-background">
                        مربوط بمهمة في النظام ✓
                      </Badge>
                    )}
                  </div>
                )}
              </Card>
            ))}
            {interactions.length === 0 && (
              <EmptyState
                title="لا توجد تفاعلات أو زيارات مسجلة"
                description="قم بتوثيق الاجتماعات والزيارات الميدانية لمراكز الأيتام والورش الإنتاجية."
                actionLabel="توثيق لقاء جديد"
                onAction={() => setInteractionDialog({ open: true })}
              />
            )}
          </div>
        </TabsContent>

        {/* 6. تبويب مذكرات التفاهم (Agreements & MoUs) */}
        <TabsContent value="agreements" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">سجل بروتوكولات التعاون ومذكرات التفاهم (MoUs)</h3>
              <p className="text-xs text-muted-foreground">
                أرشفة الوثائق الرسمية ومتابعة مدد السريان والتجديد
              </p>
            </div>
            <Button size="sm" onClick={() => setAgreementDialog({ open: true })} className="gap-1">
              <Plus className="w-4 h-4" />
              إضافة مذكرة تفاهم
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {agreements.map((ag) => (
              <Card key={ag.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <div className="space-y-1">
                    <Badge variant="outline" className="text-[10px]">
                      {ag.reference_no || "بدون كود"}
                    </Badge>
                    <h4 className="font-bold text-sm text-foreground">{ag.title}</h4>
                    <p className="text-xs text-muted-foreground">{ag.partner_name}</p>
                  </div>
                  <Badge
                    variant="secondary"
                    className={
                      ag.status === "active"
                        ? "bg-emerald-100 text-emerald-800"
                        : ag.status === "expiring_soon"
                        ? "bg-amber-100 text-amber-800"
                        : "bg-muted text-muted-foreground"
                    }
                  >
                    {AGREEMENT_STATUS_LABELS[ag.status]}
                  </Badge>
                </div>

                <div className="grid grid-cols-2 gap-2 text-xs p-2 rounded bg-muted/40 border">
                  <div>
                    <span className="text-muted-foreground">تاريخ البدء:</span> {ag.start_date}
                  </div>
                  <div>
                    <span className="text-muted-foreground">تاريخ الانتهاء:</span> {ag.end_date || "مفتوح"}
                  </div>
                  {Number(ag.total_value) > 0 && (
                    <div className="col-span-2 font-bold text-primary">
                      القيمة: {Number(ag.total_value).toLocaleString()} {ag.currency}
                    </div>
                  )}
                </div>

                {ag.notes && <p className="text-xs text-muted-foreground">{ag.notes}</p>}

                <div className="flex justify-between items-center pt-2 border-t text-xs">
                  <span className="text-muted-foreground">
                    المسؤول: {ag.assigned_employee_name || "غير محدد"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setAgreementDialog({ open: true, agreement: ag })}
                  >
                    تعديل الوثيقة
                  </Button>
                </div>
              </Card>
            ))}
            {agreements.length === 0 && (
              <div className="col-span-2">
                <EmptyState
                  title="لا توجد مذكرات تفاهم مسجلة"
                  description="أضف مذكرات التفاهم وبروتوكولات الشراكة الموقعة مع المنظمات والداعمين."
                  actionLabel="إضافة مذكرة تفاهم"
                  onAction={() => setAgreementDialog({ open: true })}
                />
              </div>
            )}
          </div>
        </TabsContent>

        {/* 7. تبويب الفعاليات والإعلام (Events & Media) */}
        <TabsContent value="events" className="space-y-4">
          <div className="flex justify-between items-center">
            <div>
              <h3 className="font-bold text-base">إدارة الفعاليات والتغطيات الإعلامية ومعارض منتجات الورش</h3>
              <p className="text-xs text-muted-foreground">
                تنسيق المؤتمرات وحفلات تخرج الأيتام والبازارات وإسناد المهام للفرق الميدانية
              </p>
            </div>
            <Button size="sm" onClick={() => setEventDialog({ open: true })} className="gap-1">
              <Plus className="w-4 h-4" />
              إضافة فعالية / تغطية
            </Button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {events.map((ev) => (
              <Card key={ev.id} className="p-4 space-y-3">
                <div className="flex justify-between items-start">
                  <Badge variant="secondary" className="text-xs">
                    {EVENT_TYPE_LABELS[ev.event_type]}
                  </Badge>
                  <Badge variant="outline" className="text-[10px]">
                    {EVENT_STATUS_LABELS[ev.status]}
                  </Badge>
                </div>

                <div className="space-y-1">
                  <h4 className="font-bold text-sm text-foreground">{ev.title}</h4>
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <Calendar className="w-3.5 h-3.5" />
                    {ev.event_date} | {ev.location || "المقر الرئيسي"}
                  </p>
                </div>

                {ev.target_audience && (
                  <p className="text-xs text-muted-foreground">
                    <span className="font-semibold">الجمهور:</span> {ev.target_audience}
                  </p>
                )}

                {ev.media_links && (
                  <p className="text-xs text-primary truncate" dir="ltr">
                    🔗 {ev.media_links}
                  </p>
                )}

                <div className="flex justify-between items-center pt-2 border-t text-xs">
                  <span className="text-muted-foreground">
                    المنسق: {ev.coordinator_name || "غير محدد"}
                  </span>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 text-xs"
                    onClick={() => setEventDialog({ open: true, eventItem: ev })}
                  >
                    تعديل
                  </Button>
                </div>
              </Card>
            ))}
            {events.length === 0 && (
              <div className="col-span-3">
                <EmptyState
                  title="لا توجد فعاليات مسجلة"
                  description="أضف فعاليات المعارض وحفلات التخرج والتغطيات الصحفية للمؤسسة."
                  actionLabel="إضافة فعالية"
                  onAction={() => setEventDialog({ open: true })}
                />
              </div>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* النوافذ المنبثقة (Dialogs) */}
      <PartnerDialog
        open={partnerDialog.open}
        onOpenChange={(open) => setPartnerDialog({ open })}
        partner={partnerDialog.partner}
        employees={employees}
        saving={partnerMutation.isPending}
        onSubmit={async (vals) => {
          await partnerMutation.mutateAsync(vals);
        }}
      />

      <InteractionDialog
        open={interactionDialog.open}
        onOpenChange={(open) => setInteractionDialog({ open })}
        partners={partners}
        employees={employees}
        preselectedPartnerId={interactionDialog.partnerId}
        saving={interactionMutation.isPending}
        onSubmit={async (vals) => {
          await interactionMutation.mutateAsync(vals);
        }}
      />

      <GrantOpportunityDialog
        open={grantDialog.open}
        onOpenChange={(open) => setGrantDialog({ open })}
        partners={partners}
        employees={employees}
        opportunity={grantDialog.opportunity}
        saving={grantMutation.isPending}
        onSubmit={async (vals) => {
          await grantMutation.mutateAsync(vals);
        }}
      />

      <DonationTrancheDialog
        open={donationDialog.open}
        onOpenChange={(open) => setDonationDialog({ ...donationDialog, open })}
        partners={partners}
        agreements={agreements}
        employees={employees}
        preselectedPartnerId={donationDialog.partnerId}
        initialKind={donationDialog.kind}
        saving={donationTrancheMutation.isPending}
        onSubmit={async (vals) => {
          await donationTrancheMutation.mutateAsync(vals);
        }}
      />

      <AgreementDialog
        open={agreementDialog.open}
        onOpenChange={(open) => setAgreementDialog({ open })}
        partners={partners}
        employees={employees}
        agreement={agreementDialog.agreement}
        saving={agreementMutation.isPending}
        onSubmit={async (vals) => {
          await agreementMutation.mutateAsync(vals);
        }}
      />

      <EventDialog
        open={eventDialog.open}
        onOpenChange={(open) => setEventDialog({ open })}
        employees={employees}
        eventItem={eventDialog.eventItem}
        saving={eventMutation.isPending}
        onSubmit={async (vals) => {
          await eventMutation.mutateAsync(vals);
        }}
      />

      {/* نافذة الملف التعريفي الشامل للشريك وتصدير تقرير الأثر */}
      <PartnerProfileDialog
        open={partnerProfileDialog.open}
        onOpenChange={(open) => setPartnerProfileDialog({ open })}
        partner={partnerProfileDialog.partner}
        donations={donations}
        agreements={agreements}
        grants={grants}
        interactions={interactions}
        onEdit={(p) => setPartnerDialog({ open: true, partner: p })}
        onDelete={(p) => setPartnerDeleteDialog({ open: true, partner: p })}
        onAddDonation={(pId) =>
          setDonationDialog({ open: true, kind: "donation", partnerId: pId })
        }
        onAddInteraction={(pId) =>
          setInteractionDialog({ open: true, partnerId: pId })
        }
        onAddGrant={(pId) =>
          setGrantDialog({ open: true })
        }
        onOpenCatalog={(p) =>
          setCatalogDialog({ open: true, partner: p })
        }
      />

      {/* نافذة الحذف الآمن للشريك */}
      <PartnerDeleteDialog
        open={partnerDeleteDialog.open}
        onOpenChange={(open) => setPartnerDeleteDialog({ open })}
        partner={partnerDeleteDialog.partner}
        isDeleting={partnerDeleteMutation.isPending}
        onConfirm={async () => {
          if (partnerDeleteDialog.partner?.id) {
            await partnerDeleteMutation.mutateAsync(partnerDeleteDialog.partner.id);
          }
        }}
      />

      {/* نافذة كتالوج المشاريع والفرص التمويلية الجاهزة */}
      <ProjectPitchCatalogDialog
        open={catalogDialog.open}
        onOpenChange={(open) => setCatalogDialog({ open })}
        partner={catalogDialog.partner}
        onSelectPitch={handleSelectPitch}
      />
    </div>
  );
}
