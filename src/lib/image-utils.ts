const MAX_IMAGE_SIZE = 500 * 1024; // 500KB
const MAX_DIMENSION = 600;

const toBlob = (canvas: HTMLCanvasElement, type: string, quality: number): Promise<Blob | null> => {
  return new Promise((resolve) => {
    try {
      if (typeof canvas.toBlob === 'function') {
        canvas.toBlob((b) => resolve(b), type, quality);
      } else if (typeof canvas.toDataURL === 'function') {
        const dataUrl = canvas.toDataURL(type, quality);
        fetch(dataUrl)
          .then(res => res.blob())
          .then(resolve)
          .catch(() => resolve(null));
      } else {
        resolve(null);
      }
    } catch {
      resolve(null);
    }
  });
};

export const compressImageToTarget = async (file: File | Blob): Promise<{ blob: Blob; dataUrl: string }> => {
  const img = new Image();
  const objectUrl = URL.createObjectURL(file);

  try {
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = objectUrl;
    });

    if (file.size <= MAX_IMAGE_SIZE) {
      const dataUrl = await new Promise<string>((resolve) => {
        const canvas = document.createElement('canvas');
        canvas.width = img.naturalWidth;
        canvas.height = img.naturalHeight;
        const ctx = canvas.getContext('2d');
        ctx?.drawImage(img, 0, 0);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      });
      return { blob: file instanceof Blob ? file : new Blob([file]), dataUrl };
    }

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
    let blob = await toBlob(canvas, 'image/jpeg', quality);

    while (blob && blob.size > MAX_IMAGE_SIZE && quality > 0.3) {
      quality -= 0.15;
      blob = await toBlob(canvas, 'image/jpeg', Math.max(quality, 0.3));
    }

    if (!blob || blob.size > MAX_IMAGE_SIZE) {
      let currentWidth = width;
      let currentHeight = height;
      let attempts = 0;

      while ((!blob || blob.size > MAX_IMAGE_SIZE) && attempts < 4) {
        const scale = Math.sqrt(MAX_IMAGE_SIZE / Math.max(blob?.size || MAX_IMAGE_SIZE, 1)) * 0.7;
        currentWidth = Math.max(100, Math.round(currentWidth * scale));
        currentHeight = Math.max(100, Math.round(currentHeight * scale));
        canvas.width = currentWidth;
        canvas.height = currentHeight;
        ctx?.drawImage(img, 0, 0, currentWidth, currentHeight);
        blob = await toBlob(canvas, 'image/jpeg', 0.6);
        attempts++;
      }
    }

    if (!blob || blob.size === 0) {
      const dataUrl = canvas.toDataURL('image/jpeg', 0.6);
      const response = await fetch(dataUrl);
      blob = await response.blob();
    }

    if (!blob || blob.size > MAX_IMAGE_SIZE * 2) {
      throw new Error('Unable to compress image to under 500KB');
    }

    const dataUrl = canvas.toDataURL('image/jpeg', 0.7);
    return { blob, dataUrl };
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
};
