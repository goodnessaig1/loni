/**
 * Helpers for editing the community React Query caches in place (used by the mutations' optimistic
 * updates AND by the WebSocket handlers, so a change made here or by someone else lands identically).
 *
 * Cache shapes:
 *   ['community', 'feed', <search>]        -> InfiniteData<Page<CommunityPost>>
 *   ['community', 'comments', <postId>]    -> InfiniteData<Page<CommunityComment>>
 */
import type { InfiniteData } from '@tanstack/react-query';
import { queryClient } from './queryClient';
import type { CommunityComment, CommunityPost, Page } from '../api/community';

export const communityKeys = {
  all: ['community'] as const,
  feed: (search = '') => ['community', 'feed', search] as const,
  feeds: ['community', 'feed'] as const,
  comments: (postId: number) => ['community', 'comments', postId] as const,
};

type FeedData = InfiniteData<Page<CommunityPost>>;
type CommentData = InfiniteData<Page<CommunityComment>>;

function mapFeeds(fn: (items: CommunityPost[]) => CommunityPost[]) {
  queryClient.setQueriesData<FeedData>({ queryKey: communityKeys.feeds }, (old) =>
    old ? { ...old, pages: old.pages.map((p) => ({ ...p, items: fn(p.items) })) } : old,
  );
}

export function patchPost(postId: number, patch: Partial<CommunityPost> | ((p: CommunityPost) => Partial<CommunityPost>)) {
  mapFeeds((items) =>
    items.map((p) => (p.id === postId ? { ...p, ...(typeof patch === 'function' ? patch(p) : patch) } : p)),
  );
}

export function removePost(postId: number) {
  mapFeeds((items) => items.filter((p) => p.id !== postId));
}

/** Add a post to the top of the un-searched feed (searches are not live-updated). No-op if already present. */
export function prependPost(post: CommunityPost) {
  queryClient.setQueryData<FeedData>(communityKeys.feed(''), (old) => {
    if (!old) return old;
    if (old.pages.some((pg) => pg.items.some((p) => p.id === post.id))) return old;
    const [first, ...rest] = old.pages;
    return { ...old, pages: [{ ...first, items: [post, ...first.items] }, ...rest] };
  });
}

export function snapshotFeeds() {
  return queryClient.getQueriesData<FeedData>({ queryKey: communityKeys.feeds });
}

export function restoreFeeds(snapshot: ReturnType<typeof snapshotFeeds>) {
  snapshot.forEach(([key, data]) => queryClient.setQueryData(key, data));
}

/** Append a comment to a post's loaded thread (if that thread is cached). Dedupes by id. */
export function appendComment(comment: CommunityComment) {
  queryClient.setQueryData<CommentData>(communityKeys.comments(comment.post_id), (old) => {
    if (!old) return old;
    if (old.pages.some((pg) => pg.items.some((c) => c.id === comment.id))) return old;
    const pages = old.pages.slice();
    const last = pages[pages.length - 1];
    pages[pages.length - 1] = { ...last, items: [...last.items, comment] };
    return { ...old, pages };
  });
}

export function replaceComment(postId: number, tempId: number, real: CommunityComment) {
  queryClient.setQueryData<CommentData>(communityKeys.comments(postId), (old) => {
    if (!old) return old;
    const alreadyThere = old.pages.some((pg) => pg.items.some((c) => c.id === real.id));
    return {
      ...old,
      pages: old.pages.map((pg) => ({
        ...pg,
        // If the socket already delivered the real comment, drop the temp one and mark the real one as mine
        // (broadcasts never carry per-recipient flags).
        items: alreadyThere
          ? pg.items.filter((c) => c.id !== tempId).map((c) => (c.id === real.id ? real : c))
          : pg.items.map((c) => (c.id === tempId ? real : c)),
      })),
    };
  });
}

export function removeComment(postId: number, commentId: number) {
  queryClient.setQueryData<CommentData>(communityKeys.comments(postId), (old) =>
    old ? { ...old, pages: old.pages.map((pg) => ({ ...pg, items: pg.items.filter((c) => c.id !== commentId) })) } : old,
  );
}
