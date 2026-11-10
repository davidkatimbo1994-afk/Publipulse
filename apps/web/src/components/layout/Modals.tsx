import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useApp } from '../../context/AppContext';
import { tomorrowIso } from '../../data/derive';

export function NewActionModal() {
  const { isNewActionModalOpen, setNewActionModalOpen, selectedSignalForAction, createAction } = useApp();
  const [title, setTitle] = useState('');
  const [assignee, setAssignee] = useState('RRT Alpha Team');
  const [priority, setPriority] = useState<'Critical' | 'High' | 'Medium'>('High');
  const [dueDate, setDueDate] = useState(() => tomorrowIso());

  // Start every opening from a clean form with a due date relative to today, never a stale fixed day.
  useEffect(() => {
    if (!isNewActionModalOpen) return;
    setTitle(''); setAssignee('RRT Alpha Team'); setPriority('High'); setDueDate(tomorrowIso());
  }, [isNewActionModalOpen]);

  useEffect(() => {
    if (!isNewActionModalOpen) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setNewActionModalOpen(false); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [isNewActionModalOpen, setNewActionModalOpen]);

  if (!isNewActionModalOpen) return null;

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!title.trim()) return;
    createAction({ title: title.trim(), assignee, priority, dueDate }, selectedSignalForAction?.id);
  };

  return (
    <div className="pp-modal-backdrop" role="presentation" onClick={() => setNewActionModalOpen(false)}>
      <div className="pp-modal" role="dialog" aria-modal="true" aria-labelledby="action-modal-title" onClick={(e) => e.stopPropagation()}>
        <header>
          <h3 id="action-modal-title">Assign Response Action</h3>
          <button type="button" className="pp-btn-ghost" onClick={() => setNewActionModalOpen(false)} aria-label="Close">✕</button>
        </header>
        <form onSubmit={submit}>
          {selectedSignalForAction && (
            <div className="pp-notice success">
              Target: <strong>{selectedSignalForAction.id}</strong> ({selectedSignalForAction.disease} — {selectedSignalForAction.location})
            </div>
          )}
          <label>Response Task Title *<input required value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Deploy AquaTabs" /></label>
          <label>Assigned Response Team
            <select value={assignee} onChange={(e) => setAssignee(e.target.value)}>
              <option value="RRT Alpha Team">RRT Alpha Team (Rapid Response)</option>
              <option value="WASH Taskforce">WASH Intervention Taskforce</option>
              <option value="Immunization Unit">District Immunization Unit</option>
              <option value="Community Health Team">Community Health Cadre</option>
            </select>
          </label>
          <div className="pp-grid-2">
            <label>Task Priority
              <select value={priority} onChange={(e) => setPriority(e.target.value as 'Critical' | 'High' | 'Medium')}>
                <option value="Critical">Critical</option><option value="High">High</option><option value="Medium">Medium</option>
              </select>
            </label>
            <label>Target Completion Date<input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} /></label>
          </div>
          <div className="pp-modal-actions">
            <button type="button" className="pp-btn-ghost" onClick={() => setNewActionModalOpen(false)}>Cancel</button>
            <button type="submit" className="pp-primary-btn">Assign Action Task</button>
          </div>
        </form>
      </div>
    </div>
  );
}
