export function fmt(n: number | string | null | undefined) {
  if (n === null || n === undefined || n === "") {
    return "—";
  }

  const v = Number(n);
  if (!Number.isFinite(v)) {
    return "—";
  }

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

