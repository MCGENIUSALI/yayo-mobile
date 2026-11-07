import * as Clipboard from 'expo-clipboard';
import { router, type Href } from 'expo-router';
import { Bookmark, Copy, EyeOff, Flag, Heart, MessageCircle, MoreHorizontal, Repeat2, Send, Share2 } from 'lucide-react-native';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Linking, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { initialsOf, currentAccount } from '@/domain/auth';
import { getProduct, getShop } from '@/domain/catalog';
import { feedPosts, MAX_COMMENT, visibleComments } from '@/domain/content';
import { formatAgo, plural } from '@/domain/format';
import { formatFC } from '@/domain/money';
import type { AppState } from '@/domain/state';
import type { Post } from '@/domain/types';
import { useStore } from '@/store/AppStore';
import { useOpenWithAccount } from '@/store/useRequireAccount';
import { pressScale } from '@/theme/motion';
import { color, radius, space, type as typeScale } from '@/theme/tokens';
import { Button } from './Button';
import { Chip, TextField } from './Form';
import { useToast } from './Feedback';
import { PressableScale } from './Pressable';
import { Sheet } from './Sheet';
import { Text } from './Text';

/* ---------- Feed data ---------- */

/** Every post the buyer may see (static demo posts + published seller contents), minus « Pas intéressé ». */
export function useFeed(): Post[] {
  const { state } = useStore();
  return useMemo(() => {
    const hidden = new Set(state.social.hiddenPosts);
    return feedPosts(state.content, new Date().toISOString()).filter((p) => !hidden.has(p.id));
  }, [state.content, state.social.hiddenPosts]);
}

/** Any post by id, hidden or not (SC6 lists saved posts even after « Pas intéressé »). */
export function findPost(state: AppState, id: string): Post | undefined {
  return feedPosts(state.content, new Date().toISOString()).find((p) => p.id === id);
}

/** Toasts the reducer's refusal for an action sent at `sentAt`. */
export function useRefusal() {
  const { state } = useStore();
  const toast = useToast();
  const sent = useRef<string | null>(null);
  useEffect(() => {
    const e = state.lastError;
    if (e && sent.current && e.at >= sent.current) {
      toast(e.message, 'danger');
      sent.current = null;
    }
  }, [state.lastError, toast]);
  return useCallback(() => {
    const at = new Date().toISOString();
    sent.current = at;
    return at;
  }, []);
}

function shareText(post: Post): string {
  const shop = getShop(post.shopId);
  const p = post.productIds[0] ? getProduct(post.productIds[0]) : undefined;
  return `${shop.name} sur YA YO : ${post.caption}${p ? ` · ${p.shortName}, ${formatFC(p.price)}` : ''}`;
}

/* ---------- SC4 · Commentaires ---------- */

export function CommentsSheet({ post, onClose, resumeHref }: { post: Post | null; onClose: () => void; resumeHref: Href }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const openWithAccount = useOpenWithAccount();
  const stamp = useRefusal();
  const [text, setText] = useState('');
  const [replyTo, setReplyTo] = useState<{ id: string; author: string } | null>(null);
  const account = currentAccount(state.auth);
  const item = post ? state.content.items[post.id] : undefined;
  const closed = item ? !item.allowComments : false;
  const list = post ? visibleComments(state.content, post.id) : [];
  const count = post ? Math.max(post.comments, list.length) : 0;
  const now = new Date();

  const close = () => {
    setText('');
    setReplyTo(null);
    onClose();
  };
  const signIn = () => {
    close();
    openWithAccount(resumeHref, 'Connecte-toi pour commenter');
  };
  const send = () => {
    if (!post || !text.trim()) return;
    if (!account) return signIn();
    const at = stamp();
    dispatch({ type: 'comment/add', postId: post.id, text, replyTo: replyTo?.id, at });
    setText('');
    setReplyTo(null);
  };
  const report = (commentId: string) => {
    if (!post) return;
    if (!account) return signIn();
    const at = stamp();
    dispatch({ type: 'comment/report', postId: post.id, commentId, at });
    toast('Commentaire signalé à la boutique.', 'success');
  };

  return (
    <Sheet
      visible={!!post}
      onClose={close}
      title={`${count} ${plural(count, 'commentaire', 'commentaires')}`}
      footer={
        <View style={styles.composerWrap}>
          <Text variant="caption" color={color.text.tertiary}>
            Commentaires publics et modérés. Les numéros et paiements hors YA YO sont masqués.
          </Text>
          {closed ? (
            <Text variant="bodyS" color={color.text.secondary}>
              Les commentaires sont fermés sur cette publication.
            </Text>
          ) : account ? (
            <>
              {replyTo ? (
                <PressableScale accessibilityLabel="Annuler la réponse" onPress={() => setReplyTo(null)} scaleTo={pressScale.card}>
                  <Text variant="labelS" color={color.text.accent}>{`Réponse à ${replyTo.author} · Annuler`}</Text>
                </PressableScale>
              ) : null}
              <View style={styles.composer}>
                <View style={styles.meAvatar}>
                  <Text variant="labelS" color={color.text.accent}>
                    {initialsOf(account.name)}
                  </Text>
                </View>
                <TextInput
                  accessibilityLabel="Ajouter un commentaire"
                  placeholder="Ajouter un commentaire…"
                  placeholderTextColor={color.text.tertiary}
                  value={text}
                  maxLength={MAX_COMMENT}
                  onChangeText={setText}
                  onSubmitEditing={send}
                  returnKeyType="send"
                  style={[typeScale.bodyM, styles.input]}
                />
                <PressableScale accessibilityLabel="Publier le commentaire" onPress={send} disabled={!text.trim()} scaleTo={pressScale.icon} style={styles.send}>
                  <Send size={20} color={text.trim() ? color.icon.accent : color.icon.disabled} strokeWidth={2} />
                </PressableScale>
              </View>
            </>
          ) : (
            <Button label="Connecte-toi pour commenter" variant="outline" onPress={signIn} fill />
          )}
        </View>
      }
    >
      <ScrollView style={styles.list} contentContainerStyle={{ gap: space.lg, paddingBottom: space.sm }} keyboardShouldPersistTaps="handled">
        {list.length === 0 ? (
          <Text variant="bodyM" color={color.text.secondary}>
            Aucun commentaire pour l’instant. Pose ta question à la boutique.
          </Text>
        ) : null}
        {list.map((c) => {
          const masked = c.status === 'masked';
          return (
            <View key={c.id} style={[styles.comment, c.replyTo ? styles.reply : null]}>
              <View style={[styles.avatar, c.seller && styles.avatarSeller]}>
                <Text variant="labelS" color={c.seller ? color.text.inverse : color.text.accent}>
                  {initialsOf(c.author)}
                </Text>
              </View>
              <View style={styles.flex}>
                <View style={styles.row}>
                  <Text variant="labelM">{c.author}</Text>
                  {c.seller ? (
                    <View style={styles.sellerBadge}>
                      <Text variant="caption" color={color.text.inverse}>
                        Vendeur
                      </Text>
                    </View>
                  ) : null}
                  {c.pinned ? (
                    <Text variant="caption" color={color.text.accent}>
                      Épinglé
                    </Text>
                  ) : null}
                  <Text variant="caption" color={color.text.tertiary}>{`· ${formatAgo(c.at, now)}`}</Text>
                </View>
                <Text variant="bodyM" color={masked ? color.text.tertiary : color.text.primary}>
                  {masked && !c.autoMasked ? 'Commentaire masqué par la boutique.' : c.text}
                </Text>
                <View style={styles.row}>
                  {!closed ? (
                    <PressableScale accessibilityRole="button" onPress={() => (account ? setReplyTo({ id: c.id, author: c.author }) : signIn())} scaleTo={pressScale.icon} hitSlop={6}>
                      <Text variant="labelS" color={color.text.secondary}>
                        Répondre
                      </Text>
                    </PressableScale>
                  ) : null}
                  {c.authorId !== account?.id ? (
                    <PressableScale accessibilityRole="button" onPress={() => report(c.id)} scaleTo={pressScale.icon} hitSlop={6}>
                      <Text variant="labelS" color={color.text.secondary}>
                        Signaler
                      </Text>
                    </PressableScale>
                  ) : null}
                </View>
              </View>
              <View style={styles.likes} accessibilityLabel={`${c.likes} j’aime`}>
                <Heart size={16} color={color.icon.secondary} strokeWidth={2} />
                <Text variant="caption" color={color.text.secondary}>
                  {c.likes}
                </Text>
              </View>
            </View>
          );
        })}
      </ScrollView>
    </Sheet>
  );
}

/* ---------- SC5 · Partager ou republier ---------- */

export function ShareSheet({ post, onClose }: { post: Post | null; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const stamp = useRefusal();
  const signedIn = !!state.auth.session;
  if (!post) return <Sheet visible={false} onClose={onClose} title="Partager">{null}</Sheet>;
  const item = state.content.items[post.id];
  const shareable = item ? item.allowShare : true;
  const reposted = state.social.reposted.includes(post.id);
  const saved = state.social.saved.includes(post.id);
  const text = shareText(post);
  const tracked = () => dispatch({ type: 'content/track', postId: post.id, metric: 'share' });

  const system = async () => {
    try {
      const r = await Share.share({ message: text });
      if (r.action === Share.sharedAction) tracked();
    } catch {
      toast('Le partage n’est pas disponible sur cet appareil.');
    }
  };
  const whatsapp = async () => {
    const url = `whatsapp://send?text=${encodeURIComponent(text)}`;
    try {
      if (await Linking.canOpenURL(url)) {
        await Linking.openURL(url);
        tracked();
      } else toast('WhatsApp n’est pas installé sur ce téléphone.');
    } catch {
      toast('WhatsApp n’est pas installé sur ce téléphone.');
    }
  };
  const copy = async () => {
    await Clipboard.setStringAsync(text);
    tracked();
    toast('Texte de la publication copié. Le lien direct arrivera avec le serveur YA YO.', 'success');
  };
  const needAccount = (what: string) => {
    onClose();
    toast(`Connecte-toi pour ${what}.`);
    router.push('/auth/connexion');
  };

  return (
    <Sheet visible onClose={onClose} title="Partager">
      {shareable ? (
        <View style={styles.targets}>
          <ShareTarget label="WhatsApp" bg="#25D366" icon={MessageCircle} onPress={whatsapp} />
          <ShareTarget label="Messenger" bg="#1f7ae0" icon={Send} onPress={system} />
          <ShareTarget label="Copier le lien" bg={color.bg.surfaceSunken} dark icon={Copy} onPress={copy} />
          <ShareTarget label="Autres" bg={color.bg.surfaceSunken} dark icon={MoreHorizontal} onPress={system} />
        </View>
      ) : (
        <Text variant="bodyS" color={color.text.secondary}>
          La boutique a désactivé le partage de cette publication.
        </Text>
      )}
      <View>
        <ShareRow
          icon={Repeat2}
          title={reposted ? 'Retirer de mon profil' : 'Republier sur mon profil'}
          subtitle="Visible par tes abonnés, avec le produit lié"
          onPress={() => {
            if (!signedIn) return needAccount('republier');
            dispatch({ type: 'social/toggle', list: 'reposted', id: post.id });
            onClose();
            toast(reposted ? 'Retiré de ton profil.' : 'Republié sur ton profil', 'success');
          }}
        />
        <ShareRow
          icon={Bookmark}
          title={saved ? 'Retirer des enregistrements' : 'Enregistrer pour plus tard'}
          subtitle="Privé, dans « Mes enregistrements »"
          onPress={() => {
            dispatch({ type: 'social/toggle', list: 'saved', id: post.id });
            onClose();
            toast(saved ? 'Retiré de tes enregistrements.' : 'Enregistré', 'success');
          }}
        />
        <ShareRow
          icon={EyeOff}
          title="Pas intéressé"
          subtitle="Moins de publications de ce type"
          onPress={() => {
            dispatch({ type: 'social/hidePost', postId: post.id });
            onClose();
            toast('Publication masquée de ton fil.');
          }}
        />
        <ShareRow
          icon={Flag}
          danger
          title="Signaler la publication"
          subtitle="Contenu trompeur ou interdit"
          onPress={() => {
            if (!signedIn) return needAccount('signaler une publication');
            dispatch({ type: 'social/report', postId: post.id, at: stamp() });
            onClose();
            toast('Merci. La publication est envoyée à la modération YA YO et masquée pour toi.', 'success');
          }}
        />
      </View>
    </Sheet>
  );
}

function ShareTarget({ label, bg, icon: Icon, dark = false, onPress }: { label: string; bg: string; icon: typeof Share2; dark?: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={label} onPress={onPress} haptic="selection" scaleTo={pressScale.icon} style={styles.target}>
      <View style={[styles.targetIcon, { backgroundColor: bg }]}>
        <Icon size={24} color={dark ? color.icon.primary : color.icon.inverse} strokeWidth={2} />
      </View>
      <Text variant="labelS" align="center" numberOfLines={2}>
        {label}
      </Text>
    </PressableScale>
  );
}

function ShareRow({ icon: Icon, title, subtitle, danger = false, onPress }: { icon: typeof Share2; title: string; subtitle: string; danger?: boolean; onPress: () => void }) {
  return (
    <PressableScale accessibilityRole="button" accessibilityLabel={title} accessibilityHint={subtitle} onPress={onPress} haptic="selection" scaleTo={pressScale.card} style={styles.shareRow}>
      <Icon size={24} color={danger ? color.icon.danger : color.icon.primary} strokeWidth={2} />
      <View style={styles.flex}>
        <Text variant="labelL" color={danger ? color.text.danger : color.text.primary}>
          {title}
        </Text>
        <Text variant="bodyS" color={color.text.secondary}>
          {subtitle}
        </Text>
      </View>
    </PressableScale>
  );
}

/* ---------- SC6 · Ranger dans un dossier ---------- */

export function FolderSheet({ postId, onClose }: { postId: string | null; onClose: () => void }) {
  const { state, dispatch } = useStore();
  const toast = useToast();
  const [name, setName] = useState('');
  const folders = Object.keys(state.social.folders);
  const current = postId ? folders.find((f) => state.social.folders[f]!.includes(postId)) : undefined;
  const put = (folder: string | null) => {
    if (!postId) return;
    dispatch({ type: 'social/folder', postId, folder });
    setName('');
    onClose();
    toast(folder ? `Rangé dans « ${folder.trim()} »` : 'Retiré du dossier', 'success');
  };
  return (
    <Sheet
      visible={!!postId}
      onClose={onClose}
      title="Ranger dans un dossier"
      footer={<Button label="Créer et ranger" disabled={name.trim().length < 2} onPress={() => put(name)} fill />}
    >
      {folders.length ? (
        <View style={styles.chips}>
          {folders.map((f) => (
            <Chip key={f} label={f} selected={f === current} onPress={() => put(f === current ? null : f)} />
          ))}
        </View>
      ) : null}
      <TextField label="Nouveau dossier" placeholder="Cadeaux, Audio…" value={name} maxLength={30} onChangeText={setName} />
    </Sheet>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, minWidth: 0, gap: 2 },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap' },
  list: { maxHeight: 420 },
  comment: { flexDirection: 'row', gap: space.md },
  reply: { marginLeft: 40 },
  avatar: { width: 32, height: 32, borderRadius: 16, backgroundColor: color.bg.accentSubtle, alignItems: 'center', justifyContent: 'center' },
  avatarSeller: { backgroundColor: color.bg.inverse },
  sellerBadge: { backgroundColor: color.bg.accent, borderRadius: radius.full, paddingHorizontal: space.sm, paddingVertical: 1 },
  likes: { alignItems: 'center', gap: 2, paddingTop: 2 },
  composerWrap: { flex: 1, gap: space.sm },
  composer: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  meAvatar: { width: 36, height: 36, borderRadius: 18, backgroundColor: color.bg.accentSubtle, alignItems: 'center', justifyContent: 'center' },
  input: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.full,
    backgroundColor: color.bg.surfaceSunken,
    paddingHorizontal: space.lg,
    color: color.text.primary,
  },
  send: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  targets: { flexDirection: 'row', justifyContent: 'space-between' },
  target: { width: 76, alignItems: 'center', gap: space.xs },
  targetIcon: { width: 56, height: 56, borderRadius: 28, alignItems: 'center', justifyContent: 'center' },
  shareRow: { flexDirection: 'row', alignItems: 'center', gap: space.lg, paddingVertical: space.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
});
