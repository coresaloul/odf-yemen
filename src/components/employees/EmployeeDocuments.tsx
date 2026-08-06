import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Download,
  ExternalLink,
  Eye,
  FileText,
  Loader2,
  Paperclip,
  Plus,
  Search,
  Trash2,
  UploadCloud,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate } from "@/lib/hr";

export const DOC_TYPES = [
  "شهادة علمية",
  "دورة تدريبية",
  "عقد عمل",
  "هوية/إقامة",
  "جواز سفر",
  "شهادة خبرة",
  "تقرير طبي",
  "أخرى",
];

export type EmployeeDoc = {
  id: string;
  doc_type: string;
  title: string;
  issuer?: string | null;
  doc_number?: string | null;
  issue_date?: string | null;
  expiry_date?: string | null;
  file_url?: string | null;
  notes?: string | null;
};

export function ExpiryBadge({ expiry }: { expiry?: string | null | undefined }) {
  if (!expiry) return null;
  const days = Math.ceil((new Date(expiry).getTime() - Date.now()) / 86400000);
  if (Number.isNaN(days)) return null;
  if (days < 0)
    return (
      <Badge variant="destructive" className="text-[11px]">
        منتهية
      </Badge>
    );
  if (days <= 30)
    return (
      <Badge variant="secondary" className="text-[11px]">
        تنتهي خلال {days} يوماً
      </Badge>
    );
  return (
    <Badge variant="outline" className="text-[11px]">
      سارية
    </Badge>
  );
}

function DocViewerDialog({
  viewer,
  onClose,
}: {
  viewer: { title: string; url: string; ext: string } | null;
  onClose: () => void;
}) {
  if (!viewer) return null;
  const isImage = ["png", "jpg", "jpeg", "gif", "webp", "bmp", "svg"].includes(viewer.ext);
  const isPdf = viewer.ext === "pdf";
  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent dir="rtl" className="max-h-[92vh] max-w-4xl overflow-hidden">
        <DialogHeader>
          <DialogTitle className="truncate text-base">{viewer.title}</DialogTitle>
        </DialogHeader>
        <div className="max-h-[70vh] overflow-auto rounded-md border bg-muted/30">
          {isImage ? (
            <img src={viewer.url} alt={viewer.title} className="mx-auto max-h-[68vh] w-auto" />
          ) : isPdf ? (
            <iframe src={viewer.url} title={viewer.title} className="h-[68vh] w-full" />
          ) : (
            <div className="flex flex-col items-center gap-2 p-10 text-center">
              <FileText className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                لا يمكن استعراض هذا النوع داخل النظام، يمكنك تنزيله لفتحه.
              </p>
            </div>
          )}
        </div>
        <DialogFooter className="gap-2 sm:justify-start">
          <Button asChild size="sm" className="gap-1">
            <a href={viewer.url} download={viewer.title} target="_blank" rel="noopener">
              <Download className="size-4" /> تنزيل
            </a>
          </Button>
          <Button asChild variant="outline" size="sm" className="gap-1">
            <a href={viewer.url} target="_blank" rel="noopener">
              <ExternalLink className="size-4" /> فتح في تبويب جديد
            </a>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export type NationalRefs = {
  national_id?: string | null | undefined;
  national_id_expiry?: string | null | undefined;
  passport_no?: string | null | undefined;
  passport_expiry?: string | null | undefined;
};

/** قسم «وثائق الموظف» الموحّد: بطاقات رسمية + قائمة وثائق + رفع + عارض داخلي */
export function EmployeeDocuments({
  employeeId,
  national,
  canUpload = false,
  canDelete = false,
  showOfficialCards = true,
}: {
  employeeId: string;
  national?: NationalRefs | undefined;
  canUpload?: boolean;
  canDelete?: boolean;
  showOfficialCards?: boolean;
}) {
  const qc = useQueryClient();

  const { data: docs = [] as EmployeeDoc[] } = useQuery({
    queryKey: ["employee-documents", employeeId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("employee_documents")
        .select("*")
        .eq("employee_id", employeeId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as EmployeeDoc[];
    },
  });

  const emptyDoc = {
    doc_type: "شهادة علمية",
    title: "",
    issuer: "",
    doc_number: "",
    issue_date: "",
    expiry_date: "",
    file_url: "",
    notes: "",
  };
  const [doc, setDoc] = useState(emptyDoc);
  const setD = (k: keyof typeof emptyDoc, v: string) => setDoc((d) => ({ ...d, [k]: v }));
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [showDetails, setShowDetails] = useState(false);
  const [typeFilter, setTypeFilter] = useState("all");
  const [docQuery, setDocQuery] = useState("");
  const [viewer, setViewer] = useState<{ title: string; url: string; ext: string } | null>(null);

  const extOf = (ref: string) => (ref.split("?")[0]?.split(".").pop() ?? "").toLowerCase();
  const isExternal = (ref: string) => /^https?:\/\//i.test(ref);

  const signedUrl = async (fileRef: string, downloadName?: string) => {
    if (isExternal(fileRef)) return fileRef;
    const { data, error } = await supabase.storage
      .from("employee-documents")
      .createSignedUrl(fileRef, 60 * 10, downloadName ? { download: downloadName } : undefined);
    if (error || !data) throw new Error(error?.message ?? "تعذر فتح الملف");
    return data.signedUrl;
  };

  const viewDoc = async (d: EmployeeDoc) => {
    try {
      const url = await signedUrl(d.file_url as string);
      setViewer({ title: d.title, url, ext: extOf(d.file_url as string) });
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const downloadDoc = async (d: EmployeeDoc) => {
    try {
      const ref = d.file_url as string;
      const name = `${d.title || "وثيقة"}${extOf(ref) ? `.${extOf(ref)}` : ""}`;
      const url = await signedUrl(ref, isExternal(ref) ? undefined : name);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.target = "_blank";
      a.rel = "noopener";
      document.body.appendChild(a);
      a.click();
      a.remove();
    } catch (err) {
      toast.error((err as Error).message);
    }
  };

  const uploadToStorage = async (file: File) => {
    const safeName = file.name.replace(/[^\w.\-]+/g, "_");
    const path = `${employeeId}/${Date.now()}-${safeName}`;
    const { error } = await supabase.storage.from("employee-documents").upload(path, file);
    if (error) throw new Error(error.message);
    return path;
  };

  /** رفع ملف واحد وإرفاقه بنموذج «إضافة وثيقة» */
  const uploadDocFile = async (file: File) => {
    setUploading(true);
    try {
      const path = await uploadToStorage(file);
      setDoc((d) => ({
        ...d,
        file_url: path,
        title: d.title || file.name.replace(/\.[^.]+$/, ""),
      }));
      toast.success("تم رفع الملف");
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  /** رفع سريع لعدة ملفات: كل ملف يصبح وثيقة مباشرة */
  const quickUpload = async (
    files: File[],
    docType?: string,
    extra?: { doc_number?: string | null; expiry_date?: string | null },
  ) => {
    if (files.length === 0) return;
    setUploading(true);
    try {
      for (const file of files) {
        const path = await uploadToStorage(file);
        const { error } = await supabase.from("employee_documents").insert({
          employee_id: employeeId,
          doc_type: docType ?? doc.doc_type,
          title: file.name.replace(/\.[^.]+$/, ""),
          doc_number: extra?.doc_number ?? null,
          expiry_date: extra?.expiry_date ?? null,
          file_url: path,
        });
        if (error) throw new Error(error.message);
      }
      toast.success(files.length > 1 ? `تم رفع ${files.length} وثائق` : "تمت إضافة الوثيقة");
      void qc.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
    } catch (err) {
      toast.error((err as Error).message);
    } finally {
      setUploading(false);
    }
  };

  const addDoc = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("employee_documents").insert({
        employee_id: employeeId,
        doc_type: doc.doc_type,
        title: doc.title,
        issuer: doc.issuer || null,
        doc_number: doc.doc_number || null,
        issue_date: doc.issue_date || null,
        expiry_date: doc.expiry_date || null,
        file_url: doc.file_url || null,
        notes: doc.notes || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تمت إضافة الوثيقة");
      setDoc(emptyDoc);
      setShowDetails(false);
      void qc.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const delDoc = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("employee_documents").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("تم حذف الوثيقة");
      void qc.invalidateQueries({ queryKey: ["employee-documents", employeeId] });
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const filteredDocs = docs.filter(
    (d) =>
      (typeFilter === "all" || d.doc_type === typeFilter) &&
      (docQuery.trim() === "" || d.title.includes(docQuery.trim())),
  );

  const OfficialCard = ({
    label,
    number,
    expiry,
    docType,
  }: {
    label: string;
    number?: string | null | undefined;
    expiry?: string | null | undefined;
    docType: string;
  }) => {
    const linked = docs.find((d) => d.doc_type === docType && d.file_url);
    return (
      <div className="rounded-lg border bg-muted/30 p-3">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0">
            <p className="text-xs text-muted-foreground">{label}</p>
            <p className="truncate text-sm font-medium">{number || "—"}</p>
            <p className="mt-0.5 text-xs text-muted-foreground">
              الانتهاء: {expiry ? formatDate(expiry) : "—"}
            </p>
          </div>
          <ExpiryBadge expiry={expiry} />
        </div>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {linked ? (
            <>
              <Button
                variant="outline"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void viewDoc(linked)}
              >
                <Eye className="size-3.5" /> استعراض
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-7 gap-1 text-xs"
                onClick={() => void downloadDoc(linked)}
              >
                <Download className="size-3.5" /> تنزيل
              </Button>
            </>
          ) : (
            canUpload && (
              <label className="inline-flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-xs hover:bg-accent">
                <Paperclip className="size-3.5" /> إرفاق ملف
                <input
                  type="file"
                  className="hidden"
                  accept="image/*,application/pdf,.doc,.docx"
                  disabled={uploading}
                  onChange={(ev) => {
                    const file = ev.target.files?.[0];
                    ev.target.value = "";
                    if (file)
                      void quickUpload([file], docType, {
                        doc_number: number ?? null,
                        expiry_date: expiry ?? null,
                      });
                  }}
                />
              </label>
            )
          )}
        </div>
      </div>
    );
  };

  return (
    <div className="space-y-4">
      {showOfficialCards && (
        <>
          <div className="grid gap-3 sm:grid-cols-2">
            <OfficialCard
              label="الهوية / الإقامة"
              number={national?.national_id}
              expiry={national?.national_id_expiry}
              docType="هوية/إقامة"
            />
            <OfficialCard
              label="جواز السفر"
              number={national?.passport_no}
              expiry={national?.passport_expiry}
              docType="جواز سفر"
            />
          </div>
          <Separator />
        </>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[160px] flex-1">
          <Search className="pointer-events-none absolute end-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={docQuery}
            onChange={(ev) => setDocQuery(ev.target.value)}
            placeholder="بحث بالعنوان"
            className="pe-8"
          />
        </div>
        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger className="w-40">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">كل الأنواع</SelectItem>
            {DOC_TYPES.map((t) => (
              <SelectItem key={t} value={t}>
                {t}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {filteredDocs.length === 0 ? (
        <p className="text-sm text-muted-foreground">لا توجد وثائق مطابقة.</p>
      ) : (
        <div className="space-y-2">
          {filteredDocs.map((d) => (
            <div key={d.id} className="rounded-md border p-3 text-sm">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <p className="font-medium">{d.title}</p>
                    <Badge variant="outline" className="text-[11px]">
                      {d.doc_type}
                    </Badge>
                    <ExpiryBadge expiry={d.expiry_date} />
                  </div>
                  <p className="text-xs text-muted-foreground">
                    {d.issuer ? `${d.issuer} · ` : ""}
                    {d.doc_number ? `رقم ${d.doc_number} · ` : ""}
                    الإصدار: {d.issue_date ? formatDate(d.issue_date) : "—"}
                  </p>
                  {d.notes && <p className="text-xs text-muted-foreground">{d.notes}</p>}
                  {d.file_url && (
                    <div className="mt-1.5 flex flex-wrap gap-1.5">
                      <Button
                        variant="outline"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => void viewDoc(d)}
                      >
                        <Eye className="size-3.5" /> استعراض
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-7 gap-1 text-xs"
                        onClick={() => void downloadDoc(d)}
                      >
                        <Download className="size-3.5" /> تنزيل
                      </Button>
                    </div>
                  )}
                </div>
                {canDelete && (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-destructive"
                    onClick={() => delDoc.mutate(d.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canUpload && (
        <div className="space-y-3 rounded-md border p-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <p className="text-sm font-medium">إضافة وثيقة</p>
            <Select value={doc.doc_type} onValueChange={(v) => setD("doc_type", v)}>
              <SelectTrigger className="w-44">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOC_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {t}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <label
            onDragOver={(ev) => {
              ev.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(ev) => {
              ev.preventDefault();
              setDragOver(false);
              const files = Array.from(ev.dataTransfer.files ?? []);
              if (files.length) void quickUpload(files);
            }}
            className={`flex cursor-pointer flex-col items-center justify-center gap-1 rounded-lg border border-dashed px-4 py-6 text-center transition-colors ${
              dragOver ? "border-primary bg-primary/5" : "bg-muted/30 hover:bg-muted/50"
            }`}
          >
            {uploading ? (
              <Loader2 className="size-5 animate-spin text-muted-foreground" />
            ) : (
              <UploadCloud className="size-5 text-muted-foreground" />
            )}
            <p className="text-sm font-medium">اسحب الملفات هنا أو اضغط للاختيار</p>
            <p className="text-xs text-muted-foreground">
              صور، PDF، Word — يمكن اختيار أكثر من ملف دفعة واحدة
            </p>
            <input
              type="file"
              multiple
              className="hidden"
              accept="image/*,application/pdf,.doc,.docx"
              disabled={uploading}
              onChange={(ev) => {
                const files = Array.from(ev.target.files ?? []);
                ev.target.value = "";
                if (files.length) void quickUpload(files);
              }}
            />
          </label>

          <Button
            variant="ghost"
            size="sm"
            className="text-xs"
            onClick={() => setShowDetails((s) => !s)}
          >
            {showDetails ? "إخفاء التفاصيل الإضافية" : "تفاصيل إضافية / رابط خارجي"}
          </Button>

          {showDetails && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="space-y-2">
                  <Label>العنوان</Label>
                  <Input value={doc.title} onChange={(ev) => setD("title", ev.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>الجهة المُصدرة</Label>
                  <Input value={doc.issuer} onChange={(ev) => setD("issuer", ev.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>رقم الوثيقة</Label>
                  <Input
                    value={doc.doc_number}
                    onChange={(ev) => setD("doc_number", ev.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الإصدار</Label>
                  <Input
                    type="date"
                    value={doc.issue_date}
                    onChange={(ev) => setD("issue_date", ev.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>تاريخ الانتهاء</Label>
                  <Input
                    type="date"
                    value={doc.expiry_date}
                    onChange={(ev) => setD("expiry_date", ev.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label>الملف</Label>
                  <div className="flex flex-wrap items-center gap-2">
                    <Input
                      type="file"
                      className="max-w-xs"
                      accept="image/*,application/pdf,.doc,.docx"
                      disabled={uploading}
                      onChange={(ev) => {
                        const file = ev.target.files?.[0];
                        ev.target.value = "";
                        if (file) void uploadDocFile(file);
                      }}
                    />
                    {doc.file_url && !uploading && (
                      <span className="text-xs text-muted-foreground">تم الإرفاق ✓</span>
                    )}
                  </div>
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>أو رابط خارجي</Label>
                  <Input
                    value={doc.file_url}
                    onChange={(ev) => setD("file_url", ev.target.value)}
                    placeholder="https://"
                  />
                </div>
                <div className="space-y-2 sm:col-span-2">
                  <Label>ملاحظات</Label>
                  <Textarea value={doc.notes} onChange={(ev) => setD("notes", ev.target.value)} />
                </div>
              </div>
              <Button
                size="sm"
                disabled={!doc.title || addDoc.isPending}
                onClick={() => addDoc.mutate()}
              >
                <Plus className="size-4" /> إضافة
              </Button>
            </div>
          )}
        </div>
      )}

      <DocViewerDialog viewer={viewer} onClose={() => setViewer(null)} />
    </div>
  );
}
