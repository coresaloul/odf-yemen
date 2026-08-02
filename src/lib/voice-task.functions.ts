import { createServerFn } from "@tanstack/react-start";

type ParsedTask = {
  title: string;
  description: string | null;
  assignee_name: string | null;
  priority: "low" | "medium" | "high" | "urgent";
  due_date: string | null;
};

export const parseVoiceTask = createServerFn({ method: "POST" })
  .inputValidator((data: { transcript: string; employees: string[] }) => {
    if (!data?.transcript || typeof data.transcript !== "string") {
      throw new Error("النص المُدخل غير صالح");
    }
    return {
      transcript: data.transcript.slice(0, 4000),
      employees: Array.isArray(data.employees) ? data.employees.slice(0, 200) : [],
    };
  })
  .handler(async ({ data }): Promise<ParsedTask> => {
    const apiKey = process.env["LOVABLE_API_KEY"];
    if (!apiKey) throw new Error("خدمة الذكاء الاصطناعي غير متاحة حالياً");

    const today = new Date().toISOString().slice(0, 10);

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-3.5-flash",
        messages: [
          {
            role: "system",
            content:
              "أنت مساعد لإدارة المهام في مؤسسة عربية. حلّل النص المنطوق واستخرج بيانات المهمة. " +
              `تاريخ اليوم هو ${today}. أعد التواريخ بصيغة YYYY-MM-DD فقط. ` +
              `أسماء الموظفين المتاحين: ${data.employees.join("، ") || "لا يوجد"}. ` +
              "اختر assignee_name من هذه القائمة حرفياً إن ورد اسم مطابق أو قريب، وإلا اتركه null.",
          },
          { role: "user", content: data.transcript },
        ],
        tools: [
          {
            type: "function",
            function: {
              name: "create_task",
              description: "إنشاء مهمة من النص المنطوق",
              parameters: {
                type: "object",
                properties: {
                  title: { type: "string", description: "عنوان مختصر للمهمة" },
                  description: { type: "string", description: "تفاصيل المهمة" },
                  assignee_name: { type: "string", description: "اسم الموظف المكلّف" },
                  priority: { type: "string", enum: ["low", "medium", "high", "urgent"] },
                  due_date: { type: "string", description: "تاريخ الاستحقاق YYYY-MM-DD" },
                },
                required: ["title"],
                additionalProperties: false,
              },
            },
          },
        ],
        tool_choice: { type: "function", function: { name: "create_task" } },
      }),
    });

    if (res.status === 429) throw new Error("تم تجاوز حد الاستخدام، حاول بعد قليل");
    if (res.status === 402) throw new Error("رصيد الذكاء الاصطناعي غير كافٍ");
    if (!res.ok) throw new Error(`تعذر تحليل النص (${res.status})`);

    const json = (await res.json()) as {
      choices?: { message?: { tool_calls?: { function?: { arguments?: string } }[] } }[];
    };
    const raw = json.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
    if (!raw) throw new Error("تعذر استخراج بيانات المهمة من النص");

    const parsed = JSON.parse(raw) as Partial<ParsedTask>;
    return {
      title: parsed.title ?? data.transcript.slice(0, 80),
      description: parsed.description ?? null,
      assignee_name: parsed.assignee_name ?? null,
      priority: parsed.priority ?? "medium",
      due_date: parsed.due_date ?? null,
    };
  });
