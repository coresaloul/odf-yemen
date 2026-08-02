import { createFileRoute } from "@tanstack/react-router";

const handler = async ({ request, params }: { request: Request; params: { _splat?: string } }) => {
  const { handleZkteco, resolveZkPath } = await import("@/lib/zkteco.server");
  const { endpoint } = resolveZkPath(params._splat);
  return handleZkteco(request, endpoint, null);
};

export const Route = createFileRoute("/iclock/$")({
  server: { handlers: { GET: handler, POST: handler } },
});
