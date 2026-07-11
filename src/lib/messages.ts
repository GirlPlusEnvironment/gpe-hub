import { supabase } from "@/lib/supabaseClient";
import type { Conversation, ConversationParticipant, Message, Profile } from "@/types/messages";
import { awardPoints } from "./points";
import { validateContent } from "./profanityFilter";

type ConversationRow = {
  id: string;
  is_group_chat: boolean;
  name: string | null;
  created_at: string;
  updated_at: string;
  owner_id: string | null;
  participants: ConversationParticipant[];
  last_message_id: string | null;
};

type MessageRow = {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string | null;
  listing_id: string | null;
  post_id: string | null;
  created_at: string;
  updated_at: string;
};

type ConversationParticipantRow = {
  id: string;
  profile_id: string;
  conversation_id: string;
  joined_at: string;
  last_read_at: string | null;
};

const transformConversation = (row: ConversationRow): Conversation => {
  const participants = row.participants.map((participant) => ({
    id: participant.id,
    profile_id: participant.profile_id,
    conversation_id: participant.conversation_id,
    joined_at: participant.joined_at,
    last_read_at: participant.last_read_at,
  }));
  return {
    id: row.id,
    is_group_chat: row.is_group_chat,
    name: row.name,
    created_at: row.created_at,
    updated_at: row.updated_at,
    owner_id: row.owner_id,
    participants,
    last_message_id: row.last_message_id,
  };
};

const transformMessage = (row: MessageRow): Message => {
  return {
    id: row.id,
    conversation_id: row.conversation_id,
    sender_id: row.sender_id,
    content: row.content,
    listing_id: row.listing_id,
    post_id: row.post_id,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
};

const transformConversationParticipant = (row: ConversationParticipantRow): ConversationParticipant => {
  return {
    id: row.id,
    profile_id: row.profile_id,
    conversation_id: row.conversation_id,
    joined_at: row.joined_at,
    last_read_at: row.last_read_at,
  };
};

// Fetch all conversations for a user in order of most recently updated
export const fetchConversations = async (profileId: string): Promise<Conversation[]> => {
  // First, get all conversation IDs where this user is a participant
  const { data: participantData, error: participantError } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("profile_id", profileId);

  if (participantError) {
    console.error("Failed to fetch participant conversations", participantError);
    throw participantError;
  }

  const conversationIds = (participantData ?? []).map((p) => p.conversation_id);

  if (conversationIds.length === 0) {
    return [];
  }

  // Then fetch the conversations with all their participants
  const { data, error } = await supabase
    .from("conversations")
    .select(`
      *,
      participants:conversation_participants (
        id,
        profile_id,
        conversation_id,
        joined_at,
        last_read_at
      )
    `)
    .in("id", conversationIds)
    .order("updated_at", { ascending: false }); // Order by updated_at, not created_at

  if (error) {
    console.error("Failed to fetch conversations", error);
    throw error;
  }

  return ((data ?? []) as ConversationRow[]).map(transformConversation);
};

export const fetchConversationById = async (conversationId: string, profileId: string): Promise<Conversation | null> => {
  // Verify user is a participant (RLS will also enforce this, but good to be explicit)
  const { data: participantCheck } = await supabase
    .from("conversation_participants")
    .select("conversation_id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!participantCheck) {
    return null; // User is not a participant
  }
  
  const { data, error } = await supabase
  .from("conversations")
  .select(`
    *,
    participants:conversation_participants (
      id,
      profile_id,
      conversation_id,
      joined_at,
      last_read_at
    )
  `)
  .eq("id", conversationId)
  .maybeSingle();

  if (error) {
    console.error("Failed to fetch conversation by id", error);
    throw error;
  }

  return data ? transformConversation(data as ConversationRow) : null;
};

export const fetchMessages = async (conversationId: string, limit?: number, before_id?: string): Promise<Message[]> => {
  let query = supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: false })
    .limit(limit ?? 20)
    
  if (before_id) {
    const { data: beforeMessage, error: beforeMessageError } = await supabase
    .from("messages")
    .select("created_at")
    .eq("id", before_id)
    .single();

    if (beforeMessageError) {
      console.error("Failed to fetch before message", beforeMessageError);
      throw beforeMessageError;
    }
        
    if (beforeMessage) {
      query = query.lt("created_at", beforeMessage.created_at);
    }
  }

  const { data, error } = await query;
    
  if (error) {
    console.error("Failed to fetch messages", error);
    throw error;
  }

  // Decrypt messages using the decryptMessage function
  const messages = await Promise.all(
    ((data ?? []) as MessageRow[]).map(async (row) => {
      if (row.content && row.content.startsWith("ENC:")) {
        row.content = await decryptMessage(row.content, conversationId);
      }
      return transformMessage(row);
    })
  );

  return messages;
};

export const createDirectConversation = async (profileId1: string, profileId2: string): Promise<Conversation> => {
  // Validate that profile IDs are different
  if (profileId1 === profileId2) {
    console.error("Cannot create direct conversation with the same profile ID twice:", profileId1);
    throw new Error("Cannot create a conversation with yourself. Please select a different user.");
  }

  console.log("Creating direct conversation between:", { profileId1, profileId2 });

  // Check if direct conversation already exists between these two users
  // Get all direct conversations for profile 1
  const { data: directConversations, error: directConversationsError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, conversations!inner(is_group_chat)")
    .eq("profile_id", profileId1)
    .eq("conversations.is_group_chat", false);

  if (directConversationsError) {
    console.error("Failed to fetch direct conversations", directConversationsError);
    throw directConversationsError;
  }

  if (directConversations && directConversations.length > 0) {
    const convIds = directConversations.map(c => c.conversation_id);
    // Check if there is a conversation profile 2 is a participant of
    const { data: matchingConv, error: matchingConvError } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("profile_id", profileId2)
      .in("conversation_id", convIds)
      .maybeSingle();

    if (matchingConvError) {
      console.error("Failed to fetch matching conversation", matchingConvError);
      throw matchingConvError;
    }

    if (matchingConv) {
      const { data: conversation, error: conversationError } = await supabase
      .from("conversations")
      .select(`
        *,
        participants:conversation_participants (
          id,
          profile_id,
          conversation_id,
          joined_at,
          last_read_at
        )
      `)
      .eq("id", matchingConv.conversation_id)
      .single();

      if (conversationError) {
        console.error("Failed to fetch existing conversation", conversationError);
        throw conversationError;
      }

      if (conversation) {
        return transformConversation(conversation as ConversationRow);
      }
    }
  }

  // Create new conversation
  const now = new Date().toISOString();
  const { data: newConv, error: convError } = await supabase
    .from("conversations")
    .insert({
      is_group_chat: false,
      updated_at: now,
      // Allow creator to read conversation on creation
      owner_id: profileId1,
    })
    .select("*")
    .single();

  if (convError) {
    console.error("Failed to create direct conversation", convError);
    throw convError;
  }

  const { data: insertedParticipants, error: participantError } = await supabase
    .from("conversation_participants")
    .insert([
      {
        conversation_id: newConv.id,
        profile_id: profileId1,
      },
      {
        conversation_id: newConv.id,
        profile_id: profileId2,
      },
    ])
    .select("*");

  console.log("Insert result:", { insertedParticipants, error: participantError });

  if (participantError || !insertedParticipants) {
    console.error("Failed to add participants", JSON.stringify(participantError));
      const { error: cleanupError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", newConv.id);

    if (cleanupError) {
      console.error("Failed to clean up conversation after participant insert failure", cleanupError);
    }
    throw participantError || new Error("Failed to insert participants");
  }

  return transformConversation({
    ...newConv,
    participants: insertedParticipants
  } as ConversationRow);
};

export const createGroupConversation = async (name: string, creatorId: string, participantIds: string[]): Promise<Conversation> => {
  // Create new conversation
  const now = new Date().toISOString();
  const { data: newConv, error: convError } = await supabase
    .from("conversations")
    .insert({
      is_group_chat: true,
      name: name,
      updated_at: now,
      owner_id: creatorId,
    })
    .select("*")
    .single();

  if (convError) {
    console.error("Failed to create group conversation", convError);
    throw convError;
  }

  // Insert all participants
  const profileIds = Array.from(new Set([creatorId, ...participantIds]));

  const participantRows = profileIds.map((profileId) => ({
  conversation_id: newConv.id,
  profile_id: profileId,
  }));

  const { data: insertedParticipants, error: participantError } = await supabase
  .from("conversation_participants")
  .insert(participantRows)
  .select("*");

  if (participantError || !insertedParticipants) {
    console.error("Failed to add participants", participantError);
      const { error: cleanupError } = await supabase
      .from("conversations")
      .delete()
      .eq("id", newConv.id);

    if (cleanupError) {
      console.error("Failed to clean up conversation after participant insert failure", cleanupError);
    }
    throw participantError;
  }

  return transformConversation({
    ...newConv,
    participants: insertedParticipants
  } as ConversationRow);
};

export const updateConversationName = async (conversationId: string, name: string): Promise<Conversation> => {
  // Validate content before updating conversation name
  validateContent(name);
  
  const { data, error } = await supabase
    .from("conversations")
    .update({ name: name })
    .eq("id", conversationId)
    .select(`
      *,
      participants:conversation_participants (
        id,
        profile_id,
        conversation_id,
        joined_at,
        last_read_at
      )
    `)
    .single();

  if (error) {
    console.error("Failed to update conversation name", error);
    throw error;
  }

  return transformConversation(data as ConversationRow);
};

export const sendMessage = async (conversationId: string, senderId: string, content: string, listingId?: string, postId?: string): Promise<Message> => {
  // Validate content before sending message
  validateContent(content);  

  // Fetch participant IDs for encryption
  const { data: participants, error: participantError } = await supabase
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conversationId);
  
  if (participantError || !participants) {
    throw new Error(`Failed to fetch data for encryption: ${participantError?.message}`);
  }
  
  const participantIds = participants.map(p => p.profile_id);
  
  // Encrypt the message content
  const encryptedContent = await encryptMessage(content, conversationId, participantIds);

  const { data: newMessage, error: messageError } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: senderId,
      content: encryptedContent,
      listing_id: listingId,
      post_id: postId,
    })
    .select("*")
    .single();

  if (messageError) {
    console.error("Failed to send message", messageError);
    throw messageError;
  }

  const now = new Date().toISOString();

  // Update conversation updated_at
  const { error: updateConversationError } = await supabase
    .from("conversations")
    .update({ updated_at: now })
    .eq("id", conversationId);

  if (updateConversationError) {
    console.error("Failed to update conversation updated_at", updateConversationError);
    throw updateConversationError;
  }

  // Update sender's last_read_at since they're actively sending messages
  const { error: updateReadError } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: now })
    .eq("conversation_id", conversationId)
    .eq("profile_id", senderId);

  if (updateReadError) {
    console.error("Failed to update sender's last_read_at", updateReadError);
    // Don't throw here - message was sent successfully, this is just a nice-to-have
  }

  // Increment user points
  try {
    await awardPoints(senderId, 1);
  } catch (pointsError) {
    console.error("Failed to award points for message send", pointsError);
  }

  return transformMessage(newMessage as MessageRow);
};

export const updateMessage = async (messageId: string, content: string): Promise<Message> => {
  // Validate content before updating message
  validateContent(content);

  // Get the message to find conversation_id
  const { data: messageData, error: messageFetchError } = await supabase
    .from("messages")
    .select("conversation_id")
    .eq("id", messageId)
    .single();
  
  if (messageFetchError || !messageData) {
    throw new Error(`Failed to fetch message: ${messageFetchError?.message}`);
  }
  
  // Fetch participant IDs for encryption
  const { data: participants, error: participantError } = await supabase
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", messageData.conversation_id);
  
  if (participantError || !participants) {
    throw new Error(`Failed to fetch participants for encryption: ${participantError?.message}`);
  }
  
  const participantIds = participants.map(p => p.profile_id);
  
  // Encrypt the message content
  const encryptedContent = await encryptMessage(content, messageData.conversation_id, participantIds);

  const now = new Date().toISOString();
  const { data, error } = await supabase
    .from("messages")
    .update({ 
      content: encryptedContent,
      updated_at: now,
    })
    .eq("id", messageId)
    .select()
    .single();

  if (error) {
    console.error("Failed to update message", error);
    throw error;
  }

  return transformMessage(data as MessageRow);
};

export const addParticipantToGroup = async (conversationId: string, profileId: string): Promise<ConversationParticipant> => {
  const { data: conversation } = await supabase
    .from("conversations")
    .select(`
      *,
      participants:conversation_participants (profile_id)
    `)
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  if (!conversation.is_group_chat) {
    throw new Error("This is not a group chat");
  }

  if (conversation.participants && conversation.participants.some(p => p.profile_id === profileId)) {
    throw new Error("This user is already a participant of this group");
  }
  
  const { data: newParticipant, error: participantError } = await supabase
    .from("conversation_participants")
    .insert({
      conversation_id: conversationId,
      profile_id: profileId,
    })
    .select("*")
    .single();

  if (participantError) {
    console.error("Failed to add participant to group", participantError);
    throw participantError;
  }
  
  const { error: updateConversationError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (updateConversationError) {
    console.error("Failed to update conversation updated_at", updateConversationError);
    throw updateConversationError;
  } 

  return transformConversationParticipant(newParticipant as ConversationParticipantRow);
};

export const removeParticipantFromGroup = async (conversationId: string, profileId: string): Promise<ConversationParticipant> => {
  const { data: conversation } = await supabase
    .from("conversations")
    .select("*")
    .eq("id", conversationId)
    .single();

  if (!conversation) {
    throw new Error("Conversation not found");
  }

  const { data: participantCheck } = await supabase
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conversationId)
    .eq("profile_id", profileId)
    .maybeSingle();

  if (!participantCheck) {
    throw new Error("This user is not a participant of this group");
  }

  if (conversation.is_group_chat && conversation.owner_id === profileId) {
    // If the person being removed is the owner of the group chat, transfer ownership to the oldest participant (earliest joined_at)
    // First, find all current participants except the one being removed
    const { data: participants, error: participantsError } = await supabase
      .from("conversation_participants")
      .select("*")
      .eq("conversation_id", conversationId)
      .neq("profile_id", profileId);

    if (participantsError) {
      console.error("Failed to fetch participants for ownership transfer", participantsError);
      throw participantsError;
    }

    if (!participants || participants.length === 0) {
      throw new Error("Cannot remove the last participant from the group");
    }

    // Find the participant with the earliest joined_at
    let oldestParticipant = participants[0];
    for (const participant of participants) {
      if (participant.joined_at < oldestParticipant.joined_at) {
        oldestParticipant = participant;
      }
    }

    // Transfer ownership in the conversations table
    const { error: updateOwnerError } = await supabase
      .from("conversations")
      .update({ owner_id: oldestParticipant.profile_id })
      .eq("id", conversationId);

    if (updateOwnerError) {
      console.error("Failed to transfer group ownership", updateOwnerError);
      throw updateOwnerError;
    }
  }

  const { data: removedParticipant, error: participantError } = await supabase
    .from("conversation_participants")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("profile_id", profileId)
    .select("*")
    .single();

  if (participantError) {
    console.error("Failed to remove participant from group", participantError);
    throw participantError;
  }

  const { error: updateConversationError } = await supabase
    .from("conversations")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", conversationId);

  if (updateConversationError) {
    console.error("Failed to update conversation updated_at", updateConversationError);
    throw updateConversationError;
  } 

  return transformConversationParticipant(removedParticipant as ConversationParticipantRow);
};

export const markAsRead = async (conversationId: string, profileId: string): Promise<void> => {
  const { error: updateParticipantError } = await supabase
    .from("conversation_participants")
    .update({ last_read_at: new Date().toISOString() })
    .eq("conversation_id", conversationId)
    .eq("profile_id", profileId);

  if (updateParticipantError) {
    console.error("Failed to mark as read", updateParticipantError);
    throw updateParticipantError;
  }
};

export const getUnreadCount = async (profileId: string): Promise<number> => {
  // Get all participant records with last_read_at for this user
  const { data: participantData, error: participantError } = await supabase
    .from("conversation_participants")
    .select("conversation_id, last_read_at")
    .eq("profile_id", profileId);

  if (participantError) {
    console.error("Failed to fetch participant conversations", participantError);
    throw participantError;
  }

  if (!participantData || participantData.length === 0) {
    return 0;
  }

  // Check each conversation for unread messages
  let unreadCount = 0;
  
  for (const participant of participantData) {
    const { conversation_id, last_read_at } = participant;
    
    // Build query to check for messages after last_read_at
    // Exclude messages sent by the current user (they shouldn't count as unread)
    let messageQuery = supabase
      .from("messages")
      .select("id", { count: "exact", head: true })
      .eq("conversation_id", conversation_id)
      .neq("sender_id", profileId); // Exclude messages sent by current user
    
    // If last_read_at is null, check if there are any messages
    // If last_read_at exists, check for messages created after it
    if (last_read_at) {
      messageQuery = messageQuery.gt("created_at", last_read_at);
    }
    
    const { count, error: messageError } = await messageQuery;
    
    if (messageError) {
      console.error(`Failed to check unread messages for conversation ${conversation_id}`, messageError);
      continue; // Skip this conversation on error
    }
    
    // If count > 0, this conversation has unread messages
    if (count && count > 0) {
      unreadCount++;
    }
  }

  return unreadCount;
};

export const fetchProfileById = async (profileId: string): Promise<Profile | null> => {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .eq("id", profileId)
    .maybeSingle();

  if (error) {
    console.error("Failed to fetch profile", error);
    throw error;
  }

  return data as Profile | null;
};

export const fetchProfilesByIds = async (profileIds: string[]): Promise<Profile[]> => {
  if (profileIds.length === 0) {
    return [];
  }

  const { data, error } = await supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .in("id", profileIds);

  if (error) {
    console.error("Failed to fetch profiles", error);
    throw error;
  }

  return (data ?? []) as Profile[];
};

export const searchUsers = async (query: string, excludeIds?: string[]): Promise<Profile[]> => {
  let searchQuery = supabase
    .from("profiles")
    .select("id, username, full_name, avatar_url")
    .or(`username.ilike.%${query}%,full_name.ilike.%${query}%`)
    .limit(20);

  if (excludeIds && excludeIds.length > 0) {
    searchQuery = searchQuery.filter("id", "not.in", `(${excludeIds.join(",")})`);
  }

  const { data, error } = await searchQuery;

  if (error) {
    console.error("Failed to search users", error);
    throw error;
  }

  return (data ?? []) as Profile[];
};

// Message encryption/decryption functionality
const encryptMessage = async (message: string, conversationId: string, participantIds: string[]): Promise<string> => {
  const encryptionKey = await deriveConversationKey(conversationId, participantIds);
  
  // Generate random IV (12 bytes for AES-GCM)
  const iv = crypto.getRandomValues(new Uint8Array(12));
  
  // Convert message string to ArrayBuffer
  const messageBuffer = new TextEncoder().encode(message);
  
  // Encrypt the message
  const encryptedData = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    encryptionKey,
    messageBuffer
  );
  
  // Combine IV + encrypted data
  const combined = new Uint8Array(iv.length + encryptedData.byteLength);
  combined.set(iv, 0);
  combined.set(new Uint8Array(encryptedData), iv.length);
  
  // Convert to base64 string
  let binary = '';
  for (let i = 0; i < combined.length; i++) {
    binary += String.fromCharCode(combined[i]);
  }
  const base64 = btoa(binary);
  return `ENC:${base64}`;
};

const deriveConversationKey = async (conversationId: string, participantIds: string[]): Promise<CryptoKey> => {
  // Sort participant IDs to ensure all participants derive the same key
  const sortedParticipantIds = [...participantIds].sort().join(",");
  
  // Create a password from conversation ID + participant IDs
  const password = `${conversationId}:${sortedParticipantIds}`;
  const passwordBuffer = new TextEncoder().encode(password);
  
  // Use conversation ID as salt (deterministic)
  const salt = new TextEncoder().encode(conversationId);
  
  // Import password as key material
  const keyMaterial = await crypto.subtle.importKey(
    "raw",
    passwordBuffer,
    "PBKDF2",
    false,
    ["deriveKey"]
  );
  
  // Derive AES-GCM key using PBKDF2
  return crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: 100000,
      hash: "SHA-256",
    },
    keyMaterial,
    { name: "AES-GCM", length: 256 },
    false,
    ["encrypt", "decrypt"]
  );
};

const getEncryptionKey = async (conversationId: string): Promise<CryptoKey> => {
  // Fetch participant IDs for this conversation
  const { data: participants, error } = await supabase
    .from("conversation_participants")
    .select("profile_id")
    .eq("conversation_id", conversationId);
  
  if (error || !participants) {
    throw new Error(`Failed to fetch participants for encryption: ${error?.message}`);
  }
  
  const participantIds = participants.map(p => p.profile_id);
  return deriveConversationKey(conversationId, participantIds);
};

export const decryptMessage = async (encryptedContent: string, conversationId: string): Promise<string> => {
  try {
    // Remove "ENC:" prefix if present
    const base64 = encryptedContent.startsWith("ENC:") 
      ? encryptedContent.slice(4) 
      : encryptedContent;
    
    // Decode base64 to get combined IV + encrypted data
    const combined = Uint8Array.from(atob(base64), c => c.charCodeAt(0));
    
    // Extract IV (first 12 bytes) and encrypted data (rest)
    const iv = combined.slice(0, 12);
    const encryptedData = combined.slice(12);
    
    // Get encryption key
    const encryptionKey = await getEncryptionKey(conversationId);
    
    // Decrypt the message
    const decryptedData = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv },
      encryptionKey,
      encryptedData
    );
    
    // Convert ArrayBuffer back to string
    return new TextDecoder().decode(decryptedData);
  } catch (error) {
    console.error("Failed to decrypt message", error);
    return "[Encrypted message - unable to decrypt]";
  }
};