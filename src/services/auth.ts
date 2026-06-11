import { supabase } from './supabase';
import type { Profile } from '@/types/models';

export interface AuthResult {
  success: boolean;
  error?: string;
}

export async function signUp(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResult> {
  const { error } = await supabase.auth.signUp({
    email,
    password,
    options: {
      data: { display_name: displayName },
    },
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function signIn(email: string, password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function signOut(): Promise<void> {
  await supabase.auth.signOut();
}

/** Send a password-reset email. The link deep-links back to stalkr://reset. */
export async function resetPassword(email: string): Promise<AuthResult> {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    redirectTo: 'stalkr://reset',
  });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Set a new password for the (recovery-authenticated) user. */
export async function updatePassword(password: string): Promise<AuthResult> {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return { success: false, error: error.message };
  return { success: true };
}

/** Permanently delete the signed-in user's account (App Store requirement). */
export async function deleteAccount(): Promise<AuthResult> {
  const { error } = await supabase.rpc('delete_account');
  if (error) return { success: false, error: error.message };
  await supabase.auth.signOut().catch(() => {});
  return { success: true };
}

export async function getSession() {
  const { data } = await supabase.auth.getSession();
  return data.session;
}

export async function getProfile(userId: string): Promise<Profile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', userId)
    .single();
  if (error || !data) return null;
  return data as Profile;
}

export async function updateProfile(
  userId: string,
  updates: Partial<Pick<Profile,
    'display_name' | 'nickname' | 'initials' | 'avatar_url' | 'phone' | 'default_sharing_mode'
    | 'blood_type' | 'allergies' | 'medications' | 'medical_notes' | 'medical_share_with_crew'>>,
): Promise<AuthResult> {
  const { error } = await supabase
    .from('profiles')
    .update({ ...updates, updated_at: new Date().toISOString() })
    .eq('id', userId);
  if (error) return { success: false, error: error.message };
  return { success: true };
}

export async function uploadAvatar(userId: string, uri: string): Promise<string | null> {
  try {
    const ext = (uri.split('.').pop() ?? 'jpg').toLowerCase().split('?')[0];
    const path = `avatars/${userId}.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage.from('avatars').upload(path, blob, {
      upsert: true,
      contentType: `image/${ext === 'jpg' ? 'jpeg' : ext}`,
    });
    if (error) {
      // Surface the real cause instead of a silent "Upload failed".
      console.error('uploadAvatar failed:', error.message);
      return null;
    }
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    // Cache-bust: the path is stable (avatars/<userId>.<ext>), so without a unique
    // query param the CDN + RN image cache keep showing the OLD photo — which looks
    // like "the picture won't change". The timestamp forces a fresh fetch.
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch (e: any) {
    console.error('uploadAvatar exception:', e?.message ?? e);
    return null;
  }
}

/** Per-crew avatar override — stored separately so it never touches the global photo. */
export async function uploadCrewAvatar(groupId: string, userId: string, uri: string): Promise<string | null> {
  try {
    const ext = uri.split('.').pop() ?? 'jpg';
    const path = `crew/${groupId}/${userId}.${ext}`;
    const response = await fetch(uri);
    const blob = await response.blob();
    const { error } = await supabase.storage.from('avatars').upload(path, blob, {
      upsert: true,
      contentType: `image/${ext}`,
    });
    if (error) return null;
    const { data } = supabase.storage.from('avatars').getPublicUrl(path);
    return `${data.publicUrl}?v=${Date.now()}`;
  } catch {
    return null;
  }
}

export async function markOnline(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ is_online: true, last_seen_at: new Date().toISOString() })
    .eq('id', userId);
}

export async function markOffline(userId: string): Promise<void> {
  await supabase
    .from('profiles')
    .update({ is_online: false, last_seen_at: new Date().toISOString() })
    .eq('id', userId);
}
