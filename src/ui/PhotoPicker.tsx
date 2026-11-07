import { Image } from 'expo-image';
import { Camera, FlaskConical, ImageIcon, Trash2 } from 'lucide-react-native';
import { useState } from 'react';
import { ActivityIndicator, Image as RNImage, Linking, StyleSheet, View } from 'react-native';
import { products } from '@/domain/catalog';
import type { Photo } from '@/domain/seller';
import { initialsOf } from '@/domain/auth';
import { pressScale } from '@/theme/motion';
import { color, radius, space } from '@/theme/tokens';
import { Button } from './Button';
import { Alert } from './Feedback';
import { pickImages, type PickSource } from './media';
import { haptic, PressableScale } from './Pressable';
import { MenuRow } from './Seller';
import { Sheet } from './Sheet';
import { Text } from './Text';

/** Catalogue visuals, offered only in development builds (web preview, simulator without photos). */
const DEV_GALLERY: Photo[] = __DEV__
  ? Object.values(products)
      .map((p) => p.image)
      .filter((x): x is number => typeof x === 'number')
      .slice(0, 6)
  : [];

/**
 * "Prendre une photo" / "Choisir dans la galerie" (+ "Supprimer la photo").
 * While the image is prepared the sheet shows a spinner; an error leaves the
 * current photo untouched.
 */
export function PhotoSourceSheet({
  visible,
  onClose,
  title,
  onPicked,
  onRemove,
  square = false,
  max = 1,
  maxSide,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  onPicked: (photos: Photo[]) => void;
  onRemove?: () => void;
  square?: boolean;
  max?: number;
  maxSide?: number;
}) {
  const [busy, setBusy] = useState<PickSource | null>(null);
  const [problem, setProblem] = useState<{ message: string; settings: boolean } | null>(null);

  const pick = async (source: PickSource) => {
    setProblem(null);
    setBusy(source);
    const r = await pickImages({ source, square, max, maxSide });
    setBusy(null);
    if (r.ok) {
      haptic('success');
      onPicked(r.uris);
      onClose();
    } else if (r.reason !== 'cancelled') {
      haptic('warning');
      setProblem({ message: r.message, settings: r.reason === 'denied' && r.canOpenSettings });
    }
  };

  const close = () => {
    if (busy) return;
    setProblem(null);
    onClose();
  };

  return (
    <Sheet visible={visible} onClose={close} title={title}>
      {busy ? (
        <View style={styles.busy} accessibilityLiveRegion="polite">
          <ActivityIndicator color={color.icon.accent} />
          <Text variant="bodyM" color={color.text.secondary}>
            Préparation de la photo…
          </Text>
        </View>
      ) : (
        <View style={styles.menu}>
          <MenuRow icon={Camera} title="Prendre une photo" onPress={() => pick('camera')} />
          <MenuRow icon={ImageIcon} title={max > 1 ? `Choisir dans la galerie (jusqu’à ${max})` : 'Choisir dans la galerie'} onPress={() => pick('library')} />
          {onRemove ? (
            <MenuRow
              icon={Trash2}
              title="Supprimer la photo"
              tone="danger"
              onPress={() => {
                onRemove();
                onClose();
              }}
            />
          ) : null}
        </View>
      )}
      {problem ? (
        <View style={{ gap: space.sm }}>
          <Alert tone="danger" title="Photo non ajoutée" body={problem.message} />
          {problem.settings ? <Button label="Ouvrir les réglages" variant="outline" onPress={() => Linking.openSettings()} fill /> : null}
        </View>
      ) : null}
      {DEV_GALLERY.length && !busy ? (
        <View style={{ gap: space.sm }}>
          <View style={styles.devHead}>
            <FlaskConical size={14} color={color.icon.secondary} strokeWidth={2} />
            <Text variant="caption" color={color.text.secondary}>
              Développement · images du catalogue
            </Text>
          </View>
          <View style={styles.gallery}>
            {DEV_GALLERY.map((src, i) => (
              <PressableScale
                key={i}
                accessibilityRole="button"
                accessibilityLabel={`Image du catalogue ${i + 1}`}
                onPress={() => {
                  onPicked([src]);
                  onClose();
                }}
                haptic="selection"
                scaleTo={pressScale.card}
              >
                <Image source={src} style={styles.galleryItem} contentFit="cover" />
              </PressableScale>
            ))}
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}

/** Empty photo slot (V1 logo, V2/L2 documents, V9 product photos, L9 incident). */
export function AddPhotoTile({
  label = 'Ajouter',
  size = 96,
  onPick,
  onPickMany,
  max = 1,
  square = false,
  title,
}: {
  label?: string;
  size?: number;
  onPick?: (p: Photo) => void;
  /** Several photos at once (V9), in the order they were selected. */
  onPickMany?: (p: Photo[]) => void;
  max?: number;
  square?: boolean;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={`${title} : ajouter une photo`}
        onPress={() => setOpen(true)}
        haptic="selection"
        scaleTo={pressScale.card}
        style={[styles.addTile, { width: size, height: size }]}
      >
        <Camera size={20} color={color.icon.secondary} strokeWidth={2} />
        <Text variant="caption" color={color.text.secondary}>
          {label}
        </Text>
      </PressableScale>
      <PhotoSourceSheet
        visible={open}
        onClose={() => setOpen(false)}
        title={title}
        max={max}
        square={square}
        onPicked={(photos) => (onPickMany ? onPickMany(photos) : photos[0] !== undefined && onPick?.(photos[0]))}
      />
    </>
  );
}

/**
 * Profile photo (every role): tap → camera or gallery (square crop) → preview
 * → Enregistrer. While saving a spinner shows; if it fails the previous photo
 * stays. "Supprimer la photo" goes back to the initials.
 */
export function ProfilePhotoEditor({
  name,
  photo,
  onSave,
  onRemove,
  size = 72,
}: {
  name: string;
  photo?: string;
  /** Resolves false when the photo could not be saved (the old one is kept). */
  onSave: (uri: string) => Promise<boolean> | boolean;
  onRemove?: () => void;
  size?: number;
}) {
  const [choosing, setChoosing] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [failed, setFailed] = useState(false);
  const initials = initialsOf(name || '?');

  const save = async () => {
    if (!preview) return;
    setSaving(true);
    setFailed(false);
    const ok = await Promise.resolve(onSave(preview)).catch(() => false);
    setSaving(false);
    if (ok) {
      haptic('success');
      setPreview(null);
    } else {
      haptic('warning');
      setFailed(true);
    }
  };

  return (
    <>
      <PressableScale
        accessibilityRole="button"
        accessibilityLabel={photo ? 'Photo de profil : modifier' : 'Photo de profil : ajouter'}
        onPress={() => setChoosing(true)}
        haptic="selection"
        scaleTo={pressScale.card}
        style={{ width: size, height: size }}
      >
        <View style={[styles.avatar, { width: size, height: size, borderRadius: size / 2 }]}>
          {photo ? (
            <Image source={photo} style={StyleSheet.absoluteFill} contentFit="cover" accessibilityIgnoresInvertColors />
          ) : (
            <Text variant={size >= 64 ? 'h3' : 'labelM'} color={color.text.accent}>
              {name.trim() ? initials : '?'}
            </Text>
          )}
        </View>
        <View style={styles.cameraBadge}>
          <Camera size={14} color={color.icon.inverse} strokeWidth={2.2} />
        </View>
      </PressableScale>

      <PhotoSourceSheet
        visible={choosing}
        onClose={() => setChoosing(false)}
        title="Photo de profil"
        square
        maxSide={800}
        onPicked={(photos) => {
          const first = photos[0];
          // Picked from the device: always a file URI. Catalogue images (development) are bundled numbers.
          if (typeof first === 'string') setPreview(first);
          else if (first !== undefined) setPreview(RNImage.resolveAssetSource(first)?.uri ?? null);
        }}
        onRemove={photo && onRemove ? onRemove : undefined}
      />

      <Sheet
        visible={!!preview}
        onClose={() => !saving && setPreview(null)}
        title="Aperçu"
        dismissible={!saving}
        footer={
          <>
            <Button label="Choisir une autre" variant="outline" disabled={saving} onPress={() => { setPreview(null); setChoosing(true); }} style={{ flex: 1 }} />
            <Button label="Enregistrer" loading={saving} onPress={save} style={{ flex: 1 }} />
          </>
        }
      >
        <View style={styles.preview}>
          {preview ? <Image source={preview} style={styles.previewImage} contentFit="cover" accessibilityLabel="Aperçu de la nouvelle photo de profil" /> : null}
          <Text variant="bodyS" color={color.text.secondary} align="center">
            Visible par les vendeurs et les livreurs de tes commandes.
          </Text>
          {failed ? <Alert tone="danger" title="Photo non enregistrée" body="Ta photo actuelle est conservée. Réessaie." /> : null}
        </View>
      </Sheet>
    </>
  );
}

const styles = StyleSheet.create({
  avatar: { backgroundColor: color.bg.accentSubtle, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cameraBadge: {
    position: 'absolute',
    right: -2,
    bottom: -2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: color.bg.brand,
    borderWidth: 2,
    borderColor: color.bg.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  preview: { alignItems: 'center', gap: space.md },
  previewImage: { width: 200, height: 200, borderRadius: 100, backgroundColor: color.bg.surfaceSunken },
  addTile: {
    borderRadius: radius.md,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: color.border.strong,
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.xs,
  },
  menu: { backgroundColor: color.bg.surface, borderRadius: radius.lg, overflow: 'hidden' },
  busy: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingVertical: space.lg },
  devHead: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  galleryItem: { width: 64, height: 64, borderRadius: radius.md, backgroundColor: color.bg.surfaceSunken },
});
