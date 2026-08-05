import { createFileRoute } from "@tanstack/react-router";
import { useAuth } from "@/hooks/useAuth";
import { PageHeader } from "@/components/PageHeader";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PayrollRuns } from "@/components/payroll/PayrollRuns";
import { PayrollAdjustments } from "@/components/payroll/PayrollAdjustments";
import { PayrollProfiles } from "@/components/payroll/PayrollProfiles";
import { PayrollAdvances } from "@/components/payroll/PayrollAdvances";
import { PayrollSettingsPanel } from "@/components/payroll/PayrollSettingsPanel";
import { MyPayslips } from "@/components/payroll/MyPayslips";

export const Route = createFileRoute("/_authenticated/payroll")({
  head: () => ({
    meta: [
      { title: "إدارة الرواتب | مؤسسة اليتيم التنموية" },
      {
        name: "description",
        content:
          "مسيرات الرواتب الشهرية للموظفين والعاملين والاستشاريين والمتطوعين، مع البدلات والاستقطاعات والسلف والتعديلات واعتماد المسير.",
      },
      { property: "og:title", content: "إدارة الرواتب | مؤسسة اليتيم التنموية" },
      {
        property: "og:description",
        content: "احتساب واعتماد الرواتب وتصدير القسائم وكشوفات الصرف.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: PayrollPage,
});

function PayrollPage() {
  const { isDirector, isHR } = useAuth();
  const isAdmin = isDirector || isHR;

  return (
    <div className="space-y-4">
      <PageHeader
        title="إدارة الرواتب"
        description={
          isAdmin
            ? "مسيرات الرواتب واعتمادها، البدلات والاستقطاعات، السلف، عقود الاستشاريين، والتعديلات."
            : "قسائم رواتبك المعتمدة."
        }
      />

      {!isAdmin ? (
        <MyPayslips />
      ) : (
        <Tabs defaultValue="runs" className="w-full">
          <TabsList className="flex w-full flex-wrap justify-start">
            <TabsTrigger value="runs">مسيرات الرواتب</TabsTrigger>
            <TabsTrigger value="adjustments">التعديلات</TabsTrigger>
            <TabsTrigger value="profiles">ملفات الأجور</TabsTrigger>
            <TabsTrigger value="advances">السلف والعقود</TabsTrigger>
            <TabsTrigger value="settings">الإعدادات والبنود</TabsTrigger>
            <TabsTrigger value="mine">قسائمي</TabsTrigger>
          </TabsList>
          <TabsContent value="runs" className="mt-4">
            <PayrollRuns />
          </TabsContent>
          <TabsContent value="adjustments" className="mt-4">
            <PayrollAdjustments />
          </TabsContent>
          <TabsContent value="profiles" className="mt-4">
            <PayrollProfiles />
          </TabsContent>
          <TabsContent value="advances" className="mt-4">
            <PayrollAdvances />
          </TabsContent>
          <TabsContent value="settings" className="mt-4">
            <PayrollSettingsPanel />
          </TabsContent>
          <TabsContent value="mine" className="mt-4">
            <MyPayslips />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}
