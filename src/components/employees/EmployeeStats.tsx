interface EmployeeStatsProps {
  filteredCount: number;
  activeCount: number;
  onLeaveCount: number;
  noAccountCount: number;
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border bg-card px-3 py-2.5">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-display text-xl font-bold">{value}</p>
    </div>
  );
}

export function EmployeeStats({
  filteredCount,
  activeCount,
  onLeaveCount,
  noAccountCount,
}: EmployeeStatsProps) {
  return (
    <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
      <StatCard label="النتائج المعروضة" value={filteredCount} />
      <StatCard label="على رأس العمل" value={activeCount} />
      <StatCard label="في إجازة" value={onLeaveCount} />
      <StatCard label="بلا حساب مستخدم" value={noAccountCount} />
    </div>
  );
}
