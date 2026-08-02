import { createFileRoute } from "@tanstack/react-router";

const handler = async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
  const { handleZkteco, resolveZkPath } = await import("@/lib/zkteco.server");
  const { endpoint, key } = resolveZkPath(params._splat);
  return handleZkteco(request, endpoint, key);
};

export const Route = createFileRoute("/api/public/zkteco/$")({
  server: { handlers: { GET: handler, POST: handler } },
});
