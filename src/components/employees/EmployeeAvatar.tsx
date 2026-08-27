export function initials(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((p) => p[0] ?? "")
    .join("");
}

export function EmployeeAvatar({ name, className }: { name: string; className?: string }) {
  return (
    <span
      className={`grid shrink-0 place-items-center rounded-full bg-primary/10 font-semibold text-primary ${className ?? "size-10 text-sm"}`}
    >
      {initials(name)}
    </span>
  );
}
