import { useCallback, useEffect, useRef } from 'react';
import { useFocusEffect } from 'expo-router';
import { AppState, ViewToken } from 'react-native';
import { useInfiniteQuery, useMutation, useQuery } from '@tanstack/react-query';
import Toast from 'react-native-toast-message';
import { communityApi, CommunityComment, CommunityPost, DEFAULT_REPORT_REASONS, FEED_PAGE_SIZE } from '../api/community';
import { subscribeTopic, unsubscribeTopic } from '../api/socket';
import {
  appendComment, communityKeys, patchPost, prependPost, removeComment, removePost, replaceComment,
  restoreFeeds, snapshotFeeds,
} from '../lib/communityCache';
import { queryClient } from '../lib/queryClient';
import { useAuth } from './useAuth';

const errorText = (e: any, fallback: string) => e?.response?.data?.message || e?.message || fallback;

/** Paginated feed. `search` is already debounced by the caller; each search term has its own cache entry. */
export function useCommunityFeed(search: string) {
  return useInfiniteQuery({
    queryKey: communityKeys.feed(search),
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => communityApi.feed({ cursor: pageParam, q: search, limit: FEED_PAGE_SIZE }),
    getNextPageParam: (last) => last.next_cursor,
  });
}

/**
 * Live updates while the feed screen is focused: subscribes to the "community" WebSocket topic, and when
 * the app returns to the foreground refreshes the feed (events sent while it was backgrounded were missed).
 * Also refreshes a stale feed each time the screen regains focus.
 */
export function useCommunityLive() {
  useFocusEffect(
    useCallback(() => {
      subscribeTopic('community');
      queryClient.invalidateQueries({ queryKey: communityKeys.feeds, refetchType: 'active' });
      const sub = AppState.addEventListener('change', (state) => {
        if (state === 'active') queryClient.invalidateQueries({ queryKey: communityKeys.feeds, refetchType: 'active' });
      });
      return () => {
        sub.remove();
        unsubscribeTopic('community');
      };
    }, []),
  );
}

/**
 * Like / unlike. The heart and count change the instant you tap (optimistic); the request follows.
 *
 * - `scope` makes requests for one post run strictly one after another, so a quick double-tap cannot
 *   arrive out of order and leave the server disagreeing with the screen.
 * - The server's answer (which includes everyone else's likes) is applied only when no further tap on
 *   this post is still in flight - otherwise it would briefly undo the newer tap.
 * - On failure the feed is simply refetched, which restores the truth whatever the tap history was.
 *
 * Returns `toggle(post)` - call it with the post as currently shown.
 */
export function useToggleLike(postId: number) {
  const inFlight = useRef(0);

  const mutation = useMutation({
    scope: { id: `community-like-${postId}` },
    mutationFn: async ({ like }: { like: boolean }) => (like ? communityApi.like(postId) : communityApi.unlike(postId)),
    onSuccess: (res) => {
      if (inFlight.current <= 1) patchPost(postId, { liked_by_me: res.liked, like_count: res.like_count });
    },
    onError: () => {
      queryClient.invalidateQueries({ queryKey: communityKeys.feeds });
      Toast.show({ type: 'error', text1: "Couldn't update your like", text2: 'Please try again.' });
    },
    onSettled: () => {
      inFlight.current = Math.max(0, inFlight.current - 1);
    },
  });

  return useCallback(
    (post: CommunityPost) => {
      const like = !post.liked_by_me;
      patchPost(postId, (p) => ({ liked_by_me: like, like_count: Math.max(0, p.like_count + (like ? 1 : -1)) }));
      inFlight.current += 1;
      mutation.mutate({ like });
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [postId],
  );
}

/** Upload the optional image, then create the post, then put it at the top of the feed. */
export function useCreatePost() {
  return useMutation({
    mutationFn: async ({ body, image }: { body: string; image?: { uri: string; name?: string | null; type?: string | null } | null }) => {
      const image_url = image ? await communityApi.uploadImage(image) : null;
      return communityApi.createPost({ body, image_url });
    },
    onSuccess: (post) => prependPost(post),
    onError: (e) => Toast.show({ type: 'error', text1: "Couldn't post", text2: errorText(e, 'Please try again.') }),
  });
}

export function useDeletePost() {
  return useMutation({
    mutationFn: (postId: number) => communityApi.deletePost(postId),
    onMutate: async (postId) => {
      await queryClient.cancelQueries({ queryKey: communityKeys.feeds });
      const snapshot = snapshotFeeds();
      removePost(postId);
      return { snapshot };
    },
    onError: (e, _id, ctx) => {
      if (ctx) restoreFeeds(ctx.snapshot);
      Toast.show({ type: 'error', text1: "Couldn't delete the post", text2: errorText(e, 'Please try again.') });
    },
  });
}

export function usePostComments(postId: number | null) {
  return useInfiniteQuery({
    queryKey: communityKeys.comments(postId ?? 0),
    enabled: postId != null,
    initialPageParam: null as string | null,
    queryFn: ({ pageParam }) => communityApi.comments(postId as number, pageParam),
    getNextPageParam: (last) => last.next_cursor,
  });
}

let tempCommentId = -1;

/** Optimistic comment: it appears at once (with a temporary id) and is swapped for the server's row. */
export function useAddComment(postId: number) {
  const { user } = useAuth();
  return useMutation({
    mutationFn: (body: string) => communityApi.addComment(postId, body),
    onMutate: (body) => {
      const temp: CommunityComment = {
        id: tempCommentId--,
        post_id: postId,
        body,
        created_at: new Date().toISOString(),
        is_mine: true,
        author: { id: user?.id ?? '', name: (user?.name ?? 'You').split(' ')[0], profile_picture: user?.profilePicture },
      };
      appendComment(temp);
      patchPost(postId, (p) => ({ comment_count: p.comment_count + 1 }));
      return { tempId: temp.id };
    },
    onSuccess: (real, _body, ctx) => ctx && replaceComment(postId, ctx.tempId, real),
    onError: (e, _body, ctx) => {
      if (ctx) removeComment(postId, ctx.tempId);
      patchPost(postId, (p) => ({ comment_count: Math.max(0, p.comment_count - 1) }));
      Toast.show({ type: 'error', text1: "Couldn't comment", text2: errorText(e, 'Please try again.') });
    },
  });
}

/**
 * Counts a "view" once a post has been on screen (≥60% visible) for a second, and batches the reports so
 * scrolling does not fire a request per post. Each post is sent at most once per session; the server
 * additionally keeps one view per person per post, and ignores your own posts.
 *
 * Returns the `viewabilityConfigCallbackPairs` to hand to the FlatList (must be a stable reference).
 */
export function useViewTracker() {
  const sent = useRef(new Set<number>());
  const pending = useRef(new Set<number>());
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const flush = useCallback(async () => {
    timer.current = null;
    const ids = [...pending.current];
    pending.current.clear();
    if (!ids.length) return;
    try {
      await communityApi.recordViews(ids);
    } catch {
      ids.forEach((id) => sent.current.delete(id)); // let a later scroll retry them
    }
  }, []);

  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  const onViewableItemsChanged = useRef(({ viewableItems }: { viewableItems: ViewToken[] }) => {
    for (const v of viewableItems) {
      const post = v.item as CommunityPost | undefined;
      if (!post || post.is_mine || sent.current.has(post.id)) continue;
      sent.current.add(post.id);
      pending.current.add(post.id);
    }
    if (pending.current.size && !timer.current) timer.current = setTimeout(flush, 1500);
  });

  return useRef([
    {
      viewabilityConfig: { itemVisiblePercentThreshold: 60, minimumViewTime: 1000 },
      onViewableItemsChanged: onViewableItemsChanged.current,
    },
  ]).current;
}


/** Reasons a post can be reported for. Falls back to the built-in list so the sheet never waits on the network. */
export function useReportReasons(enabled: boolean) {
  const query = useQuery({
    queryKey: ['community', 'report-reasons'],
    queryFn: communityApi.reportReasons,
    enabled,
    staleTime: 24 * 60 * 60 * 1000,
  });
  return query.data?.length ? query.data : DEFAULT_REPORT_REASONS;
}

/** Report a post to the LONI team. Shows the server's thank-you (or why it failed) as a toast. */
export function useReportPost() {
  return useMutation({
    mutationFn: ({ postId, reason, note }: { postId: number; reason: string; note?: string }) =>
      communityApi.reportPost(postId, { reason, note: note?.trim() || undefined }),
    onSuccess: (message) => Toast.show({ type: 'success', text1: 'Report sent', text2: message }),
    onError: (e: any) => {
      const tooMany = e?.response?.status === 429;
      Toast.show({
        type: 'error',
        text1: tooMany ? 'Too many reports' : "Couldn't send report",
        text2: tooMany ? "You've sent a lot of reports recently. Please try again later." : errorText(e, 'Please try again.'),
      });
    },
  });
}
