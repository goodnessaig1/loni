import React, { memo, useEffect, useRef, useState } from 'react';
import { Alert, Animated, Pressable, TouchableOpacity, View } from 'react-native';
import { Image } from 'expo-image';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import { Avatar } from '../Avatar';
import { HelixaText } from '../HelixaText';
import { CommentIcon, HeartIcon } from './CommunityIcons';
import { InlineComments } from './InlineComments';
import { ReportModal } from './ReportModal';
import { ViewerStack } from './ViewerStack';
import type { CommunityPost } from '../../api/community';
import { formatCount } from '../../lib/formatCount';
import { relativeTime } from '../../lib/relativeTime';
import { useToggleLike } from '../../hooks/useCommunity';
import { useTheme } from '../../context/ThemeContext';
import { cdnImage } from '../../lib/cdnImage';

const LIKED = '#E8483B';

interface Props {
  post: CommunityPost;
  onDelete: (post: CommunityPost) => void;
}

/** One feed post: author + time, text, optional image, then comments / likes on the left and viewers on the right. */
function PostCardBase({ post, onDelete }: Props) {
  const { colors, isDark } = useTheme();
  const toggleLike = useToggleLike(post.id);
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [reportOpen, setReportOpen] = useState(false);

  // The heart pops whenever it flips to liked.
  const pop = useRef(new Animated.Value(1)).current;
  const wasLiked = useRef(post.liked_by_me);
  useEffect(() => {
    if (post.liked_by_me && !wasLiked.current) {
      Animated.sequence([
        Animated.spring(pop, { toValue: 1.35, speed: 40, bounciness: 14, useNativeDriver: true }),
        Animated.spring(pop, { toValue: 1, speed: 20, bounciness: 8, useNativeDriver: true }),
      ]).start();
    }
    wasLiked.current = post.liked_by_me;
  }, [post.liked_by_me, pop]);

  const confirmDelete = () =>
    Alert.alert('Delete this post?', 'It will be removed from the community for everyone.', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: () => onDelete(post) },
    ]);

  // Someone else's post: the menu offers reporting it to the LONI team.
  const openOptions = () =>
    Alert.alert('Post options', undefined, [
      { text: 'Report post', style: 'destructive', onPress: () => setReportOpen(true) },
      { text: 'Cancel', style: 'cancel' },
    ]);

  return (
    <View style={{ marginBottom: 34 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
        <Avatar uri={post.author.profile_picture} name={post.author.name} style={{ width: 48, height: 48, borderRadius: 24 }} />
        <View style={{ marginLeft: 14, flex: 1 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <HelixaText style={{ fontSize: 18, color: colors.text }} numberOfLines={1}>{post.author.name}</HelixaText>
            {post.is_mine && (
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: isDark ? '#3A2A18' : '#FCEEDC', borderRadius: 14, paddingHorizontal: 12, paddingVertical: 5 }}>
                <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#B8651B' }} />
                <HelixaText style={{ fontSize: 14, color: '#B8651B' }}>You</HelixaText>
              </View>
            )}
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 3 }}>
            <MaterialCommunityIcons name="history" size={16} color="#B5A8F0" />
            <HelixaText style={{ fontSize: 14, color: colors.textSecondary }}>{relativeTime(post.created_at)}</HelixaText>
          </View>
        </View>
        <TouchableOpacity
          onPress={post.is_mine ? confirmDelete : openOptions}
          hitSlop={12}
          accessibilityLabel={post.is_mine ? 'Delete post' : 'Post options'}
          style={{ padding: 4 }}>
          <Feather name="more-horizontal" size={22} color={colors.textSecondary} />
        </TouchableOpacity>
      </View>

      {!!post.body && (
        <HelixaText style={{ fontSize: 16, lineHeight: 24, color: colors.text, marginTop: 16 }}>{post.body}</HelixaText>
      )}

      {!!post.image_url && (
        <Image
          source={{ uri: cdnImage(post.image_url, 400) }}
          style={{ width: '100%', aspectRatio: 1.9, marginTop: 16, backgroundColor: colors.placeholder }}
          contentFit="cover"
          transition={200}
          accessibilityLabel="Photo shared in the post"
        />
      )}

      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: 16 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 22 }}>
          <Pressable
            onPress={() => setCommentsOpen((o) => !o)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityState={{ expanded: commentsOpen }}
            accessibilityLabel={`${post.comment_count} comments. ${commentsOpen ? 'Hide' : 'Show'} comments`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <CommentIcon color={commentsOpen ? '#C93A86' : isDark ? '#8FA3B5' : '#5B7083'} />
            <HelixaText style={{ fontSize: 15, color: commentsOpen ? '#C93A86' : colors.textSecondary }}>{formatCount(post.comment_count)}</HelixaText>
          </Pressable>

          <Pressable
            onPress={() => toggleLike(post)}
            hitSlop={10}
            accessibilityRole="button"
            accessibilityState={{ selected: post.liked_by_me }}
            accessibilityLabel={post.liked_by_me ? `Unlike. ${post.like_count} likes` : `Like. ${post.like_count} likes`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <Animated.View style={{ transform: [{ scale: pop }] }}>
              <HeartIcon color={post.liked_by_me ? LIKED : colors.textSecondary} filled={post.liked_by_me} />
            </Animated.View>
            <HelixaText style={{ fontSize: 15, color: post.liked_by_me ? LIKED : colors.textSecondary }}>{formatCount(post.like_count)}</HelixaText>
          </Pressable>
        </View>

        <ViewerStack viewers={post.recent_viewers} count={post.view_count} />
      </View>

      {commentsOpen && <InlineComments post={post} />}

      {!post.is_mine && reportOpen && (
        <ReportModal visible={reportOpen} postId={post.id} authorName={post.author.name} onClose={() => setReportOpen(false)} />
      )}
    </View>
  );
}

// Re-render a card only when its own post object changes (the feed patches posts immutably).
export const PostCard = memo(PostCardBase);
