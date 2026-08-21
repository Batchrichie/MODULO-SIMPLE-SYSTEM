import React, { useState, useEffect } from 'react';
import { CheckCircle2, Circle, Loader2, RotateCcw } from 'lucide-react';
import { INK, PAPER, PAPER_RAISED, RULE, GREEN, GREEN_DEEP, GOLD, ALERT, MUTED,
         FONT_DISPLAY, FONT_BODY } from '../../theme/tokens';
import Card from '../../components/ui/Card';
import Button from '../../components/ui/Button';
import Modal from '../../components/ui/Modal';
import { inputStyle, labelStyle } from '../../components/ui/styles';
import { loadMilestones, confirmMilestone, type MilestoneRow } from '../../supabase/fieldOps';
import { confirmAsync } from '../../components/ui/Notifications';

/* ------------------------------------------------------------------ */
/*  Props                                                              */
/* ------------------------------------------------------------------ */

interface Props {
  projectId: string;
  projectName: string;
  onRefresh: () => Promise<void>;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

export default function StageConfirmationPanel({ projectId, projectName, onRefresh }: Props) {
  const [milestones, setMilestones] = useState<MilestoneRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [selectedMilestone, setSelectedMilestone] = useState<MilestoneRow | null>(null);
  const [confirmNotes, setConfirmNotes] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setLoading(true);
    const ms = await loadMilestones(projectId);
    setMilestones(ms);
    setLoading(false);
  }

  useEffect(() => { load(); }, [projectId]);

  function openConfirmModal(m: MilestoneRow) {
    setSelectedMilestone(m);
    setConfirmNotes(m.notes ?? '');
    setError('');
    setShowModal(true);
  }

  async function handleConfirm() {
    if (!selectedMilestone) return;
    setConfirmingId(selectedMilestone.id);
    setError('');
    try {
      const ok = await confirmAsync('Confirm stage completion?');
      if (!ok) { setConfirmingId(null); return; }
      await confirmMilestone(selectedMilestone.id, confirmNotes);
      setShowModal(false);
      setSelectedMilestone(null);
      await load();
      await onRefresh();
    } catch (err: any) {
      setError(err?.message || 'Failed to confirm milestone.');
    }
    setConfirmingId(null);
  }

  const confirmedCount = milestones.filter((m) => m.status === 'confirmed').length;
  const progressPct = milestones.length > 0 ? Math.round((confirmedCount / milestones.length) * 100) : 0;

  if (loading) {
    return (
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: 40, color: MUTED, fontFamily: FONT_BODY }}>
        <Loader2 size={18} style={{ animation: 'spin 1s linear infinite' }} />
        Loading milestones…
      </div>
    );
  }

  return (
    <div>
      {/* Progress header */}
      <Card style={{ marginBottom: 16, padding: '14px 18px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <div>
            <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: INK }}>{projectName}</span>
            <span style={{ fontSize: 12, color: MUTED, marginLeft: 8 }}>Stage Progress</span>
          </div>
          <span style={{ fontFamily: FONT_DISPLAY, fontWeight: 700, fontSize: 14, color: GREEN }}>{progressPct}%</span>
        </div>
        <div style={{ height: 6, background: RULE, borderRadius: 3 }}>
          <div style={{ height: '100%', width: `${progressPct}%`, background: GREEN, borderRadius: 3, transition: 'width 0.3s ease' }} />
        </div>
      </Card>

      {/* Milestone list */}
      {milestones.length === 0 && (
        <Card style={{ padding: 40, textAlign: 'center' }}>
          <div style={{ fontSize: 14, color: MUTED }}>
            No milestones defined for this project yet. Add stages in the admin Projects panel.
          </div>
        </Card>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {milestones.map((m, idx) => (
          <Card key={m.id} style={{ padding: '14px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {/* Stage indicator */}
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
                {m.status === 'confirmed' ? (
                  <CheckCircle2 size={22} style={{ color: GREEN }} />
                ) : (
                  <Circle size={22} style={{ color: RULE }} />
                )}
                {idx < milestones.length - 1 && (
                  <div style={{ width: 2, height: 12, background: m.status === 'confirmed' ? GREEN : RULE }} />
                )}
              </div>

              {/* Content */}
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontFamily: FONT_BODY, fontSize: 14, fontWeight: 600,
                  color: m.status === 'confirmed' ? MUTED : INK,
                  textDecoration: m.status === 'confirmed' ? 'line-through' : 'none',
                }}>
                  Stage {m.stage_order}: {m.name}
                </div>
                {m.notes && (
                  <div style={{ fontSize: 12, color: MUTED, marginTop: 2, lineHeight: 1.4 }}>{m.notes}</div>
                )}
                {m.confirmed_at && (
                  <div style={{ fontSize: 11, color: MUTED, marginTop: 3 }}>
                    Confirmed {new Date(m.confirmed_at).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })}
                  </div>
                )}
              </div>

              {/* Action */}
              {m.status === 'pending' && (
                <Button
                  onClick={() => openConfirmModal(m)}
                  icon={CheckCircle2}
                  size="sm"
                >
                  Confirm
                </Button>
              )}
            </div>
          </Card>
        ))}
      </div>

      {/* Confirm modal */}
      {showModal && selectedMilestone && (
        <Modal
          title={`Confirm: ${selectedMilestone.name}`}
          sub={`Stage ${selectedMilestone.stage_order} — ${projectName}`}
          onClose={() => { setShowModal(false); setSelectedMilestone(null); setError(''); }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div style={{ fontSize: 13, color: MUTED, lineHeight: 1.5 }}>
              This will mark this stage as confirmed. You can add notes about the completion (e.g., weather conditions, observations).
            </div>
            <div>
              <label style={labelStyle}>Confirmation Notes</label>
              <textarea
                style={{ ...inputStyle, minHeight: 100, resize: 'vertical' }}
                value={confirmNotes}
                onChange={(e) => setConfirmNotes(e.target.value)}
                placeholder="e.g. Foundation work completed, inspected by structural engineer. Rain delays on Day 3."
              />
            </div>
            {error && (
              <div style={{ background: 'var(--alert-bg)', color: ALERT, padding: 10, borderRadius: 8, fontSize: 13 }}>{error}</div>
            )}
            <Button
              onClick={handleConfirm}
              icon={CheckCircle2}
              disabled={confirmingId === selectedMilestone.id}
              fullWidth
            >
              {confirmingId === selectedMilestone.id ? 'Confirming…' : 'Confirm Stage'}
            </Button>
          </div>
        </Modal>
      )}
    </div>
  );
}
