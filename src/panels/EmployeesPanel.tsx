import React, { useState, useEffect } from "react";
import { Plus, Trash2, PenLine, Check, Shield, Mail, Send, Clock } from "lucide-react";
import { INK, PAPER, RULE, GREEN, ALERT, MUTED, FONT_BODY, GREEN_DEEP } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { inputStyle, labelStyle } from "../components/ui/styles";
import { fmt } from "../utils/format";
import { db } from "../supabaseClient";
import { assertEmployee } from "../validation";
import { loadPositions, type PositionOption } from "../supabase/profile";

export default function EmployeesPanel({ data, mutate }) {
  const [showModal, setShowModal] = useState(false);
  const [editingEmployeeId, setEditingEmployeeId] = useState(null);
  const [positions, setPositions] = useState<PositionOption[]>([]);
  const [invitingId, setInvitingId] = useState<string | null>(null);

  const [form, setForm] = useState({
    name: "",
    email: "",
    baseSalary: "",
    ssnitNo: "",
    niaCard: "",
    designation: "",
    positionId: "",
    portalAccess: false,
    exemptPaye: false,
    exemptSsnit: false,
  });

  useEffect(() => {
    loadPositions().then(setPositions);
  }, []);

  function resetForm() {
    setForm({
      name: "",
      email: "",
      baseSalary: "",
      ssnitNo: "",
      niaCard: "",
      designation: "",
      positionId: "",
      portalAccess: false,
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
      email: employee.email || "",
      baseSalary: String(employee.baseSalary || ""),
      ssnitNo: employee.ssnitNo || "",
      niaCard: employee.niaCard || "",
      designation: employee.designation || "",
      positionId: employee.positionId || "",
      portalAccess: employee.portalAccess || false,
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
      positionId: form.positionId || null,
      portalAccess: form.portalAccess,
      exemptPaye: form.exemptPaye,
      exemptSsnit: form.exemptSsnit,
    };

    const prevEmployees = data.employees;
    if (editingEmployeeId) {
      mutate((d) => ({
        ...d,
        // Merge rather than replace — the save form never touches onboarding
        // fields (authUserId/onboardingStatus/invitedAt), so keep whatever
        // is already in local state instead of wiping it until next reload.
        employees: d.employees.map((e) =>
          e.id === editingEmployeeId ? { ...e, ...employeePayload } : e
        ),
      }));
    } else {
      mutate((d) => ({
        ...d,
        employees: [...d.employees, employeePayload],
      }));
    }

    (async () => {
      try {
        await db.saveEmployees([employeePayload]);
      } catch (err) {
        console.error("Failed to save employee:", err);
        alert("Failed to persist employee to server. Changes reverted.");
        mutate((d) => ({ ...d, employees: prevEmployees }));
      }
    })();

    resetForm();
    setEditingEmployeeId(null);
    setShowModal(false);
  }

  async function sendInvite(employee) {
    if (!employee.email) {
      alert("Add an email address for this employee before sending an invite.");
      return;
    }
    setInvitingId(employee.id);
    try {
      const result = await db.inviteEmployee(employee.id, employee.email);
      mutate((d) => ({
        ...d,
        employees: d.employees.map((e) =>
          e.id === employee.id
            ? {
                ...e,
                authUserId: result.authUserId,
                onboardingStatus: "invited",
                invitedAt: new Date().toISOString(),
                portalAccess: true,
              }
            : e
        ),
      }));
      alert(result.mode === "resent" ? "Invite resent." : "Invite sent.");
    } catch (err) {
      console.error("Failed to send invite:", err);
      alert(err instanceof Error ? err.message : "Failed to send invite.");
    } finally {
      setInvitingId(null);
    }
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
        sub="Assign positions to control portal access and permissions."
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
                <Th>Position</Th>
                <Th>Designation</Th>
                <Th right>Base Salary</Th>
                <Th>Portal</Th>
                <Th>Exemptions</Th>
                <Th>Status</Th>
                <Th right>&nbsp;</Th>
              </tr>
            </thead>
            <tbody>
              {(data.employees || []).map((e) => (
                <tr key={e.id} className="row-hover">
                  <Td label="Name">{e.name}</Td>
                  <Td label="Position">
                    {e.positionId ? (
                      <span style={{ fontSize: 12, fontWeight: 600, color: INK }}>
                        {positions.find((p) => p.id === e.positionId)?.title || e.positionId}
                      </span>
                    ) : (
                      <span style={{ color: MUTED, fontSize: 12 }}>—</span>
                    )}
                  </Td>
                  <Td label="Designation">
                    {e.designation || <span style={{ color: MUTED }}>—</span>}
                  </Td>
                  <Td right mono label="Base Salary">
                    GHS {fmt(e.baseSalary)}
                  </Td>
                  <Td label="Portal">
                    {e.onboardingStatus === "active" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: GREEN_DEEP, background: "var(--success-bg)", padding: "2px 8px", borderRadius: 6 }}>
                        <Shield size={11} /> Active
                      </span>
                    )}
                    {e.onboardingStatus === "invited" && (
                      <span style={{ display: "inline-flex", alignItems: "center", gap: 4, fontSize: 11, fontWeight: 600, color: "#9A6B00", background: "var(--warning-bg, #FFF4DB)", padding: "2px 8px", borderRadius: 6 }}>
                        <Clock size={11} /> Invited
                      </span>
                    )}
                    {(!e.onboardingStatus || e.onboardingStatus === "not_invited" || e.onboardingStatus === "inactive") && (
                      <span style={{ fontSize: 12, color: MUTED }}>—</span>
                    )}
                  </Td>
                  <Td label="Exemptions">
                    <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                      {e.exemptPaye && (
                        <span style={{ fontSize: 10, color: ALERT, background: "var(--alert-bg)", padding: "2px 6px", borderRadius: 3, fontWeight: 700 }}>
                          PAYE
                        </span>
                      )}
                      {e.exemptSsnit && (
                        <span style={{ fontSize: 10, color: ALERT, background: "var(--alert-bg)", padding: "2px 6px", borderRadius: 3, fontWeight: 700 }}>
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
                    <div style={{ display: "flex", justifyContent: "flex-end", alignItems: "center", gap: 8 }}>
                      {e.onboardingStatus !== "active" && (
                        <button
                          onClick={() => sendInvite(e)}
                          disabled={invitingId === e.id || !e.email}
                          title={!e.email ? "Add an email address first" : e.onboardingStatus === "invited" ? "Resend invite" : "Send invite"}
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 4,
                            fontSize: 11,
                            fontWeight: 600,
                            color: !e.email ? MUTED : GREEN_DEEP,
                            background: "none",
                            border: `1px solid ${!e.email ? RULE : GREEN_DEEP}`,
                            borderRadius: 6,
                            padding: "3px 8px",
                            cursor: !e.email || invitingId === e.id ? "default" : "pointer",
                            opacity: invitingId === e.id ? 0.6 : 1,
                          }}
                        >
                          {e.onboardingStatus === "invited" ? <Send size={11} /> : <Mail size={11} />}
                          {invitingId === e.id
                            ? "Sending…"
                            : e.onboardingStatus === "invited"
                            ? "Resend"
                            : "Invite"}
                        </button>
                      )}
                      <button
                        onClick={() => openEditModal(e)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}
                        title="Edit employee"
                      >
                        <PenLine size={14} />
                      </button>
                      <button
                        onClick={() => removeEmployee(e.id)}
                        style={{ background: "none", border: "none", cursor: "pointer", color: MUTED }}
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
                  <td colSpan={8} style={{ color: MUTED, padding: 10 }}>
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
              <label style={labelStyle}>Position</label>
              <select
                style={inputStyle}
                value={form.positionId}
                onChange={(e) => setForm({ ...form, positionId: e.target.value })}
              >
                <option value="">No position assigned</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.title}
                  </option>
                ))}
              </select>
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <label style={labelStyle}>Email</label>
              <input
                type="email"
                style={inputStyle}
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                placeholder="ama@company.com"
              />
              <span style={{ fontSize: 11, color: MUTED }}>Required to send a portal invite</span>
            </div>
            <div style={{ flex: "1 1 200px" }}>
              <label style={labelStyle}>Designation</label>
              <input
                style={inputStyle}
                value={form.designation}
                onChange={(e) => setForm({ ...form, designation: e.target.value })}
                placeholder="Site Engineer"
              />
            </div>
            <div style={{ flex: "1 1 150px" }}>
              <label style={labelStyle}>Base salary (GHS)</label>
              <input
                style={inputStyle}
                value={form.baseSalary}
                onChange={(e) =>
                  setForm({ ...form, baseSalary: e.target.value.replace(/[^0-9.]/g, "") })
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
                flexWrap: "wrap",
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
                  checked={form.portalAccess}
                  onChange={(e) => setForm({ ...form, portalAccess: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Portal Access
                <span style={{ fontSize: 11, color: MUTED }}>(can log into employee portal)</span>
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
                  checked={form.exemptPaye}
                  onChange={(e) => setForm({ ...form, exemptPaye: e.target.checked })}
                  style={{ width: 16, height: 16, cursor: "pointer" }}
                />
                Exempt from PAYE
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
                Exempt from SSNIT
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
