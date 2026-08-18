import React from "react";
import { View } from "react-native";
import Svg, {
  Path,
  Rect,
  Circle,
  G,
  Defs,
  LinearGradient,
  Stop,
  Line,
} from "react-native-svg";

/**
 * Saklio custom illustration system — rounded, soft, minimal, layered,
 * thin outlines, subtle gradients. All accept a `color` (brand) prop.
 */

export function SaklioLogo({ size = 64, color = "#5B9F7D", accent = "#8FCFAE" }: { size?: number; color?: string; accent?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 64 64" fill="none">
      <Defs>
        <LinearGradient id="lg" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={accent} />
          <Stop offset="1" stopColor={color} />
        </LinearGradient>
      </Defs>
      {/* shield / box */}
      <Path
        d="M32 6l20 8v14c0 14-8.5 22-20 26C20.5 50 12 42 12 28V14l20-8z"
        fill="url(#lg)"
      />
      {/* receipt S curve */}
      <Path
        d="M38 22c-2-2-6-2.5-9-1.5-3 1-4 4-1.5 6 2.5 2 8 1.5 9.5 4s-1.5 6-5 6.5c-3 .4-6-.5-8-2.5"
        stroke="#fff"
        strokeWidth={3.4}
        strokeLinecap="round"
        fill="none"
      />
    </Svg>
  );
}

export function EmptyBoxIllustration({ size = 200, brand = "#8FCFAE", ink = "#202522" }: { size?: number; brand?: string; ink?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 220 200" fill="none">
      <Defs>
        <LinearGradient id="box" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={brand} stopOpacity={0.35} />
          <Stop offset="1" stopColor={brand} stopOpacity={0.15} />
        </LinearGradient>
      </Defs>
      {/* box back flaps */}
      <Path d="M50 90l60-22 60 22-60 20-60-20z" fill={brand} opacity={0.5} />
      {/* falling receipt */}
      <G>
        <Rect x="92" y="18" width="42" height="54" rx="6" fill="#fff" stroke={ink} strokeOpacity={0.15} strokeWidth={2} />
        <Line x1="100" y1="32" x2="126" y2="32" stroke={ink} strokeOpacity={0.25} strokeWidth={3} strokeLinecap="round" />
        <Line x1="100" y1="42" x2="122" y2="42" stroke={ink} strokeOpacity={0.2} strokeWidth={3} strokeLinecap="round" />
        <Line x1="100" y1="52" x2="118" y2="52" stroke={ink} strokeOpacity={0.15} strokeWidth={3} strokeLinecap="round" />
      </G>
      {/* box body */}
      <Path d="M50 90l60 20 60-20v58l-60 22-60-22V90z" fill="url(#box)" stroke={brand} strokeWidth={2.5} />
      <Path d="M110 110v70" stroke={brand} strokeWidth={2.5} strokeOpacity={0.5} />
    </Svg>
  );
}

export function ShieldIllustration({ size = 200, brand = "#8FCFAE", ink = "#202522" }: { size?: number; brand?: string; ink?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Defs>
        <LinearGradient id="sh" x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={brand} stopOpacity={0.4} />
          <Stop offset="1" stopColor={brand} stopOpacity={0.18} />
        </LinearGradient>
      </Defs>
      <Path d="M100 26l52 20v40c0 40-24 62-52 72-28-10-52-32-52-72V46l52-20z" fill="url(#sh)" stroke={brand} strokeWidth={3} />
      <Path d="M78 100l16 16 30-34" stroke={brand} strokeWidth={6} strokeLinecap="round" strokeLinejoin="round" fill="none" />
    </Svg>
  );
}

export function ReceiptErrorIllustration({ size = 180, brand = "#DF7C76", ink = "#202522" }: { size?: number; brand?: string; ink?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Path
        d="M62 40l10 8 10-8 10 8 10-8 10 8 10-8v96l-8 8-8-8-8 8-8-8-8 8-8-8-8 8-8-8V40z"
        fill="#fff"
        stroke={ink}
        strokeOpacity={0.15}
        strokeWidth={2.5}
        strokeLinejoin="round"
      />
      <Line x1="72" y1="70" x2="128" y2="70" stroke={ink} strokeOpacity={0.2} strokeWidth={4} strokeLinecap="round" />
      <Line x1="72" y1="86" x2="118" y2="86" stroke={ink} strokeOpacity={0.15} strokeWidth={4} strokeLinecap="round" />
      <Circle cx="130" cy="130" r="30" fill={brand} opacity={0.15} />
      <Circle cx="126" cy="126" r="18" stroke={brand} strokeWidth={5} fill="none" />
      <Line x1="139" y1="139" x2="156" y2="156" stroke={brand} strokeWidth={6} strokeLinecap="round" />
    </Svg>
  );
}

export function MailInboxIllustration({ size = 200, brand = "#8FCFAE", ink = "#202522" }: { size?: number; brand?: string; ink?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 220 180" fill="none">
      <Defs>
        <LinearGradient id="mail" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={brand} stopOpacity={0.4} />
          <Stop offset="1" stopColor={brand} stopOpacity={0.18} />
        </LinearGradient>
      </Defs>
      <Rect x="40" y="56" width="140" height="96" rx="14" fill="url(#mail)" stroke={brand} strokeWidth={2.5} />
      <Path d="M40 68l70 46 70-46" stroke={brand} strokeWidth={2.5} fill="none" />
      {/* floating products */}
      <Rect x="74" y="18" width="30" height="30" rx="8" fill="#fff" stroke={ink} strokeOpacity={0.15} strokeWidth={2} />
      <Rect x="116" y="26" width="26" height="26" rx="7" fill={brand} opacity={0.8} />
    </Svg>
  );
}

export function ScanReceiptIllustration({ size = 200, brand = "#8FCFAE", ink = "#202522" }: { size?: number; brand?: string; ink?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Rect x="66" y="40" width="68" height="110" rx="8" fill="#fff" stroke={ink} strokeOpacity={0.15} strokeWidth={2.5} />
      <Line x1="78" y1="64" x2="122" y2="64" stroke={ink} strokeOpacity={0.2} strokeWidth={4} strokeLinecap="round" />
      <Line x1="78" y1="80" x2="114" y2="80" stroke={ink} strokeOpacity={0.15} strokeWidth={4} strokeLinecap="round" />
      <Line x1="78" y1="96" x2="118" y2="96" stroke={ink} strokeOpacity={0.15} strokeWidth={4} strokeLinecap="round" />
      {/* scan corners */}
      <Path d="M40 60V44a6 6 0 016-6h16" stroke={brand} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M160 60V44a6 6 0 00-6-6h-16" stroke={brand} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M40 140v16a6 6 0 006 6h16" stroke={brand} strokeWidth={5} strokeLinecap="round" fill="none" />
      <Path d="M160 140v16a6 6 0 01-6 6h-16" stroke={brand} strokeWidth={5} strokeLinecap="round" fill="none" />
      {/* sparkle */}
      <Path d="M150 90l3 8 8 3-8 3-3 8-3-8-8-3 8-3 3-8z" fill={brand} />
    </Svg>
  );
}

export function CalendarIllustration({ size = 200, brand = "#E9B75C", ink = "#202522" }: { size?: number; brand?: string; ink?: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 200 200" fill="none">
      <Rect x="44" y="54" width="112" height="100" rx="14" fill="#fff" stroke={ink} strokeOpacity={0.12} strokeWidth={2.5} />
      <Rect x="44" y="54" width="112" height="28" rx="14" fill={brand} opacity={0.85} />
      <Line x1="72" y1="44" x2="72" y2="66" stroke={ink} strokeOpacity={0.3} strokeWidth={5} strokeLinecap="round" />
      <Line x1="128" y1="44" x2="128" y2="66" stroke={ink} strokeOpacity={0.3} strokeWidth={5} strokeLinecap="round" />
      <Rect x="86" y="98" width="28" height="28" rx="6" fill={brand} opacity={0.3} />
    </Svg>
  );
}
