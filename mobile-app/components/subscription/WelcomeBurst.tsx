import React from 'react';
import Svg, { Circle, Ellipse, G, Path, Rect } from 'react-native-svg';

/** Celebratory smiley with petals, drawn in code so it scales and needs no asset. */
export const WelcomeBurst = ({ size = 220 }: { size?: number }) => {
  const petals = [-60, -30, 0, 30, 60, 120, 150, 180, 210, 240];
  const colors = ['#C026D3', '#F472B6', '#A78BFA', '#EC4899', '#8B5CF6'];
  return (
    <Svg width={size} height={size} viewBox="0 0 220 220">
      <Circle cx="110" cy="112" r="78" fill="#4A1239" />
      <G origin="110, 112">
        {petals.map((deg, i) => (
          <Ellipse
            key={deg}
            cx="110"
            cy="40"
            rx="11"
            ry="30"
            fill={colors[i % colors.length]}
            transform={`rotate(${deg} 110 112)`}
            opacity={0.95}
          />
        ))}
      </G>
      {/* head */}
      <Circle cx="110" cy="76" r="26" fill="#6B3E2E" />
      <Path d="M86 70c2-18 46-18 48 0-10-8-38-8-48 0z" fill="#F9A8D4" />
      <Path d="M100 80q3 4 6 0M114 80q3 4 6 0" stroke="#2B1210" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      <Path d="M101 90q9 7 18 0" stroke="#2B1210" strokeWidth="2.4" fill="none" strokeLinecap="round" />
      {/* body */}
      <Rect x="76" y="100" width="68" height="60" rx="26" fill="#FACC15" />
      <Circle cx="110" cy="130" r="17" fill="#EC4899" />
      <Path d="M101 127q2 3 5 0M114 127q2 3 5 0" stroke="#2B1210" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d="M102 135q8 7 16 0" stroke="#2B1210" strokeWidth="2" fill="none" strokeLinecap="round" />
      <Path d="M76 112l-26 12M144 112l26 12" stroke="#6B3E2E" strokeWidth="9" strokeLinecap="round" />
    </Svg>
  );
};
