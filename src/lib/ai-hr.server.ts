import { supabaseAdmin } from "@/integrations/supabase/client.server";

export type DocumentType = "notice" | "warning" | "recognition" | "promotion" | "delegation";

export type DraftDocumentInput = {
  docType: DocumentType;
  employeeName: string;
  jobTitle?: string | null;
  departmentName?: string | null;
  reasonOrAchievement: string;
  sanctionDegree?: string | null;
  customNotes?: string | null;
};

export type DraftDocumentResult = {
  title: string;
  referenceNumber: string;
  date: string;
  recipient: string;
  body: string;
  signatory: string;
  source: "ai" | "template";
};

export type PerformanceAnalysisResult = {
  employeeId: string;
  employeeName: string;
  jobTitle: string;
  period: string;
  kpis: {
    tasksCompleted: number;
    tasksTotal: number;
    completionRate: number;
    presentDays: number;
    lateMinutes: number;
    performanceScore: number;
    grade: string;
  };
  executiveSummary: string;
  strengths: string[];
  areasForImprovement: string[];
  trainingRecommendations: Array<{
    title: string;
    priority: "عالية" | "متوسطة" | "تطويرية";
    description: string;
  }>;
  careerPathAdvice: {
    promotionReadiness: "مؤهل للترقية" | "واعد ويحتاج تطوير" | "يحتاج تحسين الالتزام";
    notes: string;
  };
};

/** استدعاء الذكاء الاصطناعي مع معالجة الأخطاء */
async function callAiCompletion(messages: Array<{ role: string; content: string }>): Promise<string | null> {
  const apiKey = process.env["LOVABLE_API_KEY"] ?? process.env["OPENAI_API_KEY"];
  if (!apiKey) return null;

  try {
    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages,
        temperature: 0.3,
      }),
    });

    if (!res.ok) return null;
    const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
    return json.choices?.[0]?.message?.content?.trim() ?? null;
  } catch (err) {
    console.warn("AI generation failed, using template engine:", err);
    return null;
  }
}

/** توليد الخطابات الإدارية وشهادات التكريم */
export async function draftAdministrativeDocument(input: DraftDocumentInput): Promise<DraftDocumentResult> {
  const today = new Date().toISOString().slice(0, 10);
  const ref = `ODF-HR-${new Date().getFullYear()}-${Math.floor(1000 + Math.random() * 9000)}`;

  const prompt = `أنت مستشار ومدير موارد بشرية تنفيذي خبير في صياغة الخطابات والمراسلات الإدارية الرسمية لمؤسسة اليتيم التنموية (ODF - اليمن) ووفقاً لقانون العمل اليمني.
المطلوب صياغة مستند إداري رسمي فائق الاحترافية بالبيانات التالية:
- نوع المستند: ${input.docType === "notice" ? "لفت نظر إداري" : input.docType === "warning" ? "إنذار تأديبي" : input.docType === "recognition" ? "شهادة شكر وتقدير / تكريم" : input.docType === "promotion" ? "إشعار ترقية وتعديل مسمى وظيفي" : "قرار تكليف بمهام"}
- اسم الموظف: ${input.employeeName}
- المسمى الوظيفي: ${input.jobTitle || "موظف"}
- الإدارة / القسم: ${input.departmentName || "الإدارة العامة"}
- الموضوع / المخالفة أو الإنجاز: ${input.reasonOrAchievement}
- درجة الجزاء أو الملاحظات: ${input.sanctionDegree || input.customNotes || "لا يوجد"}

يرجى إخراج نص المستند كاملاً بصياغة راقية وبليغة تتضمن:
1. البسملة والترويسة والتحية الرسمية
2. متن الخطاب الواضح والمؤصل إدارياً وقانونياً
3. التوجيهات أو التوصيات المترتبة
4. عبارة ختامية والتوقيع (المدير التنفيذي / مدير الموارد البشرية)`;

  const aiText = await callAiCompletion([
    { role: "system", content: "صيغ الخطاب باللغة العربية الرسمية الفصحى وبأعلى درجات الرصانة الإدارية." },
    { role: "user", content: prompt },
  ]);

  if (aiText) {
    return {
      title: input.docType === "notice" ? "لفت نظر إداري" : input.docType === "warning" ? "إنذار تأديبي" : input.docType === "recognition" ? "شهادة شكر وتقدير" : "خطاب إداري رسمي",
      referenceNumber: ref,
      date: today,
      recipient: `${input.employeeName} — ${input.jobTitle ?? ""}`,
      body: aiText,
      signatory: "المدير التنفيذي / مدير الموارد البشرية",
      source: "ai",
    };
  }

  // مولد القوالب الذكي الاحتياطي (Smart Fallback Generator)
  let fallbackBody = "";
  if (input.docType === "warning" || input.docType === "notice") {
    fallbackBody = `بسم الله الرحمن الرحيم\n\nإلى الأخ/ت: ${input.employeeName} المحترم\nالوظيفة: ${input.jobTitle || "موظف"}\nالإدارة: ${input.departmentName || "الإدارة العامة"}\n\nالسلام عليكم ورحمة الله وبركاته،،،\n\nالموضوع: ${input.docType === "warning" ? "إنذار تأديبي" : "لفت نظر إداري"}\n\nإشارة إلى الموضوع أعلاه، ونظراً لما لوحظ من: (${input.reasonOrAchievement}).\n\nوحيث أن مؤسسة اليتيم التنموية تحرص دائماً على الانضباط والالتزام بأعلى معايير الأداء واللوائح المعتمدة وقانون العمل، فإننا نوجه إليكم هذا ${input.docType === "warning" ? "الإنذار التأديبي" : "اللفت للنظر"} لتلافي مثل هذه الملاحظات والالتزام التام بالتعليمات والواجبات الوظيفية مستقبلاً.\n\nشاكرين تعاونكم وحرصكم الدائم على مصلحة العمل.\n\nوتقبلوا خالص التحية والتقدير،،،\n\nإدارة الموارد البشرية\nمؤسسة اليتيم التنموية`;
  } else if (input.docType === "recognition") {
    fallbackBody = `بسم الله الرحمن الرحيم\n\nشهادة شكر وتقدير وتكريم\n\nتتقدم إدارة مؤسسة اليتيم التنموية بجزيل الشكر وعظيم الامتنان للأخ/ت:\n⭐ ${input.employeeName} ⭐\nالمسمى الوظيفي: ${input.jobTitle || "موظف"}\n\nوذلك تقديراً لجهوده المتميزة وتفانيه الاستثنائي في أداء مهامه، والمتمثل في:\n(${input.reasonOrAchievement})\n\nمتمنين له دوام التوفيق والنجاح ومزيداً من البذل والعطاء في خدمة أهداف ورسالة المؤسسة.\n\nصدر بتاريخ: ${today}\n\nالمدير التنفيذي\nمؤسسة اليتيم التنموية`;
  } else {
    fallbackBody = `بسم الله الرحمن الرحيم\n\nقرار إداري رقم (${ref})\n\nبشأن: ${input.docType === "promotion" ? "ترقية وظيفية" : "تكليف بمهام إدارية"}\n\nبناءً على الصلاحيات المخولة للإدارة العامة، ولما تقتضيه مصلحة العمل، وبناءً على التميز والأداء الملحوظ للأخ/ت: ${input.employeeName}.\n\nتقرر ما يلي:\n1. (${input.reasonOrAchievement}).\n2. يُعمل بهذا القرار من تاريخ صدوره ويُبلّغ لمن يلزم لتنفيذه.\n\nالمدير التنفيذي\nمؤسسة اليتيم التنموية`;
  }

  return {
    title: input.docType === "notice" ? "لفت نظر إداري" : input.docType === "warning" ? "إنذار تأديبي" : input.docType === "recognition" ? "شهادة شكر وتقدير" : "قرار إداري",
    referenceNumber: ref,
    date: today,
    recipient: `${input.employeeName} — ${input.jobTitle ?? ""}`,
    body: fallbackBody,
    signatory: "المدير التنفيذي",
    source: "template",
  };
}

/** تحليل أداء الموظف واقتراح التوصيات والتدريب */
export async function analyzeEmployeePerformance(
  employeeId: string,
  periodStart: string,
  periodEnd: string,
): Promise<PerformanceAnalysisResult> {
  const [{ data: emp }, { data: tasks }, { data: attendance }, { data: discipline }] = await Promise.all([
    supabaseAdmin.from("employees").select("id, full_name, job_title, department:departments(name), section:sections(name)").eq("id", employeeId).maybeSingle(),
    supabaseAdmin.from("tasks").select("id, title, status, progress, due_date, completed_at").eq("assignee_id", employeeId).gte("created_at", `${periodStart}T00:00:00`),
    supabaseAdmin.from("attendance_records").select("work_date, status, late_minutes, early_leave_minutes").eq("employee_id", employeeId).gte("work_date", periodStart).lte("work_date", periodEnd),
    supabaseAdmin.from("disciplinary_actions").select("id, stage, violation_description").eq("employee_id", employeeId),
  ]);

  if (!emp) throw new Error("الموظف غير موجود");

  const taskList = tasks ?? [];
  const completedTasks = taskList.filter((t) => t.status === "completed").length;
  const taskRate = taskList.length ? Math.round((completedTasks / taskList.length) * 100) : 100;

  const attList = attendance ?? [];
  const presentDays = attList.filter((a) => a.status === "present" || a.status === "permission").length;
  const totalLate = attList.reduce((s, a) => s + (a.late_minutes ?? 0), 0);

  const score = Math.max(0, Math.min(100, Math.round(taskRate * 0.6 + Math.max(0, 100 - totalLate / 15) * 0.4)));
  const grade = score >= 90 ? "ممتاز" : score >= 80 ? "جيد جداً" : score >= 70 ? "جيد" : score >= 60 ? "مقبول" : "يحتاج تحسين";

  const prompt = `أنت خبير تقييم أداء ومستشار تطوير موارد بشرية. حلل الأداء التالي للموظف:
- الاسم: ${emp.full_name}
- الوظيفة: ${emp.job_title ?? "موظف"}
- الإدارة: ${(emp.department as unknown as { name?: string })?.name ?? "عام"}
- الفترة: ${periodStart} إلى ${periodEnd}
- إجمالي المهام: ${taskList.length} (المنجز: ${completedTasks} بنسبة ${taskRate}%)
- أيام الحضور: ${presentDays} يوم، إجمالي دقائق التأخير: ${totalLate} دقيقة
- السجل التأديبي/التكريم: ${(discipline ?? []).length} سجلات
- الدرجة المحسوبة: ${score}% (${grade})

المطلوب إخراج النتيجة بتنسيق JSON حصرياً كالتالي:
{
  "executiveSummary": "ملخص تنفيذي موجز ومحترف في فقرتين عن مستوى الموظف وإنتاجيته والتزامه",
  "strengths": ["نقطة قوة 1", "نقطة قوة 2", "نقطة قوة 3"],
  "areasForImprovement": ["مجال تحسين 1", "مجال تحسين 2"],
  "trainingRecommendations": [
    { "title": "اسم البرنامج التدريبي المقترح", "priority": "عالية", "description": "سبب وأثر التدريب على أداء الموظف" },
    { "title": "اسم برنامج تدريبي 2", "priority": "متوسطة", "description": "تطوير مهارة مساندة" }
  ],
  "careerPathAdvice": {
    "promotionReadiness": "مؤهل للترقية",
    "notes": "مبررات التوصية المهنية ومسار التطوير الوظيفي"
  }
}`;

  const aiJson = await callAiCompletion([
    { role: "system", content: "You are an expert HR Analytics AI. Respond strictly with valid JSON without markdown wrapping." },
    { role: "user", content: prompt },
  ]);

  if (aiJson) {
    try {
      const cleanJson = aiJson.replace(/^```json\s*/i, "").replace(/```$/i, "").trim();
      const parsed = JSON.parse(cleanJson);
      return {
        employeeId,
        employeeName: emp.full_name,
        jobTitle: emp.job_title ?? "موظف",
        period: `${periodStart} — ${periodEnd}`,
        kpis: {
          tasksCompleted: completedTasks,
          tasksTotal: taskList.length,
          completionRate: taskRate,
          presentDays,
          lateMinutes: totalLate,
          performanceScore: score,
          grade,
        },
        executiveSummary: parsed.executiveSummary || `أظهر الموظف ${emp.full_name} أداءً بمستوى (${grade}) مع إنجاز ${completedTasks} مهام.`,
        strengths: parsed.strengths || ["الالتزام بالمهام المسندة", "التفاعل الإيجابي مع فريق العمل"],
        areasForImprovement: parsed.areasForImprovement || ["تقليل التأخير الصباحي", "رفع وتيرة تسليم المهام المستحقة"],
        trainingRecommendations: parsed.trainingRecommendations || [
          { title: "إدارة الوقت والإنتاجية العالية", priority: "عالية", description: "لتحسين كفاءة الالتزام بمواعيد تسليم المهام" },
        ],
        careerPathAdvice: parsed.careerPathAdvice || {
          promotionReadiness: score >= 85 ? "مؤهل للترقية" : "واعد ويحتاج تطوير",
          notes: "يُنصح بمتابعة مؤشرات الأداء خلال الربع القادم.",
        },
      };
    } catch {
      // Fall through to fallback generator
    }
  }

  // Fallback Analysis
  return {
    employeeId,
    employeeName: emp.full_name,
    jobTitle: emp.job_title ?? "موظف",
    period: `${periodStart} — ${periodEnd}`,
    kpis: {
      tasksCompleted: completedTasks,
      tasksTotal: taskList.length,
      completionRate: taskRate,
      presentDays,
      lateMinutes: totalLate,
      performanceScore: score,
      grade,
    },
    executiveSummary: `حقق الموظف ${emp.full_name} خلال الفترة تقييماً إجمالياً بدرجة (${grade} - ${score}%)، حيث أنجز ${completedTasks} من أصل ${taskList.length} مهام مسندة إليه بنسبة إنجاز ${taskRate}%، مع تسجيل ${presentDays} يوم حضور فعلي.`,
    strengths: [
      `نسبة إنجاز مهام بلغت ${taskRate}%`,
      presentDays >= 15 ? "معدل حضور منتظم خلال أيام العمل" : "مشاركة نشطة في المهام",
      "الاستجابة لمتطلبات فريق العمل",
    ],
    areasForImprovement: [
      totalLate > 60 ? "تقليص معدل التأخير الصباحي والالتزام ببدء الوردية" : "تحسين دقة توثيق تسليم المهام في موعدها",
      "المبادرة في اقتراح تحسينات لسير العمل",
    ],
    trainingRecommendations: [
      {
        title: "مهارات التخطيط التنفيذي وإدارة الأولويات",
        priority: "عالية",
        description: "لرفع سرعة الإنجاز وضمان تسليم المهام قبل تواريخ الاستحقاق.",
      },
      {
        title: "التميز المؤسسي والقيادة الذاتية",
        priority: "متوسطة",
        description: "لتعزيز الجاهزية لتحمل مسؤوليات أكبر والمشاركة في قيادة المشاريع.",
      },
    ],
    careerPathAdvice: {
      promotionReadiness: score >= 85 ? "مؤهل للترقية" : score >= 70 ? "واعد ويحتاج تطوير" : "يحتاج تحسين الالتزام",
      notes: score >= 85
        ? "أداء الموظف متميز ويستحق النظر في منحه تكليفات قيادية أو علاوة تميز."
        : "الموظف يمتلك إمكانيات جيدة ويحتاج التركيز على معالجة نقاط التحسين ليكون جاهزاً للترقية.",
    },
  };
}
