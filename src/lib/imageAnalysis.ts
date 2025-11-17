/**
 * Analyze image dimensions and orientation
 */
export async function analyzeImage(file: File): Promise<{
  width: number;
  height: number;
  aspectRatio: number;
  orientation: "landscape" | "portrait" | "square";
  priority: number;
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);

    img.onload = () => {
      const width = img.naturalWidth;
      const height = img.naturalHeight;
      const aspectRatio = width / height;

      let orientation: "landscape" | "portrait" | "square";
      if (width >= height * 1.1) {
        orientation = "landscape";
      } else if (height >= width * 1.1) {
        orientation = "portrait";
      } else {
        orientation = "square";
      }

      // Calculate priority score (0-100)
      // Higher resolution = higher priority
      const megapixels = (width * height) / 1000000;
      const sizeFactor = Math.min(megapixels / 12, 1) * 50; // Max 50 points for size

      // Unique aspect ratios get bonus points
      const aspectUniqueness = Math.abs(aspectRatio - 1.5) * 10; // Deviation from common 3:2

      const priority = Math.min(100, sizeFactor + aspectUniqueness + 25); // Base 25 points

      URL.revokeObjectURL(url);
      resolve({ width, height, aspectRatio, orientation, priority });
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
export function calculatePhotoPriorities(
  photos: Array<{
    aspectRatio: number;
    width?: number;
    height?: number;
  }>
): number[] {
  const aspectRatios = photos.map((p) => p.aspectRatio);

  return photos.map((photo, index) => {
    let score = 50; // Base score

    // Resolution bonus
    if (photo.width && photo.height) {
      const megapixels = (photo.width * photo.height) / 1000000;
      score += Math.min(megapixels / 12, 1) * 30;
    }

    // Uniqueness bonus - how different from other photos
    const uniqueness =
      aspectRatios.reduce((sum, ar, i) => {
        if (i === index) return sum;
        return sum + Math.abs(ar - photo.aspectRatio);
      }, 0) / aspectRatios.length;

    score += Math.min(uniqueness * 20, 20);

    return Math.round(Math.min(100, score));
  });
}
