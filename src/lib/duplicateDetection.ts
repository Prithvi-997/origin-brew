import { Photo } from './types';

/**
 * Creates a unique signature for a file based on name and size
 */
export const createFileSignature = (file: File): string => {
  return `${file.name}-${file.size}`;
};

/**
 * Creates a unique signature for a photo based on filename and dimensions
 */
export const createPhotoSignature = (photo: Photo): string => {
  // Use originalFilename and dimensions as signature
  return `${photo.originalFilename}-${photo.width || 0}x${photo.height || 0}`;
};

/**
 * Filters out duplicate files from a FileList based on existing photos
 */
export const filterDuplicateFiles = (
  newFiles: FileList | File[],
  existingPhotos: Photo[]
): { uniqueFiles: File[]; duplicates: string[] } => {
  const existingSignatures = new Set(
    existingPhotos.map(photo => photo.originalFilename)
  );

  const uniqueFiles: File[] = [];
  const duplicates: string[] = [];
  const seenInNewBatch = new Set<string>();

  Array.from(newFiles).forEach(file => {
    const fileName = file.name;

    // Check if already exists in album
    if (existingSignatures.has(fileName)) {
      duplicates.push(fileName);
      return;
    }

    // Check if duplicate within the new batch
    if (seenInNewBatch.has(fileName)) {
      duplicates.push(fileName);
      return;
    }

    uniqueFiles.push(file);
    seenInNewBatch.add(fileName);
  });

  return { uniqueFiles, duplicates };
};
