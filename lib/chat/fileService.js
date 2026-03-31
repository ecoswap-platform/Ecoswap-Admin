import { supabase } from "@/lib/supabaseClient";

export async function uploadChatFile(file, bucket) {
  const fileExt = file.name.split(".").pop();
  const filePath = `${Date.now()}-${Math.random()}.${fileExt}`;

  const { error } = await supabase
    .storage
    .from(bucket)
    .upload(filePath, file);

  if (error) throw error;

  const { data } = supabase
    .storage
    .from(bucket)
    .getPublicUrl(filePath);

  return data.publicUrl;
}
