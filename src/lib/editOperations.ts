import { AlbumPage, Photo } from './types';
import { injectImagesIntoSVG, uniquifySVGIds } from './svgUtils';

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
  const sourcePhotos = sourcePhotoIds.map(id => photos.find(p => p.id === id)!).filter(Boolean);
  const targetPhotos = targetPhotoIds.map(id => photos.find(p => p.id === id)!).filter(Boolean);

  const layoutTemplate = layoutTemplates[sourcePage.layoutName];
  const uniqueSVG = uniquifySVGIds(layoutTemplate, sourcePage.id);
  const sourcePhotosMap = new Map(sourcePhotos.map(p => [p.id, p]));
  const sourceAssignments = sourcePhotoIds.map((id, idx) => ({ frameNumber: idx + 1, photoId: id }));
  
  newPages[sourcePageIndex] = {
    ...sourcePage,
    svgContent: injectImagesIntoSVG(uniqueSVG, sourceAssignments, sourcePhotosMap),
    photoIds: sourcePhotoIds,
  };

  if (sourcePageIndex !== targetPageIndex) {
    const targetLayoutTemplate = layoutTemplates[targetPage.layoutName];
    const targetUniqueSVG = uniquifySVGIds(targetLayoutTemplate, targetPage.id);
    const targetPhotosMap = new Map(targetPhotos.map(p => [p.id, p]));
    const targetAssignments = targetPhotoIds.map((id, idx) => ({ frameNumber: idx + 1, photoId: id }));
    
    newPages[targetPageIndex] = {
      ...targetPage,
      svgContent: injectImagesIntoSVG(targetUniqueSVG, targetAssignments, targetPhotosMap),
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
  const pagePhotos = photoIds.map(id => photos.find(p => p.id === id)!).filter(Boolean);

  const layoutTemplate = layoutTemplates[newLayoutName];
  if (!layoutTemplate) {
    console.error(`Layout ${newLayoutName} not found`);
    return pages;
  }

  const uniqueSVG = uniquifySVGIds(layoutTemplate, page.id);
  const photosMap = new Map(pagePhotos.map(p => [p.id, p]));
  const assignments = photoIds.map((id, idx) => ({ frameNumber: idx + 1, photoId: id }));
  
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
export function reorderPages(pages: AlbumPage[], fromIndex: number, toIndex: number): AlbumPage[] {
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
export function duplicatePage(pages: AlbumPage[], pageIndex: number): AlbumPage[] {
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
  const doc = parser.parseFromString(page.svgContent, 'image/svg+xml');
  const images = doc.querySelectorAll('image');
  
  const photoIds: string[] = [];
  images.forEach(img => {
    const href = img.getAttribute('href') || img.getAttribute('xlink:href');
    if (href) {
      // Extract photo ID from blob URL if possible
      // For now, use the page's photoIds if available
      photoIds.push(href);
    }
  });

  // Fallback to photoIds property if available
  return page.photoIds || photoIds;
}
