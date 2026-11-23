import { Image } from 'expo-image';
import { router, useLocalSearchParams } from 'expo-router';
import { Clock, EyeOff, Info, Send } from 'lucide-react-native';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { MAX_APPEAL, MAX_CAPTION, moderateText } from '@/domain/content';
import { formatDayTime } from '@/domain/format';
import { useSeller } from '@/store/useSeller';
import { color, radius, space } from '@/theme/tokens';
import { Button } from '@/ui/Button';
import { Alert, useToast } from '@/ui/Feedback';
import { TextField } from '@/ui/Form';
import { BottomBar, Card, Content, Screen } from '@/ui/Layout';
import { EmptyState } from '@/ui/Seller';
import { Sheet } from '@/ui/Sheet';
import { useRefusal } from '@/ui/SocialSheets';
import { Badge } from '@/ui/Status';
import { Text } from '@/ui/Text';
import { TopAppBar } from '@/ui/TopAppBar';

/** SV9 · Contenu masqué, SV9b · Contester la modération, and « Modifier et renvoyer ». */
export default function HiddenContent() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state, shop, dispatch } = useSeller();
  const toast = useToast();
  const stamp = useRefusal();
  const [appealing, setAppealing] = useState(false);
  const [editing, setEditing] = useState(false);
  const [message, setMessage] = useState('');
  const item = id ? state.content.items[id] : undefined;
  const [caption, setCaption] = useState(item?.caption ?? '');

  if (!item || item.shopId !== shop?.shopId || !item.moderation || item.status !== 'hidden') {
    return (
      <Screen>
        <TopAppBar title="Contenu masqué" />
        <EmptyState icon={EyeOff} title="Ce contenu n’est plus masqué" body="Il est de nouveau visible, ou il a été supprimé." action={<Button label="Retour" variant="outline" onPress={() => router.back()} />} />
      </Screen>
    );
  }
  const m = item.moderation;
  const pending = m.appeal?.status === 'pending';
  const stillBad = moderateText(caption).violations.length > 0;

  const appeal = () => {
    if (message.trim().length < 10) return;
    dispatch({ type: 'content/appeal', id: item.id, message, at: stamp() });
    setAppealing(false);
    toast('Contestation envoyée. Tu recevras la réponse par notification.', 'success');
  };
  const resubmit = () => {
    if (stillBad) return;
    dispatch({ type: 'content/resubmit', id: item.id, caption, at: stamp() });
    setEditing(false);
    toast('Contenu corrigé et remis en ligne.', 'success');
    router.back();
  };

  return (
    <Screen>
      <TopAppBar title="Contenu masqué" />
      <Content>
        <View style={styles.head}>
          <View style={styles.thumb}>{item.media[0] ? <Image source={item.media[0]} style={StyleSheet.absoluteFill} contentFit="cover" /> : null}</View>
          <View style={{ flex: 1, gap: space.xs }}>
            <Text variant="labelL" numberOfLines={2}>
              {item.caption}
            </Text>
            <Badge label="Masqué par YA YO" icon={EyeOff} tone="danger" />
            <Text variant="bodyS" color={color.text.secondary}>{`Masqué le ${formatDayTime(m.at)}`}</Text>
          </View>
        </View>
        <Card gap={space.xs}>
          <Text variant="caption" color={color.text.secondary}>
            Motif
          </Text>
          <Text variant="h4">{m.reason}</Text>
          <Text variant="bodyM" color={color.text.secondary}>
            {m.detail}
          </Text>
        </Card>
        {pending ? (
          <>
            <Alert tone="warning" icon={Clock} title="Contestation en cours d’examen" body={`Envoyée ${formatDayTime(m.appeal!.at)} : « ${m.appeal!.message} »`} />
            <View style={styles.demo}>
              <Text variant="caption" color={color.text.secondary}>
                MODE DÉMO · SIMULER LA RÉPONSE DE YA YO
              </Text>
              <Button label="Accepter la contestation" size="M" variant="outline" onPress={() => dispatch({ type: 'content/demoReview', id: item.id, accept: true, at: stamp() })} fill />
              <Button label="Refuser la contestation" size="M" variant="outline" onPress={() => dispatch({ type: 'content/demoReview', id: item.id, accept: false, at: stamp() })} fill />
            </View>
          </>
        ) : m.appeal?.status === 'rejected' ? (
          <Alert tone="danger" title="Contestation refusée" body="Modifie le contenu pour le remettre en ligne." />
        ) : null}
        <Alert tone="info" icon={Info} title="Ce que ça change" body="Ce contenu n’est plus visible des acheteurs. Tes autres contenus et ta boutique ne sont pas touchés." />
      </Content>
      <BottomBar>
        <View style={styles.footer}>
          {!pending && m.appeal?.status !== 'rejected' ? <Button label="Contester" variant="outline" onPress={() => setAppealing(true)} style={{ flex: 1 }} /> : null}
          <Button label="Modifier et renvoyer" onPress={() => setEditing(true)} style={{ flex: 1 }} />
        </View>
      </BottomBar>

      <Sheet
        visible={appealing}
        onClose={() => setAppealing(false)}
        title="Contester"
        footer={<Button label="Envoyer la contestation" leadingIcon={Send} disabled={message.trim().length < 10} onPress={appeal} fill />}
      >
        <Text variant="bodyS" color={color.text.secondary}>
          Explique pourquoi ce contenu respecte les règles. Un administrateur YA YO examine ta demande et tu reçois la réponse par notification.
        </Text>
        <TextField label="Ton message" placeholder="Le numéro affiché est celui du service client du fabricant." value={message} multiline maxLength={MAX_APPEAL} onChangeText={setMessage} />
        <Text variant="caption" color={color.text.tertiary}>{`${message.length} / ${MAX_APPEAL} caractères`}</Text>
        <Alert tone="warning" title="Le contenu reste masqué pendant l’examen" body="Si la contestation est acceptée, il repasse en ligne avec ses statistiques." />
      </Sheet>

      <Sheet visible={editing} onClose={() => setEditing(false)} title="Modifier et renvoyer" footer={<Button label="Renvoyer" disabled={stillBad || !caption.trim()} onPress={resubmit} fill />}>
        <TextField label="Légende" value={caption} multiline maxLength={MAX_CAPTION} onChangeText={setCaption} />
        <Text variant="caption" color={stillBad ? color.text.danger : color.text.tertiary}>
          {stillBad ? 'Retire le numéro, le lien ou la demande de paiement hors YA YO.' : 'La légende respecte les règles.'}
        </Text>
      </Sheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', gap: space.md, alignItems: 'center' },
  thumb: { width: 96, height: 96, borderRadius: radius.md, overflow: 'hidden', backgroundColor: color.bg.surfaceSunken },
  footer: { flex: 1, flexDirection: 'row', gap: space.md },
  demo: { borderRadius: radius.md, borderWidth: 1, borderStyle: 'dashed', borderColor: color.border.strong, padding: space.md, gap: space.sm },
});
