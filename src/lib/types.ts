export interface Photo {
  id: string;
  url: string;
  originalFilename: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  orientation?: 'landscape' | 'portrait' | 'square';
  priority?: number; // For AI to determine hero images
}

export interface Album {
  id: string;
  title: string;
  subtitle?: string;
  photos: Photo[];
  pages: AlbumPage[];
  createdAt: Date;
  editHistory?: EditHistoryEntry[];
  lastModified?: Date;
  version?: number;
}

export interface AlbumPage {
  id: string;
  pageNumber: number;
  svgContent: string;
  layoutName: string;
  photoIds: string[]; // Track which photos are on this page
}

export interface LayoutMetadata {
  name: string;
  frameCount: number;
  orientation: string;
  description: string;
  priority?: 'high' | 'medium' | 'low';
  visualImpact?: 'dramatic' | 'balanced' | 'subtle';
}

export interface AILayoutPlan {
  pages: Array<{
    layout_to_use: string;
    frames: Array<{
      frame_number: number;
      image_id: string;
    }>;
  }>;
}

export interface PhotoMetadata {
  id: string;
  orientation: 'landscape' | 'portrait' | 'square';
  aspectRatio: number;
}

export interface EditHistoryEntry {
  id: string;
  timestamp: Date;
  operation: 'swap_photos' | 'change_layout' | 'reorder_pages' | 'delete_page' | 'add_page';
  pageIndex?: number;
  details: any;
}

export interface DraggedPhoto {
  photoId: string;
  sourcePageIndex: number;
  sourceFrameIndex: number;
}

export interface LayoutFrame {
  id: string;
  aspect_ratio: number;
}
