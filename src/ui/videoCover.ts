import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';
import { createVideoPlayer } from 'expo-video';

/** Moment of the clip used as its cover: past the first black frames. */
const AT_SECONDS = 0.5;
const MAX_SIDE = 1080;

/**
 * Cover of a video picked on the phone (home feed card B1, SV1 list), taken from
 * the clip itself and saved as a light JPEG. Null if it cannot be read: the
 * video is still published, the feed plays it.
 */
export async function videoCover(uri: string): Promise<string | null> {
  const player = createVideoPlayer(uri);
  try {
    const [thumb] = await player.generateThumbnailsAsync(AT_SECONDS, { maxWidth: MAX_SIDE, maxHeight: MAX_SIDE });
    if (!thumb) return null;
    const ref = await ImageManipulator.manipulate(thumb).renderAsync();
    const out = await ref.saveAsync({ compress: 0.7, format: SaveFormat.JPEG });
    return out.uri;
  } catch {
    return null;
  } finally {
    player.release();
  }
}
