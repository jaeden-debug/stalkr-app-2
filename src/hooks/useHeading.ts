import * as Location from 'expo-location';
import { useEffect, useRef, useState } from 'react';

export interface HeadingData {
  magHeading: number;
  trueHeading: number;
  direction: string;
}

const DIRECTIONS = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];

export function useHeading(): HeadingData {
  const [heading, setHeading] = useState<HeadingData>({ magHeading: 0, trueHeading: 0, direction: 'N' });
  const sub = useRef<Location.LocationSubscription | null>(null);

  useEffect(() => {
    let mounted = true;

    (async () => {
      const { status } = await Location.requestForegroundPermissionsAsync();
      if (status !== 'granted' || !mounted) return;

      sub.current = await Location.watchHeadingAsync((data) => {
        if (!mounted) return;
        const deg = Math.round(data.magHeading);
        const dir = DIRECTIONS[Math.round(deg / 45) % 8];
        setHeading({ magHeading: deg, trueHeading: Math.round(data.trueHeading ?? deg), direction: dir });
      });
    })();

    return () => {
      mounted = false;
      sub.current?.remove();
      sub.current = null;
    };
  }, []);

  return heading;
}
