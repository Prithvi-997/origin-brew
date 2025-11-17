
import "./pico.js";
import { Photo } from "./types";

declare const pico: any;

let facefinder_classify_region: any = null;

const loadCascade = async () => {
  if (facefinder_classify_region) {
    return;
  }
  const response = await fetch("/facefinder");
  const buffer = await response.arrayBuffer();
  const bytes = new Int8Array(buffer);
  facefinder_classify_region = pico.unpack_cascade(bytes);
  console.log("* cascade loaded");
};

loadCascade();

const rgba_to_grayscale = (rgba: Uint8ClampedArray, nrows: number, ncols: number) => {
  var gray = new Uint8Array(nrows * ncols);
  for (var r = 0; r < nrows; ++r)
    for (var c = 0; c < ncols; ++c)
      gray[r * ncols + c] =
        (2 * rgba[r * 4 * ncols + 4 * c + 0] +
          7 * rgba[r * 4 * ncols + 4 * c + 1] +
          1 * rgba[r * 4 * ncols + 4 * c + 2]) /
        10;
  return gray;
};

export const detectFaces = async (img: HTMLImageElement) => {
  if (!facefinder_classify_region) {
    console.log("cascade not loaded yet");
    return;
  }

  const canvas = document.createElement("canvas");
  canvas.width = img.naturalWidth;
  canvas.height = img.naturalHeight;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    return;
  }
  ctx.drawImage(img, 0, 0);
  const rgba = ctx.getImageData(0, 0, img.naturalWidth, img.naturalHeight).data;
  const image = {
    pixels: rgba_to_grayscale(rgba, img.naturalHeight, img.naturalWidth),
    nrows: img.naturalHeight,
    ncols: img.naturalWidth,
    ldim: img.naturalWidth,
  };
  const params = {
    shiftfactor: 0.1,
    minsize: 20,
    maxsize: 1000,
    scalefactor: 1.1,
  };

  let dets = pico.run_cascade(image, facefinder_classify_region, params);
  dets = pico.cluster_detections(dets, 0.2);

  const faces = dets
    .filter((det: any) => det[3] > 50.0)
    .map((det: any) => ({
      x: det[1],
      y: det[0],
      width: det[2],
      height: det[2],
    }));

  return faces;
};


/**
 * Analyze image dimensions and orientation
 */
export async function analyzeImage(file: File): Promise<Partial<Photo>> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = async () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const aspectRatio = width / height;
      
      let orientation: 'landscape' | 'portrait' | 'square';
      if (width >= height * 1.1) {
        orientation = 'landscape';
      } else if (height >= width * 1.1) {
        orientation = 'portrait';
      } else {
        orientation = 'square';
      }
      
      // Calculate priority score (0-100)
      // Higher resolution = higher priority
      const megapixels = (width * height) / 1000000;
      const sizeFactor = Math.min(megapixels / 12, 1) * 50; // Max 50 points for size
      
      // Unique aspect ratios get bonus points
      const aspectUniqueness = Math.abs(aspectRatio - 1.5) * 10; // Deviation from common 3:2
      
      const priority = Math.min(100, sizeFactor + aspectUniqueness + 25); // Base 25 points
      
      const faces = await detectFaces(img);

      URL.revokeObjectURL(url);
      resolve({ width, height, aspectRatio, orientation, priority, faces });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    
    img.src = url;
  });
}

/**
 * Calculate collection-level photo priorities
 */
export function calculatePhotoPriorities(photos: Array<{
  aspectRatio: number;
  width?: number;
  height?: number;
}>): number[] {
  const aspectRatios = photos.map(p => p.aspectRatio);
  
  return photos.map((photo, index) => {
    let score = 50; // Base score
    
    // Resolution bonus
    if (photo.width && photo.height) {
      const megapixels = (photo.width * photo.height) / 1000000;
      score += Math.min(megapixels / 12, 1) * 30;
    }
    
    // Uniqueness bonus - how different from other photos
    const uniqueness = aspectRatios.reduce((sum, ar, i) => {
      if (i === index) return sum;
      return sum + Math.abs(ar - photo.aspectRatio);
    }, 0) / aspectRatios.length;
    
    score += Math.min(uniqueness * 20, 20);
    
    return Math.round(Math.min(100, score));
  });
}
