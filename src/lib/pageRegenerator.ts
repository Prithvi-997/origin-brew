import { AlbumPage, Photo } from './types';
import { supabase } from '@/integrations/supabase/client';
import { injectImagesIntoSVG, uniquifySVGIds } from './svgUtils';
import layoutsMetadata from './layouts.json';

// Import all layout SVG files
import layout1 from '@/assets/layouts/layout1.svg?raw';
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
 * Regenerate specific pages using AI
 */
export async function regeneratePages(
  pages: AlbumPage[],
  pageIndices: number[],
  photos: Photo[],
  keepLayouts: boolean = false
): Promise<AlbumPage[]> {
  try {
    // Get photos for the pages to regenerate
    const pagesToRegenerate = pageIndices.map(index => pages[index]);
    const photoIdsToUse = pagesToRegenerate.flatMap(page => page.photoIds || []);
    const photosToUse = photos.filter(photo => photoIdsToUse.includes(photo.id));

    if (photosToUse.length === 0) {
      throw new Error('No photos found for regeneration');
    }

    // Prepare metadata
    const photoMetadata = photosToUse.map(photo => ({
      id: photo.id,
      orientation: photo.orientation || 'square',
      aspectRatio: photo.aspectRatio || 1,
    }));

    // Call AI to regenerate
    const { data, error } = await supabase.functions.invoke('plan-photobook', {
      body: {
        layouts: layoutsMetadata,
        photos: photoMetadata,
        keepLayouts: keepLayouts ? pagesToRegenerate.map(p => p.layoutName) : undefined,
      },
    });

    if (error) throw error;

    const plan = data as { pages: Array<{ layout_to_use: string; frames: Array<{ frame_number: number; image_id: string }> }> };

    // Generate new pages
    const newPages = plan.pages.map((pagePlan, index) => {
      const layoutName = pagePlan.layout_to_use;
      const layoutTemplate = layoutTemplates[layoutName];
      
      if (!layoutTemplate) {
        console.error(`Layout ${layoutName} not found`);
        return pagesToRegenerate[index];
      }

      const pagePhotos = pagePlan.frames.map(frame => {
        const photo = photosToUse.find(p => p.id === frame.image_id);
        return photo;
      }).filter(Boolean) as Photo[];

      const pageId = pagesToRegenerate[index].id;
      const uniqueSVG = uniquifySVGIds(layoutTemplate, pageId);
      const photosMap = new Map(pagePhotos.map(p => [p.id, p]));
      const assignments = pagePlan.frames.map(frame => ({
        frameNumber: frame.frame_number,
        photoId: frame.image_id,
      }));
      const svgContent = injectImagesIntoSVG(uniqueSVG, assignments, photosMap);

      return {
        id: pageId,
        pageNumber: pagesToRegenerate[index].pageNumber,
        layoutName,
        svgContent,
        photoIds: pagePhotos.map(p => p.id),
      };
    });

    // Replace the regenerated pages
    const updatedPages = [...pages];
    pageIndices.forEach((pageIndex, i) => {
      updatedPages[pageIndex] = newPages[i];
    });

    return updatedPages;
  } catch (error) {
    console.error('Failed to regenerate pages:', error);
    throw error;
  }
}
