// Shared domain types for the SelectPic MagicFrames frontend.

export type Choice = 'bride' | 'groom';

export interface Project {
  id: number;
  name: string;
  google_drive_folder_id: string | null;
  bride_name: string | null;
  groom_name: string | null;
  created_at?: string;
  updated_at?: string;
  bride_selections_count?: number;
  groom_selections_count?: number;
}

export interface DriveImage {
  file_id: string;
  name: string;
  mime_type: string;
  thumbnail_link: string | null;
  web_view_link: string | null;
  image_url: string;
}

export interface ImageSelection {
  id: number;
  project_id: number;
  file_id: string;
  file_name: string | null;
  thumbnail_link: string | null;
  choice: Choice;
  created_at: string;
  updated_at: string;
}

export interface GroupedSelections {
  bride: ImageSelection[];
  groom: ImageSelection[];
}
