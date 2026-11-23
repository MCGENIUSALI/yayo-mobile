/** Web version: the frame is drawn from a <video> element into a canvas. */
const AT_SECONDS = 0.5;
const MAX_SIDE = 1080;

export function videoCover(uri: string): Promise<string | null> {
  return new Promise((resolve) => {
    const video = document.createElement('video');
    const done = (v: string | null) => {
      video.removeAttribute('src');
      video.load();
      resolve(v);
    };
    const timer = setTimeout(() => done(null), 10_000);
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.crossOrigin = 'anonymous';
    video.onloadeddata = () => {
      video.currentTime = Math.min(AT_SECONDS, (video.duration || 1) / 2);
    };
    video.onseeked = () => {
      const scale = Math.min(1, MAX_SIDE / Math.max(video.videoWidth, video.videoHeight));
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(video.videoWidth * scale);
      canvas.height = Math.round(video.videoHeight * scale);
      const ctx = canvas.getContext('2d');
      if (!ctx || !canvas.width) {
        clearTimeout(timer);
        return done(null);
      }
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
      canvas.toBlob(
        (blob) => {
          clearTimeout(timer);
          done(blob ? URL.createObjectURL(blob) : null);
        },
        'image/jpeg',
        0.7,
      );
    };
    video.onerror = () => {
      clearTimeout(timer);
      done(null);
    };
    video.src = uri;
  });
}
