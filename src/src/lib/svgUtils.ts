import type { Photo, FrameCoordinates } from "./types";

/**
 * Determines optimal preserveAspectRatio to fill frame completely
 * Uses 'slice' to crop image to fill frame - perfect for photo albums
 */
function getOptimalPreserveAspectRatio(
  photoAspect: number,
  frameAspect: number
): string {
  return "xMidYMid slice";
}

/**
 * Makes all IDs in an SVG unique by appending a suffix
 * This prevents ID conflicts when multiple pages are rendered
 */
export function uniquifySVGIds(svgContent: string, suffix: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");

  // Find all elements with IDs
  const elementsWithIds = doc.querySelectorAll("[id]");
  const idMap = new Map<string, string>();

  elementsWithIds.forEach((el) => {
    const oldId = el.getAttribute("id");
    if (oldId) {
      const newId = `${oldId}_${suffix}`;
      idMap.set(oldId, newId);
      el.setAttribute("id", newId);
    }
  });

  // Update all references to these IDs
  idMap.forEach((newId, oldId) => {
    // Update href references
    doc.querySelectorAll(`[href="#${oldId}"]`).forEach((ref) => {
      ref.setAttribute("href", `#${newId}`);
    });

    // Update xlink:href references
    doc.querySelectorAll(`[*|href="#${oldId}"]`).forEach((ref) => {
      ref.setAttributeNS(
        "http://www.w3.org/1999/xlink",
        "xlink:href",
        `#${newId}`
      );
    });

    // Update clip-path references
    doc.querySelectorAll(`[clip-path="url(#${oldId})"]`).forEach((ref) => {
      ref.setAttribute("clip-path", `url(#${newId})`);
    });

    // Update fill references (for patterns)
    doc.querySelectorAll(`[fill="url(#${oldId})"]`).forEach((ref) => {
      ref.setAttribute("fill", `url(#${newId})`);
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
  console.log("[v0] injectImagesIntoSVG called with:", {
    photoAssignmentsCount: photoAssignments.length,
    photosMapSize: photosMap.size,
    assignments: photoAssignments.map((a) => ({
      frame: a.frameNumber,
      photoId: a.photoId,
    })),
  });

  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");

  const allPatterns = Array.from(doc.querySelectorAll("pattern"));
  console.log("[v0] Total patterns found in SVG:", allPatterns.length);

  photoAssignments.forEach((assignment) => {
    const photo = photosMap.get(assignment.photoId);
    if (!photo) {
      console.warn(`[v0] Photo not found: ${assignment.photoId}`);
      return;
    }

    let pattern = doc.querySelector(
      `pattern[id^="img${assignment.frameNumber}"]`
    );

    if (!pattern) {
      pattern = doc.querySelector(`pattern[id$="-${assignment.frameNumber}"]`);
    }

    if (!pattern) {
      pattern = allPatterns[assignment.frameNumber - 1];
    }

    if (!pattern) {
      console.warn(
        `[v0] Pattern not found for frame ${assignment.frameNumber}`
      );
      console.log(
        "[v0] Available pattern IDs:",
        allPatterns.map((p) => p.getAttribute("id"))
      );
      return;
    }

    console.log(
      `[v0] Found pattern for frame ${assignment.frameNumber}:`,
      pattern.getAttribute("id")
    );

    const imageEl = pattern.querySelector("image");
    if (imageEl) {
      imageEl.setAttribute("href", photo.url);
      imageEl.setAttributeNS(
        "http://www.w3.org/1999/xlink",
        "xlink:href",
        photo.url
      );

      console.log(
        `[v0] Injected image into frame ${assignment.frameNumber}:`,
        photo.url.substring(0, 50)
      );

      imageEl.setAttribute("preserveAspectRatio", "xMidYMid slice");
    } else {
      console.warn(
        `[v0] No image element in pattern for frame ${assignment.frameNumber}`
      );
    }
  });

  console.log(
    "[v0] Image injection complete. Processed",
    photoAssignments.length,
    "assignments"
  );

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
  const doc = parser.parseFromString(svgContent, "image/svg+xml");

  // Find the pattern with this ID
  const pattern = doc.querySelector(`pattern[id*="${frameId}"]`);
  if (!pattern) return svgContent;

  const imageEl = pattern.querySelector("image");
  if (imageEl) {
    imageEl.setAttribute("href", newImageUrl);
    imageEl.setAttributeNS(
      "http://www.w3.org/1999/xlink",
      "xlink:href",
      newImageUrl
    );

    // Show full image without cropping for album viewing
    imageEl.setAttribute("preserveAspectRatio", "xMidYMid slice");
  }

  return new XMLSerializer().serializeToString(doc);
}

/**
 * Updates the background color of an SVG
 */
export function updateSVGBackground(svgContent: string, color: string): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");

  const svg = doc.querySelector("svg");
  if (svg) {
    svg.style.backgroundColor = color;
  }

  return new XMLSerializer().serializeToString(doc);
}

/**
 * Parses SVG to extract frame information
 */
export function parseSVGFrames(
  svgContent: string
): Array<{ frameId: string; frameNumber: number }> {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");

  const frames: Array<{ frameId: string; frameNumber: number }> = [];
  const patterns = doc.querySelectorAll('pattern[id^="img"]');

  patterns.forEach((pattern) => {
    const id = pattern.getAttribute("id");
    if (id) {
      const match = id.match(/img(\d+)/);
      if (match) {
        frames.push({
          frameId: id,
          frameNumber: Number.parseInt(match[1], 10),
        });
      }
    }
  });

  return frames.sort((a, b) => a.frameNumber - b.frameNumber);
}

/**
 * Parses an SVG path's 'd' attribute to extract bounding box coordinates.
 * Handles simple rectangular paths like "M75 50 H425 V550 H75 Z"
 */
function parsePathBoundingBox(
  pathD: string
): { x: number; y: number; width: number; height: number } | null {
  try {
    // Normalize the path string: remove extra whitespace and make uppercase for easier parsing
    const normalizedPath = pathD.trim().toUpperCase().replace(/\s+/g, " ");

    // Match the initial M (moveto) command
    const moveMatch = normalizedPath.match(/M\s*([\d.]+)\s+([\d.]+)/);
    if (!moveMatch) {
      console.warn("[v0] Path parsing: No M command found in path:", pathD);
      return null;
    }

    const startX = Number.parseFloat(moveMatch[1]);
    const startY = Number.parseFloat(moveMatch[2]);

    // Extract all H (horizontal) and V (vertical) commands with their values
    const hMatches = Array.from(normalizedPath.matchAll(/H\s*([\d.]+)/g));
    const vMatches = Array.from(normalizedPath.matchAll(/V\s*([\d.]+)/g));

    if (hMatches.length === 0 && vMatches.length === 0) {
      console.warn(
        "[v0] Path parsing: No H or V commands found in path:",
        pathD
      );
      return null;
    }

    // Collect all x and y coordinates
    const xCoords = [startX];
    const yCoords = [startY];

    // Add all horizontal line coordinates
    hMatches.forEach((m) => {
      const x = Number.parseFloat(m[1]);
      if (!isNaN(x)) xCoords.push(x);
    });

    // Add all vertical line coordinates
    vMatches.forEach((m) => {
      const y = Number.parseFloat(m[1]);
      if (!isNaN(y)) yCoords.push(y);
    });

    // Calculate bounding box
    const minX = Math.min(...xCoords);
    const maxX = Math.max(...xCoords);
    const minY = Math.min(...yCoords);
    const maxY = Math.max(...yCoords);

    const bbox = {
      x: minX,
      y: minY,
      width: maxX - minX,
      height: maxY - minY,
    };

    console.log("[v0] Path parsing successful:", {
      pathD: pathD.substring(0, 50),
      bbox,
    });
    return bbox;
  } catch (error) {
    console.error(
      "[v0] Error parsing path bounding box:",
      error,
      "Path:",
      pathD
    );
    return null;
  }
}

/**
 * Parses an SVG string to extract the coordinates of photo frames.
 * Looks for <rect> and <path> elements whose fill references a pattern (e.g., "url(#img1_page-...)").
 */
export function extractFrameCoordinates(
  svgContent: string
): FrameCoordinates[] {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgContent, "image/svg+xml");

  const coordinates: FrameCoordinates[] = [];

  const rects = doc.querySelectorAll('rect[fill^="url(#img"]');
  rects.forEach((rect) => {
    const fill = rect.getAttribute("fill") || "";
    const match = fill.match(/#img(\d+)/);

    if (match) {
      const frameNumber = Number.parseInt(match[1], 10);
      const x = Number.parseFloat(rect.getAttribute("x") || "0");
      const y = Number.parseFloat(rect.getAttribute("y") || "0");
      const width = Number.parseFloat(rect.getAttribute("width") || "0");
      const height = Number.parseFloat(rect.getAttribute("height") || "0");

      console.log("[v0] Extracted rect frame:", {
        frameNumber,
        x,
        y,
        width,
        height,
      });

      coordinates.push({ frameNumber, x, y, width, height });
    }
  });

  const paths = doc.querySelectorAll('path[fill^="url(#img"]');
  paths.forEach((path) => {
    const fill = path.getAttribute("fill") || "";
    const match = fill.match(/#img(\d+)/);

    if (match) {
      const frameNumber = Number.parseInt(match[1], 10);
      const d = path.getAttribute("d") || "";
      const bbox = parsePathBoundingBox(d);

      if (bbox) {
        console.log("[v0] Extracted path frame:", { frameNumber, ...bbox });
        coordinates.push({
          frameNumber,
          x: bbox.x,
          y: bbox.y,
          width: bbox.width,
          height: bbox.height,
        });
      } else {
        console.warn(
          "[v0] Failed to parse path for frame:",
          frameNumber,
          "Path d:",
          d
        );
      }
    }
  });

  // Sort by frame number to ensure order is consistent
  const sorted = coordinates.sort((a, b) => a.frameNumber - b.frameNumber);
  console.log("[v0] Total frame coordinates extracted:", sorted.length);

  return sorted;
}
