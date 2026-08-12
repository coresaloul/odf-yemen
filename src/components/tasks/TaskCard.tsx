import {
  Mic,
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle,
  Repeat,
  Paperclip,
  ChevronDown,
  ChevronUp,
  AlignRight,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Slider } from "@/components/ui/slider";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate } from "@/lib/hr";
import { isOverdue, type TaskRow } from "./task-utils";
import { useState } from "react";

export function TaskCard({
  task,
  assigneeName,
  assignerName,
  supervisorName,
  canManage,
  canUpdateProgress,
  onOpen,
  onEdit,
  onDelete,
  onProgress,
}: {
  task: TaskRow;
  assigneeName: string;
  assignerName: string;
  supervisorName?: string | null;
  canManage: boolean;
  canUpdateProgress: boolean;
  onOpen: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onProgress: (progress: number) => void;
}) {
  const overdue = isOverdue(task);
  const [draft, setDraft] = useState<number | null>(null);

  return (
    <Card className={overdue ? "border-destructive/50" : undefined}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <button className="text-right font-semibold hover:underline" onClick={onOpen}>
              {task.title}
            </button>
            {task.created_via_voice && (
              <Mic className="mr-2 inline size-3.5 text-accent" aria-label="أُضيفت صوتياً" />
            )}
            {task.recurrence && task.recurrence !== "none" && (
              <Repeat className="mr-2 inline size-3.5 text-muted-foreground" aria-label="مهمة متكررة" />
            )}
            <p className="mt-1 text-xs text-muted-foreground">
              المكلّف: {assigneeName} — المكلِّف: {assignerName} — الاستحقاق: {formatDate(task.due_date)}
            </p>
            {supervisorName && (
              <p className="mt-1 text-xs font-medium text-primary">
                المشرف على المهمة: {supervisorName}
              </p>
            )}
          </div>
          <div className="flex items-center gap-2">
            {overdue && (
              <Badge variant="destructive" className="gap-1">
                <AlertTriangle className="size-3" /> متأخرة
              </Badge>
            )}
            <Badge variant="outline">{PRIORITY_LABELS[task.priority]}</Badge>
            <Badge variant={task.status === "completed" ? "default" : "secondary"}>
              {TASK_STATUS_LABELS[task.status]}
            </Badge>
            {canManage && (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <Button size="icon" variant="ghost" aria-label="خيارات المهمة">
                    <MoreVertical className="size-4" />
                  </Button>
                </DropdownMenuTrigger>
                <DropdownMenuContent align="start">
                  <DropdownMenuItem onClick={onEdit}>
                    <Pencil className="size-4" /> تعديل
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={onDelete} className="text-destructive">
                    <Trash2 className="size-4" /> حذف
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            )}
          </div>
        </div>

        {task.description && <p className="text-sm text-foreground/80">{task.description}</p>}

        <Progress value={task.progress} />
        <div className="flex flex-wrap items-center gap-3">
          <span className="text-xs text-muted-foreground">التقدم {draft ?? task.progress}%</span>
          {canUpdateProgress && (
            <>
              <Slider
                className="w-40"
                value={[draft ?? task.progress]}
                max={100}
                step={5}
                onValueChange={(v) => setDraft(v[0] ?? 0)}
                onValueCommit={(v) => {
                  onProgress(v[0] ?? 0);
                  setDraft(null);
                }}
              />
              {[25, 50, 75, 100].map((p) => (
                <Button key={p} size="sm" variant="outline" onClick={() => onProgress(p)}>
                  {p}%
                </Button>
              ))}
            </>
          )}
          <Button size="sm" variant="ghost" onClick={onOpen}>
            <Paperclip className="size-4" /> التفاصيل
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
