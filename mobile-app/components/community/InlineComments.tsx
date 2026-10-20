import React, { useMemo, useState } from 'react';
import { ActivityIndicator, TextInput, TouchableOpacity, View } from 'react-native';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { HelixaText } from '../HelixaText';
import type { CommunityComment, CommunityPost } from '../../api/community';
import { useAuth } from '../../hooks/useAuth';
import { useAddComment, usePostComments } from '../../hooks/useCommunity';
import { relativeTime } from '../../lib/relativeTime';
import { useTheme } from '../../context/ThemeContext';

const PINK = '#C93A86';
const PREVIEW = 3; // comments shown before "Load more comments"
const STEP = 5; // how many more each tap reveals
const MAX_LENGTH = 1000;

function CommentCard({ c }: { c: CommunityComment }) {
  const { colors } = useTheme();
  const sending = c.id < 0; // optimistic row that has not reached the server yet
  return (
    <View style={{ flexDirection: 'row', gap: 12, backgroundColor: colors.elevated, borderRadius: 14, padding: 14, marginBottom: 10, opacity: sending ? 0.55 : 1 }}>
      <Avatar uri={c.author.profile_picture} name={c.author.name} style={{ width: 44, height: 44, borderRadius: 22 }} />
      <View style={{ flex: 1 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <HelixaText style={{ fontSize: 17, color: colors.text }}>{c.is_mine ? 'You' : c.author.name}</HelixaText>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
            <MaterialCommunityIcons name="history" size={15} color="#B5A8F0" />
            <HelixaText style={{ fontSize: 14, color: colors.textSecondary }}>{sending ? 'Sending…' : relativeTime(c.created_at)}</HelixaText>
          </View>
        </View>
        <HelixaText style={{ fontSize: 15, lineHeight: 23, color: colors.text, marginTop: 8 }}>{c.body}</HelixaText>
      </View>
    </View>
  );
}

/**
 * A post's comments, shown in a grey panel directly under the post: the first few comments (oldest first),
 * "Load more comments", and a composer. Mounted only while the post's comments are open; the data lives in
 * the React Query cache, so closing and reopening is instant and new comments arrive live.
 */
export function InlineComments({ post }: { post: CommunityPost }) {
  const { colors } = useTheme();
  const { user } = useAuth();
  const query = usePostComments(post.id);
  const add = useAddComment(post.id);
  const [text, setText] = useState('');
  const [visible, setVisible] = useState(PREVIEW);

  const comments = useMemo(() => query.data?.pages.flatMap((p) => p.items) ?? [], [query.data]);
  const shown = comments.slice(0, visible);
  // More to reveal: either already-loaded comments we are hiding, or further pages on the server.
  const hasMore = comments.length > visible || !!query.hasNextPage;
  const canSend = text.trim().length > 0;

  const loadMore = async () => {
    const next = visible + STEP;
    // Make sure enough comments are loaded to fill the next step before revealing it.
    if (comments.length < next && query.hasNextPage && !query.isFetchingNextPage) await query.fetchNextPage();
    setVisible(next);
  };

  const send = () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    setVisible((v) => Math.max(v, comments.length + 1)); // keep your own comment in view
    add.mutate(body, { onError: () => setText(body) }); // hand the text back if it fails
  };

  const countLabel =
    post.comment_count === 0 ? 'No comments yet' : `${post.comment_count} ${post.comment_count === 1 ? 'comment' : 'comments'}`;

  return (
    <View style={{ marginTop: 16, backgroundColor: colors.surface, borderRadius: 22, padding: 16 }}>
      <HelixaText style={{ fontSize: 17, color: colors.text, marginBottom: 14, marginLeft: 4 }}>{countLabel}</HelixaText>

      {query.isLoading ? (
        <ActivityIndicator color={PINK} style={{ marginVertical: 18 }} />
      ) : query.isError ? (
        <TouchableOpacity onPress={() => query.refetch()} style={{ paddingVertical: 14, alignItems: 'center' }}>
          <HelixaText style={{ color: colors.textSecondary }}>We couldn&apos;t load the comments. <HelixaText weight="bold" style={{ color: PINK }}>Try again</HelixaText></HelixaText>
        </TouchableOpacity>
      ) : (
        shown.map((c) => <CommentCard key={c.id} c={c} />)
      )}

      {hasMore && !query.isLoading && (
        <TouchableOpacity
          onPress={loadMore}
          disabled={query.isFetchingNextPage}
          accessibilityRole="button"
          accessibilityLabel="Load more comments"
          style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 12, paddingHorizontal: 6, marginBottom: 4 }}>
          {query.isFetchingNextPage ? <ActivityIndicator size="small" color={colors.text} /> : <Feather name="maximize-2" size={17} color={colors.text} />}
          <HelixaText style={{ fontSize: 16, color: colors.text }}>Load more comments</HelixaText>
        </TouchableOpacity>
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.elevated, borderRadius: 18, padding: 12, marginTop: 6 }}>
        <Avatar uri={user?.profilePicture} name={user?.name} style={{ width: 44, height: 44, borderRadius: 22 }} />
        <TextInput
          value={text}
          onChangeText={setText}
          placeholder="Share your thoughts"
          placeholderTextColor={colors.textMuted}
          maxLength={MAX_LENGTH}
          returnKeyType="send"
          blurOnSubmit={false}
          onSubmitEditing={send}
          accessibilityLabel="Write a comment"
          style={{ flex: 1, height: 46, borderRadius: 10, borderWidth: 1, borderColor: colors.border, paddingHorizontal: 14, fontSize: 15, color: colors.text, fontFamily: 'Helixa-Regular' }}
        />
        <TouchableOpacity
          onPress={send}
          disabled={!canSend}
          activeOpacity={0.8}
          accessibilityLabel="Send comment"
          style={{ height: 46, paddingHorizontal: 20, borderRadius: 10, backgroundColor: PINK, opacity: canSend ? 1 : 0.45, alignItems: 'center', justifyContent: 'center' }}>
          <HelixaText weight="bold" style={{ fontSize: 15, color: '#FFF' }}>Send</HelixaText>
        </TouchableOpacity>
      </View>
    </View>
  );
}
