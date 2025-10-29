import { Photo } from './types';

/**
 * Makes all IDs in an SVG unique by appending a suffix
 * This prevents ID conflicts when multiple pages are rendered
 */
export function uniquifySVGIds(svgContent: string, suffix: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  
  // Find all elements with IDs
  const elementsWithIds = doc.querySelectorAll('[id]');
  const idMap = new Map<string, string>();
  
  elementsWithIds.forEach(el => {
    const oldId = el.getAttribute('id');
    if (oldId) {
      const newId = `${oldId}_${suffix}`;
      idMap.set(oldId, newId);
      el.setAttribute('id', newId);
    }
  });
  
  // Update all references to these IDs
  idMap.forEach((newId, oldId) => {
    // Update href references
    doc.querySelectorAll(`[href="#${oldId}"]`).forEach(ref => {
      ref.setAttribute('href', `#${newId}`);
    });
    
    // Update xlink:href references
    doc.querySelectorAll(`[*|href="#${oldId}"]`).forEach(ref => {
      ref.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', `#${newId}`);
    });
    
    // Update clip-path references
    doc.querySelectorAll(`[clip-path="url(#${oldId})"]`).forEach(ref => {
      ref.setAttribute('clip-path', `url(#${newId})`);
    });
    
    // Update fill references (for patterns)
    doc.querySelectorAll(`[fill="url(#${oldId})"]`).forEach(ref => {
      ref.setAttribute('fill', `url(#${newId})`);
    });
  });
  
  return new XMLSerializer().serializeToString(doc);
}

/**
 * Injects photo URLs into SVG pattern elements
 */
export function injectImagesIntoSVG(
  svgContent: string,
  photoAssignments: Array<{ frameNumber: number; photoId: string }>,
  photosMap: Map<string, Photo>
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  
  photoAssignments.forEach(assignment => {
    const photo = photosMap.get(assignment.photoId);
    if (!photo) {
      console.warn(`Photo not found: ${assignment.photoId}`);
      return;
    }
    
    // Try multiple pattern naming conventions
    // Standard: img1, img2, etc.
    // Alternative: modern-img-1, frame-1, etc.
    let pattern = doc.querySelector(`pattern[id^="img${assignment.frameNumber}"]`);
    
    // If not found, try with dash separator
    if (!pattern) {
      pattern = doc.querySelector(`pattern[id$="-${assignment.frameNumber}"]`);
    }
    
    // If still not found, get all patterns and match by index
    if (!pattern) {
      const allPatterns = Array.from(doc.querySelectorAll('pattern'));
      pattern = allPatterns[assignment.frameNumber - 1];
    }
    
    if (!pattern) {
      console.warn(`Pattern not found for frame ${assignment.frameNumber}`);
      return;
    }
    
    const imageEl = pattern.querySelector('image');
    if (imageEl) {
      imageEl.setAttribute('href', photo.url);
      imageEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', photo.url);
    } else {
      console.warn(`No image element in pattern for frame ${assignment.frameNumber}`);
    }
  });
  
  return new XMLSerializer().serializeToString(doc);
}

/**
 * Replaces an image in a specific frame
 */
export function replaceSVGImage(
  svgContent: string,
  frameId: string,
  newImageUrl: string
): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  
  // Find the pattern with this ID
  const pattern = doc.querySelector(`pattern[id*="${frameId}"]`);
  if (!pattern) return svgContent;
  
  const imageEl = pattern.querySelector('image');
  if (imageEl) {
    imageEl.setAttribute('href', newImageUrl);
    imageEl.setAttributeNS('http://www.w3.org/1999/xlink', 'xlink:href', newImageUrl);
  }
  
  return new XMLSerializer().serializeToString(doc);
}

/**
 * Updates the background color of an SVG
 */
export function updateSVGBackground(svgContent: string, color: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  
  const svg = doc.querySelector('svg');
  if (svg) {
    svg.style.backgroundColor = color;
  }
  
  return new XMLSerializer().serializeToString(doc);
}

/**
 * Parses SVG to extract frame information
 */
export function parseSVGFrames(svgContent: string): Array<{ frameId: string; frameNumber: number }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, 'image/svg+xml');
  
  const frames: Array<{ frameId: string; frameNumber: number }> = [];
  const patterns = doc.querySelectorAll('pattern[id^="img"]');
  
  patterns.forEach(pattern => {
    const id = pattern.getAttribute('id');
    if (id) {
      const match = id.match(/img(\d+)/);
      if (match) {
        frames.push({
          frameId: id,
          frameNumber: parseInt(match[1], 10)
        });
      }
    }
  });
  
  return frames.sort((a, b) => a.frameNumber - b.frameNumber);
}
