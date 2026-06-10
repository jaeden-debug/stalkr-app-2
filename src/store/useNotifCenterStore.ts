/**
 * useNotifCenterStore — read/dismiss state + unseen badge for the Notification
 * Center. The notifications themselves are the permanent group_events records;
 * this store only tracks which the user has read or dismissed (persisted), so
 * notifications survive even if the OS notification was swiped away.
 */
import AsyncStorage from '@react-native-async-storage/async-storage';
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

interface NotifCenterState {
  readIds: Record<string, true>;
  dismissedIds: Record<string, true>;
  unseenCount: number;

  bumpUnseen: () => void;
  clearUnseen: () => void;
  markRead: (id: string) => void;
  markReadMany: (ids: string[]) => void;
  dismiss: (id: string) => void;
  isRead: (id: string) => boolean;
  isDismissed: (id: string) => boolean;
}

export const useNotifCenterStore = create<NotifCenterState>()(
  persist(
    (set, get) => ({
      readIds: {},
      dismissedIds: {},
      unseenCount: 0,

      bumpUnseen: () => set((s) => ({ unseenCount: Math.min(99, s.unseenCount + 1) })),
      clearUnseen: () => set({ unseenCount: 0 }),
      markRead: (id) => set((s) => ({ readIds: { ...s.readIds, [id]: true } })),
      markReadMany: (ids) =>
        set((s) => {
          const readIds = { ...s.readIds };
          ids.forEach((id) => { readIds[id] = true; });
          return { readIds };
        }),
      dismiss: (id) => set((s) => ({ dismissedIds: { ...s.dismissedIds, [id]: true } })),
      isRead: (id) => !!get().readIds[id],
      isDismissed: (id) => !!get().dismissedIds[id],
    }),
    {
      name: 'notif-center',
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
