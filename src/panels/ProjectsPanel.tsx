import React, { useState, useMemo, useCallback } from "react";
import * as XLSX from "xlsx";
import {
  BookOpen, PenLine, Scale, Users, Banknote, FileSpreadsheet,
  Plus, Trash2, Printer, Check, AlertTriangle, Settings2, Briefcase,
  Receipt, TrendingUp, X, Sun, Moon, LayoutDashboard,
  ArrowUpRight, ArrowDownRight, FileText, MoreHorizontal, Landmark,
} from "lucide-react";
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY, FONT_MONO, LOGO_SRC } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { inputStyle, labelStyle } from "../components/ui/styles";
import MiniTable from "../components/ui/MiniTable";
import ProjectSelect from "../components/ui/ProjectSelect";
import KpiCard from "../components/charts/KpiCard";
import LineChart from "../components/charts/LineChart";
import BarChart from "../components/charts/BarChart";
import DonutChart from "../components/charts/DonutChart";
import { fmt, projectName } from "../utils/format";
import { amountInWords } from "../utils/numberToWords";
import { computeInvoiceTotals, NAVY, INVOICE_GOLD, invTdLabel, invTdVal } from "../utils/invoiceUtils";
import { projectStatsFn } from "../utils/dashboardUtils";
import { COMPANY_TEMPLATE, GENERAL_PROJECT } from "../constants/defaults";
import {
  assertJournalEntry, assertInvoice, assertAccount, assertEmployee,
  assertProject, assertPayment
} from "../validation";
import {
  db, loadLedgerState, loadTaxConfig, saveSettings, saveTaxRates,
  savePayeBrackets, getTrialBalance, getBalanceSheet, getProfitAndLoss,
  getSession, onAuthStateChange, signOut, runPayrollAndFetch
} from "../supabaseClient";
import type { AppData, MutateFn, PanelProps, InvoicingPanelProps, PayrollPanelProps,
             NewInvoiceFormProps, RecordPaymentFormProps, InvoiceDocumentProps,
             ReceiptDocumentProps, PayslipProps, ProjectStats } from "../types";

export default function ProjectsPanel({ data, mutate }) {
  const [showModal, setShowModal] = useState(false);
  const [editingProjectId, setEditingProjectId] = useState(null);
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

  function openNewProjectModal() {
    setEditingProjectId(null);
    resetForm();
    setShowModal(true);
  }

  function openEditProjectModal(project) {
    setEditingProjectId(project.id);
    setForm({
      name: project.name,
      status: project.status,
      projectType: project.projectType,
      recognitionMethod: project.recognitionMethod,
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
      alert(err);
      return;
    }
    const baseProject = {
      id: editingProjectId ||
        "PRJ-" +
          form.name
            .trim()
            .toUpperCase()
            .replace(/[^A-Z0-9]+/g, "-"),
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
        alert("Failed to persist project to server. Check console for details.");
      });
    } else {
      mutate((d) => ({
        ...d,
        projects: [...d.projects, baseProject],
      }));
      db.saveProjects([baseProject]).catch((err) => {
        console.error("Failed to save project:", err);
        alert("Failed to persist project to server. Check console for details.");
      });
    }

    closeModal();
  }

  function deleteProject(id) {
    mutate((d) => ({
      ...d,
      projects: d.projects.filter((p) => p.id !== id),
    }));
    db.deleteProject(id).catch((err) => {
      console.error("Failed to delete project:", err);
      alert("Failed to delete project on server. Check console for details.");
    });
  }

  function toggleStatus(id) {
    mutate((d) => {
      const updatedProjects = d.projects.map((p) =>
        p.id === id
          ? { ...p, status: p.status === "Active" ? "Complete" : "Active" }
          : p
      );
      const updatedProj = updatedProjects.find((p) => p.id === id);
      if (updatedProj) db.saveProjects([updatedProj]).catch((err) => {
        console.error("Failed to save project:", err);
        alert("Failed to persist project to server. Check console for details.");
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
                  {p.projectType} •{" "}
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
                <span style={{ color: p.projectedMargin >= 0 ? GREEN : ALERT }}>
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
          title={editingProjectId ? "Edit Project Engagement" : "New Project Engagement"}
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
                  <option value="POC">Percentage of Completion</option>
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
          </div>
        </Modal>
      )}
    </div>
  );
}

