import {
  STAGE_STEP_LABELS,
  stepDone,
  type ApprovalStage,
} from "@/lib/evaluation-approval";

export function ApprovalTrack({ stage }: { stage: ApprovalStage }) {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs">
      {STAGE_STEP_LABELS.map((s, i) => {
        const done = stepDone(s.stage, stage);
        const current = stage === s.stage;
        return (
          <span key={s.stage} className="flex items-center gap-2">
            {i > 0 && <span className="text-muted-foreground">←</span>}
            <span
              className={
                done
                  ? "rounded-full bg-primary/10 px-2 py-1 font-medium text-primary"
                  : current
                    ? "rounded-full bg-accent px-2 py-1 font-medium text-accent-foreground"
                    : "rounded-full bg-muted px-2 py-1 text-muted-foreground"
              }
            >
              {done ? "✓ " : current ? "• " : ""}
              {s.label}
            </span>
          </span>
        );
      })}
    </div>
  );
}
