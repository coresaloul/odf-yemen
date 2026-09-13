import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Sparkles, ArrowLeft, Clock, Users, CheckCircle2 } from "lucide-react";
import { PACKAGED_PROJECT_PITCHES, type ProjectPitchItem } from "@/lib/pr-catalog";
import { GRANT_SECTOR_LABELS, type PartnerRow } from "@/lib/pr-crm";

export function ProjectPitchCatalogDialog({
  open,
  onOpenChange,
  partner,
  onSelectPitch,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  partner?: PartnerRow | null;
  onSelectPitch: (pitch: ProjectPitchItem) => void;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto" dir="rtl">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-primary" />
            <DialogTitle>
              كتالوج المشاريع والفرص التمويلية الجاهزة للأيتام (Pitch Catalog)
            </DialogTitle>
          </div>
          <p className="text-xs text-muted-foreground">
            {partner ? (
              <>
                اختر حزمة مشروع لتقديمها للشريك:{" "}
                <span className="font-bold text-foreground">{partner.name}</span>
              </>
            ) : (
              "حزم مشاريع معيارية جاهزة للصياغة وتقديمها للمانحين بضغطة زر"
            )}
          </p>
        </DialogHeader>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
          {PACKAGED_PROJECT_PITCHES.map((pitch) => (
            <Card
              key={pitch.id}
              className="hover:border-primary transition-colors flex flex-col justify-between"
            >
              <CardHeader className="pb-2 space-y-1.5">
                <div className="flex justify-between items-start gap-2">
                  <Badge variant="outline" className="text-xs">
                    {GRANT_SECTOR_LABELS[pitch.sector]}
                  </Badge>
                  <span className="font-bold text-base text-primary">
                    ${pitch.estimatedAmount.toLocaleString()} {pitch.currency}
                  </span>
                </div>
                <CardTitle className="text-sm font-bold text-foreground leading-snug">
                  {pitch.title}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-3 pt-0 flex-1 flex flex-col justify-between">
                <p className="text-xs text-muted-foreground leading-relaxed">{pitch.summary}</p>

                <div className="space-y-1.5 p-2.5 rounded-lg bg-muted/40 border text-[11px]">
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Users className="w-3.5 h-3.5 text-primary" />
                    <span>المستفيدون: {pitch.targetBeneficiaries}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-muted-foreground">
                    <Clock className="w-3.5 h-3.5 text-primary" />
                    <span>المدة الزمنية: {pitch.durationMonths} أشهر</span>
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[11px] font-semibold text-foreground">أبرز المخرجات:</span>
                  {pitch.keyOutcomes.slice(0, 2).map((outcome, idx) => (
                    <div
                      key={idx}
                      className="text-[11px] text-muted-foreground flex items-center gap-1.5"
                    >
                      <CheckCircle2 className="w-3 h-3 text-emerald-600 shrink-0" />
                      <span className="truncate">{outcome}</span>
                    </div>
                  ))}
                </div>

                <div className="pt-2 border-t mt-2">
                  <Button
                    size="sm"
                    className="w-full gap-1.5 text-xs h-8"
                    onClick={() => {
                      onSelectPitch(pitch);
                      onOpenChange(false);
                    }}
                  >
                    <span>تقديم هذا المشروع كفرصة تمويل</span>
                    <ArrowLeft className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}
