/**
 * FilterSheet — show/hide map layers: marker types, zones, trails.
 *
 * Icons come from MARKER_TYPE_CONFIGS (`ionicon` + `color`) — the SAME source
 * the map pins render from — so a row in this menu always looks like the thing
 * it toggles. It previously rendered `m.emoji`, which drew platform emoji that
 * matched nothing on the map and drifted per OS. Deliberately no second icon
 * table here: adding one is how the menu and the map diverge.
 */
import React from 'react';
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { Sheet } from '@/components/ui/Sheet';
import { Toggle } from '@/components/ui/Toggle';
import { useMapStore } from '@/store/useMapStore';
import { MARKER_TYPES } from '@/constants/markerTypes';
import { C } from '@/constants/theme';
import type { MarkerType } from '@/types/database';

const ALL_TYPES = MARKER_TYPES.map((m) => m.type as MarkerType);

export const FilterSheet: React.FC = () => {
  const open = useMapStore((s) => s.filterSheetOpen);
  const setOpen = useMapStore((s) => s.setFilterSheetOpen);
  const hidden = useMapStore((s) => s.hiddenMarkerTypes);
  const toggleType = useMapStore((s) => s.toggleMarkerType);
  const setAll = useMapStore((s) => s.setAllMarkerTypes);
  const showZones = useMapStore((s) => s.showZones);
  const setShowZones = useMapStore((s) => s.setShowZones);
  const showTrails = useMapStore((s) => s.showTrails);
  const setShowTrails = useMapStore((s) => s.setShowTrails);
  const showPlaces = useMapStore((s) => s.showPlaces);
  const setShowPlaces = useMapStore((s) => s.setShowPlaces);

  const allVisible = hidden.length === 0;

  return (
    <Sheet visible={open} onClose={() => setOpen(false)} title="Map Layers" snapHeight={560}>
      <ScrollView contentContainerStyle={s.body} showsVerticalScrollIndicator={false}>
        <View style={s.rowCard}>
          {/* Colours mirror ZoneLayer's default zone stroke and TrailLayer's
              self-trail stroke so the swatch reads as the layer it controls. */}
          <Row label="Zones" icon="scan-circle" color="#22c55e" value={showZones} onChange={setShowZones} />
          <Row label="Trails" icon="footsteps" color="#22c55e" value={showTrails} onChange={setShowTrails} />
          {/* Google's own POIs — businesses, transit, attractions. Off by
              default because they compete with the pins that matter. Greyed
              rather than green: this is basemap chrome, not STALKR data. */}
          <Row
            label="Places & businesses"
            icon="storefront"
            color="#94A3B8"
            value={showPlaces}
            onChange={setShowPlaces}
            last
          />
        </View>

        <View style={s.sectionHead}>
          <Text style={s.sectionLabel}>MARKERS</Text>
          <TouchableOpacity onPress={() => setAll(!allVisible, ALL_TYPES)} activeOpacity={0.8}>
            <Text style={s.allBtn}>{allVisible ? 'Hide all' : 'Show all'}</Text>
          </TouchableOpacity>
        </View>

        <View style={s.rowCard}>
          {MARKER_TYPES.map((m, i) => {
            const visible = !hidden.includes(m.type as MarkerType);
            return (
              <View key={m.type} style={[s.row, i < MARKER_TYPES.length - 1 && s.rowBorder]}>
                <View style={[s.iconWrap, { backgroundColor: m.color + '22', borderColor: m.color + '55' }]}>
                  <Ionicons name={m.ionicon} size={17} color={m.color} />
                </View>
                <Text style={s.rowLabel}>{m.label}</Text>
                <Toggle value={visible} onValueChange={() => toggleType(m.type as MarkerType)} />
              </View>
            );
          })}
        </View>
      </ScrollView>
    </Sheet>
  );
};

const Row: React.FC<{
  label: string;
  icon: React.ComponentProps<typeof Ionicons>['name'];
  color: string;
  value: boolean;
  onChange: (v: boolean) => void;
  last?: boolean;
}> = ({ label, icon, color, value, onChange, last }) => (
  <View style={[s.row, !last && s.rowBorder]}>
    <View style={[s.iconWrap, { backgroundColor: color + '22', borderColor: color + '55' }]}>
      <Ionicons name={icon} size={17} color={color} />
    </View>
    <Text style={s.rowLabel}>{label}</Text>
    <Toggle value={value} onValueChange={onChange} />
  </View>
);

const s = StyleSheet.create({
  body: { padding: 16, gap: 14 },
  rowCard: { backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 14, borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', paddingHorizontal: 12 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 11 },
  rowBorder: { borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.07)' },
  iconWrap: { width: 34, height: 34, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  rowLabel: { flex: 1, color: '#FFFFFF', fontSize: 14, fontWeight: '600' },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 4 },
  sectionLabel: { color: 'rgba(255,255,255,0.45)', fontSize: 10, fontWeight: '900', letterSpacing: 1.4 },
  allBtn: { color: C.green, fontSize: 12, fontWeight: '800' },
});
