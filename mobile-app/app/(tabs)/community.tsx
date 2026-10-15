import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  KeyboardAvoidingView,
  Platform,
  RefreshControl,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather } from '@expo/vector-icons';
import { CalText } from '../../components/CalText';
import { HelixaText } from '../../components/HelixaText';
import { Avatar } from '../../components/Avatar';
import { PostCard } from '../../components/community/PostCard';
import { ShareModal } from '../../components/community/ShareModal';
import type { CommunityPost } from '../../api/community';
import { useAuth } from '../../hooks/useAuth';
import { useTheme } from '../../context/ThemeContext';
import {
  useCommunityFeed,
  useCommunityLive,
  useDeletePost,
  useViewTracker,
} from '../../hooks/useCommunity';

const PINK = '#C93A86';

/** Debounce a fast-changing value (the search box) so we don't hit the API on every keystroke. */
function useDebounced<T>(value: T, ms: number): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const id = setTimeout(() => setDebounced(value), ms);
    return () => clearTimeout(id);
  }, [value, ms]);
  return debounced;
}

export default function CommunityScreen() {
  const { colors } = useTheme();
  const { user } = useAuth();

  const [searchText, setSearchText] = useState('');
  const search = useDebounced(searchText.trim(), 350);
  const [shareOpen, setShareOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const feed = useCommunityFeed(search);
  useCommunityLive();
  const del = useDeletePost();
  const viewability = useViewTracker();

  const posts = useMemo(() => feed.data?.pages.flatMap((p) => p.items) ?? [], [feed.data]);
  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await feed.refetch();
    setRefreshing(false);
  }, [feed]);

  const renderItem = useCallback(
    ({ item }: { item: CommunityPost }) => (
      <PostCard post={item} onDelete={(p) => del.mutate(p.id)} />
    ),
    [del]
  );

  const header = (
    <View>
      <CalText style={{ fontSize: 30, color: PINK, marginTop: 14 }}>Community</CalText>
      <HelixaText style={{ fontSize: 17, lineHeight: 26, color: colors.textSecondary, marginTop: 10 }}>
        A warm space to share, ask, and encourage one another.
      </HelixaText>

      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 12,
          height: 54,
          marginTop: 24,
          paddingHorizontal: 16,
          borderRadius: 14,
          borderWidth: 1,
          borderColor: colors.border,
          backgroundColor: colors.bgSoft,
        }}>
        <Feather name="search" size={20} color={colors.textSecondary} />
        <TextInput
          value={searchText}
          onChangeText={setSearchText}
          placeholder="Search"
          placeholderTextColor={colors.textMuted}
          returnKeyType="search"
          autoCorrect={false}
          accessibilityLabel="Search the community"
          style={{
            flex: 1,
            fontSize: 16,
            color: colors.text,
            fontFamily: 'Helixa-Regular',
            paddingVertical: 0,
          }}
        />
        {searchText.length > 0 && (
          <TouchableOpacity
            onPress={() => setSearchText('')}
            hitSlop={10}
            accessibilityLabel="Clear search">
            <Feather name="x-circle" size={18} color={colors.textMuted} />
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => setShareOpen(true)}
        accessibilityRole="button"
        accessibilityLabel="Share something with the community"
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          gap: 14,
          marginTop: 20,
          marginBottom: 34,
          padding: 14,
          borderRadius: 20,
          backgroundColor: colors.surface,
        }}>
        <Avatar
          uri={user?.profilePicture}
          name={user?.name}
          style={{ width: 50, height: 50, borderRadius: 25 }}
        />
        <View
          style={{
            flex: 1,
            height: 50,
            borderRadius: 12,
            backgroundColor: colors.card,
            borderWidth: 1,
            borderColor: colors.border,
            justifyContent: 'center',
            paddingHorizontal: 16,
          }}>
          <HelixaText style={{ fontSize: 16, color: colors.textMuted }}>
            What&apos;s on your mind?
          </HelixaText>
        </View>
      </TouchableOpacity>
    </View>
  );

  const empty = feed.isLoading ? (
    <View style={{ paddingVertical: 50, alignItems: 'center' }}>
      <ActivityIndicator color={PINK} />
    </View>
  ) : feed.isError ? (
    <View style={{ paddingVertical: 40, alignItems: 'center' }}>
      <HelixaText style={{ color: colors.textSecondary, textAlign: 'center' }}>
        We couldn&apos;t load the community right now.
      </HelixaText>
      <TouchableOpacity onPress={() => feed.refetch()} style={{ marginTop: 14 }}>
        <HelixaText weight="bold" style={{ color: PINK }}>
          Try again
        </HelixaText>
      </TouchableOpacity>
    </View>
  ) : (
    <View style={{ paddingVertical: 40, alignItems: 'center', paddingHorizontal: 20 }}>
      <Feather name={search ? 'search' : 'message-circle'} size={36} color={colors.textMuted} />
      <HelixaText weight="bold" style={{ fontSize: 17, color: colors.text, marginTop: 14 }}>
        {search ? 'No posts found' : 'Nothing shared yet'}
      </HelixaText>
      <HelixaText style={{ fontSize: 14, color: colors.textSecondary, marginTop: 6, textAlign: 'center' }}>
        {search
          ? `Nothing matches "${search}".`
          : 'Be the first to share something with other mums.'}
      </HelixaText>
    </View>
  );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={['top']}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={{ flex: 1 }}>
        <FlatList
          data={posts}
          keyExtractor={(p) => String(p.id)}
          renderItem={renderItem}
          ListHeaderComponent={header}
          ListEmptyComponent={empty}
          ListFooterComponent={
            feed.isFetchingNextPage ? (
              <ActivityIndicator color={PINK} style={{ marginVertical: 16 }} />
            ) : null
          }
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 150 }}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="on-drag"
          onEndReached={() => feed.hasNextPage && !feed.isFetchingNextPage && feed.fetchNextPage()}
          onEndReachedThreshold={0.6}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={PINK}
              colors={[PINK]}
            />
          }
          viewabilityConfigCallbackPairs={viewability}
          // A new post arriving live at the top must not shove what you're reading down the screen.
          maintainVisibleContentPosition={{ minIndexForVisible: 0 }}
          initialNumToRender={6}
          windowSize={9}
          removeClippedSubviews
        />
      </KeyboardAvoidingView>

      <ShareModal visible={shareOpen} onClose={() => setShareOpen(false)} />
    </SafeAreaView>
  );
}
