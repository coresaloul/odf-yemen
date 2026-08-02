import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { CORRECTION_TYPES, CORRECTION_TYPE_LABELS } from "@/lib/approvals";
import { saveCorrectionRequest, submitCorrectionRequest } from "@/lib/approvals.functions";

export function CorrectionRequestDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { employee } = useAuth();
  const qc = useQueryClient();
  const save = useServerFn(saveCorrectionRequest);
  const submit = useServerFn(submitCorrectionRequest);

  const [employeeId, setEmployeeId] = useState("");
  const [workDate, setWorkDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [type, setType] = useState(CORRECTION_TYPES[0]!);
  const [checkIn, setCheckIn] = useState("");
  const [checkOut, setCheckOut] = useState("");
  const [reason, setReason] = useState("");

  const { data: employees = [] } = useQuery({
    queryKey: ["correction-employees"],
    queryFn: async () => {
      const { data } = await supabase
        .from("employees")
        .select("id, full_name")
        .eq("status", "active")
        .order("full_name");
      return data ?? [];
    },
    enabled: open,
  });

  useEffect(() => {
    if (open && !employeeId && employee?.id) setEmployeeId(employee.id);
  }, [open, employee?.id, employeeId]);

  const create = useMutation({
    mutationFn: async () => {
      const res = (await save({
        data: {
          employee_id: employeeId,
          work_date: workDate,
          correction_type: type,
          requested_check_in: checkIn || null,
          requested_check_out: checkOut || null,
          reason: reason || null,
        },
      })) as { id: string };
      await submit({ data: { id: res.id } });
    },
    onSuccess: () => {
      toast.success("تم إرسال طلب التصحيح للاعتماد");
      void qc.invalidateQueries({ queryKey: ["correction-requests"] });
      void qc.invalidateQueries({ queryKey: ["pending-approvals"] });
      setCheckIn("");
      setCheckOut("");
      setReason("");
      onOpenChange(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>طلب تصحيح حضور</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>الموظف</Label>
            <Select value={employeeId} onValueChange={setEmployeeId}>
              <SelectTrigger>
                <SelectValue placeholder="اختر الموظف" />
              </SelectTrigger>
              <SelectContent>
                {employees.map((e) => (
                  <SelectItem key={e.id} value={e.id}>
                    {e.full_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <Label htmlFor="work-date">اليوم</Label>
              <Input
                id="work-date"
                type="date"
                value={workDate}
                onChange={(e) => setWorkDate(e.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label>نوع التصحيح</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {CORRECTION_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {CORRECTION_TYPE_LABELS[t]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-in">حضور مقترح</Label>
              <Input id="c-in" type="time" value={checkIn} onChange={(e) => setCheckIn(e.target.value)} />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="c-out">انصراف مقترح</Label>
              <Input id="c-out" type="time" value={checkOut} onChange={(e) => setCheckOut(e.target.value)} />
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="c-reason">السبب</Label>
            <Textarea
              id="c-reason"
              rows={3}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="اشرح سبب التصحيح…"
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            disabled={!employeeId || (!checkIn && !checkOut) || create.isPending}
            onClick={() => create.mutate()}
          >
            إرسال للاعتماد
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
