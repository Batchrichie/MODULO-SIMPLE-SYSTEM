import React, { useState, useMemo, useEffect, useCallback } from "react";
import { PenLine, Plus, Trash2, ListChecks, GripVertical } from "lucide-react";
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, FONT_MONO } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { inputStyle, labelStyle } from "../components/ui/styles";
import { fmt } from "../utils/format";
import { projectStatsFn } from "../utils/dashboardUtils";
import { db } from "../supabaseClient";
import { assertProject } from "../validation";
import { loadMilestones, insertMilestones, type MilestoneRow } from "../supabase/fieldOps";
import type { AppData, Project } from "../types";

/* ------------------------------------------------------------------ */
/*  Stage builder sub-component                                         */
/* ------------------------------------------------------------------ */

interface StageLine {
  tempId: string;
  name: string;
}

function StageBuilder({
  projectId,
  onSave,
}: {
  projectId: string;
  onSave: () => void;
}) {
  const [stages, setStages] = useState<StageLine[]>([]);
  const [existingStages, setExistingStages] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!projectId || projectId.startsWith("PRJ-NEW")) {
      setLoading(false);
      return;
    }
    (async () => {
      const ms = await loadMilestones(projectId);
      setExistingStages(ms);
      if (ms.length > 0) {
        setStages(ms.map((m) => ({ tempId: m.id, name: m.name })));
      }
      setLoading(false);
    })();
  }, [projectId]);

  function addStage() {
    setStages((prev) => [
      ...prev,
      { tempId: `stage-${Date.now()}`, name: "" },
    ]);
  }

  function removeStage(tempId: string) {
    setStages((prev) => prev.filter((s) => s.tempId !== tempId));
  }

  function updateStageName(tempId: string, name: string) {
    setStages((prev) =>
      prev.map((s) => (s.tempId === tempId ? { ...s, name } : s))
    );
  }

  function moveStage(index: number, direction: -1 | 1) {
    const newStages = [...stages];
    const targetIndex = index + direction;
    if (targetIndex < 0 || targetIndex >= newStages.length) return;
    [newStages[index], newStages[targetIndex]] = [newStages[targetIndex], newStages[index]];
    setStages(newStages);
  }

  async function handleSave() {
    const validStages = stages.filter((s) => s.name.trim());
    if (validStages.length === 0) {
      window.alert("Add at least one stage with a name.");
      return;
    }
    setSaving(true);
    try {
      // If project is new (not yet saved), skip milestone save — will be saved after project creation
      if (projectId.startsWith("PRJ-NEW") || !projectId) {
        window.alert("Save the project first, then add stages.");
        setSaving(false);
        return;
      }
      // Delete existing and re-insert all
      const { supabase } = await import("../supabaseClient");
      await supabase.from("project_milestones").delete().eq("project_id", projectId);
      if (validStages.length > 0) {
        await insertMilestones(
          validStages.map((s, idx) => ({
            project_id: projectId,
            name: s.name.trim(),
            stage_order: idx + 1,
            status: "pending" as const,
            confirmed_at: null,
            confirmed_by: null,
            notes: null,
          }))
        );
      }
      // Refresh existing
      const ms = await loadMilestones(projectId);
      setExistingStages(ms);
      onSave();
    } catch (err) {
      console.error("Failed to save stages:", err);
      window.alert("Failed to save stages. Check console.");
    }
    setSaving(false);
  }

  if (loading) return null;

  // Only show if there are existing stages (edit mode)
  // or always show in a new project form
  const isNew = projectId.startsWith("PRJ-NEW") || !projectId;
  const hasExisting = existingStages.length > 0;

  if (!isNew && !hasExisting) return null;

  return (
    <div
      style={{
        borderTop: `1px solid ${RULE}`,
        marginTop: 12,
        paddingTop: 12,
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: 8,
        }}
      >
        <label style={{ ...labelStyle, marginBottom: 0 }}>
          <ListChecks size={12} style={{ marginRight: 4, verticalAlign: "middle" }} />
          Project Stages (Milestones)
        </label>
        <Button onClick={addStage} size="sm" icon={Plus}>
          Add Stage
        </Button>
      </div>
      <div style={{ fontSize: 11, color: MUTED, marginBottom: 10 }}>
        Define the stages the PM will confirm during the project. These appear in the PM portal as a progress checklist.
      </div>
      {stages.map((stage, idx) => (
        <div
          key={stage.tempId}
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
            marginBottom: 6,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: MUTED,
              width: 22,
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            {idx + 1}
          </span>
          <button
            onClick={() => moveStage(idx, -1)}
            disabled={idx === 0}
            style={{
              background: "none",
              border: `1px solid ${RULE}`,
              borderRadius: 4,
              padding: 2,
              cursor: idx === 0 ? "default" : "pointer",
              color: idx === 0 ? RULE : MUTED,
              fontSize: 10,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ▲
          </button>
          <button
            onClick={() => moveStage(idx, 1)}
            disabled={idx === stages.length - 1}
            style={{
              background: "none",
              border: `1px solid ${RULE}`,
              borderRadius: 4,
              padding: 2,
              cursor: idx === stages.length - 1 ? "default" : "pointer",
              color: idx === stages.length - 1 ? RULE : MUTED,
              fontSize: 10,
              lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ▼
          </button>
          <input
            style={{ ...inputStyle, flex: 1 }}
            value={stage.name}
            onChange={(e) => updateStageName(stage.tempId, e.target.value)}
            placeholder={`Stage ${idx + 1} name`}
          />
          <button
            onClick={() => removeStage(stage.tempId)}
            style={{
              background: "none",
              border: "none",
              cursor: "pointer",
              color: ALERT,
              flexShrink: 0,
            }}
          >
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      {stages.length > 0 && (
        <Button
          onClick={handleSave}
          icon={Plus}
          fullWidth
          disabled={saving}
          style={{ marginTop: 8 }}
        >
          {saving
            ? "Saving stages…"
            : hasExisting
            ? "Update Stages"
            : "Save Stages"}
        </Button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main ProjectsPanel                                                 */
/* ------------------------------------------------------------------ */

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
  });
  const stats = useMemo(() => projectStatsFn(data), [data]);

  function resetForm() {
    setForm({
      name: "",
      status: "Active",
      projectType: "Construction Contract",
      recognitionMethod: "POC",
      contractValue: "",
      estimatedCost: "",
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
      contractValue: project.contractValue?.toString() || "",
      estimatedCost: project.estimatedCost?.toString() || "",
    });
    setShowModal(true);
  }

  function closeModal() {
    setShowModal(false);
    setEditingProjectId(null);
    resetForm();
  }

  function saveProject() {
    const err = assertProject({
      name: form.name,
      contractValue: parseFloat(form.contractValue) || 0,
      estimatedCost: parseFloat(form.estimatedCost) || 0,
    });
    if (err) {
      window.alert(err);
      return;
    }
    const baseProject = {
      id:
        editingProjectId || generateProjectId(form.name),
      name: form.name.trim(),
      status: form.status,
      projectType: form.projectType,
      recognitionMethod: form.recognitionMethod,
      contractValue: parseFloat(form.contractValue) || 0,
      estimatedCost: parseFloat(form.estimatedCost) || 0,
    };

    if (editingProjectId) {
      mutate((d) => ({
        ...d,
        projects: d.projects.map((p) =>
          p.id === editingProjectId ? baseProject : p
        ),
      }));
      db.saveProjects([baseProject]).catch((err) => {
        console.error("Failed to save project:", err);
        alert("Failed to persist project. Check console.");
      });
    } else {
      mutate((d) => ({
        ...d,
        projects: [...d.projects, baseProject],
      }));
      db.saveProjects([baseProject]).catch((err) => {
        console.error("Failed to save project:", err);
        alert("Failed to persist project. Check console.");
      });
    }

    closeModal();
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

  function toggleStatus(id: string) {
    mutate((d) => {
      const updatedProjects = d.projects.map((p) =>
        p.id === id
          ? { ...p, status: p.status === "Active" ? "Complete" : "Active" }
          : p
      );
      const updatedProj = updatedProjects.find((p) => p.id === id);
      if (updatedProj)
        db.saveProjects([updatedProj]).catch((err) => {
          console.error("Failed to save project:", err);
        });
      return { ...d, projects: updatedProjects };
    });
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
        {stats.map((p) => (
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
                  {p.recognitionMethod === "POC"
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
                <span>GHS {fmt(p.contractValue)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Revenue Billed
                </span>
                <span>GHS {fmt(p.revenueBilled)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Actual Cost to Date
                </span>
                <span>GHS {fmt(p.actualCost)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Estimated Cost
                </span>
                <span>GHS {fmt(p.estimatedCost)}</span>
              </div>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <span style={{ color: MUTED, fontFamily: FONT_BODY }}>
                  Remaining Cost
                </span>
                <span>GHS {fmt(p.remainingCost)}</span>
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
                  style={{ color: p.projectedMargin >= 0 ? GREEN : ALERT }}
                >
                  GHS {fmt(p.projectedMargin)}
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
        ))}
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
                  value={form.contractValue}
                  onChange={(e) =>
                    setForm({ ...form, contractValue: e.target.value })
                  }
                  placeholder="50000"
                />
              </div>
              <div style={{ flex: "1 1 150px" }}>
                <label style={labelStyle}>Estimated Cost (GHS)</label>
                <input
                  style={inputStyle}
                  type="number"
                  value={form.estimatedCost}
                  onChange={(e) =>
                    setForm({ ...form, estimatedCost: e.target.value })
                  }
                  placeholder="35000"
                />
              </div>
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
