import { apiClient } from './client';

export interface CommunityAuthor {
  id: string;
  name: string; // first name only
  profile_picture?: string | null;
}

export interface CommunityPost {
  id: number;
  author: CommunityAuthor;
  body: string;
  image_url?: string | null;
  like_count: number;
  comment_count: number;
  view_count: number;
  recent_viewers: CommunityAuthor[];
  created_at: string;
  liked_by_me: boolean;
  is_mine: boolean;
}

export interface CommunityComment {
  id: number;
  post_id: number;
  author: CommunityAuthor;
  body: string;
  created_at: string;
  is_mine: boolean;
}

export interface Page<T> {
  items: T[];
  next_cursor: string | null;
}

export interface PostStats {
  post_id: number;
  like_count: number;
  comment_count: number;
  view_count: number;
}

export const FEED_PAGE_SIZE = 10;

const unwrap = <T>(res: { data: { data: T } }): T => res.data.data;

export const communityApi = {
  feed: async (params: { cursor?: string | null; q?: string; limit?: number }): Promise<Page<CommunityPost>> =>
    unwrap(await apiClient.get('/community/posts', {
      params: { cursor: params.cursor || undefined, q: params.q || undefined, limit: params.limit ?? FEED_PAGE_SIZE },
    })),

  /** Uploads one image (multipart) and returns its hosted URL, to be attached to a post. */
  uploadImage: async (file: { uri: string; name?: string | null; type?: string | null }): Promise<string> => {
    const form = new FormData() as any;
    form.append('image', { uri: file.uri, name: file.name || 'post.jpg', type: file.type || 'image/jpeg' });
    const data = unwrap<{ url: string }>(await apiClient.post('/community/images', form, {
      headers: { 'Content-Type': 'multipart/form-data' },
      timeout: 60_000,
    }));
    return data.url;
  },

  createPost: async (body: { body: string; image_url?: string | null }): Promise<CommunityPost> =>
    unwrap(await apiClient.post('/community/posts', body)),

  deletePost: async (postId: number): Promise<void> => {
    await apiClient.delete(`/community/posts/${postId}`);
  },

  like: async (postId: number): Promise<{ liked: boolean; like_count: number }> =>
    unwrap(await apiClient.post(`/community/posts/${postId}/like`)),
  unlike: async (postId: number): Promise<{ liked: boolean; like_count: number }> =>
    unwrap(await apiClient.delete(`/community/posts/${postId}/like`)),

  comments: async (postId: number, cursor?: string | null): Promise<Page<CommunityComment>> =>
    unwrap(await apiClient.get(`/community/posts/${postId}/comments`, { params: { cursor: cursor || undefined, limit: 20 } })),
  addComment: async (postId: number, body: string): Promise<CommunityComment> =>
    unwrap(await apiClient.post(`/community/posts/${postId}/comments`, { body })),

  /** Fire-and-forget: the server queues the views and counts them within a few seconds. */
  recordViews: async (postIds: number[]): Promise<number> =>
    unwrap<{ queued: number }>(await apiClient.post('/community/views', { post_ids: postIds })).queued,
};
