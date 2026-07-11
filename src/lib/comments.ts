import { supabase } from "@/lib/supabaseClient";
import { validateContent } from "@/lib/profanityFilter";

export type Comment = {
  id: string;
  listing_id: string;
  user_id: string;
  content: string;
  created_at: string;
};

export async function fetchCommentsByListingId(listingId: string) {
  const { data, error } = await supabase
    .from("comments")
    .select("*")
    .eq("listing_id", listingId)
    .order("created_at", { ascending: true });

  if (error) {
    throw error;
  }

  return data as Comment[];
}

export async function addComment(listingId: string, content: string) {
  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError || !user) {
    throw new Error("You must be logged in to comment.");
  }

  validateContent(content);

  const { data, error } = await supabase
    .from("comments")
    .insert({
      listing_id: listingId,
      user_id: user.id,
      content,
    })
    .select()
    .single();

  if (error) {
    throw error;
  }

  return data as Comment;
}
