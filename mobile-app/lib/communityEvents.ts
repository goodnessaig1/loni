/**
 * Handler for server `community_*` events arriving over the shared WebSocket (api/socket.ts), delivered
 * to clients that subscribed to the "community" topic while the feed is open. They go straight into the
 * React Query cache, so the UI updates without any polling or refetch.
 *
 * Broadcasts carry no per-recipient flags (liked_by_me / is_mine), so those are filled in here:
 * somebody else's brand-new post is, by definition, neither mine nor liked by me.
 */
import type { CommunityComment, CommunityPost, PostStats } from '../api/community';
import { appendComment, patchPost, prependPost, removePost } from './communityCache';

export function applyServerCommunityEvent(type: string, data: any) {
  if (!data) return;

  switch (type) {
    case 'community_post_created': {
      const post: CommunityPost = { ...data, liked_by_me: false, is_mine: false };
      prependPost(post);
      break;
    }
    case 'community_post_stats': {
      const s = data as PostStats;
      patchPost(s.post_id, { like_count: s.like_count, comment_count: s.comment_count, view_count: s.view_count });
      break;
    }
    case 'community_post_deleted':
      removePost(Number(data.post_id));
      break;
    case 'community_comment_created': {
      const comment: CommunityComment = { ...data, is_mine: false };
      appendComment(comment);
      break;
    }
    default:
      break;
  }
}
