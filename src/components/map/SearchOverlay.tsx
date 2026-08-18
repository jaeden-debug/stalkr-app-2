/**
 * SearchOverlay — Google/Apple-maps style place search.
 *
 * Opened from the nav drawer's search bar (useMapStore.searchOpen). Picking a
 * real place sets useMapStore.searchedPlace (which drops a pin + opens the
 * PlaceCard) — it never starts a journey on its own.
 */
import React from 'react';
import {
  Keyboard,
  KeyboardAvoidingView,
  Modal,
  Platform,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { useMapStore } from '@/store/useMapStore';
import { C } from '@/constants/theme';

/**
 * One height for every part of the search bar.
 *
 * The bar is drawn as a single pill split into two siblings — a left icon cap
 * and the text input — joined by removing the border on the facing edge and
 * rounding only the outer corners. That only reads as ONE control if both
 * halves are the same height. The icon cap previously had no height at all, so
 * it collapsed to its 18px glyph while the input stayed at 52: two differently
 * sized boxes with mismatched radii, which is the "two sizes" bug.
 *
 * Both halves and their container now derive from this constant, so they cannot
 * drift apart again.
 */
const SEARCH_BAR_HEIGHT = 52;
const SEARCH_ICON_WIDTH = 46;

// Places is a separate API from the Maps SDK. Falling back to the IOS key on
// Android would send requests with a key restricted to an iOS bundle id, which
// fails closed with an opaque error.
const GOOGLE_API_KEY =
  process.env.EXPO_PUBLIC_GOOGLE_MAPS_API_KEY ||
  (Platform.OS === 'ios'
    ? process.env.EXPO_PUBLIC_GOOGLE_MAPS_IOS_KEY
    : process.env.EXPO_PUBLIC_GOOGLE_MAPS_ANDROID_KEY) ||
  '';

export const SearchOverlay: React.FC = () => {
  const searchOpen = useMapStore((s) => s.searchOpen);
  const setSearchOpen = useMapStore((s) => s.setSearchOpen);
  const setSearchedPlace = useMapStore((s) => s.setSearchedPlace);

  const close = () => {
    Keyboard.dismiss();
    setSearchOpen(false);
  };

  return (
    <Modal visible={searchOpen} animationType="slide" onRequestClose={close} transparent={false}>
      <SafeAreaView style={s.root} edges={['top', 'left', 'right']}>
        <View style={s.headerRow}>
          <TouchableOpacity style={s.backBtn} onPress={close} activeOpacity={0.8} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
            <Ionicons name="arrow-back" size={22} color="#FFFFFF" />
          </TouchableOpacity>
          <Text style={s.title}>SEARCH</Text>
        </View>

        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <GooglePlacesAutocomplete
            placeholder="Search a place or address"
            fetchDetails
            minLength={1}
            debounce={250}
            enablePoweredByContainer={false}
            keyboardShouldPersistTaps="handled"
            onFail={(e) => console.log('SEARCH PLACES FAIL:', e)}
            textInputProps={{
              autoFocus: true,
              placeholderTextColor: 'rgba(255,255,255,0.4)',
              returnKeyType: 'search',
              clearButtonMode: 'always',
            }}
            onPress={(data: any, details: any = null) => {
              const loc = details?.geometry?.location;
              if (!loc) return;
              setSearchedPlace({
                name: data?.structured_formatting?.main_text ?? data?.description ?? 'Dropped pin',
                address: details?.formatted_address ?? data?.description,
                latitude: loc.lat,
                longitude: loc.lng,
              });
              setSearchOpen(false);
            }}
            query={{ key: GOOGLE_API_KEY, language: 'en' }}
            renderLeftButton={() => (
              <View style={s.searchIcon}>
                <Ionicons name="search" size={18} color={C.green} />
              </View>
            )}
            styles={{
              container: s.acContainer,
              textInputContainer: s.acInputContainer,
              textInput: s.acInput,
              listView: s.acList,
              row: s.acRow,
              description: { color: '#FFFFFF', fontSize: 14 },
              separator: { backgroundColor: 'rgba(255,255,255,0.08)', height: 0.5 },
            }}
          />
        </KeyboardAvoidingView>
      </SafeAreaView>
    </Modal>
  );
};

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: C.bg, paddingHorizontal: 16 },
  headerRow: { flexDirection: 'row', alignItems: 'center', gap: 14, paddingVertical: 14 },
  backBtn: {
    width: 38, height: 38, borderRadius: 19,
    backgroundColor: C.surface, borderWidth: 1, borderColor: C.border,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { color: '#FFFFFF', fontSize: 20, fontWeight: '900', letterSpacing: 1.5 },

  acContainer: { flex: 1 },
  acInputContainer: {
    backgroundColor: 'transparent',
    paddingHorizontal: 0,
    // Pin the row to the bar height and stretch both halves to fill it, so the
    // cap and the input are always the same size regardless of glyph metrics or
    // platform TextInput sizing.
    height: SEARCH_BAR_HEIGHT,
    alignItems: 'stretch',
  },
  searchIcon: {
    width: SEARCH_ICON_WIDTH,
    height: SEARCH_BAR_HEIGHT,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderTopLeftRadius: 14,
    borderBottomLeftRadius: 14,
    borderWidth: 1.5,
    borderRightWidth: 0,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  acInput: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
    color: '#FFFFFF',
    height: SEARCH_BAR_HEIGHT,
    borderTopRightRadius: 14,
    borderBottomRightRadius: 14,
    borderTopLeftRadius: 0,
    borderBottomLeftRadius: 0,
    paddingHorizontal: 12,
    // Android centres text by baseline unless padding is zeroed, which made the
    // right half look taller than the cap even at equal heights.
    paddingVertical: 0,
    textAlignVertical: 'center',
    fontSize: 15,
    fontWeight: '600',
    borderWidth: 1.5,
    borderLeftWidth: 0,
    borderColor: 'rgba(255,255,255,0.12)',
  },
  acList: {
    backgroundColor: 'transparent',
    marginTop: 10,
  },
  acRow: {
    backgroundColor: 'rgba(255,255,255,0.04)',
    paddingVertical: 14,
    paddingHorizontal: 14,
    borderRadius: 12,
    marginBottom: 8,
  },
});
