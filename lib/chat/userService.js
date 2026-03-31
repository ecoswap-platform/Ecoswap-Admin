import { supabase } from "@/lib/supabaseClient";

/**
 * Get current user by email
 * SAFE: does not crash if user not found
 */
export async function getUserByUsername(username) {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, username, avatar_url")
    .eq("username", username)
    .maybeSingle();

  if (error) {
    console.error("getUserByUsername error:", error);
    return null;
  }

  return data;
}

// Keep old name as alias for backward compat
export const getUserByEmail = getUserByUsername;

/**
 * Get all other users except current user
 */
export async function getOtherUsers(currentUsername) {
  const { data, error } = await supabase
    .from("users")
    .select("id, full_name, username, avatar_url")
    .neq("username", currentUsername);

  if (error) {
    console.error("getOtherUsers error:", error);
    return [];
  }

  return data || [];
}
