import { supabase } from "@/lib/supabaseClient";

/**
 * Create a notification
 */
export async function createNotification({
  recipient_id,
  recipient_type,
  title,
  body
}) {
  return supabase.from("notifications").insert({
    recipient_id,
    recipient_type,
    title,
    body
  });
}

/**
 * Fetch notifications for a user
 */
export async function getNotifications(userId) {
  return supabase
    .from("notifications")
    .select("*")
    .eq("recipient_id", userId)
    .order("created_at", { ascending: false });
}

/**
 * Mark notification as read
 */
export async function markAsRead(notificationId) {
  return supabase
    .from("notifications")
    .update({ is_read: true })
    .eq("id", notificationId);
}
