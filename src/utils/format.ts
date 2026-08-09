export function fmt(n: number | string | null | undefined) {
  const v = Number(n) || 0;
  return v.toLocaleString("en-GH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}

export function projectName(
  projects: Array<{ id: string; name: string }>,
  id?: string | null
) {
  if (!id || id === "GEN") return "General / Office";
  const p = projects.find((p) => p.id === id);
  return p ? p.name : "General / Office";
}

