import Svg, { Path, Rect } from "react-native-svg";

/** Bucket-seat glyph traced from design-assets/vecteezy car-seat icon:
 *  headrest + neck posts, backrest with inner panel, wide cushion.
 *  Keep in sync with web/src/components/ui.tsx SeatIcon. */
export function SeatIcon({ fill, size = 40 }: { fill: string; size?: number }) {
  return (
    <Svg viewBox="0 0 96 104" width={size} height={size * (104 / 96)}>
      <Path
        d="M33 2h30c6.6 0 11 4.4 11 11v4c0 5.5-4.5 10-10 10H32c-5.5 0-10-4.5-10-10v-4c0-6.6 4.4-11 11-11z"
        fill={fill}
      />
      <Rect x="35" y="25" width="7" height="9" fill={fill} />
      <Rect x="54" y="25" width="7" height="9" fill={fill} />
      <Path
        d="M25 33h46c7.7 0 13 5.3 13 13v29c0 7.7-5.3 13-13 13H25c-7.7 0-13-5.3-13-13V46c0-7.7 5.3-13 13-13z"
        fill={fill}
      />
      <Rect
        x="28"
        y="41"
        width="40"
        height="47"
        rx="11"
        fill="none"
        stroke="#fff"
        strokeWidth="3.5"
      />
      <Path
        d="M13 82h70c5.5 0 9 3.8 9 9.5S88.5 101 83 101H13c-5.5 0-9-3.8-9-9.5S7.5 82 13 82z"
        fill={fill}
        stroke="#fff"
        strokeWidth="3"
      />
    </Svg>
  );
}
