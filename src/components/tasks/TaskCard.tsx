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
import { isOverdue, type TaskRow } from "./task-utils";
import { buildTaskAssignedMessage, waLink } from "@/lib/whatsapp";
import { PRIORITY_LABELS as PRIORITIES } from "@/lib/hr";

export function TaskCard({
  task,
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
    <Card className={`transition-all hover:shadow-md ${overdue ? "border-destructive/50" : isMultiple ? "border-primary/30 bg-primary/[0.02]" : ""}`}>
      <CardContent className="space-y-4 p-4 sm:p-5">
        {/* Header Section: Title and Menu */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex flex-wrap items-center gap-2 flex-1 pt-0.5">
            <button
              type="button"
              onClick={onOpen}
              className="text-right text-base sm:text-lg font-semibold text-primary hover:underline line-clamp-2"
            >
              {task.title}
            </button>
            {task.created_via_voice && (
              <Mic className="inline size-3.5 sm:size-4 text-accent" aria-label="أُضيفت صوتياً" />
            )}
            {task.recurrence && task.recurrence !== "none" && (
              <Repeat className="inline size-3.5 sm:size-4 text-muted-foreground" aria-label="مهمة متكررة" />
            )}
          </div>
          {canManage && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button size="icon" variant="ghost" className="-mt-1.5 -me-1.5 shrink-0 h-8 w-8 text-muted-foreground" aria-label="خيارات المهمة">
                  <MoreVertical className="size-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-40">
                <DropdownMenuItem onClick={onEdit} className="cursor-pointer">
                  <Pencil className="size-4 ms-2" /> تعديل
                </DropdownMenuItem>
                <DropdownMenuItem onClick={onDelete} className="text-destructive cursor-pointer focus:bg-destructive/10 focus:text-destructive">
                  <Trash2 className="size-4 ms-2" /> حذف
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        {/* Badges Section */}
        <div className="flex flex-wrap items-center gap-2">
          {overdue && (
            <Badge variant="destructive" className="gap-1 px-2 py-0.5 text-[11px] sm:text-xs">
              <AlertTriangle className="size-3 sm:size-3.5" /> متأخرة
            </Badge>
          )}
          <Badge variant="outline" className="px-2 py-0.5 text-[11px] sm:text-xs">{PRIORITY_LABELS[task.priority]}</Badge>
          <Badge variant={task.status === "completed" ? "default" : "secondary"} className="px-2 py-0.5 text-[11px] sm:text-xs">
            {TASK_STATUS_LABELS[task.status]}
          </Badge>
          {isMultiple && (
            <Badge variant="secondary" className="bg-primary/10 text-primary border-primary/20 gap-1 px-2 py-0.5 text-[11px] sm:text-xs">
              <Users className="size-3 sm:size-3.5" /> مهمة مشتركة ({names.length})
            </Badge>
          )}
        </div>

        {/* Details Section */}
        <div className="space-y-3 rounded-xl bg-muted/40 p-3 sm:p-4 text-xs sm:text-sm">
          {/* Assignees */}
          <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3">
            <span className="font-medium text-foreground/80 shrink-0 flex items-center gap-1.5">
              <Users className="size-3.5 opacity-70" />
              المكلفون:
            </span>
            <div className="flex flex-wrap items-center gap-1.5">
              {names.slice(0, 4).map((name, idx) => (
                <div
                  key={idx}
                  title={name}
                  className="flex items-center gap-1.5 rounded-md bg-background px-2 py-1 text-[11px] sm:text-xs font-medium text-secondary-foreground border shadow-sm transition-colors hover:bg-secondary/50"
                >
                  <UserCheck className="size-3 text-muted-foreground" />
                  <span className="truncate max-w-[120px]">{name}</span>
                </div>
              ))}
              {names.length > 4 && (
                <span className="rounded-md bg-muted px-2 py-1 text-[11px] sm:text-xs font-semibold text-muted-foreground border">
                  +{names.length - 4}
                </span>
              )}
            </div>
          </div>

          {/* Dates and Supervisor */}
          <div className="flex flex-col gap-2 pt-1">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-muted-foreground">
              <span className="flex items-center gap-1.5">
                <span className="text-foreground/70">المكلِّف:</span>
                <span className="font-medium text-foreground/90">{assignerName}</span>
              </span>
              <span className="hidden sm:inline opacity-30">•</span>
              <span className="flex items-center gap-1.5">
                <span className="text-foreground/70">الاستحقاق:</span>
                <span className="font-medium text-foreground/90">{formatDate(task.due_date)}</span>
              </span>
            </div>
            
            {supervisorName && (
              <div className="inline-flex items-center gap-1.5 font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2.5 py-1.5 rounded-md border border-amber-500/20 w-fit mt-1 text-[11px] sm:text-xs">
                <ShieldCheck className="size-3.5 sm:size-4" />
                المشرف: {supervisorName}
              </div>
            )}
          </div>
        </div>

        {/* Progress Section */}
        <div className="space-y-2 pt-1">
          <div className="flex items-center justify-between gap-2 text-xs sm:text-sm text-muted-foreground font-medium">
            <span>{isMultiple ? "متوسط نسبة الإنجاز" : "نسبة الإنجاز"}</span>
            <span className="font-bold text-primary">{progressValue}%</span>
          </div>
          <Progress value={progressValue} className="h-2 bg-secondary" />
        </div>

        {/* Actions Section */}
        <div className="flex flex-col sm:flex-row items-center justify-end gap-2 sm:gap-3 pt-3 border-t mt-4">
          {whatsappHref && (
            <Button 
              size="sm" 
              variant="outline" 
              className="w-full sm:w-auto h-9 bg-green-50/50 text-green-700 hover:bg-green-100 hover:text-green-800 border-green-200 dark:bg-green-950/20 dark:text-green-400 dark:hover:bg-green-900/40 dark:border-green-900/50 transition-colors shadow-sm" 
              asChild
            >
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center">
                <MessageCircle className="size-4 ms-2" /> إرسال للمتابعة (واتساب)
              </a>
            </Button>
          )}
          <Button 
            size="sm" 
            variant="default" 
            className="w-full sm:w-auto h-9 shadow-sm" 
            type="button" 
            onClick={onOpen} 
            disabled={!onOpen}
          >
            <Paperclip className="size-4 ms-2" /> عرض التفاصيل
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
