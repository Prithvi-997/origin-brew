import { Photo, AlbumPage, AILayoutPlan, PhotoMetadata } from './types';
import { uniquifySVGIds, injectImagesIntoSVG } from './svgUtils';
import layoutsMetadata from './layouts.json';
import { supabase } from '@/integrations/supabase/client';
import { toast } from '@/hooks/use-toast';

/**
 * Analyzes photo distribution by aspect ratio categories
 */
function analyzePhotoDistribution(photos: Photo[]) {
  return {
    fullLengthPortraits: photos.filter(p => (p.aspectRatio || 1) < 0.65).length,
    regularPortraits: photos.filter(p => {
      const ar = p.aspectRatio || 1;
      return ar >= 0.65 && ar < 0.85;
    }).length,
    squares: photos.filter(p => {
      const ar = p.aspectRatio || 1;
      return ar >= 0.85 && ar <= 1.15;
    }).length,
    landscapes: photos.filter(p => {
      const ar = p.aspectRatio || 1;
      return ar > 1.15 && ar <= 1.6;
    }).length,
    widePanoramics: photos.filter(p => (p.aspectRatio || 1) > 1.6).length,
  };
}

/**
 * Recommends priority layouts based on photo distribution
 */
function recommendPriorityLayouts(distribution: ReturnType<typeof analyzePhotoDistribution>): string[] {
  const recommendations: string[] = [];
  
  // Full-length portraits need tall frames
  if (distribution.fullLengthPortraits >= 3) {
    recommendations.push('layout5.svg', 'layout2.svg', 'layout10.svg', 'layout13.svg', 'layout14.svg');
  } else if (distribution.fullLengthPortraits >= 1) {
    recommendations.push('layout5.svg', 'layout2.svg');
  }
  
  // Regular portraits
  if (distribution.regularPortraits >= 5) {
    recommendations.push('layout2.svg', 'layout5.svg', 'layout8.svg', 'layout12.svg', 'layout18.svg');
  }
  
  // Landscapes
  if (distribution.landscapes >= 5) {
    recommendations.push('layout1.svg', 'layout4.svg', 'layout7.svg', 'layout9.svg', 'layout11.svg');
  }
  
  // Wide panoramics
  if (distribution.widePanoramics >= 2) {
    recommendations.push('layout4.svg', 'layout9.svg', 'layout13.svg', 'layout17.svg');
  }
  
  return recommendations;
}

/**
 * Auto-correct layout plan to fix AI mistakes
 */
function autoCorrectLayoutPlan(
  plan: AILayoutPlan,
  photos: Photo[],
  layouts: typeof layoutsMetadata
): AILayoutPlan {
  const photosMap = new Map(photos.map(p => [p.id, p]));
  const correctedPages = [];
  const unassignedPhotos = new Set(photos.map(p => p.id));

  for (const page of plan.pages) {
    const layout = layouts[page.layout_to_use as keyof typeof layouts];
    if (!layout) continue;

    const correctedFrames = [];

    for (const frameAssignment of page.frames) {
      const photo = photosMap.get(frameAssignment.image_id);
      const frameData = layout.frames.find(f => f.id === frameAssignment.frame_number);
      
      if (!photo || !frameData) continue;

      const photoAspect = photo.aspectRatio || 1;
      const frameAspect = frameData.aspect_ratio;
      const aspectDiff = Math.abs(photoAspect - frameAspect);

      // CRITICAL: Detect orientation mismatches
      const isPortraitPhoto = photoAspect < 0.85;
      const isLandscapePhoto = photoAspect > 1.15;
      const isPortraitFrame = frameAspect < 0.85;
      const isLandscapeFrame = frameAspect > 1.2;

      // REJECT only the worst mismatches to avoid empty frames
      // Allow aspect differences up to 0.75 unless there's an orientation mismatch
      const hasOrientationMismatch = (isPortraitPhoto && isLandscapeFrame) || (isLandscapePhoto && isPortraitFrame);
      
      if (hasOrientationMismatch || aspectDiff > 0.75) {
        console.warn(`❌ REJECTING: Photo ${photo.id} (aspect ${photoAspect.toFixed(2)}) in frame (aspect ${frameAspect.toFixed(2)}) - ${hasOrientationMismatch ? 'orientation mismatch' : 'extreme aspect diff'}`);
        continue; // Skip this assignment
      }

      // Accept good matches
      correctedFrames.push(frameAssignment);
      unassignedPhotos.delete(frameAssignment.image_id);
    }

    if (correctedFrames.length > 0) {
      correctedPages.push({
        ...page,
        frames: correctedFrames
      });
    }
  }

  // Reassign unassigned photos using simple fallback
  if (unassignedPhotos.size > 0) {
    console.log(`♻️ Reassigning ${unassignedPhotos.size} rejected photos...`);
    const remainingPhotos = Array.from(unassignedPhotos)
      .map(id => photosMap.get(id))
      .filter(Boolean) as Photo[];
    
    // Use simple layout assignment for remaining photos
    const fallbackPages = generateAlbumPages(remainingPhotos);
    correctedPages.push(...fallbackPages.map((page, idx) => ({
      layout_to_use: page.layoutName,
      frames: page.photoIds.map((photoId, frameIdx) => ({
        frame_number: frameIdx + 1,
        image_id: photoId
      }))
    })));
  }

  return { pages: correctedPages };
}

/**
 * Validates layout plan and logs warnings for poor aspect ratio matches
 */
function validateLayoutPlan(
  plan: AILayoutPlan,
  photos: Photo[],
  layouts: typeof layoutsMetadata
): { isValid: boolean; warnings: string[] } {
  const warnings: string[] = [];
  const photosMap = new Map(photos.map(p => [p.id, p]));
  
  plan.pages.forEach((page, pageIdx) => {
    const layout = layouts[page.layout_to_use as keyof typeof layouts];
    
    if (!layout) {
      warnings.push(`Page ${pageIdx + 1}: Layout ${page.layout_to_use} not found`);
      return;
    }
    
    page.frames.forEach(frameAssignment => {
      const photo = photosMap.get(frameAssignment.image_id);
      if (!photo) {
        warnings.push(`Page ${pageIdx + 1}: Photo ${frameAssignment.image_id} not found`);
        return;
      }
      
      const frameData = layout.frames.find(f => f.id === frameAssignment.frame_number);
      if (!frameData) {
        warnings.push(`Page ${pageIdx + 1}: Frame ${frameAssignment.frame_number} not found in ${page.layout_to_use}`);
        return;
      }
      
      const photoAspect = photo.aspectRatio || 1;
      const frameAspect = frameData.aspect_ratio;
      const aspectDiff = Math.abs(photoAspect - frameAspect);
      
      // Critical mismatch detected
      if (aspectDiff > 0.5) {
        warnings.push(
          `Page ${pageIdx + 1}: Poor fit - Photo ${photo.id} (aspect ${photoAspect.toFixed(2)}) ` +
          `in frame with aspect ${frameAspect.toFixed(2)} (diff: ${aspectDiff.toFixed(2)})`
        );
      }
      
      // Full-length portrait in unsuitable frame
      if (photoAspect < 0.65 && frameAspect > 1.0) {
        warnings.push(
          `Page ${pageIdx + 1}: CRITICAL - Full-length portrait (aspect ${photoAspect.toFixed(2)}) ` +
          `in unsuitable wide frame (aspect ${frameAspect.toFixed(2)})! Faces may be cropped.`
        );
      }
      
      // Portrait in landscape frame
      if (photoAspect < 0.85 && frameAspect > 1.2) {
        warnings.push(
          `Page ${pageIdx + 1}: WARNING - Portrait photo in landscape frame. Consider different layout.`
        );
      }
    });
  });
  
  if (warnings.length > 0) {
    console.warn('Layout validation warnings:', warnings);
  }
  
  return { isValid: warnings.length === 0, warnings };
}

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
    console.log('Starting AI-powered album generation with', photos.length, 'photos');
    
    // Analyze photo distribution
    const distribution = analyzePhotoDistribution(photos);
    
    // Pre-select suitable layouts based on photo distribution
    const suitableLayouts: Record<string, any> = {};
    
    Object.entries(layoutsMetadata).forEach(([name, layout]) => {
      // Count how many photos would fit well in this layout
      let goodFits = 0;
      
      for (const frame of layout.frames) {
        const matchingPhotos = photos.filter(photo => {
          const photoAspect = photo.aspectRatio || 1;
          const frameAspect = frame.aspect_ratio;
          const aspectDiff = Math.abs(photoAspect - frameAspect);
          
          // Check orientation compatibility
          const isPortraitPhoto = photoAspect < 0.85;
          const isLandscapePhoto = photoAspect > 1.15;
          const isPortraitFrame = frameAspect < 0.85;
          const isLandscapeFrame = frameAspect > 1.2;
          
          // Good fit if orientations match AND aspect diff is acceptable
          return aspectDiff < 0.4 && 
                 !((isPortraitPhoto && isLandscapeFrame) || 
                   (isLandscapePhoto && isPortraitFrame));
        });
        
        if (matchingPhotos.length > 0) goodFits++;
      }
      
      // Layout is suitable if at least 50% of frames have good photo matches
      if (goodFits >= layout.frameCount * 0.5) {
        suitableLayouts[name] = layout;
      }
    });
    
    // Fallback: if no suitable layouts found, use all layouts
    const layoutsToSend = Object.keys(suitableLayouts).length > 0 
      ? suitableLayouts 
      : layoutsMetadata;
    
    console.log('Photo distribution analysis:', {
      distribution,
      totalPhotos: photos.length,
      suitableLayoutsCount: Object.keys(layoutsToSend).length,
    });
    
    // Prepare photo metadata for AI with enhanced information
    const photoMetadata: PhotoMetadata[] = photos.map(photo => ({
      id: photo.id,
      orientation: photo.orientation || 'square',
      aspectRatio: photo.aspectRatio || 1,
    }));

    // Call edge function for AI layout planning
    const { data, error } = await supabase.functions.invoke('plan-photobook', {
      body: {
        layouts: layoutsToSend,
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

    let aiPlan: AILayoutPlan = data;
    
    // Validate the AI plan for aspect ratio issues
    const validation = validateLayoutPlan(aiPlan, photos, layoutsMetadata);
    console.log('AI plan validation:', validation);
    
    const criticalCount = validation.warnings.filter(w => 
      w.includes('CRITICAL') || w.includes('WARNING')
    ).length;
    
    if (criticalCount > 3) {
      console.warn(`⚠️ Detected ${criticalCount} critical issues. Applying auto-correction...`);
      
      toast({
        title: "Optimizing layout quality",
        description: `Correcting ${criticalCount} photo placements for better results...`,
        variant: "default",
      });
      
      // Apply auto-correction
      aiPlan = autoCorrectLayoutPlan(aiPlan, photos, layoutsMetadata);
      
      // Re-validate after correction
      const correctedValidation = validateLayoutPlan(aiPlan, photos, layoutsMetadata);
      console.log('✅ After auto-correction:', correctedValidation);
    }

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
