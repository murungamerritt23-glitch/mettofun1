const MAX_IMAGE_SIZE = 500 * 1024; // 500KB
const MAX_DIMENSION = 800;
const MIN_QUALITY = 0.3;
const QUALITY_STEP = 0.15;

export const compressImageToTarget = async (file: File | Blob): Promise<{ blob: Blob; dataUrl: string }> => {
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = URL.createObjectURL(file);
  });

  let width = img.naturalWidth;
  let height = img.naturalHeight;

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    if (width > height) {
      height = Math.round((height / width) * MAX_DIMENSION);
      width = MAX_DIMENSION;
    } else {
      width = Math.round((width / height) * MAX_DIMENSION);
      height = MAX_DIMENSION;
    }
  }

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx?.drawImage(img, 0, 0, width, height);

  let quality = 0.8;
  let blob = await new Promise<Blob | null>((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
  });

  while (blob && blob.size > MAX_IMAGE_SIZE && quality > MIN_QUALITY) {
    quality -= QUALITY_STEP;
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', Math.max(quality, MIN_QUALITY));
    });
  }

  if (!blob || blob.size > MAX_IMAGE_SIZE) {
    const scale = Math.sqrt(MAX_IMAGE_SIZE / (blob?.size || MAX_IMAGE_SIZE)) * 0.8;
    const newWidth = Math.max(100, Math.round(width * scale));
    const newHeight = Math.max(100, Math.round(height * scale));
    canvas.width = newWidth;
    canvas.height = newHeight;
    ctx?.drawImage(img, 0, 0, newWidth, newHeight);
    blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.6);
    });
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  return {
    blob: blob || new Blob(),
    dataUrl
  };
};
