import type { Photo, AlbumPage, AILayoutPlan, PhotoMetadata } from "./types";
import {
  uniquifySVGIds,
  injectImagesIntoSVG,
  extractFrameCoordinates,
} from "./svgUtils";
import layoutsMetadata from "./layouts.json";
import { supabase } from "@/integrations/supabase/client";

/**
 * Analyzes photo distribution by aspect ratio categories
 */
function analyzePhotoDistribution(photos: Photo[]) {
  return {
    fullLengthPortraits: photos.filter((p) => (p.aspectRatio || 1) < 0.65)
      .length,
    regularPortraits: photos.filter((p) => {
      const ar = p.aspectRatio || 1;
      return ar >= 0.65 && ar < 0.85;
    }).length,
    squares: photos.filter((p) => {
      const ar = p.aspectRatio || 1;
      return ar >= 0.85 && ar <= 1.15;
    }).length,
    landscapes: photos.filter((p) => {
      const ar = p.aspectRatio || 1;
      return ar > 1.15 && ar <= 1.6;
    }).length,
    widePanoramics: photos.filter((p) => (p.aspectRatio || 1) > 1.6).length,
  };
}

/**
 * Recommends priority layouts based on photo distribution
 */
function recommendPriorityLayouts(
  distribution: ReturnType<typeof analyzePhotoDistribution>
): string[] {
  const recommendations: string[] = [];

  // Full-length portraits need tall frames
  if (distribution.fullLengthPortraits >= 3) {
    recommendations.push("layout8.svg", "layout18.svg");
  } else if (distribution.fullLengthPortraits >= 1) {
    recommendations.push("layout8.svg");
  }

  // Regular portraits
  if (distribution.regularPortraits >= 5) {
    recommendations.push("layout8.svg", "layout18.svg");
  }

  // Landscapes
  if (distribution.landscapes >= 5) {
    recommendations.push("layout9.svg", "layout10.svg", "layout17.svg");
  }

  // Wide panoramics
  if (distribution.widePanoramics >= 2) {
    recommendations.push(
      "layout9.svg",
      "layout10.svg",
      "layout16.svg",
      "layout17.svg"
    );
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
  const photosMap = new Map(photos.map((p) => [p.id, p]));
  const correctedPages = [];
  const unassignedPhotos = new Set(photos.map((p) => p.id));

  for (const page of plan.pages) {
    const layout = layouts[page.layout_to_use as keyof typeof layouts];
    if (!layout) continue;

    const correctedFrames = [];

    for (const frameAssignment of page.frames) {
      const photo = photosMap.get(normalizeId(frameAssignment.image_id));
      const frameData = layout.frames.find(
        (f) => f.id === frameAssignment.frame_number
      );

      if (!photo || !frameData) continue;

      const photoAspect = photo.aspectRatio || 1;
      const frameAspect = frameData.aspect_ratio;
      const aspectDiff = Math.abs(photoAspect - frameAspect);

      const isPortraitPhoto = photoAspect < 0.85;
      const isLandscapePhoto = photoAspect > 1.15;
      const isPortraitFrame = frameAspect < 0.85;
      const isLandscapeFrame = frameAspect > 1.15;

      const hasOrientationMismatch =
        (isPortraitPhoto && isLandscapeFrame) ||
        (isLandscapePhoto && isPortraitFrame);

      if (hasOrientationMismatch || aspectDiff > 0.5) {
        console.warn(
          `❌ REJECTING: Photo ${photo.id} (aspect ${photoAspect.toFixed(
            2
          )}) in frame (aspect ${frameAspect.toFixed(2)}) - ${
            hasOrientationMismatch
              ? "orientation mismatch"
              : `aspect diff ${aspectDiff.toFixed(2)} too large`
          }`
        );
        continue;
      }

      correctedFrames.push(frameAssignment);
      unassignedPhotos.delete(frameAssignment.image_id);
    }

    if (correctedFrames.length > 0) {
      correctedPages.push({
        ...page,
        frames: correctedFrames,
      });
    }
  }

  if (unassignedPhotos.size > 0) {
    console.log(`♻️ Reassigning ${unassignedPhotos.size} rejected photos...`);
    const remainingPhotos = Array.from(unassignedPhotos)
      .map((id) => photosMap.get(id))
      .filter(Boolean) as Photo[];

    const fallbackPages = generateAlbumPages(remainingPhotos);
    correctedPages.push(
      ...fallbackPages.map((page, idx) => ({
        layout_to_use: page.layoutName,
        frames: page.photoIds.map((photoId, frameIdx) => ({
          frame_number: frameIdx + 1,
          image_id: photoId,
        })),
      }))
    );
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
  const photosMap = new Map(photos.map((p) => [p.id, p]));

  plan.pages.forEach((page, pageIdx) => {
    const layout = layouts[page.layout_to_use as keyof typeof layouts];

    if (!layout) {
      warnings.push(
        `Page ${pageIdx + 1}: Layout ${page.layout_to_use} not found`
      );
      return;
    }

    page.frames.forEach((frameAssignment) => {
      const photo = photosMap.get(normalizeId(frameAssignment.image_id));
      if (!photo) {
        warnings.push(
          `Page ${pageIdx + 1}: Photo ${frameAssignment.image_id} not found`
        );
        return;
      }

      const frameData = layout.frames.find(
        (f) => f.id === frameAssignment.frame_number
      );
      if (!frameData) {
        warnings.push(
          `Page ${pageIdx + 1}: Frame ${
            frameAssignment.frame_number
          } not found in ${page.layout_to_use}`
        );
        return;
      }

      const photoAspect = photo.aspectRatio || 1;
      const frameAspect = frameData.aspect_ratio;
      const aspectDiff = Math.abs(photoAspect - frameAspect);

      // Critical mismatch detected
      if (aspectDiff > 0.5) {
        warnings.push(
          `Page ${pageIdx + 1}: Poor fit - Photo ${
            photo.id
          } (aspect ${photoAspect.toFixed(2)}) ` +
            `in frame with aspect ${frameAspect.toFixed(
              2
            )} (diff: ${aspectDiff.toFixed(2)})`
        );
      }

      // Full-length portrait in unsuitable frame
      if (photoAspect < 0.65 && frameAspect > 1.0) {
        warnings.push(
          `Page ${
            pageIdx + 1
          }: CRITICAL - Full-length portrait (aspect ${photoAspect.toFixed(
            2
          )}) ` +
            `in unsuitable wide frame (aspect ${frameAspect.toFixed(
              2
            )})! Faces may be cropped.`
        );
      }

      // Portrait in landscape frame
      if (photoAspect < 0.85 && frameAspect > 1.2) {
        warnings.push(
          `Page ${
            pageIdx + 1
          }: WARNING - Portrait photo in landscape frame. Consider different layout.`
        );
      }
    });
  });

  if (warnings.length > 0) {
    console.warn("Layout validation warnings:", warnings);
  }

  return { isValid: warnings.length === 0, warnings };
}

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

function normalizeId(id: any): string {
  if (id === null || id === undefined) return String(id);
  return String(id).trim();
}

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

  // Allow 40% difference in aspect ratio
  if (diff > 0.4) return false;

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

function assignPhotosToFrames(
  photos: Photo[],
  frames: Array<{ id: number; aspect_ratio: number }>,
  usedPhotoIds: Set<string>
): Array<{ frameNumber: number; photoId: string }> | null {
  const assignments: Array<{ frameNumber: number; photoId: string }> = [];
  const availablePhotos = photos.filter((p) => !usedPhotoIds.has(p.id));

  if (availablePhotos.length < frames.length) {
    return null; // Not enough photos for this layout
  }

  // Score each photo for each frame
  const scores: Array<{ frameIdx: number; photoIdx: number; score: number }> =
    [];

  frames.forEach((frame, frameIdx) => {
    // use traditional for loop so we can reference index numbers later
    for (let photoIdx = 0; photoIdx < availablePhotos.length; photoIdx++) {
      const photo = availablePhotos[photoIdx];

      const photoAspect = photo.aspectRatio || 1;
      const frameAspect = frame.aspect_ratio || 1;
      const aspectDiff = Math.abs(photoAspect - frameAspect);

      const isLandscapePhoto = photoAspect > 1.2;
      const isPortraitFrame = frameAspect < 0.85;

      // Keep obvious dangerous reject: landscape photo into a very narrow portrait frame
      if (isLandscapePhoto && isPortraitFrame) {
        // Skip — will probably severely crop people
        continue;
      }

      // New scoring logic (C step):
      // base score: closer aspect => higher score
      let score = 1 / (1 + aspectDiff);

      // small orientation boost if both portrait or both landscape/landscape-ish
      const isPortraitPhoto = photoAspect < 1;
      const isPortraitFrameLoose = frameAspect < 1;
      if (
        (isPortraitPhoto && isPortraitFrameLoose) ||
        (!isPortraitPhoto && !isPortraitFrameLoose)
      ) {
        score *= 1.15;
      }

      // penalize severe mismatch so it's unlikely to be chosen
      if (aspectDiff > 0.6) score *= 0.2;
      if (aspectDiff > 1.2) score *= 0.05;

      // push the candidate score
      scores.push({ frameIdx, photoIdx, score });
    }
  });

  // Greedy assignment: best matches first
  scores.sort((a, b) => b.score - a.score);

  const assignedFrames = new Set<number>();
  const assignedPhotos = new Set<number>();

  for (const { frameIdx, photoIdx, score } of scores) {
    if (assignedFrames.has(frameIdx) || assignedPhotos.has(photoIdx)) continue;

    assignments.push({
      frameNumber: frames[frameIdx].id,
      photoId: availablePhotos[photoIdx].id,
    });

    assignedFrames.add(frameIdx);
    assignedPhotos.add(photoIdx);

    if (assignments.length === frames.length) break;
  }

  // Only return if we filled all frames
  return assignments.length === frames.length ? assignments : null;
}

/**
 * AI-powered layout generation with robust fallback
 */
export async function generateAlbumPagesWithAI(
  photos: Photo[]
): Promise<AlbumPage[]> {
  try {
    console.log("🎨 ========== ALBUM GENERATION START ==========");
    console.log(`📸 Total photos to process: ${photos.length}`);
    console.log(
      `📸 Photo IDs:`,
      photos.map((p) => p.id)
    );

    // Prepare photo metadata for AI
    const photoMetadata: PhotoMetadata[] = photos.map((photo) => ({
      id: photo.id,
      orientation: photo.orientation || "square",
      aspectRatio: photo.aspectRatio || 1,
    }));

    // Call AI for layout planning
    const { data, error } = await supabase.functions.invoke("plan-photobook", {
      body: {
        layouts: layoutsMetadata,
        photos: photoMetadata,
      },
    });

    if (error) {
      console.error("AI planning error:", error);
      return generateAlbumPagesDeterministic(photos);
    }

    const aiPlan: AILayoutPlan = data;
    console.log("🤖 AI generated plan with", aiPlan.pages.length, "pages");

    const pages = processAIPlan(aiPlan, photos);

    const allPhotoIdsInPages = new Set<string>();
    pages.forEach((page) => {
      page.photoIds.forEach((id) => {
        if (allPhotoIdsInPages.has(id)) {
          console.error(`🚨 DUPLICATE PHOTO IN FINAL ALBUM: ${id}`);
        }
        allPhotoIdsInPages.add(id);
      });
    });

    const missingPhotos = photos.filter((p) => !allPhotoIdsInPages.has(p.id));

    console.log("🎨 ========== ALBUM GENERATION COMPLETE ==========");
    console.log(`✅ Total pages created: ${pages.length}`);
    console.log(
      `✅ Total photos used: ${allPhotoIdsInPages.size}/${photos.length}`
    );

    if (missingPhotos.length > 0) {
      console.error(
        `🚨 MISSING PHOTOS: ${missingPhotos.length} photos not in album!`
      );
      console.error(
        `🚨 Missing photo IDs:`,
        missingPhotos.map((p) => p.id)
      );
    }

    // Validate and remove duplicate pages (dedupe before returning)
    // NOTE: use copies when sorting to avoid mutating page.photoIds in-place
    const seenSignatures = new Set<string>();
    const uniquePages: AlbumPage[] = [];

    for (let i = 0; i < pages.length; i++) {
      const page = pages[i];
      // Use a non-mutating sort of a copy of the array
      const sortedPhotoIds = Array.isArray(page.photoIds)
        ? [...page.photoIds].slice().sort()
        : [];
      const signature = `${page.layoutName}-${sortedPhotoIds.join(",")}`;

      if (seenSignatures.has(signature)) {
        // duplicate — skip pushing to uniquePages
        console.warn(`🔁 Skipping duplicate page at index ${i}`, {
          layoutName: page.layoutName,
          photoIds: page.photoIds,
        });
        continue;
      }

      seenSignatures.add(signature);
      uniquePages.push(page);
    }

    if (uniquePages.length !== pages.length) {
      console.info(
        `📎 Removed ${pages.length - uniquePages.length} duplicate pages.`
      );
    }

    console.log(
      `✅ Final album: ${uniquePages.length} pages, ${seenSignatures.size} unique pages`
    );

    return uniquePages;
  } catch (error) {
    console.error("Error in AI layout generation:", error);
    return generateAlbumPagesDeterministic(photos);
  }
}

function processAIPlan(aiPlan: AILayoutPlan, photos: Photo[]): AlbumPage[] {
  console.log("🤖 ========== PROCESSING AI PLAN ==========");
  console.log(`📄 AI plan has ${aiPlan.pages.length} pages`);

  const pages: AlbumPage[] = [];
  const photosMap = new Map(photos.map((p) => [normalizeId(p.id), p]));
  const usedPhotoIds = new Set<string>();

  // Process each page from AI plan
  for (let pageIdx = 0; pageIdx < aiPlan.pages.length; pageIdx++) {
    const pagePlan = aiPlan.pages[pageIdx];
    const layoutName = pagePlan.layout_to_use;
    const layout = layoutsMetadata[layoutName as keyof typeof layoutsMetadata];
    const templateSvg = layoutTemplates[layoutName];

    if (!layout || !templateSvg) {
      console.warn(
        `⚠️ Page ${pageIdx}: Layout ${layoutName} not found, skipping`
      );
      continue;
    }

    console.log(
      `\n📄 Processing page ${pageIdx}: ${layoutName} (needs ${layout.frameCount} photos)`
    );

    const validAssignments: Array<{ frameNumber: number; photoId: string }> =
      [];
    const pagePhotoIds = new Set<string>();

    for (const frame of pagePlan.frames) {
      const photo = photosMap.get(normalizeId(frame.image_id));
      if (!photo) {
        console.warn(`⚠️ Page ${pageIdx}: Photo ${frame.image_id} not found`);
        continue;
      }

      if (usedPhotoIds.has(frame.image_id)) {
        console.warn(
          `⚠️ Page ${pageIdx}: Photo ${frame.image_id} already used globally, skipping`
        );
        continue;
      }

      if (pagePhotoIds.has(frame.image_id)) {
        console.warn(
          `⚠️ Page ${pageIdx}: Photo ${frame.image_id} already used on this page, skipping`
        );
        continue;
      }

      // Validate frame number
      if (frame.frame_number < 1 || frame.frame_number > layout.frameCount) {
        console.warn(
          `⚠️ Invalid frame number ${frame.frame_number} for ${layoutName}`
        );
        continue;
      }

      const frameData = layout.frames.find((f) => f.id === frame.frame_number);
      if (frameData) {
        const photoAspect = photo.aspectRatio || 1;
        const frameAspect = frameData.aspect_ratio;
        const aspectDiff = Math.abs(photoAspect - frameAspect);

        const isLandscapePhoto = photoAspect > 1.2;
        const isPortraitFrame = frameAspect < 0.85;

        if (isLandscapePhoto && isPortraitFrame) {
          console.warn(
            `⚠️ CROPPING RISK: Landscape photo ${
              frame.image_id
            } (aspect ${photoAspect.toFixed(2)}) ` +
              `in portrait frame (aspect ${frameAspect.toFixed(
                2
              )}) - likely group photo that will crop people!`
          );
          continue;
        }

        if (aspectDiff > 0.35) {
          console.warn(
            `⚠️ SEVERE CROPPING RISK: Photo ${
              frame.image_id
            } (aspect ${photoAspect.toFixed(2)}) ` +
              `vs frame (aspect ${frameAspect.toFixed(
                2
              )}) - diff ${aspectDiff.toFixed(2)} too large`
          );
          continue;
        }

        if (!isGoodAspectMatch(photoAspect, frameData.aspect_ratio)) {
          console.warn(
            `⚠️ Poor aspect match: photo ${photoAspect.toFixed(
              2
            )} vs frame ${frameData.aspect_ratio.toFixed(2)}`
          );
          continue;
        }
      }

      validAssignments.push({
        frameNumber: frame.frame_number,
        photoId: frame.image_id,
      });
      pagePhotoIds.add(frame.image_id);
    }

    // Only create page if we have the right number of photos
    // Only create page if we have the right number of photos (with smarter partial acceptance)
    const MIN_ACCEPT_RATIO = 0.6; // accept if at least 60% of frames filled

    if (validAssignments.length === layout.frameCount) {
      const page = createPage(
        pageIdx,
        layoutName,
        templateSvg,
        validAssignments,
        photosMap
      );
      if (page) {
        // validate SVG image injection
        const expectedFrameCount =
          layout.frameCount || (page.photoIds ? page.photoIds.length : 0);
        if (!svgHasAllImages(page.svgContent, expectedFrameCount)) {
          console.warn(
            `🚫 Skipping page ${pageIdx} due to missing/invalid image injection`,
            {
              layoutName,
              pagePhotoIds: page.photoIds,
            }
          );
        } else {
          pages.push(page);
          validAssignments.forEach((a) => usedPhotoIds.add(a.photoId));
          console.log(
            `✅ Page ${pageIdx}: Created successfully with ${validAssignments.length} photos`
          );
        }
      }
    } else if (
      validAssignments.length >= Math.ceil(layout.frameCount * MIN_ACCEPT_RATIO)
    ) {
      // partial page: attempt to fill remaining frames
      const remainingFramesCount = layout.frameCount - validAssignments.length;
      const remainingPhotos = photos.filter(
        (p) =>
          !usedPhotoIds.has(p.id) &&
          !validAssignments.some((a) => a.photoId === p.id)
      );
      const fill = remainingPhotos
        .slice(0, remainingFramesCount)
        .map((p, idx) => ({
          frameNumber: (
            layout.frames.find(
              (f) => !validAssignments.some((a) => a.frameNumber === f.id)
            ) || { id: validAssignments.length + idx + 1 }
          ).id,
          photoId: p.id,
        }));
      const combinedAssignments = [...validAssignments, ...fill];
      const page = createPage(
        pageIdx,
        layoutName,
        templateSvg,
        combinedAssignments,
        photosMap
      );
      if (page) {
        const expectedFrameCount = combinedAssignments.length;
        if (!svgHasAllImages(page.svgContent, expectedFrameCount)) {
          console.warn(
            `🚫 Skipping partial page ${pageIdx} due to missing/invalid image injection`,
            {
              layoutName,
              attempted: combinedAssignments.map((a) => a.photoId),
            }
          );
        } else {
          pages.push(page);
          combinedAssignments.forEach((a) => usedPhotoIds.add(a.photoId));
          console.log(
            `⚡ Partial page ${pageIdx}: Created with ${combinedAssignments.length}/${layout.frameCount} photos`
          );
        }
      }
    } else {
      console.warn(
        `⚠️ Page ${pageIdx}: Skipped - expected ${layout.frameCount} photos, got ${validAssignments.length}`
      );
      console.warn(
        `⚠️ Page ${pageIdx}: Photos that were attempted:`,
        Array.from(pagePhotoIds)
      );
    }
  }

  console.log(`\n📊 AI Plan Processing Complete:`);
  console.log(`   - Pages created: ${pages.length}`);
  console.log(`   - Photos used: ${usedPhotoIds.size}/${photos.length}`);

  const unassignedPhotos = photos.filter((p) => !usedPhotoIds.has(p.id));

  if (unassignedPhotos.length > 0) {
    console.log(`\n♻️ ========== CREATING FALLBACK PAGES ==========`);
    console.log(`📸 Unassigned photos: ${unassignedPhotos.length}`);
    console.log(
      `📸 Unassigned photo IDs:`,
      unassignedPhotos.map((p) => p.id)
    );

    const fallbackPages = generateAlbumPagesDeterministic(
      unassignedPhotos,
      usedPhotoIds
    );

    console.log(`✅ Created ${fallbackPages.length} fallback pages`);

    pages.push(
      ...fallbackPages.map((p, idx) => ({
        ...p,
        id: `page-${pages.length + idx}`,
        pageNumber: pages.length + idx,
      }))
    );
  } else {
    console.log(`\n✅ All photos assigned, no fallback pages needed`);
  }

  console.log(`\n📊 Final Result:`);
  console.log(`   - Total pages: ${pages.length}`);
  console.log(`   - Total photos used: ${usedPhotoIds.size}/${photos.length}`);

  return pages;
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
 * Deterministic fallback layout generation
 * Guarantees all photos are used exactly once
 */
export function generateAlbumPagesDeterministic(
  photos: Photo[],
  existingUsedPhotoIds?: Set<string>
): AlbumPage[] {
  console.log(`\n🔧 ========== DETERMINISTIC GENERATION ==========`);
  console.log(`📸 Photos to process: ${photos.length}`);
  console.log(`📸 Already used: ${existingUsedPhotoIds?.size || 0}`);

  const pages: AlbumPage[] = [];
  const usedPhotoIds = existingUsedPhotoIds || new Set<string>();
  const photosMap = new Map(photos.map((p) => [p.id, p]));

  // Sort layouts by frame count (prefer larger layouts)
  const sortedLayouts = Object.entries(layoutsMetadata).sort(
    (a, b) => b[1].frameCount - a[1].frameCount
  );

  let attempts = 0;
  const maxAttempts = photos.length * 2;

  while (
    usedPhotoIds.size < photos.length + (existingUsedPhotoIds?.size || 0) &&
    attempts < maxAttempts
  ) {
    attempts++;

    const remainingPhotos = photos.filter((p) => !usedPhotoIds.has(p.id));

    if (remainingPhotos.length === 0) break;

    console.log(
      `\n🔄 Attempt ${attempts}: ${remainingPhotos.length} photos remaining`
    );

    // Try each layout
    let pageCreated = false;
    for (const [layoutName, layout] of sortedLayouts) {
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
          console.log(
            `✅ Created page with ${layoutName} (${assignments.length} photos)`
          );
          pageCreated = true;
          break;
        }
      }
    }

    // If no layout worked, use single-photo layout
    if (!pageCreated && remainingPhotos.length > 0) {
      const photo = remainingPhotos[0];
      const layoutName = "layout19.svg";
      const templateSvg = layoutTemplates[layoutName];

      console.log(
        `⚠️ No layout matched, using single-photo layout for ${photo.id}`
      );

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
        console.log(`✅ Created single-photo page`);
      } else {
        console.error(`❌ Failed to create single-photo page for ${photo.id}`);
        break; // Prevent infinite loop
      }
    }
  }

  const finalUsedCount = Array.from(usedPhotoIds).filter((id) =>
    photos.some((p) => p.id === id)
  ).length;

  console.log(`\n📊 Deterministic Generation Complete:`);
  console.log(`   - Pages created: ${pages.length}`);
  console.log(`   - Photos used: ${finalUsedCount}/${photos.length}`);
  console.log(`   - Attempts: ${attempts}`);

  return pages;
}

// Simple client-side layout generation (legacy fallback)
export function generateAlbumPages(photos: Photo[]): AlbumPage[] {
  return generateAlbumPagesDeterministic(photos);
}
