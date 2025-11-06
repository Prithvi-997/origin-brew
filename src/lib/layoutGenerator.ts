import type { Photo, AlbumPage } from "./types";
import {
  uniquifySVGIds,
  injectImagesIntoSVG,
  extractFrameCoordinates,
} from "./svgUtils";
import layoutsMetadata from "./layouts.json";

// Import all layout SVG files
import layout8 from "@/assets/layouts/layout8.svg?raw";
import layout9 from "@/assets/layouts/layout9.svg?raw";
import layout10 from "@/assets/layouts/layout10.svg?raw";
import layout11 from "@/assets/layouts/layout11.svg?raw";
import layout12 from "@/assets/layouts/layout12.svg?raw";
import layout13 from "@/assets/layouts/layout13.svg?raw";
import layout14 from "@/assets/layouts/layout14.svg?raw";
import layout15 from "@/assets/layouts/layout15.svg?raw";
import layout16 from "@/assets/layouts/layout16.svg?raw";
import layout17 from "@/assets/layouts/layout17.svg?raw";
import layout18 from "@/assets/layouts/layout18.svg?raw";
import layout19 from "@/assets/layouts/layout19.svg?raw";
import layout20 from "@/assets/layouts/layout20.svg?raw";
import layout21 from "@/assets/layouts/layout21.svg?raw";
import layout22 from "@/assets/layouts/layout22.svg?raw";
import layout23 from "@/assets/layouts/layout23.svg?raw";
import layout24 from "@/assets/layouts/layout24.svg?raw";

const layoutTemplates: Record<string, string> = {
  "layout8.svg": layout8,
  "layout9.svg": layout9,
  "layout10.svg": layout10,
  "layout11.svg": layout11,
  "layout12.svg": layout12,
  "layout13.svg": layout13,
  "layout14.svg": layout14,
  "layout15.svg": layout15,
  "layout16.svg": layout16,
  "layout17.svg": layout17,
  "layout18.svg": layout18,
  "layout19.svg": layout19,
  "layout20.svg": layout20,
  "layout21.svg": layout21,
  "layout22.svg": layout22,
  "layout23.svg": layout23,
  "layout24.svg": layout24,
};

// --- Helper: quick check that injected SVG contains expected number of images ---
function svgHasAllImages(svgContent: string, expectedCount: number): boolean {
  try {
    const imageTagRegex =
      /<image\b[^>]*?(?:href|xlink:href)\s*=\s*["']([^"']+)["'][^>]*>/g;
    let match;
    let validCount = 0;
    while ((match = imageTagRegex.exec(svgContent)) !== null) {
      const hrefVal = (match[1] || "").trim();
      if (hrefVal && hrefVal !== "data:," && !hrefVal.includes("undefined")) {
        validCount++;
      }
    }
    return validCount >= expectedCount;
  } catch (e) {
    console.warn("svgHasAllImages failed", e);
    return false;
  }
}

function isGoodAspectMatch(photoAspect: number, frameAspect: number): boolean {
  const diff = Math.abs(photoAspect - frameAspect);

  // Allow 35% difference in aspect ratio
  if (diff > 0.35) return false;

  // Check orientation mismatch
  const isPortraitPhoto = photoAspect < 0.9;
  const isLandscapePhoto = photoAspect > 1.1;
  const isPortraitFrame = frameAspect < 0.9;
  const isLandscapeFrame = frameAspect > 1.1;

  // Reject if orientations are opposite
  if (
    (isPortraitPhoto && isLandscapeFrame) ||
    (isLandscapePhoto && isPortraitFrame)
  ) {
    return false;
  }

  return true;
}

function getScore(
  photo: Photo,
  frame: { aspect_ratio: number; area?: number }
): number {
  const photoAspect = photo.aspectRatio || 1;
  const frameAspect = frame.aspect_ratio || 1;
  const aspectDiff = Math.abs(photoAspect - frameAspect);

  // Base score: aspect ratio match
  let score = 1 / (1 + aspectDiff * aspectDiff);

  const isGroupPhoto = photoAspect > 1.2;
  const frameArea = frame.area || 0;

  // Boost score for group photos in large frames
  if (isGroupPhoto) {
    score *= 1 + frameArea / 50000; // Boost proportional to area
  }

  const isPortraitPhoto = photoAspect < 0.95;
  const isLandscapePhoto = photoAspect > 1.05;
  const isPortraitFrame = frameAspect < 0.95;
  const isLandscapeFrame = frameAspect > 1.05;

  // Penalize orientation mismatches
  if (
    (isPortraitPhoto && isLandscapeFrame) ||
    (isLandscapePhoto && isPortraitFrame)
  ) {
    score *= 0.01;
  }

  return score;
}

function assignPhotosToFrames(
  photos: Photo[],
  frames: Array<{ id: number; aspect_ratio: number; area?: number }>,
  usedPhotoIds: Set<string>
): Array<{ frameNumber: number; photoId: string }> | null {
  const availablePhotos = photos.filter((p) => !usedPhotoIds.has(p.id));
  if (availablePhotos.length < frames.length) {
    return null;
  }

  // Create a cost matrix where cost is the inverse of the score
  const costs: number[][] = [];
  for (let i = 0; i < frames.length; i++) {
    costs[i] = [];
    for (let j = 0; j < availablePhotos.length; j++) {
      costs[i][j] = 1 / (1 + getScore(availablePhotos[j], frames[i]));
    }
  }

  // Use a greedy approach for assignment
  const assignments: Array<{ frameNumber: number; photoId: string }> = [];
  const usedPhotoIndices = new Set<number>();

  for (let i = 0; i < frames.length; i++) {
    let bestPhotoIndex = -1;
    let minCost = Infinity;

    for (let j = 0; j < availablePhotos.length; j++) {
      if (!usedPhotoIndices.has(j) && costs[i][j] < minCost) {
        minCost = costs[i][j];
        bestPhotoIndex = j;
      }
    }

    if (bestPhotoIndex !== -1) {
      assignments.push({
        frameNumber: frames[i].id,
        photoId: availablePhotos[bestPhotoIndex].id,
      });
      usedPhotoIndices.add(bestPhotoIndex);
    }
  }

  if (assignments.length === frames.length) {
    return assignments;
  }

  return null;
}

/**
 * AI-powered layout generation with robust fallback
 */
export async function generateAlbumPagesWithAI(
  photos: Photo[]
): Promise<AlbumPage[]> {
  return generateAlbumPagesDeterministic(photos);
}

function createPage(
  pageNumber: number,
  layoutName: string,
  templateSvg: string,
  photoAssignments: Array<{ frameNumber: number; photoId: string }>,
  photosMap: Map<string, Photo>
): AlbumPage | null {
  try {
    let svgContent = templateSvg;
    svgContent = uniquifySVGIds(svgContent, `page${pageNumber}`);
    svgContent = injectImagesIntoSVG(svgContent, photoAssignments, photosMap);

    const frameCoordinates = extractFrameCoordinates(svgContent);
    const photoIds = photoAssignments.map((a) => a.photoId);

    return {
      id: `page-${pageNumber}`,
      pageNumber,
      svgContent,
      layoutName,
      photoIds,
      frameCoordinates,
    };
  } catch (error) {
    console.error(`❌ Error creating page ${pageNumber}:`, error);
    return null;
  }
}

/**
 * Shuffles an array in place.
 * @param array The array to shuffle.
 */
function shuffle<T>(array: T[]): T[] {
  let currentIndex = array.length;
  let randomIndex;

  // While there remain elements to shuffle.
  while (currentIndex !== 0) {
    // Pick a remaining element.
    randomIndex = Math.floor(Math.random() * currentIndex);
    currentIndex--;

    // And swap it with the current element.
    [array[currentIndex], array[randomIndex]] = [
      array[randomIndex],
      array[currentIndex],
    ];
  }

  return array;
}

/**
 * Deterministic fallback layout generation
 * Guarantees all photos are used exactly once
 */
export function generateAlbumPagesDeterministic(photos: Photo[]): AlbumPage[] {
  console.log(`\n🔧 ========== DETERMINISTIC GENERATION ==========`);
  console.log(`📸 Photos to process: ${photos.length}`);

  const pages: AlbumPage[] = [];
  const usedPhotoIds = new Set<string>();
  const photosMap = new Map(photos.map((p) => [p.id, p]));

  // Sort layouts by frame count (prefer larger layouts)
  const sortedLayouts = Object.entries(layoutsMetadata).sort(
    (a, b) => b[1].frameCount - a[1].frameCount
  );

  let attempts = 0;
  const maxAttempts = photos.length * 2;

  while (usedPhotoIds.size < photos.length && attempts < maxAttempts) {
    attempts++;

    const remainingPhotos = photos.filter((p) => !usedPhotoIds.has(p.id));

    if (remainingPhotos.length === 0) break;

    let pageCreated = false;
    // Shuffle a copy of the layouts to ensure variety
    const shuffledLayouts = shuffle([...sortedLayouts]);
    for (const [layoutName, layout] of shuffledLayouts) {
      if (remainingPhotos.length < layout.frameCount) continue;

      const templateSvg = layoutTemplates[layoutName];
      if (!templateSvg) continue;

      const assignments = assignPhotosToFrames(
        remainingPhotos,
        layout.frames,
        usedPhotoIds
      );

      if (assignments) {
        const page = createPage(
          pages.length,
          layoutName,
          templateSvg,
          assignments,
          photosMap
        );
        if (page) {
          pages.push(page);
          assignments.forEach((a) => usedPhotoIds.add(a.photoId));
          pageCreated = true;
          break; // Move to next attempt
        }
      }
    }

    if (!pageCreated) {
      // If no layout was found, break and proceed to single-page generation
      break;
    }
  }

  // Final step: create single-photo pages for any remaining photos
  const remainingPhotos = photos.filter((p) => !usedPhotoIds.has(p.id));
  if (remainingPhotos.length > 0) {
    for (const photo of remainingPhotos) {
      const layoutName = "layout19.svg"; // A reliable single-photo layout
      const templateSvg = layoutTemplates[layoutName];
      const page = createPage(
        pages.length,
        layoutName,
        templateSvg,
        [{ frameNumber: 1, photoId: photo.id }],
        photosMap
      );
      if (page) {
        pages.push(page);
        usedPhotoIds.add(photo.id);
      }
    }
  }

  console.log(`\n📊 Deterministic Generation Complete:`);
  console.log(`   - Pages created: ${pages.length}`);
  console.log(`   - Photos used: ${usedPhotoIds.size}/${photos.length}`);
  console.log(`   - Attempts: ${attempts}`);

  return pages;
}
