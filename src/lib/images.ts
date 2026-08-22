import { MAX_IMAGES, isAcceptedMimeType } from './uploads';

/**
 * Lato client riduciamo le foto prima dell'invio: meno banda in mercatino,
 * meno token di input, stessa capacita' di riconoscimento.
 * 1600px sul lato lungo e' il compromesso: sotto si perdono i punzoni.
 */
const MAX_EDGE = 1600;
const JPEG_QUALITY = 0.85;

export type PreparedImage = {
  id: string;
  file: File;
  previewUrl: string;
};

export async function prepareImage(file: File): Promise<PreparedImage> {
  if (!isAcceptedMimeType(file.type)) {
    throw new Error(`Formato non supportato: ${file.name}`);
  }

  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, MAX_EDGE / Math.max(bitmap.width, bitmap.height));

  if (scale === 1 && file.size < 1_500_000) {
    bitmap.close();
    return { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) };
  }

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);

  const context = canvas.getContext('2d');
  if (!context) {
    bitmap.close();
    return { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) };
  }

  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', JPEG_QUALITY),
  );
  if (!blob) {
    return { id: crypto.randomUUID(), file, previewUrl: URL.createObjectURL(file) };
  }

  const resized = new File([blob], file.name.replace(/\.[^.]+$/, '') + '.jpg', {
    type: 'image/jpeg',
  });
  return { id: crypto.randomUUID(), file: resized, previewUrl: URL.createObjectURL(resized) };
}

export async function prepareImages(
  files: File[],
  alreadySelected: number,
): Promise<{ images: PreparedImage[]; errors: string[] }> {
  const room = Math.max(0, MAX_IMAGES - alreadySelected);
  const accepted = files.slice(0, room);
  const errors: string[] = [];

  if (files.length > room) {
    errors.push(`Puoi caricare al massimo ${MAX_IMAGES} foto.`);
  }

  const images: PreparedImage[] = [];
  for (const file of accepted) {
    try {
      images.push(await prepareImage(file));
    } catch (error) {
      errors.push(error instanceof Error ? error.message : `Impossibile leggere ${file.name}`);
    }
  }

  return { images, errors };
}
