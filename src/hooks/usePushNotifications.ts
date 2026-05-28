import { useEffect } from 'react';
import { registerPushToken } from '@/services/notifications';
import { useAuthStore } from '@/store/useAuthStore';

export function usePushNotifications() {
  const session = useAuthStore((s) => s.session);

  useEffect(() => {
    const userId = session?.user?.id;
    if (!userId) return;
    registerPushToken(userId).catch(console.error);
  }, [session?.user?.id]);
}
