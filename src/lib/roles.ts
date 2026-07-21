import { supabase } from "@/lib/supabaseClient";

export type GpeRole = "member" | "team_gpe" | "admin";

export async function hasRole(role: GpeRole) {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc("has_role", {
    check_role: role,
    check_user_id: user.id,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function canManageCamp() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc("can_manage_camp", {
    check_user_id: user.id,
  });
  if (error) throw error;
  return Boolean(data);
}

export async function isAdmin() {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return false;
  const { data, error } = await supabase.rpc("is_admin", {
    check_user_id: user.id,
  });
  if (error) throw error;
  return Boolean(data);
}
