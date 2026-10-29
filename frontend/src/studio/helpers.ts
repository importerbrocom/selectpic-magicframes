// Shared helpers for the Magic Frames studio.

import { photos } from './data';
import type {
  Album,
  SelectionCounts,
  Selections,
  SelectionType,
} from './types';

// Lookup of the bundled demo photos, used to enrich CSV rows with a filename
// when a selection refers to a demo photo (Drive selections use file IDs).
const demoById = new Map(photos.map((p) => [p.id, p]));

export function selectionCounts(album: Album): SelectionCounts {
  const counts: SelectionCounts = { bride: 0, groom: 0, both: 0 };
  const selections: Selections = album.selections ?? {};
  for (const value of Object.values(selections)) {
    if (value in counts) counts[value] += 1;
  }
  return counts;
}

export interface SelectionStatus {
  /** Short label for the status pill. */
  label: string;
  /** 'done' = submitted, 'active' = in progress, 'idle' = awaiting. */
  tone: 'done' | 'active' | 'idle';
}

/** Derive a selection-workflow status for an album. */
export function selectionStatus(album: Album): SelectionStatus {
  if (album.locked) return { label: 'Selections submitted', tone: 'done' };
  const made = Object.keys(album.selections ?? {}).length;
  if (made > 0) return { label: 'In progress', tone: 'active' };
  return { label: 'Awaiting selection', tone: 'idle' };
}

/**
 * Build and download a CSV of an album's selections for the given type.
 * Returns false (and downloads nothing) when there are no matching selections.
 */
export function downloadAlbumCSV(
  album: Album,
  type: 'all' | SelectionType,
): boolean {
  const selections: Selections = album.selections ?? {};
  const matchingIds = Object.keys(selections).filter((id) =>
    type === 'all' ? true : selections[id] === type,
  );

  if (matchingIds.length === 0) return false;

  const rows: (string | undefined)[][] = [
    ['Album', album.name],
    ['Selection type', type === 'all' ? 'All selections' : type.toUpperCase()],
    [],
    ['Photo ID', 'Filename', 'Selection', 'Drive link'],
  ];
  matchingIds.forEach((id) => {
    const demo = demoById.get(id);
    const driveLink = demo
      ? ''
      : `https://drive.google.com/file/d/${id}/view`;
    rows.push([id, demo?.name ?? id, selections[id], driveLink]);
  });

  const csv = rows
    .map((row) =>
      row
        .map((value) => '"' + String(value ?? '').replace(/"/g, '""') + '"')
        .join(','),
    )
    .join('\r\n');

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `${album.name.replace(/[^a-z0-9]+/gi, '_')}_${type}_selections.csv`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
  return true;
}
