/**
 * NotificationPrefsSheet — lets each user control which zone/SOS alerts
 * they receive. Prefs are stored locally (AsyncStorage via Zustand persist).
 *
 * Foreground notifications are suppressed immediately.
 * Background (push) suppression requires server-side filtering — these prefs
 * control outbound pushes for events this device originates.
 */
import React, { memo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useNotificationStore } from '@/store/useNotificationStore';

interface NotificationPrefsSheetProps {
  visible: boolean;
  onClose: () => void;
}

export const NotificationPrefsSheet: React.FC<NotificationPrefsSheetProps> = memo(({ visible, onClose }) => {
  const {
    notifyZoneEnter, setNotifyZoneEnter,
    notifyZoneLeave, setNotifyZoneLeave,
    notifyZoneOverstay, setNotifyZoneOverstay,
    notifyCrewZoneActivity, setNotifyCrewZoneActivity,
    notifySOSAlerts, setNotifySOSAlerts,
    notifySOSCancel, setNotifySOSCancel,
  } = useNotificationStore();

  return (
    <Sheet visible={visible} onClose={onClose} title="Notification Preferences" snapHeight={540}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>

        <Text style={styles.sectionNote}>
          These settings control which alerts appear on your device. Zone-level settings (set by the zone creator) still apply on top.
        </Text>

        {/* Zone alerts — for yourself */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>ZONE ALERTS — YOU</Text>
          <Text style={styles.groupSub}>Alerts when you enter or leave zones</Text>

          <PrefRow
            label="Entering a zone"
            sub="Alert when you cross into a zone"
            value={notifyZoneEnter}
            onChange={setNotifyZoneEnter}
          />
          <PrefRow
            label="Leaving a zone"
            sub="Alert when you exit a zone"
            value={notifyZoneLeave}
            onChange={setNotifyZoneLeave}
          />
          <PrefRow
            label="Overstay alert"
            sub="Alert when you've been inside too long"
            value={notifyZoneOverstay}
            onChange={setNotifyZoneOverstay}
            last
          />
        </View>

        {/* Zone alerts — crew activity */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>ZONE ALERTS — CREW</Text>
          <Text style={styles.groupSub}>Alerts when crew members enter, leave, or overstay zones</Text>

          <PrefRow
            label="Crew zone activity"
            sub="Arrivals, departures, and overstays"
            value={notifyCrewZoneActivity}
            onChange={setNotifyCrewZoneActivity}
            last
          />
        </View>

        {/* SOS */}
        <View style={styles.group}>
          <Text style={styles.groupTitle}>SOS / EMERGENCY</Text>
          <Text style={styles.groupSub}>Critical safety alerts — recommended on</Text>

          <PrefRow
            label="SOS alerts"
            sub="When a crew member activates SOS"
            value={notifySOSAlerts}
            onChange={setNotifySOSAlerts}
          />
          <PrefRow
            label="SOS cancellations"
            sub="When a crew member cancels their SOS"
            value={notifySOSCancel}
            onChange={setNotifySOSCancel}
            last
          />
        </View>

      </ScrollView>
    </Sheet>
  );
});

// ─── Internal row ─────────────────────────────────────────────────────────────

interface PrefRowProps {
  label: string;
  sub: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}

const PrefRow: React.FC<PrefRowProps> = ({ label, sub, value, onChange, last }) => (
  <View style={[styles.row, last && styles.rowLast]}>
    <View style={styles.rowText}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowSub}>{sub}</Text>
    </View>
    <Toggle value={value} onValueChange={onChange} />
  </View>
);

const styles = StyleSheet.create({
  content: { padding: 16, gap: 16 },
  sectionNote: { color: 'rgba(255,255,255,0.5)', fontSize: 13, lineHeight: 18 },
  group: {
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    padding: 12,
    gap: 4,
  },
  groupTitle: {
    color: '#4ADE80',
    fontSize: 10,
    fontWeight: '900',
    letterSpacing: 1.4,
    marginBottom: 2,
  },
  groupSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginBottom: 8 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  rowLast: { borderBottomWidth: 0 },
  rowText: { flex: 1, paddingRight: 12 },
  rowLabel: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  rowSub: { color: 'rgba(255,255,255,0.4)', fontSize: 11, marginTop: 2 },
});
