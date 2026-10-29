// Shared helpers for the Magic Frames studio.

import { photos } from './data';
import type {
  Album,
  SelectionCounts,
  Selections,
  SelectionType,
} from './types';

export function selectionCounts(album: Album): SelectionCounts {
  const counts: SelectionCounts = { bride: 0, groom: 0, both: 0 };
  const selections: Selections = album.selections ?? {};
  for (const value of Object.values(selections)) {
    if (value in counts) counts[value] += 1;
  }
  return counts;
}

/**
 * Build and download a CSV of an album's selections for the given type.
 * Returns false (and downloads nothing) when there are no matching selections.
 */
export function downloadAlbumCSV(
  album: Album,
  type: 'all' | SelectionType,
): boolean {
  const matching = photos.filter((p) =>
    type === 'all' ? !!album.selections[p.id] : album.selections[p.id] === type,
  );

  if (matching.length === 0) return false;

  const rows: (string | undefined)[][] = [
    ['Album', album.name],
    ['Selection type', type === 'all' ? 'All selections' : type.toUpperCase()],
    [],
    ['Photo ID', 'Filename', 'Folder', 'Selection'],
  ];
  matching.forEach((p) =>
    rows.push([p.id, p.name, p.folder, album.selections[p.id]]),
  );

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
