import { useMemo, useState } from "react";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { FileText, Plus, Trash2, Send, RefreshCw } from "lucide-react";
import { PageHeader } from "@/components/PageHeader";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/EmptyState";
import { ListSkeleton } from "@/components/LoadingState";
import { RequestTypePicker } from "@/components/requests/RequestTypePicker";
import { RequestTypesAdmin } from "@/components/requests/RequestTypesAdmin";
import {
  DynamicRequestForm,
  type RequestValues,
} from "@/components/requests/DynamicRequestForm";
import {
  listHrRequests,
  listRequestTypes,
  saveHrRequest,
  deleteHrRequest,
} from "@/lib/hr-requests.functions";
import { formatFieldValue, type HrRequestRow, type HrRequestType } from "@/lib/hr-requests";
import { STAGE_LABELS } from "@/lib/evaluation-approval";

export const Route = createFileRoute("/_authenticated/requests")({
  component: RequestsPage,
  head: () => ({
    meta: [
      { title: "الطلبات والنماذج | مدير" },
      {
        name: "description",
        content:
          "تقديم ومتابعة طلبات الموارد البشرية: صيانة، مهمة ميدانية، شهادة تعريف، شكوى، مقترح وغيرها في نظام مدير.",
      },
      { property: "og:title", content: "الطلبات والنماذج | مدير" },
      {
        property: "og:description",
        content: "نماذج إلكترونية لطلبات الموظفين مع مسار اعتماد واضح ومتابعة فورية.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function StageBadge({ stage }: { stage: HrRequestRow["stage"] }) {
  const variant =
    stage === "approved" ? "default" : stage === "returned" ? "destructive" : "outline";
  return <Badge variant={variant}>{STAGE_LABELS[stage] ?? stage}</Badge>;
}

function RequestCard({
  row,
  canDelete,
  onDelete,
  onResubmit,
}: {
  row: HrRequestRow;
  canDelete: boolean;
  onDelete: () => void;
  onResubmit?: () => void;
}) {
  return (
    <Card>
      <CardContent className="space-y-2 p-4">
        <div className="flex flex-wrap items-center gap-2">
          <StageBadge stage={row.stage} />
          <Badge variant="secondary">{row.type_category}</Badge>
          <span className="text-xs text-muted-foreground">
            {new Date(row.created_at).toLocaleDateString("ar")}
          </span>
        </div>
        <p className="font-semibold">{row.type_name}</p>
        <p className="text-sm text-muted-foreground">
          {row.employee_name} — {row.department_name}
        </p>

        <dl className="divide-y rounded-lg border bg-muted/20 text-xs sm:text-sm">
          {row.fields.map((f) => (
            <div key={f.key} className="grid grid-cols-1 gap-0.5 px-3 py-2 sm:grid-cols-[9rem_minmax(0,1fr)] sm:gap-2">
              <dt className="font-medium text-muted-foreground">{f.label}</dt>
              <dd className="min-w-0 font-medium break-words text-foreground">{formatFieldValue(f, row.values[f.key])}</dd>
            </div>
          ))}
        </dl>

        {row.return_reason && (
          <p className="text-xs text-destructive">سبب الإعادة: {row.return_reason}</p>
        )}

        {(canDelete || onResubmit) && (
          <div className="flex flex-wrap gap-2 pt-1">
            {onResubmit && (
              <Button size="sm" className="gap-1.5" onClick={onResubmit}>
                <Send className="size-3.5" />
                إرسال
              </Button>
            )}
            {canDelete && (
              <Button size="sm" variant="outline" className="gap-1.5" onClick={onDelete}>
                <Trash2 className="size-3.5" />
                حذف
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function RequestsPage() {
  const qc = useQueryClient();
  const fetchTypes = useServerFn(listRequestTypes);
  const fetchRequests = useServerFn(listHrRequests);
  const save = useServerFn(saveHrRequest);
  const remove = useServerFn(deleteHrRequest);

  const [picking, setPicking] = useState(false);
  const [type, setType] = useState<HrRequestType | null>(null);

  const typesQuery = useQuery({
    queryKey: ["hr-request-types"],
    queryFn: async () => (await fetchTypes()) as unknown as HrRequestType[],
  });
  const requestsQuery = useQuery({
    queryKey: ["hr-requests"],
    queryFn: async () =>
      (await fetchRequests()) as unknown as {
        rows: HrRequestRow[];
        myEmployeeId: string | null;
        canManageTypes: boolean;
      },
  });

  const types = typesQuery.data ?? [];
  const rows = requestsQuery.data?.rows ?? [];
  const myId = requestsQuery.data?.myEmployeeId ?? null;
  const canManageTypes = requestsQuery.data?.canManageTypes ?? false;

  const mine = useMemo(() => rows.filter((r) => r.employee_id === myId), [rows, myId]);
  const incoming = useMemo(() => rows.filter((r) => r.employee_id !== myId), [rows, myId]);

  const invalidate = () => {
    void qc.invalidateQueries({ queryKey: ["hr-requests"] });
    void qc.invalidateQueries({ queryKey: ["pending-approvals"] });
  };

  const saveMutation = useMutation({
    mutationFn: async (v: { typeId: string; values: RequestValues; submit: boolean }) =>
      save({ data: { type_id: v.typeId, values: v.values, submit: v.submit } }),
    onSuccess: (_r, v) => {
      toast.success(v.submit ? "تم إرسال الطلب" : "تم حفظ المسودة");
      setType(null);
      setPicking(false);
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => remove({ data: { id } }),
    onSuccess: () => {
      toast.success("تم حذف الطلب");
      invalidate();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-5">
      <PageHeader
        title="الطلبات والنماذج"
        description="قدّم طلبات الموارد البشرية إلكترونياً وتابع مسار اعتمادها"
        action={
          <>
            <Button
              variant="outline"
              className="gap-2"
              onClick={() => void requestsQuery.refetch()}
            >
              <RefreshCw className={requestsQuery.isFetching ? "size-4 animate-spin" : "size-4"} />
              تحديث
            </Button>
            <Button
              className="gap-2"
              onClick={() => {
                setType(null);
                setPicking(true);
              }}
            >
              <Plus className="size-4" />
              طلب جديد
            </Button>
          </>
        }
      />

      {picking && !type && (
        <div className="space-y-3">
          <RequestTypePicker types={types} onPick={(t) => setType(t)} />
          <Button variant="ghost" onClick={() => setPicking(false)}>
            إلغاء
          </Button>
        </div>
      )}

      {type && (
        <DynamicRequestForm
          type={type}
          saving={saveMutation.isPending}
          onCancel={() => {
            setType(null);
            setPicking(false);
          }}
          onSave={(values, submit) =>
            saveMutation.mutate({ typeId: type.id, values, submit })
          }
        />
      )}

      {!picking && !type && (
        <Tabs defaultValue="mine">
          <TabsList>
            <TabsTrigger value="mine" className="gap-1.5">
              طلباتي
              <Badge variant="secondary" className="px-1.5">
                {mine.length}
              </Badge>
            </TabsTrigger>
            <TabsTrigger value="incoming" className="gap-1.5">
              طلبات الموظفين
              <Badge variant="secondary" className="px-1.5">
                {incoming.length}
              </Badge>
            </TabsTrigger>
            {canManageTypes && <TabsTrigger value="types">أنواع الطلبات</TabsTrigger>}
          </TabsList>

          <TabsContent value="mine" className="space-y-3">
            {requestsQuery.isLoading ? (
              <ListSkeleton />
            ) : mine.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="لا توجد طلبات"
                description="ابدأ بتقديم طلب جديد من الأعلى"
              />
            ) : (
              mine.map((r) => (
                <RequestCard
                  key={r.id}
                  row={r}
                  canDelete={r.stage === "draft" || r.stage === "returned"}
                  onDelete={() => deleteMutation.mutate(r.id)}
                />
              ))
            )}
          </TabsContent>

          <TabsContent value="incoming" className="space-y-3">
            {requestsQuery.isLoading ? (
              <ListSkeleton />
            ) : incoming.length === 0 ? (
              <EmptyState
                icon={FileText}
                title="لا توجد طلبات واردة"
                description="ستظهر هنا طلبات الموظفين التابعين لك"
              />
            ) : (
              incoming.map((r) => (
                <RequestCard key={r.id} row={r} canDelete={false} onDelete={() => undefined} />
              ))
            )}
          </TabsContent>

          {canManageTypes && (
            <TabsContent value="types">
              <RequestTypesAdmin types={types} />
            </TabsContent>
          )}
        </Tabs>
      )}
    </div>
  );
}
