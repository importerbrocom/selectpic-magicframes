import { useMemo, useState, type FormEvent } from 'react';
import type { StaffMember, StaffStatus } from './types';

interface StaffViewProps {
  staff: StaffMember[];
  /** Controlled: whether the "Add staff" modal is open. */
  adding: boolean;
  /** Called to open/close the add modal (header button opens it). */
  setAdding: (open: boolean) => void;
  onAdd: (data: Omit<StaffMember, 'id' | 'status'>) => boolean;
  onUpdate: (id: number, patch: Partial<StaffMember>) => void;
  onDelete: (id: number) => void;
  showToast: (msg: string) => void;
}

type StatusFilter = 'all' | StaffStatus;

export function StaffView({
  staff,
  adding,
  setAdding,
  onAdd,
  onUpdate,
  onDelete,
  showToast,
}: StaffViewProps) {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all');
  const [editing, setEditing] = useState<StaffMember | null>(null);
  const [deleting, setDeleting] = useState<StaffMember | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return staff.filter((s) => {
      const matchesText =
        !q ||
        s.name.toLowerCase().includes(q) ||
        s.email.toLowerCase().includes(q);
      const matchesStatus =
        statusFilter === 'all' || s.status === statusFilter;
      return matchesText && matchesStatus;
    });
  }, [staff, search, statusFilter]);

  function toggleSuspend(member: StaffMember) {
    const next: StaffStatus =
      member.status === 'active' ? 'suspended' : 'active';
    onUpdate(member.id, { status: next });
    showToast(
      next === 'suspended'
        ? `Suspended ${member.name}.`
        : `Reactivated ${member.name}.`,
    );
  }

  function resetPassword(member: StaffMember) {
    const pwd = 'mf-' + Math.random().toString(36).slice(2, 8);
    onUpdate(member.id, { tempPassword: pwd });
    showToast(`New temporary password for ${member.name}: ${pwd}`);
  }

  return (
    <>
      <div className="staffToolbar">
        <input
          className="albumSearch"
          placeholder="Search name or email…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <select
          className="staffFilter"
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value as StatusFilter)}
        >
          <option value="all">All statuses</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="panel empty">No staff match your search.</div>
      ) : (
        <div className="staffList">
          {filtered.map((member) => (
            <div className="panel staffRow" key={member.id}>
              <div className="staffInfo">
                <div className="staffName">{member.name}</div>
                <div className="staffEmail">{member.email}</div>
              </div>
              <div className="staffActions">
                <span
                  className={
                    'statusPill ' +
                    (member.status === 'active' ? 'done' : 'idle')
                  }
                >
                  {member.status === 'active' ? 'Active' : 'Suspended'}
                </span>
                <button
                  className="btn small outline"
                  onClick={() => setEditing(member)}
                >
                  Edit
                </button>
                <button
                  className="btn small outline"
                  onClick={() => toggleSuspend(member)}
                >
                  {member.status === 'active' ? 'Suspend' : 'Activate'}
                </button>
                <button
                  className="btn small outline"
                  onClick={() => resetPassword(member)}
                >
                  Reset password
                </button>
                <button
                  className="btn small outline staffDelete"
                  onClick={() => setDeleting(member)}
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {adding && (
        <StaffFormModal
          title="Add staff member"
          submitLabel="Create"
          onClose={() => setAdding(false)}
          onSubmit={(data) => {
            const ok = onAdd(data);
            if (!ok) {
              showToast('A staff member with that email already exists.');
              return false;
            }
            showToast(`Added ${data.name}.`);
            setAdding(false);
            return true;
          }}
        />
      )}

      {editing && (
        <StaffFormModal
          title="Edit staff member"
          submitLabel="Save changes"
          initial={editing}
          onClose={() => setEditing(null)}
          onSubmit={(data) => {
            onUpdate(editing.id, {
              name: data.name,
              email: data.email,
              ...(data.tempPassword
                ? { tempPassword: data.tempPassword }
                : {}),
            });
            showToast('Staff member updated.');
            setEditing(null);
            return true;
          }}
        />
      )}

      {deleting && (
        <div
          className="modalBack"
          onClick={(e) => {
            if (e.target === e.currentTarget) setDeleting(null);
          }}
        >
          <div className="modal" style={{ maxWidth: 420 }}>
            <div className="modalHead">
              <h2>Remove staff member?</h2>
              <button className="closeBtn" onClick={() => setDeleting(null)}>
                ×
              </button>
            </div>
            <p>
              This removes <b>{deleting.name}</b>’s access. This cannot be undone.
            </p>
            <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
              <button className="btn outline" onClick={() => setDeleting(null)}>
                Cancel
              </button>
              <button
                className="btn danger"
                onClick={() => {
                  const name = deleting.name;
                  onDelete(deleting.id);
                  setDeleting(null);
                  showToast(`Removed ${name}.`);
                }}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

    </>
  );
}

interface StaffFormValues {
  name: string;
  email: string;
  tempPassword: string;
}

interface StaffFormModalProps {
  title: string;
  submitLabel: string;
  initial?: StaffMember;
  onClose: () => void;
  onSubmit: (data: StaffFormValues) => boolean;
}

function StaffFormModal({
  title,
  submitLabel,
  initial,
  onClose,
  onSubmit,
}: StaffFormModalProps) {
  const [name, setName] = useState(initial?.name ?? '');
  const [email, setEmail] = useState(initial?.email ?? '');
  const [password, setPassword] = useState('');
  const isEdit = Boolean(initial);

  function submit(e: FormEvent) {
    e.preventDefault();
    onSubmit({
      name: name.trim(),
      email: email.trim(),
      tempPassword: password,
    });
  }

  return (
    <div
      className="modalBack"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="modal" style={{ maxWidth: 440 }}>
        <div className="modalHead">
          <h2>{title}</h2>
          <button className="closeBtn" onClick={onClose}>
            ×
          </button>
        </div>
        <form onSubmit={submit}>
          <div className="field">
            <label>Full name</label>
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          <div className="field">
            <label>
              {isEdit
                ? 'New temporary password (optional)'
                : 'Temporary password (min 8 chars)'}
            </label>
            <input
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              minLength={isEdit ? undefined : 8}
              required={!isEdit}
            />
            <span className="muted tiny">
              The staff member will be required to change this on their first
              login.
            </span>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn outline" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="btn">
              {submitLabel}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
