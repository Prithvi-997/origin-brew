export interface Photo {
  id: string;
  url: string;
  originalFilename: string;
  width?: number;
  height?: number;
  aspectRatio?: number;
  orientation?: 'landscape' | 'portrait' | 'square';
}

export interface Album {
  id: string;
  title: string;
  subtitle?: string;
  photos: Photo[];
  pages: AlbumPage[];
  createdAt: Date;
}

export interface AlbumPage {
  id: string;
  pageNumber: number;
  svgContent: string;
  layoutName: string;
}

export interface LayoutMetadata {
  name: string;
  frameCount: number;
  orientation: string;
  description: string;
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
