import * as ImagePicker from 'expo-image-picker';

export type PickResult = { ok: true; uri: string } | { ok: false; reason: 'cancelled' | 'denied' | 'unavailable' };

/**
 * Opens the camera or the gallery (expo-image-picker, works in Expo Go).
 * Returns a local URI; nothing is uploaded until a server exists.
 */
export async function pickPhoto(source: 'camera' | 'library', mediaTypes: ImagePicker.MediaType[] = ['images']): Promise<PickResult> {
  try {
    const perm = source === 'camera' ? await ImagePicker.requestCameraPermissionsAsync() : await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) return { ok: false, reason: 'denied' };
    const options: ImagePicker.ImagePickerOptions = { mediaTypes, quality: 0.8, allowsEditing: false, videoMaxDuration: 60 };
    const r = source === 'camera' ? await ImagePicker.launchCameraAsync(options) : await ImagePicker.launchImageLibraryAsync(options);
    if (r.canceled || !r.assets[0]) return { ok: false, reason: 'cancelled' };
    return { ok: true, uri: r.assets[0].uri };
  } catch {
    // Web without a camera, simulator without a library…
    return { ok: false, reason: 'unavailable' };
  }
}

export const PICK_ERROR: Record<Exclude<PickResult, { ok: true }>['reason'], string | null> = {
  cancelled: null,
  denied: 'Autorise l’accès à l’appareil photo ou à tes photos dans les réglages du téléphone.',
  unavailable: 'L’appareil photo n’est pas disponible ici : choisis une image de démo.',
};
