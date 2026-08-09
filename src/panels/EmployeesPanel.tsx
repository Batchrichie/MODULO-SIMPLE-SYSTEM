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

export default function EmployeesPanel({ data, mutate }) {
  const [showModal, setShowModal] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [form, setForm] = useState({
    name: "",
    baseSalary: "",
    ssnitNo: "",
    niaCard: "",
    designation: "",
    exemptPaye: false,
    exemptSsnit: false,
  });

  function resetForm() {
    setForm({
      name: "",
      baseSalary: "",
      ssnitNo: "",
      niaCard: "",
      designation: "",
      exemptPaye: false,
      exemptSsnit: false,
    });
  }

  function openAddModal() {
    setEditingEmployeeId(null);
    resetForm();
    setShowModal(true);
  }

  function openEditModal(employee) {
    setEditingEmployeeId(employee.id);
    setForm({
      name: employee.name || "",
      baseSalary: String(employee.baseSalary || ""),
      ssnitNo: employee.ssnitNo || "",
      niaCard: employee.niaCard || "",
      designation: employee.designation || "",
      exemptPaye: employee.exemptPaye || false,
      exemptSsnit: employee.exemptSsnit || false,
    });
    setShowModal(true);
  }

  function saveEmployee() {
    const err = assertEmployee({
      name: form.name,
      baseSalary: parseFloat(form.baseSalary) || 0,
    });
    if (err) {
      alert(err);
      return;
    }

    const employeePayload = {
      id: editingEmployeeId || "EMP-" + Date.now(),
      name: form.name.trim(),
      baseSalary: parseFloat(form.baseSalary),
      active: editingEmployeeId
        ? data.employees.find((e) => e.id === editingEmployeeId)?.active ?? true
        : true,
      ssnitNo: form.ssnitNo.trim(),
      niaCard: form.niaCard.trim(),
      designation: form.designation.trim(),
      exemptPaye: form.exemptPaye,
      exemptSsnit: form.exemptSsnit,
    };

    const prevEmployees = data.employees;
    if (editingEmployeeId) {
      mutate((d) => ({
        ...d,
        employees: d.employees.map((e) =>
          e.id === editingEmployeeId ? employeePayload : e
        ),
      }));
      (async () => {
        try {
          await db.saveEmployees([employeePayload]);
        } catch (err) {
          console.error("Failed to save employee:", err);
          alert("Failed to persist employee to server. Changes reverted.");
          mutate((d) => ({ ...d, employees: prevEmployees }));
        }
      })();
    } else {
      mutate((d) => ({
        ...d,
        employees: [...d.employees, employeePayload],
      }));
      (async () => {
        try {
          await db.saveEmployees([employeePayload]);
        } catch (err) {
          console.error("Failed to save employee:", err);
          alert("Failed to persist employee to server. Changes reverted.");
          mutate((d) => ({ ...d, employees: prevEmployees }));
        }
      })();
    }

    resetForm();
    setEditingEmployeeId(null);
    setShowModal(false);
  }

  function toggleActive(id) {
    const prevEmployees = data.employees;
    const updatedEmployees = data.employees.map((e) =>
      e.id === id ? { ...e, active: !e.active } : e
    );
    const updatedEmp = updatedEmployees.find((e) => e.id === id);
    mutate((d) => ({ ...d, employees: updatedEmployees }));
    if (updatedEmp) {
      (async () => {
        try {
          await db.saveEmployees([updatedEmp]);
        } catch (err) {
          console.error("Failed to toggle employee active:", err);
          alert("Failed to update employee on server. Reverting.");
          mutate((d) => ({ ...d, employees: prevEmployees }));
        }
      })();
    }
  }

  function removeEmployee(id) {
    const prevEmployees = data.employees;
    mutate((d) => ({ ...d, employees: d.employees.filter((e) => e.id !== id) }));
    (async () => {
      try {
        await db.deleteEmployee(id);
      } catch (err) {
        console.error("Failed to delete employee:", err);
        alert("Failed to delete employee on server. Reverting.");
        mutate((d) => ({ ...d, employees: prevEmployees }));
      }
    })();
  }

  return (
    <div>
      <SectionTitle
        sub="Base monthly salary before deductions. Exempt employees from PAYE or SSNIT as needed."
        action={
          <Button onClick={openAddModal} icon={Plus}>
            Add employee
          </Button>
        }
      >
        Employees
      </SectionTitle>
      <Card>
        <TableScroll>
          <table
            className="table-card"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <Th>Name</Th>
                <Th>Designation</Th>
                <Th>SSNIT No.</Th>
                <Th right>Base Salary</Th>
                <Th>Exemptions</Th>
                <Th>Status</Th>
                <Th right>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {(data.employees || []).map((e) => (
                <tr key={e.id} className="row-hover">
                  <Td label="Name">{e.name}</Td>
                  <Td label="Designation">
                    {e.designation || <span style={{ color: MUTED }}>—</span>}
                  </Td>
                  <Td mono label="SSNIT No.">
                    {e.ssnitNo || <span style={{ color: MUTED }}>—</span>}
                  </Td>
                  <Td right mono label="Base Salary">
                    GHS {fmt(e.baseSalary)}
                  </Td>
                  <Td label="Exemptions">
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {e.exemptPaye && (
                        <span
                          style={{
                            fontSize: 10,
                            color: ALERT,
                            background: "var(--alert-bg)",
                            padding: "2px 6px",
                            borderRadius: 3,
                            fontWeight: 700,
                          }}
                        >
                          PAYE
                        </span>
                      )}
                      {e.exemptSsnit && (
                        <span
                          style={{
                            fontSize: 10,
                            color: ALERT,
                            background: "var(--alert-bg)",
                            padding: "2px 6px",
                            borderRadius: 3,
                            fontWeight: 700,
                          }}
                        >
                          SSNIT
                        </span>
                      )}
                      {!e.exemptPaye && !e.exemptSsnit && (
                        <span style={{ fontSize: 11, color: MUTED }}>None</span>
                      )}
                    </div>
                  </Td>
                  <Td label="Status">
                    <button
                      onClick={() => toggleActive(e.id)}
                      style={{
                        ...inputStyle,
                        width: "auto",
                        cursor: "pointer",
                        color: e.active ? GREEN : MUTED,
                        border: `1px solid ${e.active ? GREEN : RULE}`,
                        background: "none",
                      }}
                    >
                      {e.active ? "Active" : "Inactive"}
                    </button>
                  </Td>
                  <Td right label="Action">
                    <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                      <button
                        onClick={() => openEditModal(e)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: MUTED,
                        }}
                        title="Edit employee"
                      >
                        <PenLine size={14} />
                      </button>
                      <button
                        onClick={() => removeEmployee(e.id)}
                        style={{
                          background: "none",
                          border: "none",
                          cursor: "pointer",
                          color: MUTED,
                        }}
                        title="Remove employee"
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </Td>
                </tr>
              ))}
              {(data.employees || []).length === 0 && (
                <tr>
                  <td colSpan={7} style={{ color: MUTED, padding: 10 }}>
                    No employees added yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      {showModal && (
        <Modal
          title={editingEmployeeId ? "Edit employee" : "Add employee"}
          onClose={() => {
            resetForm();
            setEditingEmployeeId(null);
            setShowModal(false);
          }}
        >
          <div style={{ display: "flex", flexWrap: "wrap", gap: 12 }}>
            <div style={{ flex: "1 1 100%" }}>
              <label style={labelStyle}>Full name</label>
              <input
                style={inputStyle}
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Ama Owusu"
              />
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <label style={labelStyle}>Designation</label>
              <input
                style={inputStyle}
                value={form.designation}
                onChange={(e) =>
                  setForm({ ...form, designation: e.target.value })
                }
                placeholder="Site Engineer"
              />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={labelStyle}>Base salary (GHS)</label>
              <input
                style={inputStyle}
                value={form.baseSalary}
                onChange={(e) =>
                  setForm({
                    ...form,
                    baseSalary: e.target.value.replace(/[^0-9.]/g, ""),
                  })
                }
                placeholder="3500"
              />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={labelStyle}>SSNIT No.</label>
              <input
                style={inputStyle}
                value={form.ssnitNo}
                onChange={(e) => setForm({ ...form, ssnitNo: e.target.value })}
                placeholder="F019506120374"
              />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={labelStyle}>NIA Card</label>
              <input
                style={inputStyle}
                value={form.niaCard}
                onChange={(e) => setForm({ ...form, niaCard: e.target.value })}
                placeholder="GHA-XXXXXXXXX-X"
              />
            </div>

            <div
              style={{
                flex: "1 1 100%",
                display: "flex",
                gap: 24,
                padding: "8px 0",
                borderTop: `1px solid ${RULE}`,
                marginTop: 8,
              }}
            >
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: INK,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.exemptPaye}
                  onChange={(e) => setForm({ ...form, exemptPaye: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Exempt from PAYE (e.g. Second Job)
              </label>
              <label
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 8,
                  fontFamily: FONT_BODY,
                  fontSize: 13,
                  color: INK,
                  cursor: "pointer",
                }}
              >
                <input
                  type="checkbox"
                  checked={form.exemptSsnit}
                  onChange={(e) => setForm({ ...form, exemptSsnit: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Exempt from SSNIT (e.g. Not Registered)
              </label>
            </div>

            <div style={{ flex: "1 1 100%" }}>
              <Button onClick={saveEmployee} icon={editingEmployeeId ? PenLine : Plus} fullWidth>
                {editingEmployeeId ? "Save changes" : "Add employee"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

