import { Photo, AlbumPage, AILayoutPlan, PhotoMetadata } from './types';
import { uniquifySVGIds, injectImagesIntoSVG } from './svgUtils';
import layoutsMetadata from './layouts.json';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

// Import all layout SVG files
import layout1 from '@/assets/layouts/layout1.svg?raw';
import layout2 from '@/assets/layouts/layout2.svg?raw';
import layout3 from '@/assets/layouts/layout3.svg?raw';
import layout4 from '@/assets/layouts/layout4.svg?raw';
import layout5 from '@/assets/layouts/layout5.svg?raw';
import layout6 from '@/assets/layouts/layout6.svg?raw';
import layout7 from '@/assets/layouts/layout7.svg?raw';
import layout8 from '@/assets/layouts/layout8.svg?raw';
import layout9 from '@/assets/layouts/layout9.svg?raw';
import layout10 from '@/assets/layouts/layout10.svg?raw';

const layoutTemplates: Record<string, string> = {
  'layout1.svg': layout1,
  'layout2.svg': layout2,
  'layout3.svg': layout3,
  'layout4.svg': layout4,
  'layout5.svg': layout5,
  'layout6.svg': layout6,
  'layout7.svg': layout7,
  'layout8.svg': layout8,
  'layout9.svg': layout9,
  'layout10.svg': layout10,
};

/**
 * AI-powered layout generation
 * Uses Lovable AI to intelligently arrange photos based on orientation and aspect ratio
 */
export async function generateAlbumPagesWithAI(photos: Photo[]): Promise<AlbumPage[]> {
  try {
    // Prepare photo metadata for AI
    const photoMetadata: PhotoMetadata[] = photos.map(photo => ({
      id: photo.id,
      orientation: photo.orientation || 'square',
      aspectRatio: photo.aspectRatio || 1,
    }));

    // Call edge function for AI layout planning
    const { data, error } = await supabase.functions.invoke('plan-photobook', {
      body: {
        layouts: layoutsMetadata,
        photos: photoMetadata,
      },
    });

    if (error) {
      console.error('AI planning error:', error);
      toast({
        title: "AI planning failed",
        description: "Using basic layout instead",
        variant: "destructive",
      });
      return generateAlbumPages(photos);
    }

    const aiPlan: AILayoutPlan = data;

    // Filter duplicate image assignments (AI sometimes duplicates)
    const usedImageIds = new Set<string>();
    const cleanedPages = aiPlan.pages.map(page => ({
      ...page,
      frames: page.frames.filter(frame => {
        if (usedImageIds.has(frame.image_id)) {
          console.warn(`Duplicate image assignment filtered: ${frame.image_id}`);
          return false;
        }
        usedImageIds.add(frame.image_id);
        return true;
      })
    }));

    // Generate pages from AI plan
    const pages: AlbumPage[] = [];
    const photosMap = new Map(photos.map(p => [p.id, p]));

    cleanedPages.forEach((pagePlan, pageIndex) => {
      const layoutName = pagePlan.layout_to_use;
      const layout = layoutsMetadata[layoutName as keyof typeof layoutsMetadata];
      const templateSvg = layoutTemplates[layoutName];

      if (!templateSvg || !layout) {
        console.error(`Template not found: ${layoutName}`);
        return;
      }

      // Validate frame numbers
      const validFrames = pagePlan.frames.filter(frame => {
        if (frame.frame_number < 1 || frame.frame_number > layout.frameCount) {
          console.warn(`Invalid frame_number ${frame.frame_number} for ${layoutName}`);
          return false;
        }
        return true;
      });

      // Build photo assignments
      const photoAssignments = validFrames.map(frame => ({
        frameNumber: frame.frame_number,
        photoId: frame.image_id,
      }));

      // Generate SVG with images
      let svgContent = templateSvg;
      svgContent = uniquifySVGIds(svgContent, `page${pageIndex}`);
      svgContent = injectImagesIntoSVG(svgContent, photoAssignments, photosMap);

      pages.push({
        id: `page-${pageIndex}`,
        pageNumber: pageIndex,
        svgContent,
        layoutName,
      });
    });

    return pages;
  } catch (error) {
    console.error('Error in AI layout generation:', error);
    toast({
      title: "AI layout generation failed",
      description: "Using basic layout",
      variant: "destructive",
    });
    return generateAlbumPages(photos);
  }
}

/**
 * Simple client-side layout generation (fallback)
 * Distributes photos across layouts based on available frames
 */
export function generateAlbumPages(photos: Photo[]): AlbumPage[] {
  const pages: AlbumPage[] = [];
  const layoutKeys = Object.keys(layoutsMetadata);
  let photoIndex = 0;
  let pageNumber = 0;

  while (photoIndex < photos.length) {
    // Cycle through layouts
    const layoutName = layoutKeys[pageNumber % layoutKeys.length];
    const layout = layoutsMetadata[layoutName as keyof typeof layoutsMetadata];
    const templateSvg = layoutTemplates[layoutName];

    if (!templateSvg) {
      console.error(`Template not found: ${layoutName}`);
      continue;
    }

    // Determine how many photos to use for this page
    const photosForPage = Math.min(layout.frameCount, photos.length - photoIndex);
    const photoAssignments: Array<{ frameNumber: number; photoId: string }> = [];

    // Assign photos to frames
    for (let i = 0; i < photosForPage; i++) {
      photoAssignments.push({
        frameNumber: i + 1,
        photoId: photos[photoIndex + i].id
      });
    }

    // Create photos map
    const photosMap = new Map(photos.map(p => [p.id, p]));

    // Generate SVG with images
    let svgContent = templateSvg;
    svgContent = uniquifySVGIds(svgContent, `page${pageNumber}`);
    svgContent = injectImagesIntoSVG(svgContent, photoAssignments, photosMap);

    pages.push({
      id: `page-${pageNumber}`,
      pageNumber,
      svgContent,
      layoutName
    });

    photoIndex += photosForPage;
    pageNumber++;
  }

  return pages;
}
