import React, { useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { G, Line, Path, Text as SvgText } from 'react-native-svg';

import { spacing, type as typography, useTheme } from '../../theme';
import { axisLabelIndices, buildScale, compactNumber, roundedTopBar } from './chartUtils';

const PADDING = { left: 30, right: 12, top: 16, bottom: 24 };
const GAP = 2; // 2 px de surface entre deux barres : les blocs restent dénombrables

export type BarPoint = { label: string; value: number; capacity?: number };

type Props = {
  title: string;
  points: BarPoint[];
  color: string;
  unit?: string;
  height?: number;
  emptyMessage?: string;
};

export function BarChart({
  title,
  points,
  color,
  unit,
  height = 160,
  emptyMessage = 'Pas encore de données sur cette période.',
}: Props) {
  const theme = useTheme();
  const [width, setWidth] = useState(0);
  const widthRef = useRef(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);

  const capacity = useMemo(
    () => Math.max(1, ...points.map((point) => point.capacity ?? point.value)),
    [points],
  );
  const hasData = points.some((point) => point.value > 0);

  const scale = useMemo(
    () =>
      buildScale({
        values: points.map((point) => point.value),
        width: width || 320,
        height,
        padding: PADDING,
        fromZero: true,
        snapMax: capacity,
      }),
    [points, width, height, capacity],
  );

  const slot = points.length ? scale.plotWidth / points.length : scale.plotWidth;
  const barWidth = Math.max(2, Math.min(22, slot - GAP));

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => select(event.nativeEvent.locationX),
        onPanResponderMove: (event) => select(event.nativeEvent.locationX),
        onPanResponderRelease: () => setActiveIndex(null),
        onPanResponderTerminate: () => setActiveIndex(null),
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points.length],
  );

  function select(locationX: number) {
    const currentWidth = widthRef.current || 320;
    const plotWidth = Math.max(1, currentWidth - PADDING.left - PADDING.right);
    const perSlot = plotWidth / Math.max(1, points.length);
    const index = Math.floor((locationX - PADDING.left) / perSlot);
    setActiveIndex(Math.max(0, Math.min(points.length - 1, index)));
  }

  const readoutIndex = activeIndex ?? (points.length ? points.length - 1 : null);
  const readout = readoutIndex !== null ? points[readoutIndex] : null;
  const labelIndices = axisLabelIndices(points.length);
  const baseline = scale.plotTop + scale.plotHeight;

  return (
    <View>
      <View style={styles.header}>
        <View style={{ flex: 1 }}>
          <Text style={[typography.strong, { color: theme.ink }]}>{title}</Text>
          {readout ? (
            <Text style={[typography.tiny, { color: theme.inkMuted, marginTop: 2 }]}>{readout.label}</Text>
          ) : null}
        </View>
        {readout ? (
          <Text style={[styles.readoutValue, { color: theme.ink }]}>
            {readout.value}
            {readout.capacity ? <Text style={{ color: theme.inkMuted }}>/{readout.capacity}</Text> : null}
            {unit ? <Text style={[typography.small, { color: theme.inkMuted }]}> {unit}</Text> : null}
          </Text>
        ) : null}
      </View>

      <View
        onLayout={(event) => {
          const next = event.nativeEvent.layout.width;
          widthRef.current = next;
          setWidth(next);
        }}
        {...panResponder.panHandlers}>
        {width > 0 ? (
          <Svg width={width} height={height}>
            <G>
              {scale.ticks.map((tick) => (
                <React.Fragment key={`tick-${tick}`}>
                  <Line
                    x1={scale.plotLeft}
                    y1={scale.y(tick)}
                    x2={scale.plotLeft + scale.plotWidth}
                    y2={scale.y(tick)}
                    stroke={theme.grid}
                    strokeWidth={1}
                  />
                  <SvgText
                    x={scale.plotLeft - 6}
                    y={scale.y(tick) + 4}
                    fill={theme.inkMuted}
                    fontSize={10}
                    fontWeight="600"
                    textAnchor="end">
                    {compactNumber(tick)}
                  </SvgText>
                </React.Fragment>
              ))}
            </G>

            <G>
              {points.map((point, index) => {
                const x = scale.plotLeft + index * slot + (slot - barWidth) / 2;
                const trackTop = scale.y(point.capacity ?? capacity);
                const valueTop = scale.y(point.value);
                const isActive = activeIndex === index;
                return (
                  <React.Fragment key={`bar-${index}`}>
                    <Path
                      d={roundedTopBar(x, trackTop, barWidth, baseline - trackTop, 4)}
                      fill={theme.surfaceSunken}
                      opacity={isActive ? 1 : 0.7}
                    />
                    {point.value > 0 ? (
                      <Path
                        d={roundedTopBar(x, valueTop, barWidth, baseline - valueTop, 4)}
                        fill={color}
                        opacity={activeIndex === null || isActive ? 1 : 0.55}
                      />
                    ) : null}
                  </React.Fragment>
                );
              })}
            </G>

            <Line
              x1={scale.plotLeft}
              y1={baseline}
              x2={scale.plotLeft + scale.plotWidth}
              y2={baseline}
              stroke={theme.line}
              strokeWidth={1}
            />

            <G>
              {labelIndices.map((index) => (
                <SvgText
                  key={`x-${index}`}
                  x={
                    index === 0
                      ? scale.plotLeft
                      : index === points.length - 1
                        ? scale.plotLeft + scale.plotWidth
                        : scale.plotLeft + index * slot + slot / 2
                  }
                  y={height - 6}
                  fill={theme.inkMuted}
                  fontSize={10}
                  fontWeight="600"
                  textAnchor={index === 0 ? 'start' : index === points.length - 1 ? 'end' : 'middle'}>
                  {points[index]?.label ?? ''}
                </SvgText>
              ))}
            </G>
          </Svg>
        ) : (
          <View style={{ height }} />
        )}
      </View>

      {!hasData ? (
        <Text style={[typography.small, { color: theme.inkMuted, textAlign: 'center', marginTop: -height / 2 }]}>
          {emptyMessage}
        </Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
    gap: spacing.md,
  },
  readoutValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
});
