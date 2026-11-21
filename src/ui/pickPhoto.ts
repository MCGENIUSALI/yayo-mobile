import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import * as ImagePicker from 'expo-image-picker';

export type PickResult = { ok: true; uri: string } | { ok: false; reason: 'cancelled' | 'denied' | 'unavailable' };

/**
 * Opens the camera or the gallery (expo-image-picker, works in Expo Go).
 * Returns a local URI; in server mode the seller screens upload it to Supabase Storage.
 */
export async function pickPhoto(source: 'camera' | 'library', mediaTypes: ImagePicker.MediaType[] = ['images']): Promise<PickResult> {
  try {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };
    const options: ImagePicker.ImagePickerOptions = { mediaTypes, quality: 0.8, allowsEditing: false, videoMaxDuration: 60 };
    const r = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    const asset = r.assets?.[0];
    if (r.canceled || !asset) return { ok: false, reason: 'cancelled' };
    if (asset.type === 'video') return { ok: true, uri: asset.uri };
    return { ok: true, uri: await shrink(asset) };
  } catch {
    // Web without a camera, simulator without a library…
    return { ok: false, reason: 'unavailable' };
  }
}

/** Longest side kept for photos: enough for the product page, light on mobile data. */
const MAX_SIDE = 1600;

/**
 * A phone photo weighs 3 to 6 MB; resized and saved as JPEG it is about 10 times
 * lighter, so it uploads in seconds on 3G/4G. On failure the original is kept.
 */
async function shrink(asset: ImagePicker.ImagePickerAsset): Promise<string> {
  try {
    const ctx = ImageManipulator.manipulate(asset.uri);
    const big = Math.max(asset.width, asset.height) > MAX_SIDE;
    if (big) ctx.resize(asset.width >= asset.height ? { width: MAX_SIDE } : { height: MAX_SIDE });
    const ref = await ctx.renderAsync();
    const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return asset.uri;
  }
}

export const PICK_ERROR: Record<Exclude<PickResult, { ok: true }>['reason'], string | null> = {
  cancelled: null,
  denied: 'Autorise l’accès à l’appareil photo ou à tes photos dans les réglages du téléphone.',
  unavailable: 'L’appareil photo n’est pas disponible ici : choisis une image de démo.',
};
