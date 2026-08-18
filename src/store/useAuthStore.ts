import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import type { Session } from '@supabase/supabase-js';
import type { Profile } from '@/types/models';
import * as authService from '@/services/auth';
import { unregisterPushToken } from '@/services/notifications';
import { supabase } from '@/services/supabase';

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  loading: boolean;
  error: string | null;

  initialize: () => Promise<void>;
  setSession: (session: Session | null) => void;
  setProfile: (profile: Profile | null) => void;
  loadProfile: () => Promise<void>;
  signIn: (email: string, password: string) => Promise<boolean>;
  signUp: (email: string, password: string, displayName: string) => Promise<boolean>;
  updateProfile: (
    updates: Partial<
      Pick<Profile, 'display_name' | 'nickname' | 'initials' | 'avatar_url' | 'phone' | 'default_sharing_mode'
        | 'blood_type' | 'allergies' | 'medications' | 'medical_notes' | 'medical_share_with_crew'>
    >,
  ) => Promise<boolean>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<boolean>;
  clearError: () => void;
  /** Convenience — avoids null-chaining everywhere */
  user: { id: string; email?: string } | null;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      session: null,
      profile: null,
      loading: false,
      error: null,
      user: null,

      initialize: async () => {
        set({ loading: true });
        const { data } = await supabase.auth.getSession();
        const session = data.session;
        const user = session?.user ? { id: session.user.id, email: session.user.email } : null;
        set({ session, user, loading: false });
        if (session?.user?.id) {
          await authService.markOnline(session.user.id);
          await get().loadProfile();
        }

        supabase.auth.onAuthStateChange(async (_event, newSession) => {
          const newUser = newSession?.user
            ? { id: newSession.user.id, email: newSession.user.email }
            : null;
          set({ session: newSession, user: newUser });
          if (newSession?.user?.id) {
            await authService.markOnline(newSession.user.id);
            await get().loadProfile();
          } else {
            set({ profile: null });
          }
        });
      },

      setSession: (session) => {
        const user = session?.user ? { id: session.user.id, email: session.user.email } : null;
        set({ session, user });
      },

      setProfile: (profile) => set({ profile }),

      loadProfile: async () => {
        const { session } = get();
        if (!session?.user?.id) return;
        const profile = await authService.getProfile(session.user.id);
        if (profile) set({ profile });
      },

      signIn: async (email, password) => {
        set({ loading: true, error: null });
        const result = await authService.signIn(email, password);
        if (!result.success) {
          set({ loading: false, error: result.error ?? 'Sign in failed' });
          return false;
        }
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user
          ? { id: data.session.user.id, email: data.session.user.email }
          : null;
        set({ session: data.session, user, loading: false });
        if (data.session?.user?.id) {
          await authService.markOnline(data.session.user.id);
          await get().loadProfile();
        }
        return true;
      },

      signUp: async (email, password, displayName) => {
        set({ loading: true, error: null });
        const result = await authService.signUp(email, password, displayName);
        if (!result.success) {
          set({ loading: false, error: result.error ?? 'Sign up failed' });
          return false;
        }
        const { data } = await supabase.auth.getSession();
        const user = data.session?.user
          ? { id: data.session.user.id, email: data.session.user.email }
          : null;
        set({ session: data.session, user, loading: false });
        if (data.session?.user?.id) {
          await authService.markOnline(data.session.user.id);
          await get().loadProfile();
        }
        return true;
      },

      updateProfile: async (updates) => {
        const { session, profile } = get();
        if (!session?.user?.id) return false;
        set({ loading: true });
        const result = await authService.updateProfile(session.user.id, updates);
        if (result.success && profile) {
          set({ profile: { ...profile, ...updates }, loading: false });
        } else {
          set({ loading: false, error: result.error ?? 'Update failed' });
        }
        return result.success;
      },

      signOut: async () => {
        const userId = get().session?.user?.id;
        if (userId) {
          await authService.markOffline(userId).catch(() => {});
          // Revoke THIS device's push registration before the session goes away.
          // Otherwise the phone kept receiving the old account's crew alerts —
          // including SOS — after sign-out.
          const token = get().profile?.push_token ?? null;
          await unregisterPushToken(userId, token).catch(() => {});
        }
        await authService.signOut();
        set({ session: null, profile: null, user: null, error: null });
        // Purge every per-user store so the next account starts clean (no leaked
        // crews / zones / markers / plan). Lazy import avoids a circular dep.
        try { await require('./resetUserScopedState').resetUserScopedState(); } catch {}
      },

      deleteAccount: async () => {
        // Release this device's push registration BEFORE the account is gone.
        // The profile row cascades away server-side, but doing it here also
        // stops the local token being reused by the next account to sign in.
        const userId = get().session?.user?.id;
        const token = get().profile?.push_token ?? null;
        if (userId) await unregisterPushToken(userId, token).catch(() => {});

        const result = await authService.deleteAccount();
        if (result.success) {
          set({ session: null, profile: null, user: null, error: null });
          // Same purge sign-out performs. Without it the deleted account's
          // crews, markers, zones, sessions and plan survived in memory AND in
          // AsyncStorage, so the next account to sign in on this device
          // inherited them — the precise account-isolation failure that was
          // fixed for sign-out and missed here.
          try { await require('./resetUserScopedState').resetUserScopedState(); } catch {}
          return true;
        }
        set({ error: result.error ?? 'Account deletion failed' });
        return false;
      },

      clearError: () => set({ error: null }),
    }),
    {
      name: 'auth-store',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ session: state.session, profile: state.profile }),
    },
  ),
);
