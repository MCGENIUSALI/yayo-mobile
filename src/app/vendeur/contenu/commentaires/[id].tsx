import { useLocalSearchParams } from 'expo-router';
import { MessageCircle } from 'lucide-react-native';
import { useState } from 'react';
import { ScrollView, StyleSheet } from 'react-native';
import type { Comment } from '@/domain/content';
import { useSeller } from '@/store/useSeller';
import { space } from '@/theme/tokens';
import { ReplySheet, SellerCommentCard } from '@/ui/ContentComments';
import { Chip } from '@/ui/Form';
import { Content, Screen } from '@/ui/Layout';
import { EmptyState } from '@/ui/Seller';
import { TopAppBar } from '@/ui/TopAppBar';

type Filter = 'all' | 'review' | 'masked' | 'blocked';

/** SV8 · Tous les commentaires, with the seller's filters. */
export default function AllComments() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { state } = useSeller();
  const [filter, setFilter] = useState<Filter>('all');
  const [replying, setReplying] = useState<Comment | null>(null);
  const all = id ? (state.content.comments[id] ?? []) : [];
  const groups: Record<Filter, Comment[]> = {
    all: all.filter((c) => c.status !== 'blocked'),
    review: all.filter((c) => c.review && c.status !== 'blocked'),
    masked: all.filter((c) => c.status === 'masked'),
    blocked: all.filter((c) => c.status === 'blocked'),
  };
  const list = [...groups[filter]].sort((a, b) => (a.pinned === b.pinned ? b.at.localeCompare(a.at) : a.pinned ? -1 : 1));
  const labels: Record<Filter, string> = { all: 'Tous', review: 'À modérer', masked: 'Masqués', blocked: 'Bloqués' };

  return (
    <Screen>
      <TopAppBar title={`Commentaires (${groups.all.length})`} />
      <Content>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {(Object.keys(labels) as Filter[]).map((f) => (
            <Chip key={f} label={`${labels[f]} · ${groups[f].length}`} selected={filter === f} onPress={() => setFilter(f)} />
          ))}
        </ScrollView>
        {list.length ? (
          list.map((c) => <SellerCommentCard key={c.id} comment={c} onReply={setReplying} />)
        ) : (
          <EmptyState icon={MessageCircle} title="Aucun commentaire ici" body="Les commentaires de tes acheteurs apparaîtront dans cette liste." />
        )}
      </Content>
      <ReplySheet target={replying} onClose={() => setReplying(null)} />
    </Screen>
  );
}

const styles = StyleSheet.create({ chips: { gap: space.sm } });
