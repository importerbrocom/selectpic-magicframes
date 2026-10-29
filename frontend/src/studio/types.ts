// Domain types for the Magic Frames Wedding Selection Studio theme.

export type SelectionType = 'bride' | 'groom' | 'both';

export interface Photo {
  id: string;
  folder: string;
  name: string;
  url: string;
}

export type Selections = Record<string, SelectionType>;

export interface Album {
  id: number;
  name: string;
  subtitle: string;
  password: string;
  /** Parent Google Drive folder ID (photos live in its sub-folders). */
  driveFolderId: string;
  /** The original Drive link the admin pasted (for display/editing). */
  driveLink: string;
  /** Legacy demo folder names; only used by the built-in seed albums. */
  events?: string[];
  photos: number;
  cover: string;
  status: string;
  views: number;
  locked: boolean;
  selections: Selections;
}

export type Screen = 'login' | 'admin' | 'clientGate' | 'client';

export type AdminTab =
  | 'dashboard'
  | 'albums'
  | 'create'
  | 'staff'
  | 'profile'
  | 'settings';

export type PhotoFilter = 'all' | 'selected' | 'unselected';

export interface SelectionCounts {
  bride: number;
  groom: number;
  both: number;
}
