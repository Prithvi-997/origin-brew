/**
 * Analyze image dimensions and orientation
 */
export async function analyzeImage(file: File): Promise<{
  width: number;
  height: number;
  aspectRatio: number;
  orientation: 'landscape' | 'portrait' | 'square';
}> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    const url = URL.createObjectURL(file);
    
    img.onload = () => {
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
      
      URL.revokeObjectURL(url);
      resolve({ width, height, aspectRatio, orientation });
    };
    
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error(`Failed to load image: ${file.name}`));
    };
    
    img.src = url;
  });
}
