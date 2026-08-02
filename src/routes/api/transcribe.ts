import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/transcribe")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const apiKey = process.env["LOVABLE_API_KEY"];
        if (!apiKey) {
          return Response.json({ error: "خدمة التفريغ الصوتي غير متاحة" }, { status: 503 });
        }

        const form = await request.formData();
        const file = form.get("file");
        if (!(file instanceof File) || file.size < 2048) {
          return Response.json(
            { error: "التسجيل الصوتي فارغ أو غير صالح، أعد المحاولة" },
            { status: 400 },
          );
        }
        if (file.size > 20 * 1024 * 1024) {
          return Response.json({ error: "حجم التسجيل كبير جداً" }, { status: 413 });
        }

        const upstream = new FormData();
        upstream.append("model", "openai/gpt-4o-mini-transcribe");
        upstream.append("file", file, "recording.wav");
        upstream.append("language", "ar");

        const res = await fetch("https://ai.gateway.lovable.dev/v1/audio/transcriptions", {
          method: "POST",
          headers: { Authorization: `Bearer ${apiKey}` },
          body: upstream,
        });

        if (!res.ok) {
          const detail = await res.text().catch(() => "");
          return Response.json(
            { error: `تعذر تفريغ التسجيل الصوتي (${res.status})`, detail },
            { status: res.status },
          );
        }

        const json = (await res.json()) as { text?: string };
        return Response.json({ text: json.text ?? "" });
      },
    },
  },
});
