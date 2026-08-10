import React, { useState } from "react";
import { Plus } from "lucide-react";
import { MUTED } from "../theme/tokens";
import Card from "../components/ui/Card";
import SectionTitle from "../components/ui/SectionTitle";
import TableScroll from "../components/ui/TableScroll";
import Th from "../components/ui/Th";
import Td from "../components/ui/Td";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { fmt, projectName } from "../utils/format";
import JournalEntryForm from "./JournalEntryForm";

export default function JournalPanel({ data, mutate, readOnly }: { data: any; mutate?: any; readOnly?: boolean }) {
  const [showModal, setShowModal] = useState(false);
  const [viewingEntry, setViewingEntry] = useState(null);

  return (
    <div>
      <SectionTitle
        sub={readOnly ? "Read-only view. Contact your accountant to post entries." : "Debits and credits must match before an entry can post."}
        action={
          !readOnly && mutate ? (
            <Button onClick={() => setShowModal(true)} icon={Plus}>
              New journal entry
            </Button>
          ) : undefined
        }
      >
        Journal
      </SectionTitle>

      <SectionTitle>Recent entries</SectionTitle>
      <Card>
        <TableScroll>
          <table
            className="table-card"
            style={{ width: "100%", borderCollapse: "collapse" }}
          >
            <thead>
              <tr>
                <Th>Entry</Th>
                <Th>Date</Th>
                <Th>Description</Th>
                <Th>Project</Th>
                <Th right>Amount</Th>
              </tr>
            </thead>
            <tbody>
              {data.journal.slice(0, 20).map((e) => (
                <tr
                  key={e.id}
                  className="row-hover"
                  style={{ cursor: "pointer" }}
                  onClick={() => setViewingEntry(e)}
                >
                  <Td mono label="Entry">
                    {e.entryNumber}
                  </Td>
                  <Td label="Date">{e.date}</Td>
                  <Td label="Description">
                    {e.description || <span style={{ color: MUTED }}>—</span>}
                  </Td>
                  <Td label="Project">
                    {projectName(data.projects, e.project)}
                  </Td>
                  <Td right mono label="Amount">
                    GHS {fmt(e.lines.reduce((s, l) => s + l.debit, 0))}
                  </Td>
                </tr>
              ))}
              {data.journal.length === 0 && (
                <tr>
                  <td colSpan={5} style={{ color: MUTED, padding: 10 }}>
                    No entries posted yet.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </TableScroll>
      </Card>

      {showModal && (
        <Modal
          title="New journal entry"
          sub="Debits and credits must match before it can post."
          onClose={() => setShowModal(false)}
          wide
        >
          <JournalEntryForm
            data={data}
            mutate={mutate}
            onDone={() => setShowModal(false)}
          />
        </Modal>
      )}

      {viewingEntry && (
        <Modal
          title={`Entry Details: ${viewingEntry.entryNumber}`}
          sub={`${viewingEntry.date} — ${
            viewingEntry.description || "No description"
          }`}
          onClose={() => setViewingEntry(null)}
          wide
        >
          <div style={{ marginBottom: 16 }}>
            <strong>Project:</strong>{" "}
            {projectName(data.projects, viewingEntry.project)}
          </div>
          <TableScroll>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr>
                  <Th>Account</Th>
                  <Th right>Debit (GHS)</Th>
                  <Th right>Credit (GHS)</Th>
                </tr>
              </thead>
              <tbody>
                {viewingEntry.lines.map((l, i) => {
                  const acc = data.accounts.find((a) => a.code === l.account);
                  return (
                    <tr key={i} className="row-hover">
                      <Td>{acc ? `${acc.code} — ${acc.name}` : l.account}</Td>
                      <Td right mono>
                        {l.debit > 0 ? fmt(l.debit) : ""}
                      </Td>
                      <Td right mono>
                        {l.credit > 0 ? fmt(l.credit) : ""}
                      </Td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </TableScroll>
        </Modal>
      )}
    </div>
  );
}

