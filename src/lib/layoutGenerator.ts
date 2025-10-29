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
import layout11 from '@/assets/layouts/layout11.svg?raw';
import layout12 from '@/assets/layouts/layout12.svg?raw';
import layout13 from '@/assets/layouts/layout13.svg?raw';
import layout14 from '@/assets/layouts/layout14.svg?raw';
import layout15 from '@/assets/layouts/layout15.svg?raw';
import layout16 from '@/assets/layouts/layout16.svg?raw';
import layout17 from '@/assets/layouts/layout17.svg?raw';
import layout18 from '@/assets/layouts/layout18.svg?raw';
import singlephoto from '@/assets/layouts/singlephoto.svg?raw';

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
  'layout11.svg': layout11,
  'layout12.svg': layout12,
  'layout13.svg': layout13,
  'layout14.svg': layout14,
  'layout15.svg': layout15,
  'layout16.svg': layout16,
  'layout17.svg': layout17,
  'layout18.svg': layout18,
  'singlephoto.svg': singlephoto,
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
    // Diversify layouts: rotate among templates with matching frame counts
    const layoutsByFrameCount = Object.entries(layoutsMetadata).reduce((acc, [name, meta]) => {
      (acc[meta.frameCount] ||= []).push(name);
      return acc;
    }, {} as Record<number, string[]>);
    const rotationIndex: Record<number, number> = {};
    cleanedPages.forEach((pagePlan, pageIndex) => {
      const originalLayoutName = pagePlan.layout_to_use;
      // Determine frames needed for this page
      const framesNeeded = pagePlan.frames.length;
      // Rotate among layouts that have the same frame count to avoid repetition
      let chosenLayoutName = originalLayoutName;
      const candidates = layoutsByFrameCount[framesNeeded];
      if (candidates && candidates.length) {
        const idx = rotationIndex[framesNeeded] ?? 0;
        chosenLayoutName = candidates[idx % candidates.length];
        rotationIndex[framesNeeded] = idx + 1;
      }
      const layout = layoutsMetadata[chosenLayoutName as keyof typeof layoutsMetadata];
      const templateSvg = layoutTemplates[chosenLayoutName];

      if (!templateSvg || !layout) {
        console.error(`Template not found: ${chosenLayoutName}`);
        return;
      }

      // Validate frame numbers
      const validFrames = pagePlan.frames.filter(frame => {
        if (frame.frame_number < 1 || frame.frame_number > layout.frameCount) {
          console.warn(`Invalid frame_number ${frame.frame_number} for ${chosenLayoutName}`);
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

      const photoIds = validFrames.map(frame => frame.image_id);
      
      pages.push({
        id: `page-${pageIndex}`,
        pageNumber: pageIndex,
        svgContent,
        layoutName: chosenLayoutName,
        photoIds,
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

    const photoIds = photoAssignments.map(a => a.photoId);
    
    pages.push({
      id: `page-${pageNumber}`,
      pageNumber,
      svgContent,
      layoutName,
      photoIds,
    });

    photoIndex += photosForPage;
    pageNumber++;
  }

  return pages;
}
