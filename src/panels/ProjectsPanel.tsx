import React, { useState, useMemo, useEffect } from "react";
import { PenLine, Plus, Trash2, ListChecks } from "lucide-react";
import { INK, RULE, GREEN, ALERT, MUTED, FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { inputStyle, labelStyle } from "../components/ui/styles";
import { fmt } from "../utils/format";
import { db, getProjectPoc, loadLedgerState, supabase } from "../supabaseClient";
import { loadMilestones, insertMilestones, type MilestoneRow } from "../supabase/fieldOps";
import type { AppData, Project } from "../types";

interface StageLine { tempId: string; name: string; }
function StageBuilder({ projectId, onSave }: { projectId: string; onSave: () => void }) {
  const [stages, setStages] = useState<StageLine[]>([]); const [existingStages, setExistingStages] = useState<MilestoneRow[]>([]); const [loading, setLoading] = useState(true); const [saving, setSaving] = useState(false);
  useEffect(() => { if (!projectId || projectId.startsWith("PRJ-NEW")) { setLoading(false); return; } (async () => { const ms = await loadMilestones(projectId); setExistingStages(ms); if (ms.length) setStages(ms.map((m) => ({ tempId: m.id, name: m.name }))); setLoading(false); })(); }, [projectId]);
  function addStage() { setStages((p) => [...p, { tempId: `stage-${Date.now()}`, name: "" }]); }
  function moveStage(index: number, direction: -1 | 1) { const next = [...stages]; const target = index + direction; if (target < 0 || target >= next.length) return; [next[index], next[target]] = [next[target], next[index]]; setStages(next); }
  async function handleSave() { const valid = stages.filter((s) => s.name.trim()); if (!valid.length) { window.alert("Add at least one stage with a name."); return; } setSaving(true); try { if (!projectId || projectId.startsWith("PRJ-NEW")) throw new Error("Save the project first, then add stages."); const { error } = await supabase.from("project_milestones").delete().eq("project_id", projectId); if (error) throw error; await insertMilestones(valid.map((s, i) => ({ project_id: projectId, name: s.name.trim(), stage_order: i + 1, status: "pending" as const, confirmed_at: null, confirmed_by: null, notes: null }))); setExistingStages(await loadMilestones(projectId)); onSave(); } catch (err) { window.alert(err instanceof Error ? err.message : "Failed to save stages."); } finally { setSaving(false); } }
  if (loading) return null; const isNew = projectId.startsWith("PRJ-NEW") || !projectId; const hasExisting = existingStages.length > 0; if (!isNew && !hasExisting) return null;
  return <div style={{ borderTop: `1px solid ${RULE}`, marginTop: 12, paddingTop: 12 }}><div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}><label style={{ ...labelStyle, marginBottom: 0 }}><ListChecks size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />Project Stages (Milestones)</label><Button onClick={addStage} size="sm" icon={Plus}>Add Stage</Button></div><div style={{ fontSize: 11, color: MUTED, marginBottom: 10 }}>Define the stages the PM will confirm during the project. These appear in the PM portal as a progress checklist.</div>{stages.map((stage, idx) => <div key={stage.tempId} style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}><span style={{ fontSize: 11, fontWeight: 700, color: MUTED, width: 22, textAlign: "center" }}>{idx + 1}</span><button onClick={() => moveStage(idx, -1)} disabled={idx === 0} style={{ background: "none", border: `1px solid ${RULE}`, borderRadius: 4, padding: 2, color: idx === 0 ? RULE : MUTED }}>▲</button><button onClick={() => moveStage(idx, 1)} disabled={idx === stages.length - 1} style={{ background: "none", border: `1px solid ${RULE}`, borderRadius: 4, padding: 2, color: idx === stages.length - 1 ? RULE : MUTED }}>▼</button><input style={{ ...inputStyle, flex: 1 }} value={stage.name} onChange={(e) => setStages((p) => p.map((s) => s.tempId === stage.tempId ? { ...s, name: e.target.value } : s))} placeholder={`Stage ${idx + 1} name`} /><button onClick={() => setStages((p) => p.filter((s) => s.tempId !== stage.tempId))} style={{ background: "none", border: "none", color: ALERT }}><Trash2 size={14} /></button></div>)}{stages.length > 0 && <Button onClick={handleSave} icon={Plus} fullWidth disabled={saving} style={{ marginTop: 8 }}>{saving ? "Saving stages…" : hasExisting ? "Update Stages" : "Save Stages"}</Button>}</div>;
}

export default function ProjectsPanel({ data, mutate }: { data: AppData; mutate: (fn: (prev: AppData) => AppData) => void }) {
  const [showModal, setShowModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState<string | null>(null);
  const [form, setForm] = useState({
    name: "",
    status: "Active",
    projectType: "Construction Contract",
    recognitionMethod: "POC",
    contractValue: "",
    estimatedCost: "",
    effectiveDate: "",
    reason: "",
  });
  const [projectPocById, setProjectPocById] = useState<Record<string, Awaited<ReturnType<typeof getProjectPoc>>>>({});
  const stats = useMemo(() => data.projects.map((project) => {
    const projectEntries = data.journal.filter((entry) => entry.project === project.id);
    const revenueBilled = projectEntries
      .flatMap((entry) => entry.lines)
      .filter((line) => data.accounts.find((account) => account.code === line.account)?.type === "Income")
      .reduce((sum, line) => sum + (line.credit - line.debit), 0);
    const actualCost = projectEntries
      .flatMap((entry) => entry.lines)
      .filter((line) => data.accounts.find((account) => account.code === line.account)?.type === "Expense")
      .reduce((sum, line) => sum + line.debit, 0);
    return {
      ...project,
      revenueBilled,
      actualCost,
      wipMargin: revenueBilled - actualCost,
    };
  }), [data]);

  useEffect(() => {
    let active = true;
    void Promise.all(
      data.projects.map(async (project) => [project.id, await getProjectPoc(project.id)] as const)
    ).then((entries) => {
      if (active) setProjectPocById(Object.fromEntries(entries));
    });
    return () => {
      active = false;
    };
  }, [data.projects]);

  function resetForm() {
    setForm({
      name: "",
      status: "Active",
      projectType: "Construction Contract",
      recognitionMethod: "POC",
      contractValue: "",
      estimatedCost: "",
      effectiveDate: "",
      reason: "",
    });
  }

  function generateProjectId(name: string): string {
    return (
      "PRJ-" +
      name
        .trim()
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, "-")
    );
  }

  function openNewProjectModal() {
    setEditingProjectId(null);
    resetForm();
    setShowModal(true);
  }

  function openEditProjectModal(project: Project) {
    setEditingProjectId(project.id);
    setForm({
      name: project.name,
      status: project.status || "Active",
      projectType: project.projectType || "Construction Contract",
      recognitionMethod: project.recognitionMethod || "POC",
      contractValue: "",
      estimatedCost: "",
      effectiveDate: "",
      reason: "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProjectId(null);
    resetForm();
  }

  async function upsertProjectMetadata(project: Pick<Project, "id" | "name" | "status" | "projectType" | "recognitionMethod">) {
    const { error } = await supabase.from("projects").upsert({
      id: project.id,
      name: project.name,
      status: project.status ?? "Active",
      project_type: project.projectType ?? "Construction Contract",
      recognition_method: project.recognitionMethod ?? "POC",
    });

    if (error) {
      throw new Error(error.message || "Failed to save project metadata.");
    }
  }

  function parseOptionalCurrency(raw: string, label: string): number | null {
    const trimmed = raw?.trim?.() ?? "";
    if (trimmed === "") return null;

    const value = Number(trimmed);
    if (!Number.isFinite(value)) {
      throw new Error(`${label} must be a valid number.`);
    }
    if (value < 0) {
      throw new Error(`${label} cannot be negative.`);
    }
    return value;
  }

  async function saveProjectFinancialValue(
    projectId: string,
    field: "contractValue" | "estimatedCost",
    value: number,
    effectiveDate: string,
    reason: string | null
  ) {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue < 0) {
      throw new Error(`${field === "contractValue" ? "Contract Value" : "Estimated Cost"} must be zero or greater.`);
    }

    const rpcField = field === "contractValue" ? "contract_value" : "estimated_cost";
    const { data: historyId, error } = await supabase.rpc("record_project_transaction_value", {
      p_project: projectId,
      p_field: rpcField,
      p_new_value: numericValue,
      p_effective_date: effectiveDate,
      p_reason: reason?.trim() || null,
    });

    if (error) {
      throw new Error(error.message || `Failed to save ${field === "contractValue" ? "Contract Value" : "Estimated Cost"}.`);
    }
    if (!historyId) {
      throw new Error(`The ${field === "contractValue" ? "Contract Value" : "Estimated Cost"} change did not create a history record.`);
    }

    return historyId;
  }

  async function saveProject() {
    const projectName = form.name.trim();
    if (!projectName) {
      window.alert("Project name is required.");
      return;
    }

    let contractValue: number | null;
    let estimatedCost: number | null;
    try {
      contractValue = parseOptionalCurrency(form.contractValue, "Contract Value");
      estimatedCost = parseOptionalCurrency(form.estimatedCost, "Estimated Cost");
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Financial value is invalid.");
      return;
    }

    const previousProject = editingProjectId
      ? data.projects.find((p) => p.id === editingProjectId)
      : undefined;

    const changedFinancialFields: Array<{ key: "contractValue" | "estimatedCost"; label: string; value: number }> = [];
    if (contractValue !== null) {
      const previousValue = previousProject?.contractValue == null ? null : Number(previousProject.contractValue);
      if (previousValue !== contractValue) {
        changedFinancialFields.push({ key: "contractValue", label: "Contract Value", value: contractValue });
      }
    }
    if (estimatedCost !== null) {
      const previousValue = previousProject?.estimatedCost == null ? null : Number(previousProject.estimatedCost);
      if (previousValue !== estimatedCost) {
        changedFinancialFields.push({ key: "estimatedCost", label: "Estimated Cost", value: estimatedCost });
      }
    }

    if (changedFinancialFields.length > 0) {
      if (!form.effectiveDate) {
        window.alert("Please select an effective date for the financial value change.");
        return;
      }
      if (!form.reason.trim()) {
        window.alert("Please provide a reason for the financial value change.");
        return;
      }
    }

    const projectId = editingProjectId || generateProjectId(projectName);
    const metadataProject = {
      id: projectId,
      name: projectName,
      status: form.status,
      projectType: form.projectType,
      recognitionMethod: form.recognitionMethod,
    };

    try {
      await upsertProjectMetadata(metadataProject);

      if (editingProjectId) {
        mutate((d) => ({
          ...d,
          projects: d.projects.map((p) =>
            p.id === editingProjectId ? { ...p, ...metadataProject } : p
          ),
        }));
      } else {
        mutate((d) => ({
          ...d,
          projects: [...d.projects, { ...metadataProject, contractValue: null, estimatedCost: null }],
        }));
      }

      const successfulFields: string[] = [];
      const failedFields: Array<{ label: string; message: string }> = [];

      for (const field of changedFinancialFields) {
        try {
          await saveProjectFinancialValue(
            projectId,
            field.key,
            field.value,
            form.effectiveDate,
            form.reason.trim()
          );
          successfulFields.push(field.label);
        } catch (error) {
          failedFields.push({
            label: field.label,
            message: error instanceof Error ? error.message : "Unknown backend error.",
          });
        }
      }

      const refreshed = await loadLedgerState();
      if (refreshed) {
        mutate((prev) => ({
          ...prev,
          ...refreshed,
          accounts: refreshed.accounts ?? prev.accounts,
          projects: refreshed.projects ?? prev.projects,
          employees: refreshed.employees ?? prev.employees,
          payrollRuns: refreshed.payrollRuns ?? prev.payrollRuns,
          bills: refreshed.bills ?? prev.bills,
          journal: refreshed.journal ?? prev.journal,
          invoices: refreshed.invoices ?? prev.invoices,
          bankReconciliations: refreshed.bankReconciliations ?? prev.bankReconciliations,
        }));
      }

      if (failedFields.length > 0 && successfulFields.length > 0) {
        const saved = successfulFields.length === 1
          ? `${successfulFields[0]} saved.`
          : `${successfulFields.join(" and ")} saved.`;
        const failed = failedFields.map((field) => `${field.label} failed: ${field.message}`).join(" ");
        window.alert(`${saved} ${failed}`);
      } else if (failedFields.length > 0) {
        const errors = failedFields.map((field) => `${field.label}: ${field.message}`).join(" ");
        window.alert(`Neither financial value was saved: ${errors}`);
      } else if (changedFinancialFields.length > 0) {
        window.alert(
          successfulFields.length === 2
            ? "Contract Value and Estimated Cost saved successfully."
            : `${successfulFields[0]} saved successfully.`
        );
      }

      closeModal();
    } catch (error) {
      console.error("Failed to save project:", error);
      const message = error instanceof Error ? error.message : "Failed to persist project.";
      window.alert(message);
    }
  }

  function deleteProject(id: string) {
    mutate((d) => ({
      ...d,
      projects: d.projects.filter((p) => p.id !== id),
    }));
    db.deleteProject(id).catch((err) => {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project. Check console.");
    });
  }
  async function toggleStatus(id: string) {
    const prev = data.projects.find((p) => p.id === id);
    if (!prev) return;
    const status = prev.status === "Active" ? "Complete" : "Active";
    try {
      await upsertProjectMetadata({
        id: prev.id,
        name: prev.name,
        status,
        projectType: prev.projectType,
        recognitionMethod: prev.recognitionMethod,
      });
      mutate((d) => ({
        ...d,
        projects: d.projects.map((p) => p.id === id ? { ...p, status } : p),
      }));
    } catch (err) {
      window.alert(err instanceof Error ? err.message : "Failed to update project status.");
    }
  }

  return (
    <div>
      <SectionTitle
        sub="One engagement = One project. Track permits, designs, and construction under one unified register."
        action={
          <Button onClick={openNewProjectModal} icon={Plus}>
            New project
          </Button>
        }
      >
        Projects
      </SectionTitle>

      <div style={{ display: "flex", flexWrap: "wrap", gap: 16 }}>
        {stats.map((p) => {
          const poc = projectPocById[p.id];
          const contractValue = poc?.contract_value;
          const estimatedCost = poc?.estimated_cost;
          const backendActualCost = poc?.actual_project_cost;
          const backendRevenueBilled = poc?.revenue_billed;
          return (
          <Card key={p.id} style={{ flex: "1 1 320px" }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 12,
              }}
            >
              <div>
                <div
                  style={{
                    fontFamily: FONT_DISPLAY,
                    fontWeight: 700,
                    fontSize: 16,
                    color: INK,
                  }}
                >
                  {p.name}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    color: MUTED,
                    marginTop: 4,
                    textTransform: "uppercase",
                    letterSpacing: 0.5,
                  }}
                >
                  {p.projectType} • {" "}
                  {String(p.recognitionMethod || "POINT_IN_TIME").trim().toUpperCase() === "POC"
                    ? "Percentage of Completion"
                    : "Point-in-Time"}
                </div>
              </div>
              {p.id !== "GEN" && (
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  <button
                    onClick={() => openEditProjectModal(p)}
                    style={{
                      ...inputStyle,
                      width: "auto",
                      padding: "3px 8px",
                      cursor: "pointer",
                      fontSize: 11,
                      color: INK,
                      border: `1px solid ${RULE}`,
                      background: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <PenLine size={12} /> Edit
                  </button>
                  <button
                    onClick={() => deleteProject(p.id)}
                    style={{
                      ...inputStyle,
                      width: "auto",
                      padding: "3px 8px",
                      cursor: "pointer",
                      fontSize: 11,
                      color: ALERT,
                      border: `1px solid ${ALERT}`,
                      background: "none",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                    }}
                  >
                    <Trash2 size={12} /> Delete
                  </button>
                  <button
                    onClick={() => toggleStatus(p.id)}
                    style={{
                      ...inputStyle,
                      width: "auto",
                      padding: "3px 8px",
                      cursor: "pointer",
                      fontSize: 11,
                      color: p.status === "Active" ? GREEN : MUTED,
                      border: `1px solid ${p.status === "Active" ? GREEN : RULE}`,
                      background: "none",
                    }}
                  >
                    {p.status}
                  </button>
                </div>
              )}
            </div>

            <div
              style={{
                fontFamily: FONT_MONO,
                fontSize: 13,
                color: INK,
                lineHeight: 1.9,
                borderTop: `1px solid ${RULE}`,
                paddingTop: 12,
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Contract Value
                </span>
                <span>{contractValue == null ? "Not configured" : `GHS ${fmt(contractValue)}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Revenue Billed
                </span>
                <span>{backendRevenueBilled == null ? `GHS ${fmt(p.revenueBilled)}` : `GHS ${fmt(backendRevenueBilled)}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Actual Cost to Date
                </span>
                <span>{backendActualCost == null ? `GHS ${fmt(p.actualCost)}` : `GHS ${fmt(backendActualCost)}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Estimated Cost
                </span>
                <span>{estimatedCost == null ? "Not configured" : `GHS ${fmt(estimatedCost)}`}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Remaining Cost
                </span>
                <span>Not available from backend</span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  borderTop: `1px solid ${RULE}`,
                  paddingTop: 4,
                  marginTop: 4,
                  fontWeight: 700,
                }}
              >
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Projected Margin
                </span>
                <span
                  style={{ color: MUTED }}
                >
                  Not available from backend
                </span>
              </div>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  fontWeight: 700,
                }}
              >
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  WIP Margin (Billed - Cost)
                </span>
                <span style={{ color: p.wipMargin >= 0 ? GREEN : ALERT }}>
                  GHS {fmt(p.wipMargin)}
                </span>
              </div>
            </div>
          </Card>
          );
        })}
      </div>

      {showModal && (
        <Modal
          title={
            editingProjectId
              ? "Edit Project Engagement"
              : "New Project Engagement"
          }
          sub="All services (permits, designs, construction) go here."
          onClose={closeModal}
        >
          <div style={{ display: "grid", gap: 12 }}>
            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: "1 1 200px" }}>
                <label style={labelStyle}>Project Name</label>
                <input
                  style={inputStyle}
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="e.g. East Legon Villa"
                />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Project Type</label>
                <select
                  style={inputStyle}
                  value={form.projectType}
                  onChange={(e) =>
                    setForm({ ...form, projectType: e.target.value })
                  }
                >
                  <option>Permit Processing</option>
                  <option>Architectural Drawing</option>
                  <option>Architectural Design</option>
                  <option>Consultancy Project</option>
                  <option>Construction Contract</option>
                </select>
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Recognition Method</label>
                <select
                  style={inputStyle}
                  value={form.recognitionMethod}
                  onChange={(e) =>
                    setForm({ ...form, recognitionMethod: e.target.value })
                  }
                >
                  <option value="POINT_IN_TIME">Point-in-Time</option>
                  <option value="POC">
                    Percentage of Completion
                  </option>
                </select>
              </div>
            </div>

            <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Contract Value (GHS)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.contractValue}
                  onChange={(e) =>
                    setForm({ ...form, contractValue: e.target.value })
                  }
                />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Estimated Cost (GHS)</label>
                <input
                  style={inputStyle}
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.estimatedCost}
                  onChange={(e) =>
                    setForm({ ...form, estimatedCost: e.target.value })
                  }
                />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Effective Date</label>
                <input
                  style={inputStyle}
                  type="date"
                  value={form.effectiveDate}
                  onChange={(e) =>
                    setForm({ ...form, effectiveDate: e.target.value })
                  }
                />
              </div>
            </div>

            <div style={{ display: "grid", gap: 6 }}>
              <label style={labelStyle}>Reason for financial change</label>
              <textarea
                style={{ ...inputStyle, minHeight: 70, resize: "vertical" }}
                value={form.reason}
                onChange={(e) => setForm({ ...form, reason: e.target.value })}
                placeholder="Required whenever Contract Value or Estimated Cost changes."
              />
            </div>

            <Button onClick={saveProject} icon={Plus} fullWidth>
              {editingProjectId ? "Save project" : "Add project"}
            </Button>

            {/* Stage builder — only in edit mode for existing projects */}
            {editingProjectId && (
              <StageBuilder
                projectId={editingProjectId}
                onSave={() => {}}
              />
            )}
          </div>
        </Modal>
      )}
    </div>
  );
}
