import { useEffect, useState } from 'react';
import type { Project } from '../types';

interface DriveToolbarProps {
  project: Project;
  onFetch: (folderId: string) => void;
  loading: boolean;
}

/**
 * Input + button to fetch images from a Google Drive folder. Prefills from the
 * project's stored folder id when available.
 */
export function DriveToolbar({ project, onFetch, loading }: DriveToolbarProps) {
  const [folderId, setFolderId] = useState(project.google_drive_folder_id ?? '');

  // Keep the field in sync when the active project changes.
  useEffect(() => {
    setFolderId(project.google_drive_folder_id ?? '');
  }, [project.id, project.google_drive_folder_id]);

  return (
    <form
      className="drive-toolbar"
      onSubmit={(e) => {
        e.preventDefault();
        if (folderId.trim()) onFetch(folderId.trim());
      }}
    >
      <input
        placeholder="Google Drive folder ID or share link"
        value={folderId}
        onChange={(e) => setFolderId(e.target.value)}
      />
      <button type="submit" className="btn btn--primary" disabled={loading || !folderId.trim()}>
        {loading ? 'Fetching…' : 'Fetch images'}
      </button>
    </form>
  );
}
