import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { useAuth } from "@/hooks/useAuth";
import { EMPLOYEE_STATUS_LABELS, formatDate } from "@/lib/hr";
import { EmployeeDocuments } from "./EmployeeDocuments";
import { EmployeeServiceLinks } from "./EmployeeServiceLinks";
import { EmployeeAvatar } from "./EmployeeAvatar";
import type { Employee, Department, Section } from "./types";

interface EmployeeProfileDialogProps {
  employee: Employee;
  departments: Department[];
  sections: Section[];
  onOpenChange: (open: boolean) => void;
}

function Field({ label, value }: { label: string; value: string | null | undefined }) {
  return (
    <div className="space-y-0.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm">{value || "—"}</p>
    </div>
  );
}

export function EmployeeProfileDialog({
  employee,
  departments,
  sections,
  onOpenChange,
}: EmployeeProfileDialogProps) {
  const { isDirector, isHR } = useAuth();
  const e = employee;

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-3 text-right">
            <EmployeeAvatar name={e.full_name} className="size-11 text-base" />
            <span className="min-w-0">
              <span className="block truncate">{e.full_name}</span>
              <span className="block truncate text-xs font-normal text-muted-foreground">
                {e.job_title ?? "بدون مسمى"} — رقم {e.employee_no}
              </span>
            </span>
          </DialogTitle>
        </DialogHeader>

        <div className="flex flex-wrap items-center gap-2">
          <Badge variant={e.status === "active" ? "default" : "secondary"}>
            {EMPLOYEE_STATUS_LABELS[e.status]}
          </Badge>
          <Badge variant="outline">
            {departments.find((d) => d.id === e.department_id)?.name ?? "بدون إدارة"}
          </Badge>
          {e.section_id && (
            <Badge variant="outline">
              {sections.find((s) => s.id === e.section_id)?.name ?? "—"}
            </Badge>
          )}
        </div>

        <Tabs defaultValue="job" dir="rtl">
          <TabsList className="flex-wrap">
            <TabsTrigger value="job">بيانات وظيفية</TabsTrigger>
            <TabsTrigger value="personal">شخصية وصحية</TabsTrigger>
            <TabsTrigger value="docs">وثائق الموظف</TabsTrigger>
            <TabsTrigger value="services">الخدمات المرتبطة</TabsTrigger>
          </TabsList>

          <TabsContent value="job" className="grid gap-3 pt-4 sm:grid-cols-3">
            <Field label="الرقم الوظيفي" value={e.employee_no} />
            <Field label="المسمى الوظيفي" value={e.job_title} />
            <Field label="الحالة" value={EMPLOYEE_STATUS_LABELS[e.status]} />
            <Field
              label="الإدارة"
              value={departments.find((d) => d.id === e.department_id)?.name}
            />
            <Field label="القسم" value={sections.find((s) => s.id === e.section_id)?.name} />
            <Field label="تاريخ التعيين" value={e.hire_date ? formatDate(e.hire_date) : null} />
            <Field label="نوع العقد" value={e.contract_type} />
            <Field
              label="نهاية العقد"
              value={e.contract_end_date ? formatDate(e.contract_end_date) : null}
            />
            <Field label="المؤهل العلمي" value={e.education_level} />
            <Field label="التخصص" value={e.specialization} />
            {isDirector && (
              <Field
                label="الراتب الأساسي"
                value={e.basic_salary ? String(e.basic_salary) : null}
              />
            )}
            {isDirector && <Field label="الآيبان" value={e.iban} />}
          </TabsContent>

          <TabsContent value="personal" className="grid gap-3 pt-4 sm:grid-cols-3">
            <Field label="تاريخ الميلاد" value={e.birth_date ? formatDate(e.birth_date) : null} />
            <Field label="الجنس" value={e.gender} />
            <Field label="الحالة الاجتماعية" value={e.marital_status} />
            <Field label="فصيلة الدم" value={e.blood_type} />
            <Field label="الجنسية" value={e.nationality} />
            <Field label="الجوال" value={e.phone} />
            <Field label="البريد الإلكتروني" value={e.email} />
            <div className="sm:col-span-3">
              <Field label="الأمراض المزمنة" value={e.chronic_diseases} />
            </div>
            <div className="sm:col-span-3">
              <Field label="الحساسية" value={e.allergies} />
            </div>
            <div className="sm:col-span-3">
              <Field label="العنوان" value={e.address} />
            </div>
            <Separator className="sm:col-span-3" />
            <Field label="جهة الاتصال للطوارئ" value={e.emergency_contact_name} />
            <Field label="جوال الطوارئ" value={e.emergency_contact_phone} />
            <Field label="صلة القرابة" value={e.emergency_contact_relation} />
            <div className="sm:col-span-3">
              <Field label="ملاحظات" value={e.notes} />
            </div>
          </TabsContent>

          <TabsContent value="docs" className="pt-4">
            <EmployeeDocuments
              employeeId={e.id}
              national={{
                national_id: e.national_id,
                national_id_expiry: e.national_id_expiry,
                passport_no: e.passport_no,
                passport_expiry: e.passport_expiry,
              }}
              canUpload={isDirector || isHR}
              canDelete={isDirector || isHR}
            />
          </TabsContent>

          <TabsContent value="services" className="space-y-3 pt-4">
            <p className="text-xs text-muted-foreground">
              انتقل إلى وحدات النظام المرتبطة بالموظف: المهام، الدوام، الإجازات، التقييم، العهد،
              الطلبات، الجزاءات، دورة الحياة والرواتب.
            </p>
            <EmployeeServiceLinks />
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}
