import { ingestPunches, touchDevice, verifyDevice, type PunchInput } from "@/lib/biometric.server";

const text = (body: string, status = 200) =>
  new Response(body, { status, headers: { "Content-Type": "text/plain; charset=utf-8" } });

function parseAttlog(body: string): PunchInput[] {
  const out: PunchInput[] = [];
  for (const line of body.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const cols = line.split(/\t|\s{2,}/).filter(Boolean);
    const userId = cols[0]?.trim();
    const stamp = cols[1]?.trim();
    if (!userId || !stamp) continue;
    const m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})(?::(\d{2}))?$/.exec(stamp);
    if (!m) continue;
    out.push({
      device_user_id: userId,
      punched_at: `${m[1]}-${m[2]}-${m[3]}T${m[4]}:${m[5]}:${m[6] ?? "00"}.000Z`,
      punch_type: cols[3] ?? cols[2] ?? null,
      raw: line.trim(),
    });
  }
  return out;
}

/**
 * معالج بروتوكول ZKTeco (iClock / ADMS Push).
 * endpoint: cdata | getrequest | devicecmd
 */
export async function handleZkteco(request: Request, endpoint: string, pathKey?: string | null) {
  const url = new URL(request.url);
  const serial = url.searchParams.get("SN") ?? url.searchParams.get("sn");
  const key = pathKey ?? url.searchParams.get("key");

  const device = await verifyDevice(serial, key);
  if (!device) return text("Unauthorized", 401);

  if (endpoint === "cdata" && request.method === "GET") {
    await touchDevice(device.id, 0);
    return text(
      [
        `GET OPTION FROM: ${device.serial_number}`,
        "Stamp=9999",
        "OpStamp=0",
        "ErrorDelay=30",
        "Delay=10",
        "TransTimes=00:00;14:00",
        "TransInterval=1",
        "TransFlag=1111000000",
        "Realtime=1",
        "Encrypt=0",
        "",
      ].join("\n"),
    );
  }

  if (endpoint === "cdata" && request.method === "POST") {
    const table = (url.searchParams.get("table") ?? "ATTLOG").toUpperCase();
    const body = await request.text();
    if (table !== "ATTLOG") {
      await touchDevice(device.id, 0);
      return text("OK");
    }
    const punches = parseAttlog(body);
    if (punches.length === 0) {
      await touchDevice(device.id, 0);
      return text("OK: 0");
    }
    await ingestPunches(device, punches);
    await touchDevice(device.id, punches.length);
    return text(`OK: ${punches.length}`);
  }

  if (endpoint === "getrequest") {
    await touchDevice(device.id, 0);
    return text("OK");
  }

  if (endpoint === "devicecmd") {
    await request.text().catch(() => "");
    return text("OK");
  }

  return text("OK");
}

export function resolveZkPath(splat: string | undefined) {
  const parts = (splat ?? "").split("/").filter(Boolean);
  const endpoint = parts[parts.length - 1] ?? "";
  const key = parts.length > 1 ? parts[0]! : null;
  return { endpoint: endpoint.toLowerCase(), key };
}
