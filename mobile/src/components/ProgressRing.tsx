import React from 'react';
import { View } from 'react-native';
import Svg, { Circle, Text as SvgText } from 'react-native-svg';

import { useTheme } from '../theme';

/**
 * Anneau de progression : blocs terminés sur blocs prévus. Le chiffre est écrit
 * au centre — l'arc seul se lit mal, et la valeur exacte compte ici.
 */
export function ProgressRing({
  done,
  total,
  size = 104,
}: {
  done: number;
  total: number;
  size?: number;
}) {
  const theme = useTheme();
  const stroke = 11;
  const radius = 50 - stroke / 2 - 0.5;
  const circumference = 2 * Math.PI * radius;
  const ratio = total > 0 ? Math.min(1, done / total) : 0;

  return (
    <View accessible accessibilityLabel={`${done} blocs terminés sur ${total}`}>
      <Svg width={size} height={size} viewBox="0 0 100 100">
        <Circle cx={50} cy={50} r={radius} fill="none" stroke={theme.surfaceSunken} strokeWidth={stroke} />
        <Circle
          cx={50}
          cy={50}
          r={radius}
          fill="none"
          stroke={theme.brand}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - ratio)}
          transform="rotate(-90 50 50)"
        />
        <SvgText x={50} y={47} textAnchor="middle" fontSize={21} fontWeight="800" fill={theme.ink}>
          {`${done}/${total}`}
        </SvgText>
        <SvgText x={50} y={63} textAnchor="middle" fontSize={9} fontWeight="600" fill={theme.inkMuted}>
          blocs
        </SvgText>
      </Svg>
    </View>
  );
}
