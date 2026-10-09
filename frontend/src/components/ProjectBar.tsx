import { useState } from 'react';
import type { Project } from '../types';

interface ProjectBarProps {
  projects: Project[];
  activeProject: Project | null;
  onSelect: (project: Project) => void;
  onCreate: (payload: {
    name: string;
    google_drive_folder_id?: string;
    bride_name?: string;
    groom_name?: string;
  }) => Promise<void>;
}

/**
 * Top bar that lets the user pick an existing project or create a new one.
 */
export function ProjectBar({ projects, activeProject, onSelect, onCreate }: ProjectBarProps) {
  const [showForm, setShowForm] = useState(false);
  const [name, setName] = useState('');
  const [folderId, setFolderId] = useState('');
  const [brideName, setBrideName] = useState('');
  const [groomName, setGroomName] = useState('');
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;
    setSubmitting(true);
    try {
      await onCreate({
        name: name.trim(),
        google_drive_folder_id: folderId.trim() || undefined,
        bride_name: brideName.trim() || undefined,
        groom_name: groomName.trim() || undefined,
      });
      setName('');
      setFolderId('');
      setBrideName('');
      setGroomName('');
      setShowForm(false);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="project-bar">
      <div className="project-bar__row">
        <label className="project-bar__picker">
          <span>Project</span>
          <select
            value={activeProject?.id ?? ''}
            onChange={(e) => {
              const p = projects.find((proj) => proj.id === Number(e.target.value));
              if (p) onSelect(p);
            }}
          >
            <option value="" disabled>
              {projects.length ? 'Select a project…' : 'No projects yet'}
            </option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>
        <button
          type="button"
          className="btn btn--ghost"
          onClick={() => setShowForm((v) => !v)}
        >
          {showForm ? 'Cancel' : '+ New project'}
        </button>
      </div>

      {showForm && (
        <form className="project-form" onSubmit={handleSubmit}>
          <input
            placeholder="Project name *"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
          />
          <input
            placeholder="Google Drive folder ID"
            value={folderId}
            onChange={(e) => setFolderId(e.target.value)}
          />
          <input
            placeholder="Bride name"
            value={brideName}
            onChange={(e) => setBrideName(e.target.value)}
          />
          <input
            placeholder="Groom name"
            value={groomName}
            onChange={(e) => setGroomName(e.target.value)}
          />
          <button type="submit" className="btn btn--primary" disabled={submitting}>
            {submitting ? 'Creating…' : 'Create'}
          </button>
        </form>
      )}
    </div>
  );
}
