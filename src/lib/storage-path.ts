export function buildStorageObjectKey(folder: string, originalName: string) {
  const safeFolder = (folder || "files")
    .trim()
    .replace(/[^a-zA-Z0-9/_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/\/+/, "/");

  const nameWithoutExtension = originalName.replace(/\.[^/.]+$/, "");
  const extensionMatch = originalName.match(/\.([A-Za-z0-9]+)$/);
  const extension = extensionMatch?.[1] ? `.${extensionMatch[1].slice(0, 8)}` : "";

  const safeBase = (nameWithoutExtension || "file")
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-+|-+$/g, "")
    .trim();

  const baseName = (safeBase || "file").slice(0, 40);
  const timestamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
  const uniqueSuffix = crypto.randomUUID().slice(0, 8);

  return `${safeFolder}/${timestamp}-${uniqueSuffix}-${baseName}${extension}`;
}
