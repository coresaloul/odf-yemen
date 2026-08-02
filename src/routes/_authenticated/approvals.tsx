import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { ClipboardCheck, Plus, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import type { ApprovalKind, PendingApproval } from "@/lib/approvals";
import {
  APPROVAL_KIND_LABELS,
  CORRECTION_TYPE_LABELS,
  waitingLabel,
} from "@/lib/approvals";
import { STAGE_LABELS } from "@/lib/evaluation-approval";
import { listCorrectionRequests } from "@/lib/approvals.functions";
import { usePendingApprovals } from "@/components/approvals/useApprovals";
import { ApprovalDecisionDialog } from "@/components/approvals/ApprovalDecisionDialog";
import { CorrectionRequestDialog } from "@/components/approvals/CorrectionRequestDialog";

export const Route = createFileRoute("/_authenticated/approvals")({
  component: ApprovalsPage,
  head: () => ({
    meta: [
      { title: "مركز الموافقات | نظام الموارد البشرية" },
      {
        name: "description",
        content:
          "مركز موحّد لاعتماد طلبات الإجازات وتقارير التقييم والمهام المنجزة وطلبات تصحيح الحضور في مؤسسة اليتيم التنموية.",
      },
      { property: "og:title", content: "مركز الموافقات | نظام الموارد البشرية" },
      {
        property: "og:description",
        content: "اعتماد الطلبات المعلّقة: إجازات، تقييم أداء، مهام منجزة، وتصحيح حضور.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

const KINDS: (ApprovalKind | "all")[] = [
  "all",
  "leave",
  "evaluation",
  "task",
  "attendance_correction",
];

type CorrectionRow = {
  id: string;
  work_date: string;
  correction_type: string;
  stage: string;
  reason: string | null;
  return_reason: string | null;
  requested_check_in: string | null;
  requested_check_out: string | null;
  employees: { full_name: string } | null;
};

function ApprovalsPage() {
  const { data = [], isFetching, refetch } = usePendingApprovals();
  const [selected, setSelected] = useState<PendingApproval | null>(null);
  const [search, setSearch] = useState("");
  const [newRequest, setNewRequest] = useState(false);

  const fetchCorrections = useServerFn(listCorrectionRequests);
  const { data: corrections = [] } = useQuery({
    queryKey: ["correction-requests"],
    queryFn: async () => (await fetchCorrections()) as unknown as CorrectionRow[],
  });

  const filtered = useMemo(() => {
    const q = search.trim();
    if (!q) return data;
    return data.filter(
      (i) => i.title.includes(q) || i.employeeName.includes(q) || i.departmentName.includes(q),
    );
  }, [data, search]);

  const countOf = (kind: ApprovalKind | "all") =>
    kind === "all" ? filtered.length : filtered.filter((i) => i.kind === kind).length;

  return (
    <div className="space-y-5">
      <PageHeader
        title="مركز الموافقات"
        description="جميع الطلبات المعلّقة التي تنتظر قرارك في مكان واحد"
        action={
          <>
            <Button variant="outline" className="gap-2" onClick={() => void refetch()}>
              <RefreshCw className={isFetching ? "size-4 animate-spin" : "size-4"} />
              تحديث
            </Button>
            <Button className="gap-2" onClick={() => setNewRequest(true)}>
              <Plus className="size-4" />
              طلب تصحيح حضور
            </Button>
          </>
        }
      />

      <Input
        placeholder="بحث بالاسم أو الإدارة أو عنوان الطلب…"
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <Tabs defaultValue="all">
        <TabsList>
          {KINDS.map((k) => (
            <TabsTrigger key={k} value={k} className="gap-1.5">
              {k === "all" ? "الكل" : APPROVAL_KIND_LABELS[k]}
              <Badge variant="secondary" className="px-1.5">
                {countOf(k)}
              </Badge>
            </TabsTrigger>
          ))}
          <TabsTrigger value="corrections">طلبات التصحيح</TabsTrigger>
        </TabsList>

        {KINDS.map((k) => {
          const items = k === "all" ? filtered : filtered.filter((i) => i.kind === k);
          return (
            <TabsContent key={k} value={k} className="space-y-3">
              {items.length === 0 ? (
                <Card>
                  <CardContent className="flex flex-col items-center gap-2 py-10 text-muted-foreground">
                    <ClipboardCheck className="size-8" />
                    <p className="text-sm">لا توجد طلبات بانتظار قرارك</p>
                  </CardContent>
                </Card>
              ) : (
                items.map((item) => (
                  <Card key={`${item.kind}-${item.id}`} className="transition-shadow hover:shadow-md">
                    <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                      <div className="min-w-0 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <Badge variant="secondary">{APPROVAL_KIND_LABELS[item.kind]}</Badge>
                          <Badge variant="outline">{STAGE_LABELS[item.stage] ?? item.stage}</Badge>
                          <span className="text-xs text-muted-foreground">
                            {waitingLabel(item.since)}
                          </span>
                        </div>
                        <p className="truncate font-semibold">{item.title}</p>
                        <p className="truncate text-sm text-muted-foreground">
                          {item.employeeName} — {item.departmentName} · {item.summary}
                        </p>
                      </div>
                      <Button className="shrink-0" onClick={() => setSelected(item)}>
                        مراجعة
                      </Button>
                    </CardContent>
                  </Card>
                ))
              )}
            </TabsContent>
          );
        })}

        <TabsContent value="corrections" className="space-y-3">
          {corrections.length === 0 ? (
            <Card>
              <CardContent className="py-10 text-center text-sm text-muted-foreground">
                لا توجد طلبات تصحيح حضور
              </CardContent>
            </Card>
          ) : (
            corrections.map((c) => (
              <Card key={c.id}>
                <CardContent className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 p-4">
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-semibold">
                      {c.employees?.full_name ?? "—"} — {c.work_date}
                    </p>
                    <p className="truncate text-sm text-muted-foreground">
                      {CORRECTION_TYPE_LABELS[c.correction_type] ?? c.correction_type} ·{" "}
                      {String(c.requested_check_in ?? "—").slice(0, 5)} /{" "}
                      {String(c.requested_check_out ?? "—").slice(0, 5)}
                    </p>
                    {c.return_reason && (
                      <p className="text-xs text-destructive">سبب الإعادة: {c.return_reason}</p>
                    )}
                  </div>
                  <Badge variant={c.stage === "approved" ? "default" : "outline"}>
                    {STAGE_LABELS[c.stage as never] ?? c.stage}
                  </Badge>
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <ApprovalDecisionDialog item={selected} onOpenChange={(o) => !o && setSelected(null)} />
      <CorrectionRequestDialog open={newRequest} onOpenChange={setNewRequest} />
    </div>
  );
}
