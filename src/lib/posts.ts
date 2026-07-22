import { supabase } from "@/lib/supabaseClient";
import type { Post, PostComment } from "@/types/posts";
import { awardPoints, deductPoints } from "./points";
import { validateContent } from "./profanityFilter";

type JoinedUser = {
  username: string | null;
  full_name: string | null;
  avatar_url: string | null;
};

type JoinedCount = { count: number };
type JoinedLike = { user_id: string };
type JoinedVote = { user_id: string };
type JoinedPollOption = {
  id: string;
  option_text: string;
  poll_votes?: JoinedVote[] | null;
};

type PostRow = Omit<Post, "likes_count" | "comments_count" | "has_liked" | "poll_options" | "user_vote_option_id"> & {
  user?: JoinedUser | null;
  post_likes?: JoinedLike[] | null;
  post_comments?: JoinedCount[] | null;
  poll_options?: JoinedPollOption[] | null;
};

function transformPostRow(post: PostRow, currentUserId?: string): Post {
  let pollOptions = undefined;
  let userVoteOptionId: string | null = null;

  if (post.type === "poll" && post.poll_options) {
    pollOptions = post.poll_options.map((option) => ({
      id: option.id,
      post_id: post.id,
      option_text: option.option_text,
      votes_count: option.poll_votes ? option.poll_votes.length : 0,
    }));

    if (currentUserId) {
      for (const option of post.poll_options) {
        if (option.poll_votes?.some((vote) => vote.user_id === currentUserId)) {
          userVoteOptionId = option.id;
          break;
        }
      }
    }
  }

  return {
    ...post,
    user: post.user ?? undefined,
    likes_count: post.post_likes ? post.post_likes.length : 0,
    comments_count: post.post_comments?.[0]?.count ?? 0,
    has_liked: currentUserId ? Boolean(post.post_likes?.some((like) => like.user_id === currentUserId)) : false,
    poll_options: pollOptions,
    user_vote_option_id: userVoteOptionId,
  };
}

export async function fetchPosts() {
  // First try with poll data, fall back to without if tables don't exist
  let data;
  let error;
  
  // Try fetching with poll options first
  const pollResult = await supabase
    .from("posts")
    .select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      ),
      post_likes (user_id),
      post_comments (count),
      poll_options (
        id,
        option_text,
        poll_votes (user_id)
      )
    `)
    .order("created_at", { ascending: false });

  // If poll tables don't exist, fetch without them
  if (pollResult.error && pollResult.error.message.includes('poll_options')) {
    const basicResult = await supabase
      .from("posts")
      .select(`
        *,
        user:user_id (
          username,
          full_name,
          avatar_url
        ),
        post_likes (user_id),
        post_comments (count)
      `)
      .order("created_at", { ascending: false });
    
    data = basicResult.data;
    error = basicResult.error;
  } else {
    data = pollResult.data;
    error = pollResult.error;
  }

  if (error) throw error;

  // Transform data to include counts and has_liked
  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  return ((data ?? []) as PostRow[]).map((post) => transformPostRow(post, currentUserId));
}

export async function fetchPostById(postId: string) {
  // Try fetching with poll options first
  let data;
  let error;
  
  const pollResult = await supabase
    .from("posts")
    .select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      ),
      post_likes (user_id),
      post_comments (count),
      poll_options (
        id,
        option_text,
        poll_votes (user_id)
      )
    `)
    .eq("id", postId)
    .single();

  // If poll tables don't exist, fetch without them
  if (pollResult.error && pollResult.error.message.includes('poll_options')) {
    const basicResult = await supabase
      .from("posts")
      .select(`
        *,
        user:user_id (
          username,
          full_name,
          avatar_url
        ),
        post_likes (user_id),
        post_comments (count)
      `)
      .eq("id", postId)
      .single();
    
    data = basicResult.data;
    error = basicResult.error;
  } else {
    data = pollResult.data;
    error = pollResult.error;
  }

  if (error) throw error;

  const { data: { user } } = await supabase.auth.getUser();
  const currentUserId = user?.id;

  return transformPostRow(data as PostRow, currentUserId);
}

export async function createPost(post: { title: string; description: string; image_url?: string; type?: 'text' | 'poll'; poll_options?: string[] }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");


  // Validate content before creating post
  validateContent(post.title);
  validateContent(post.description);
  if (post.poll_options) {
    post.poll_options.forEach(option => {
      validateContent(option);
    });
  }

  // 1. Create the post
  const { data: postData, error: postError } = await supabase
    .from("posts")
    .insert({
      title: post.title,
      description: post.description,
      image_url: post.image_url,
      type: post.type || 'text',
      user_id: user.id,
    })
    .select()
    .single();

  if (postError) throw postError;

  // 2. If it's a poll, create options
  if (post.type === 'poll' && post.poll_options && post.poll_options.length > 0) {
    const optionsToInsert = post.poll_options.map(optionText => ({
      post_id: postData.id,
      option_text: optionText
    }));

    const { error: optionsError } = await supabase
      .from("poll_options")
      .insert(optionsToInsert);

    if (optionsError) {
      console.error("Failed to create poll options", optionsError);
      // Should probably delete the post if options fail, but for now just log
    }
  }

  // Increment user points
  try {
    await awardPoints(user.id, 10);
    // Profile will refresh automatically via useUserPoints hook watching profile.points
  } catch (pointsError) {
    console.error("Failed to award points for post creation", pointsError);
  }
  
  return postData;
}

export async function votePoll(postId: string, optionId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  // Check if user already voted for this post
  const { data: existingVote, error: checkError } = await supabase
    .from("poll_votes")
    .select("id")
    .eq("post_id", postId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (checkError) throw checkError;

  if (existingVote) {
    throw new Error("You have already voted on this poll");
  }

  const { error } = await supabase
    .from("poll_votes")
    .insert({
      post_id: postId,
      poll_option_id: optionId,
      user_id: user.id
    });

  if (error) throw error;
  
  // Award points for voting? Maybe small amount
  try {
    await awardPoints(user.id, 1);
  } catch (pointsError) {
    console.error("Failed to award points for voting", pointsError);
  }
}

export async function toggleLikePost(postId: string, hasLiked: boolean) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  if (hasLiked) {
    // Unlike
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", user.id);
    if (error) throw error;

    // Decrement user points
    try {
      await deductPoints(user.id, 1);
    } catch (pointsError) {
      console.error("Failed to deduct points for post unlike", pointsError);
    }
  } else {
    // Like
    const { error } = await supabase
      .from("post_likes")
      .insert({
        post_id: postId,
        user_id: user.id,
      });
    if (error) throw error;

    // Increment user points
    try {
      await awardPoints(user.id, 1);
    } catch (pointsError) {
      console.error("Failed to award points for post like", pointsError);
    }
  }
}

export async function fetchComments(postId: string) {
  const { data, error } = await supabase
    .from("post_comments")
    .select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      )
    `)
    .eq("post_id", postId)
    .order("created_at", { ascending: true });

  if (error) throw error;

  // Build tree structure
  const commentsMap = new Map<string, PostComment>();
  const rootComments: PostComment[] = [];

  (data as PostComment[]).forEach((comment) => {
    commentsMap.set(comment.id, { ...comment, replies: [] });
  });

  (data as PostComment[]).forEach((comment) => {
    if (comment.parent_id) {
      const parent = commentsMap.get(comment.parent_id);
      if (parent) {
        parent.replies?.push(commentsMap.get(comment.id)!);
      }
    } else {
      rootComments.push(commentsMap.get(comment.id)!);
    }
  });

  return rootComments;
}

export async function addComment(postId: string, content: string, parentId?: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");
  
  // Validate content before creating comment
  validateContent(content);

  const { data, error } = await supabase
    .from("post_comments")
    .insert({
      post_id: postId,
      user_id: user.id,
      content,
      parent_id: parentId || null,
    })
    .select(`
      *,
      user:user_id (
        username,
        full_name,
        avatar_url
      )
    `)
    .single();

  if (error) throw error;

  // Increment user points
  try {
    await awardPoints(user.id, 2);
  } catch (pointsError) {
    console.error("Failed to award points for comment creation", pointsError);
  }

  return data as PostComment;
}

export async function deletePost(postId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("posts")
    .delete()
    .eq("id", postId);

  if (error) throw error;

  // Decrement user points
  try {
    await deductPoints(user.id, 10);
  } catch (pointsError) {
    console.error("Failed to deduct points for post deletion", pointsError);
  }
}

export async function updatePost(postId: string, updates: { title?: string; description?: string; image_url?: string }) {
  
  // Validate content before updating post
  if (updates.title) {
    validateContent(updates.title);
  }
  if (updates.description) {
    validateContent(updates.description);
  }

  const { data, error } = await supabase
    .from("posts")
    .update({
      ...updates,
      updated_at: new Date().toISOString(),
    })
    .eq("id", postId)
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteComment(commentId: string) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { error } = await supabase
    .from("post_comments")
    .delete()
    .eq("id", commentId);

  if (error) throw error;

  // Decrement user points
  try {
    await deductPoints(user.id, 2);
  } catch (pointsError) {
    console.error("Failed to deduct points for comment deletion", pointsError);
  }
}

export async function updateComment(commentId: string, content: string) {
  // Validate content before updating comment
  validateContent(content);

  const { data, error } = await supabase
    .from("post_comments")
    .update({ 
      content,
      updated_at: new Date().toISOString(),
    })
    .eq("id", commentId)
    .select()
    .single();

  if (error) throw error;
  return data;
}
