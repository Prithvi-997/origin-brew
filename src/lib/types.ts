export interface Photo {
  id: string;
  url: string;
  originalFilename: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  orientation?: "landscape" | "portrait" | "square";
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

export interface FrameCoordinates {
  frameNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
}
export interface AlbumPage {
  id: string;
  pageNumber: number;
  svgContent: string;
  layoutName: string;
  photoIds: string[]; // Track which photos are on this page
  frameCoordinates?: FrameCoordinates[];
}

export interface LayoutMetadata {
  name: string;
  frameCount: number;
  orientation: string;
  description: string;
  priority?: "high" | "medium" | "low";
  visualImpact?: "dramatic" | "balanced" | "subtle";
}

export interface EditHistoryEntry {
  id: string;
  timestamp: Date;
  operation:
    | "swap_photos"
    | "change_layout"
    | "reorder_pages"
    | "delete_page"
    | "add_page"
    | "move_photo_cross_page";
  pageIndex?: number;
  details: any;
}

export interface DraggedPhoto {
  photoId: string;
  sourcePageIndex: number;
  sourceFrameIndex: number;
}

export interface LayoutFrame {
  id: number;
  aspect_ratio: number;
  width?: number;
  height?: number;
  area?: number;
}
