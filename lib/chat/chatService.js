import { supabase } from "@/lib/supabaseClient";

/**
 * Create a new conversation and attach participants
 * participants = [{ id, type: "user" | "charity" }]
 */
/**
 * Get existing conversation between two users
 */
export async function getExistingConversation(userId1, userId2) {
  try {
    // Get conversations for user 1
    const { data: user1Rows, error: err1 } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("participant_id", userId1)
      .eq("participant_type", "user");

    if (err1) throw err1;

    // Get conversations for user 2
    const { data: user2Rows, error: err2 } = await supabase
      .from("conversation_participants")
      .select("conversation_id")
      .eq("participant_id", userId2)
      .eq("participant_type", "user");

    if (err2) throw err2;

    // Find common conversation_id
    const user1Convos = user1Rows.map(r => r.conversation_id);
    const user2Convos = user2Rows.map(r => r.conversation_id);

    const existingConversationId = user1Convos.find(id =>
      user2Convos.includes(id)
    );

    return existingConversationId || null;
  } catch (error) {
    console.error("getExistingConversation error:", error);
    return null;
  }
}



export async function createConversation(participants) {
  const { data: conversation, error } = await supabase
    .from("conversations")
    .insert({})
    .select()
    .single();

  if (error) throw error;

  const rows = participants.map(p => ({
    conversation_id: conversation.id,
    participant_id: p.id,
    participant_type: p.type
  }));

  await supabase
    .from("conversation_participants")
    .insert(rows);

  return conversation.id;
}


/**
 * Send a message
 */
export async function sendMessage(message) {
  return supabase.from("messages").insert(message);
}

/**
 * Fetch messages for a conversation
 */
export async function fetchMessages(conversationId) {
  return supabase
    .from("messages")
    .select("*")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true });
}

/**
 * Subscribe to realtime messages
 */
export function subscribeToMessages(conversationId, callback) {
  return supabase
    .channel(`conversation-${conversationId}`)
    .on(
      "postgres_changes",
      {
        event: "INSERT",
        schema: "public",
        table: "messages",
        filter: `conversation_id=eq.${conversationId}`
      },
      payload => callback(payload.new)
    )
    .subscribe();
}
