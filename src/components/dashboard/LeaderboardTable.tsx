import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { PerformerScore } from "@/lib/dashboard-metrics";

export function LeaderboardTable({
  title,
  entityLabel,
  rows,
  limit = 5,
}: {
  title: string;
  entityLabel: string;
  rows: PerformerScore[];
  limit?: number;
}) {
  const shown = rows.slice(0, limit);
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {shown.length === 0 ? (
          <p className="text-sm text-muted-foreground">لا توجد بيانات كافية خلال الفترة.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-10">#</TableHead>
                  <TableHead>{entityLabel}</TableHead>
                  <TableHead>المنجزة</TableHead>
                  <TableHead>الإنجاز</TableHead>
                  <TableHead>الالتزام</TableHead>
                  <TableHead>الدرجة</TableHead>
                  <TableHead>التقدير</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {shown.map((r, i) => (
                  <TableRow key={r.id}>
                    <TableCell className="text-muted-foreground">{i + 1}</TableCell>
                    <TableCell>
                      <p className="font-medium">{r.name}</p>
                      <p className="truncate text-xs text-muted-foreground">{r.subtitle}</p>
                    </TableCell>
                    <TableCell>
                      {r.completedTasks} / {r.totalTasks}
                    </TableCell>
                    <TableCell>{r.tasksScore}%</TableCell>
                    <TableCell>{r.attendanceScore}%</TableCell>
                    <TableCell className="font-semibold text-primary">{r.score}%</TableCell>
                    <TableCell>
                      <Badge variant={i === 0 ? "default" : "outline"}>{r.grade}</Badge>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
