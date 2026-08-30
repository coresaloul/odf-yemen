import {
  Mic,
  MoreVertical,
  Pencil,
  Trash2,
  AlertTriangle,
  Repeat,
  Paperclip,
  MessageCircle,
  Users,
  ShieldCheck,
  UserCheck,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Progress } from "@/components/ui/progress";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { PRIORITY_LABELS, TASK_STATUS_LABELS, formatDate } from "@/lib/hr";
import { isOverdue, type SubtaskItem, type TaskRow } from "./task-utils";
import { buildTaskAssignedMessage, waLink } from "@/lib/whatsapp";
import { PRIORITY_LABELS as PRIORITIES } from "@/lib/hr";

export function TaskCard({
  task,
  subtasks = [],
  assigneeName,
  assigneeNames,
  assignerName,
  supervisorName,
  assigneePhone,
  isShared,
  canManage,
  canUpdateProgress,
  onOpen,
  onEdit,
  onDelete,
  onProgress,
}: {
  task: TaskRow;
  subtasks?: SubtaskItem[];
  assigneeName?: string;
  assigneeNames?: string[];
  assignerName: string;
  supervisorName?: string | null;
  assigneePhone?: string | null;
  isShared?: boolean;
  canManage: boolean;
  canUpdateProgress: boolean;
  onOpen?: () => void;
  onEdit: () => void;
  onDelete: () => void;
  onProgress: (progress: number) => void;
}) {
  const overdue = isOverdue(task);
  const progressValue = Number(task.progress ?? 0);
  
  const names = assigneeNames && assigneeNames.length > 0 
    ? assigneeNames 
    : [assigneeName || "—"];
  
  const isMultiple = isShared || names.length > 1;

  const whatsappHref = waLink(
    assigneePhone,
    buildTaskAssignedMessage({
      title: task.title,
      description: task.description,
      priority: PRIORITIES[task.priority] ?? task.priority,
      dueDate: task.due_date,
      assigneeName: names.join("، "),
      supervisorName: supervisorName ?? null,
      taskId: task.id,
    }),
  );

  const getInitials = (name: string) => {
    const parts = name.trim().split(/\s+/);
    if (parts.length >= 2) return `${parts[0]![0]}${parts[1]![0]}`;
    return parts[0]?.slice(0, 2) || "مو";
  };

  return (
    <Card className={`transition hover:shadow-md ${overdue ? "border-destructive/50" : isMultiple ? "border-primary/30 bg-primary/[0.02]" : ""}`}>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onOpen}
                className="text-right font-semibold text-primary hover:underline"
              >
                {task.title}
              </button>
              {isMultiple && (
                <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1 text-[11px] font-normal py-0 px-2">
                  <Users className="size-3" /> مهمة مشتركة ({names.length})
                </Badge>
              )}
              {task.created_via_voice && (
                <Mic className="inline size-3.5 text-accent" aria-label="أُضيفت صوتياً" />
              )}
              {task.recurrence && task.recurrence !== "none" && (
                <Repeat className="inline size-3.5 text-muted-foreground" aria-label="مهمة متكررة" />
              )}
            </div>

            {/* تفاصيل المنفذين والمشرف */}
            <div className="mt-2.5 space-y-1.5">
              {/* قائمة الموظفين المنفذين */}
              <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">المكلفون:</span>
                <div className="flex items-center -space-x-1.5 space-x-reverse overflow-hidden py-0.5">
                  {names.slice(0, 4).map((name, idx) => (
                    <div
                      key={idx}
                      title={name}
                      className="flex items-center gap-1 rounded-full bg-secondary px-2 py-0.5 text-[11px] font-medium text-secondary-foreground border border-background shadow-xs"
                    >
                      <UserCheck className="size-3 text-muted-foreground" />
                      <span>{name}</span>
                    </div>
                  ))}
                  {names.length > 4 && (
                    <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold text-muted-foreground">
                      +{names.length - 4}
                    </span>
                  )}
                </div>
              </div>

              {/* المشرف وتواريخ المهمة */}
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                <span>المكلِّف: {assignerName}</span>
                <span>•</span>
                <span>الاستحقاق: {formatDate(task.due_date)}</span>
                
                {supervisorName && (
                  <>
                    <span>•</span>
                    <span className="inline-flex items-center gap-1 font-medium text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-sm">
                      <ShieldCheck className="size-3.5" />
                      المشرف: {supervisorName}
                    </span>
                  </>
                )}
              </div>
            </div>
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

        <div className="space-y-2">
          <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
            <span>{isMultiple ? "متوسط نسبة الإنجاز الكلية" : "نسبة الإنجاز"}</span>
            <span className="font-semibold text-foreground">{progressValue}%</span>
          </div>
          <Progress value={progressValue} className="h-2" />
        </div>

        <div className="flex justify-end gap-1">
          {whatsappHref && (
            <Button size="sm" variant="ghost" asChild>
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" /> واتساب
              </a>
            </Button>
          )}
          <Button size="sm" variant="ghost" type="button" onClick={onOpen} disabled={!onOpen}>
            <Paperclip className="size-4" /> التفاصيل
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
