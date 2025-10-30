import { Photo } from './types';

/**
 * Determines optimal preserveAspectRatio based on photo-to-frame fit
 * Uses aggressive slice approach to fill frames edge-to-edge like professional layouts
 */
function getOptimalPreserveAspectRatio(
  photoAspect: number,
  frameAspect: number
): string {
  const aspectDiff = Math.abs(photoAspect - frameAspect);
  
  // Good match (< 0.4 difference): use slice to fill frame completely
  // Trust AI to place photos in appropriate frames, so this should look good
  if (aspectDiff < 0.4) {
    return 'xMidYMid slice';
  }
  
  // Poor match (0.4-0.5): Still use slice but might have some crop
  // Better to fill frame than show white borders
  if (aspectDiff < 0.5) {
    // For orientation matches (both portrait or both landscape), use slice
    const bothPortrait = photoAspect < 1 && frameAspect < 1;
    const bothLandscape = photoAspect > 1 && frameAspect > 1;
    
    if (bothPortrait || bothLandscape) {
      return 'xMidYMid slice';
    }
    
    // Orientation mismatch - use meet to avoid extreme cropping
    return 'xMidYMid meet';
  }
  
  // Severe mismatch - this shouldn't happen if AI is working correctly
  // But if it does, prioritize showing important content
  if (photoAspect < frameAspect) {
    // Portrait in landscape frame - show top portion (faces) with center horizontal alignment
    return 'xMidYMin slice';
  } else {
    // Landscape in portrait frame - center both ways and show full image
    return 'xMidYMid meet';
  }
}

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
      
      // Smart aspect ratio handling based on photo-to-frame fit
      // Get frame dimensions from pattern attributes to calculate frame aspect ratio
      const patternWidth = parseFloat(pattern.getAttribute('width') || '1');
      const patternHeight = parseFloat(pattern.getAttribute('height') || '1');
      const frameAspect = patternWidth / patternHeight;
      const photoAspect = photo.aspectRatio || 1;
      
      const optimalPreserveAspectRatio = getOptimalPreserveAspectRatio(photoAspect, frameAspect);
      imageEl.setAttribute('preserveAspectRatio', optimalPreserveAspectRatio);
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
    
    // Apply smart aspect ratio handling
    // Note: We don't have photo metadata here, so we use a balanced approach
    // In the future, this could be enhanced to accept photo metadata
    imageEl.setAttribute('preserveAspectRatio', 'xMidYMid meet');
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
