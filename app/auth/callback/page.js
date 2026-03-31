"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabaseClient";

export default function AuthCallback() {
  const router = useRouter();

  useEffect(() => {
    const completeLogin = async () => {
      // Supabase reads token from URL hash automatically
      const {
        data: { user }
      } = await supabase.auth.getUser();

      if (!user) {
        router.replace("/admin/login");
        return;
      }

      const { data: admin } = await supabase
        .from("admins")
        .select("*")
        .eq("email", user.email)
        .single();

      if (!admin || !admin.approved || !admin.is_active) {
        await supabase.auth.signOut();
        router.replace("/admin/login");
        return;
      }

      router.replace("/admin/dashboard");
    };

    completeLogin();
  }, [router]);

  return <p>Signing you in…</p>;
}
