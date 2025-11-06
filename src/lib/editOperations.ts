import type { AlbumPage, Photo } from "./types";
import { injectImagesIntoSVG, uniquifySVGIds } from "./svgUtils";

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

/**
 * Swap two photos within the same page or across pages
 */
export function swapPhotos(
  pages: AlbumPage[],
  sourcePageIndex: number,
  sourceFrameIndex: number,
  targetPageIndex: number,
  targetFrameIndex: number,
  photos: Photo[]
): AlbumPage[] {
  const newPages = [...pages];
  const sourcePage = newPages[sourcePageIndex];
  const targetPage = newPages[targetPageIndex];

  // Extract photo IDs from current pages
  const sourcePhotoIds = extractPhotoIdsFromPage(sourcePage);
  const targetPhotoIds = extractPhotoIdsFromPage(targetPage);

  // Swap the photo IDs
  const temp = sourcePhotoIds[sourceFrameIndex];
  sourcePhotoIds[sourceFrameIndex] = targetPhotoIds[targetFrameIndex];
  targetPhotoIds[targetFrameIndex] = temp;

  // Regenerate SVGs with swapped photos
  const sourcePhotos = sourcePhotoIds
    .map((id) => photos.find((p) => p.id === id)!)
    .filter(Boolean);
  const targetPhotos = targetPhotoIds
    .map((id) => photos.find((p) => p.id === id)!)
    .filter(Boolean);

  const layoutTemplate = layoutTemplates[sourcePage.layoutName];
  const uniqueSVG = uniquifySVGIds(layoutTemplate, sourcePage.id);
  const sourcePhotosMap = new Map(sourcePhotos.map((p) => [p.id, p]));
  const sourceAssignments = sourcePhotoIds.map((id, idx) => ({
    frameNumber: idx + 1,
    photoId: id,
  }));

  newPages[sourcePageIndex] = {
    ...sourcePage,
    svgContent: injectImagesIntoSVG(
      uniqueSVG,
      sourceAssignments,
      sourcePhotosMap
    ),
    photoIds: sourcePhotoIds,
  };

  if (sourcePageIndex !== targetPageIndex) {
    const targetLayoutTemplate = layoutTemplates[targetPage.layoutName];
    const targetUniqueSVG = uniquifySVGIds(targetLayoutTemplate, targetPage.id);
    const targetPhotosMap = new Map(targetPhotos.map((p) => [p.id, p]));
    const targetAssignments = targetPhotoIds.map((id, idx) => ({
      frameNumber: idx + 1,
      photoId: id,
    }));

    newPages[targetPageIndex] = {
      ...targetPage,
      svgContent: injectImagesIntoSVG(
        targetUniqueSVG,
        targetAssignments,
        targetPhotosMap
      ),
      photoIds: targetPhotoIds,
    };
  }

  return newPages;
}

/**
 * Change the layout of a specific page
 */
export function changePageLayout(
  pages: AlbumPage[],
  pageIndex: number,
  newLayoutName: string,
  photos: Photo[]
): AlbumPage[] {
  const newPages = [...pages];
  const page = newPages[pageIndex];
  const photoIds = extractPhotoIdsFromPage(page);
  const pagePhotos = photoIds
    .map((id) => photos.find((p) => p.id === id)!)
    .filter(Boolean);

  const layoutTemplate = layoutTemplates[newLayoutName];
  if (!layoutTemplate) {
    console.error(`Layout ${newLayoutName} not found`);
    return pages;
  }

  const uniqueSVG = uniquifySVGIds(layoutTemplate, page.id);
  const photosMap = new Map(pagePhotos.map((p) => [p.id, p]));
  const assignments = photoIds.map((id, idx) => ({
    frameNumber: idx + 1,
    photoId: id,
  }));

  newPages[pageIndex] = {
    ...page,
    layoutName: newLayoutName,
    svgContent: injectImagesIntoSVG(uniqueSVG, assignments, photosMap),
    photoIds,
  };

  return newPages;
}

/**
 * Reorder pages
 */
export function reorderPages(
  pages: AlbumPage[],
  fromIndex: number,
  toIndex: number
): AlbumPage[] {
  const newPages = [...pages];
  const [movedPage] = newPages.splice(fromIndex, 1);
  newPages.splice(toIndex, 0, movedPage);

  // Update page numbers
  return newPages.map((page, index) => ({
    ...page,
    pageNumber: index + 1,
  }));
}

/**
 * Delete a page
 */
export function deletePage(pages: AlbumPage[], pageIndex: number): AlbumPage[] {
  const newPages = pages.filter((_, index) => index !== pageIndex);

  // Update page numbers
  return newPages.map((page, index) => ({
    ...page,
    pageNumber: index + 1,
  }));
}

/**
 * Duplicate a page
 */
export function duplicatePage(
  pages: AlbumPage[],
  pageIndex: number
): AlbumPage[] {
  const pageToDuplicate = pages[pageIndex];
  const newPage: AlbumPage = {
    ...pageToDuplicate,
    id: `page-${Date.now()}-${Math.random()}`,
    pageNumber: pageIndex + 2,
  };

  const newPages = [...pages];
  newPages.splice(pageIndex + 1, 0, newPage);

  // Update page numbers
  return newPages.map((page, index) => ({
    ...page,
    pageNumber: index + 1,
  }));
}

/**
 * Extract photo IDs from a page's SVG content
 */
function extractPhotoIdsFromPage(page: AlbumPage): string[] {
  // Parse SVG to extract href attributes from image tags
  const parser = new DOMParser();
  const doc = parser.parseFromString(page.svgContent, "image/svg+xml");
  const images = doc.querySelectorAll("image");

  const photoIds: string[] = [];
  images.forEach((img) => {
    const href = img.getAttribute("href") || img.getAttribute("xlink:href");
    if (href) {
      // Extract photo ID from blob URL if possible
      // For now, use the page's photoIds if available
      photoIds.push(href);
    }
  });

  // Fallback to photoIds property if available
  return page.photoIds || photoIds;
}

/**
 * Move a photo from one page to another with automatic layout adjustment
 * When moving a photo between pages, automatically adjusts layouts to accommodate the new frame counts
 */
export function movePhotoWithLayoutAdjustment(
  pages: AlbumPage[],
  sourcePageIndex: number,
  sourceFrameIndex: number,
  targetPageIndex: number,
  targetFrameIndex: number,
  photos: Photo[]
): AlbumPage[] {
  const newPages = [...pages];
  const sourcePage = newPages[sourcePageIndex];
  const targetPage = newPages[targetPageIndex];

  // Extract photo IDs
  const sourcePhotoIds = extractPhotoIdsFromPage(sourcePage);
  const targetPhotoIds = extractPhotoIdsFromPage(targetPage);

  // Remove photo from source page
  const movedPhotoId = sourcePhotoIds[sourceFrameIndex];
  sourcePhotoIds.splice(sourceFrameIndex, 1);

  // Add photo to target page at the target position
  targetPhotoIds.splice(targetFrameIndex, 0, movedPhotoId);

  const sourcePhotos = sourcePhotoIds
    .map((id) => photos.find((p) => p.id === id)!)
    .filter(Boolean);
  const targetPhotos = targetPhotoIds
    .map((id) => photos.find((p) => p.id === id)!)
    .filter(Boolean);

  // Find appropriate layouts for new frame counts
  const sourceLayoutName = findBestLayout(sourcePhotos);
  const targetLayoutName = findBestLayout(targetPhotos);

  // Regenerate source page with new layout
  const sourceLayoutTemplate = layoutTemplates[sourceLayoutName];
  const sourceUniqueSVG = uniquifySVGIds(sourceLayoutTemplate, sourcePage.id);
  const sourcePhotosMap = new Map(sourcePhotos.map((p) => [p.id, p]));
  const sourceAssignments = sourcePhotoIds.map((id, idx) => ({
    frameNumber: idx + 1,
    photoId: id,
  }));

  newPages[sourcePageIndex] = {
    ...sourcePage,
    layoutName: sourceLayoutName,
    svgContent: injectImagesIntoSVG(
      sourceUniqueSVG,
      sourceAssignments,
      sourcePhotosMap
    ),
    photoIds: sourcePhotoIds,
  };

  // Regenerate target page with new layout
  const targetLayoutTemplate = layoutTemplates[targetLayoutName];
  const targetUniqueSVG = uniquifySVGIds(targetLayoutTemplate, targetPage.id);
  const targetPhotosMap = new Map(targetPhotos.map((p) => [p.id, p]));
  const targetAssignments = targetPhotoIds.map((id, idx) => ({
    frameNumber: idx + 1,
    photoId: id,
  }));

  newPages[targetPageIndex] = {
    ...targetPage,
    layoutName: targetLayoutName,
    svgContent: injectImagesIntoSVG(
      targetUniqueSVG,
      targetAssignments,
      targetPhotosMap
    ),
    photoIds: targetPhotoIds,
  };

  return newPages;
}

/**
 * Find an appropriate layout for a given frame count
 */
function findLayoutForFrameCount(frameCount: number): string {
  const layoutsByFrameCount: Record<number, string[]> = {
    1: ["layout19.svg"],
    2: ["layout20.svg", "layout21.svg"],
    3: ["layout22.svg", "layout23.svg", "layout24.svg"],
    4: ["layout11.svg", "layout13.svg", "layout14.svg"],
    5: [
      "layout8.svg",
      "layout9.svg",
      "layout10.svg",
      "layout12.svg",
      "layout15.svg",
      "layout16.svg",
    ],
    6: ["layout17.svg", "layout18.svg"],
  };

  const availableLayouts = layoutsByFrameCount[frameCount];
  if (!availableLayouts || availableLayouts.length === 0) {
    return "layout11.svg";
  }

  return availableLayouts[0];
}

const layoutMetadata: Record<
  string,
  { slots: number; orientations: ("landscape" | "portrait" | "square")[] }
> = {
  "layout8.svg": {
    slots: 5,
    orientations: [
      "landscape",
      "landscape",
      "portrait",
      "portrait",
      "portrait",
    ],
  },
  "layout9.svg": {
    slots: 5,
    orientations: [
      "landscape",
      "landscape",
      "landscape",
      "landscape",
      "landscape",
    ],
  },
  "layout10.svg": {
    slots: 5,
    orientations: [
      "landscape",
      "landscape",
      "landscape",
      "landscape",
      "landscape",
    ],
  },
  "layout11.svg": {
    slots: 4,
    orientations: ["square", "square", "landscape", "landscape"],
  },
  "layout12.svg": {
    slots: 5,
    orientations: [
      "portrait",
      "portrait",
      "portrait",
      "landscape",
      "landscape",
    ],
  },
  "layout13.svg": {
    slots: 4,
    orientations: ["square", "square", "square", "square"],
  },
  "layout14.svg": {
    slots: 4,
    orientations: ["portrait", "square", "square", "square"],
  },
  "layout15.svg": {
    slots: 5,
    orientations: [
      "square",
      "landscape",
      "landscape",
      "landscape",
      "landscape",
    ],
  },
  "layout16.svg": {
    slots: 5,
    orientations: [
      "landscape",
      "portrait",
      "portrait",
      "portrait",
      "landscape",
    ],
  },
  "layout17.svg": {
    slots: 6,
    orientations: [
      "landscape",
      "landscape",
      "landscape",
      "landscape",
      "square",
      "square",
    ],
  },
  "layout18.svg": {
    slots: 6,
    orientations: [
      "portrait",
      "portrait",
      "portrait",
      "landscape",
      "portrait",
      "portrait",
    ],
  },
  "layout19.svg": { slots: 1, orientations: ["portrait"] },
  "layout20.svg": { slots: 2, orientations: ["portrait", "portrait"] },
  "layout21.svg": { slots: 2, orientations: ["landscape", "landscape"] },
  "layout22.svg": {
    slots: 3,
    orientations: ["portrait", "portrait", "portrait"],
  },
  "layout23.svg": {
    slots: 3,
    orientations: ["portrait", "portrait", "portrait"],
  },
  "layout24.svg": {
    slots: 3,
    orientations: ["portrait", "portrait", "portrait"],
  },
};

/**
 * Find the best layout for a given set of photos based on their orientations.
 */
function findBestLayout(photos: Photo[]): string {
  const frameCount = photos.length;

  if (frameCount < 1) {
    console.log("[v0] No photos, using layout19.svg");
    return "layout19.svg";
  }

  const photoOrientations = photos.map((p) => p.orientation);

  const layoutsByFrameCount: Record<number, string[]> = {
    1: ["layout19.svg"],
    2: ["layout20.svg", "layout21.svg"],
    3: ["layout22.svg", "layout23.svg", "layout24.svg"],
    4: ["layout11.svg", "layout13.svg", "layout14.svg"],
    5: [
      "layout8.svg",
      "layout9.svg",
      "layout10.svg",
      "layout12.svg",
      "layout15.svg",
      "layout16.svg",
    ],
    6: ["layout17.svg", "layout18.svg"],
  };

  const availableLayouts = layoutsByFrameCount[frameCount];
  if (!availableLayouts || availableLayouts.length === 0) {
    const closestCount = Object.keys(layoutsByFrameCount)
      .map(Number)
      .reduce((prev, curr) =>
        Math.abs(curr - frameCount) < Math.abs(prev - frameCount) ? curr : prev
      );
    return layoutsByFrameCount[closestCount][0];
  }

  let bestLayout = availableLayouts[0];
  let bestScore = -1;

  for (const layoutName of availableLayouts) {
    const metadata = layoutMetadata[layoutName];
    if (!metadata) continue;

    let score = 0;
    const layoutOrientations = metadata.orientations;

    for (
      let i = 0;
      i < Math.min(photoOrientations.length, layoutOrientations.length);
      i++
    ) {
      if (photoOrientations[i] === layoutOrientations[i]) {
        score += 2;
      } else if (
        (photoOrientations[i] === "square" &&
          layoutOrientations[i] !== "square") ||
        (photoOrientations[i] !== "square" &&
          layoutOrientations[i] === "square")
      ) {
        score += 1;
      }
    }

    if (score > bestScore) {
      bestScore = score;
      bestLayout = layoutName;
    }
  }

  console.log(
    "[v0] Selected layout:",
    bestLayout,
    "for",
    frameCount,
    "photos with score:",
    bestScore
  );
  return bestLayout;
}
