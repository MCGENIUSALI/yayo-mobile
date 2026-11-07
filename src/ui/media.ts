import { Directory, File, Paths } from 'expo-file-system';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';
import { Platform } from 'react-native';

/**
 * Native photo picking for the whole app (profile photo, product photos,
 * shop logo, documents, incident photo).
 *
 * - Gallery: the system photo picker (Android 13+ and iOS), which needs no
 *   permission, so none is asked.
 * - Camera: permission asked only when "Prendre une photo" is chosen.
 * - Each image is resized (longest side `maxSide`) and saved as JPEG 80 %,
 *   then copied out of the picker's temporary cache into the app's documents,
 *   so it is still there after a restart.
 * Nothing is uploaded: there is no YA YO media backend in this app yet.
 */

export type PickSource = 'camera' | 'library';

export type PickResult =
  | { ok: true; uris: string[] }
  | { ok: false; reason: 'cancelled' }
  | { ok: false; reason: 'denied'; message: string; canOpenSettings: boolean }
  | { ok: false; reason: 'error'; message: string };

export interface PickOptions {
  source: PickSource;
  /** Square crop in the system editor (profile photo, logo). Single image only. */
  square?: boolean;
  /** Up to this many images from the gallery (product photos); 1 by default. */
  max?: number;
  /** Longest side after resizing, in px. */
  maxSide?: number;
}

const ACCEPTED = /\.(jpe?g|png|heic|heif|webp)$/i;

export async function pickImages({ source, square = false, max = 1, maxSide = 1600 }: PickOptions): Promise<PickResult> {
  const options: ImagePicker.ImagePickerOptions = {
    mediaTypes: ['images'],
    quality: 1,
    allowsEditing: square && max === 1,
    aspect: square ? [1, 1] : undefined,
    allowsMultipleSelection: max > 1,
    selectionLimit: max > 1 ? max : 1,
    orderedSelection: max > 1,
    exif: false,
  };

  let result: ImagePicker.ImagePickerResult;
  try {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();
      if (!permission.granted)
        return {
          ok: false,
          reason: 'denied',
          canOpenSettings: !permission.canAskAgain,
          message: permission.canAskAgain
            ? 'YA YO a besoin de l’appareil photo pour prendre la photo.'
            : 'L’accès à l’appareil photo est refusé. Autorise-le dans les réglages du téléphone.',
        };
      result = await ImagePicker.launchCameraAsync(options);
    } else {
      result = await ImagePicker.launchImageLibraryAsync(options);
    }
  } catch {
    return { ok: false, reason: 'error', message: source === 'camera' ? 'L’appareil photo n’a pas pu s’ouvrir.' : 'La galerie n’a pas pu s’ouvrir.' };
  }
  if (result.canceled || result.assets.length === 0) return { ok: false, reason: 'cancelled' };

  const assets = result.assets.filter((a) => a.type !== 'video' && (!a.fileName || ACCEPTED.test(a.fileName)));
  if (assets.length === 0) return { ok: false, reason: 'error', message: 'Format non pris en charge. Choisis une photo JPEG, PNG ou HEIC.' };

  try {
    const uris: string[] = [];
    for (const asset of assets.slice(0, max)) uris.push(await optimise(asset, maxSide));
    return { ok: true, uris };
  } catch {
    return { ok: false, reason: 'error', message: 'La photo n’a pas pu être préparée. Réessaie avec une autre image.' };
  }
}

/** Resize + JPEG 80 %, then keep a copy in the app's documents (not the picker's temporary cache). */
async function optimise(asset: ImagePicker.ImagePickerAsset, maxSide: number): Promise<string> {
  const landscape = asset.width >= asset.height;
  const tooBig = Math.max(asset.width, asset.height) > maxSide;
  const context = ImageManipulator.manipulate(asset.uri);
  // One side only: the other follows the image ratio.
  if (tooBig) context.resize(landscape ? { width: maxSide } : { height: maxSide });
  const image = await context.renderAsync();
  const saved = await image.saveAsync({ compress: 0.8, format: SaveFormat.JPEG });
  if (Platform.OS === 'web') return saved.uri;
  const dir = new Directory(Paths.document, 'photos');
  if (!dir.exists) dir.create({ intermediates: true, idempotent: true });
  const target = new File(dir, `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`);
  new File(saved.uri).copySync(target);
  return target.uri;
}

/** Removes a photo this app saved (replaced or deleted profile photo). Bundled images and others are left alone. */
export function forgetPhoto(uri: string | number | undefined) {
  if (typeof uri !== 'string' || Platform.OS === 'web' || !uri.includes('/photos/')) return;
  try {
    const f = new File(uri);
    if (f.exists) f.delete();
  } catch {
    // Already gone: nothing to do.
  }
}
