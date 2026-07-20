const MAX_IMAGE_SIZE = 500 * 1024; // 500KB
const MAX_DIMENSION = 800;
const MIN_QUALITY = 0.3;
const QUALITY_STEP = 0.15;

export const compressImageToTarget = async (file: File | Blob): Promise<{ blob: Blob; dataUrl: string }> => {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('Failed to load image'));
    img.src = objectUrl;
  });
  URL.revokeObjectURL(objectUrl);

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
    let currentWidth = width;
    let currentHeight = height;
    let attempts = 0;
    const maxAttempts = 5;

    while ((!blob || blob.size > MAX_IMAGE_SIZE) && attempts < maxAttempts) {
      const scale = Math.sqrt(MAX_IMAGE_SIZE / Math.max(blob?.size || MAX_IMAGE_SIZE, 1)) * 0.8;
      currentWidth = Math.max(100, Math.round(currentWidth * scale));
      currentHeight = Math.max(100, Math.round(currentHeight * scale));
      canvas.width = currentWidth;
      canvas.height = currentHeight;
      ctx?.drawImage(img, 0, 0, currentWidth, currentHeight);
      quality = Math.max(quality - 0.1, 0.4);
      blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/jpeg', quality);
      });
      attempts++;
    }
  }

  if (!blob || blob.size > MAX_IMAGE_SIZE) {
    throw new Error('Unable to compress image to under 500KB');
  }

  const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
  return {
    blob,
    dataUrl
  };
};
