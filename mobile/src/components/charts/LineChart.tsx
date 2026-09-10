import React, { useId, useMemo, useRef, useState } from 'react';
import { PanResponder, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, G, Line, LinearGradient, Path, Stop, Text as SvgText } from 'react-native-svg';

import { spacing, type as typography, useTheme } from '../../theme';
import {
  areaPath,
  axisLabelIndices,
  buildScale,
  compactNumber,
  contiguousSegments,
  filledPoints,
  linePath,
  type ChartPoint,
} from './chartUtils';

const PADDING = { left: 44, right: 14, top: 16, bottom: 24 };

type Props = {
  title: string;
  points: ChartPoint[];
  color: string;
  unit?: string;
  height?: number;
  fromZero?: boolean;
  reference?: { value: number; label: string };
  formatValue?: (value: number) => string;
  emptyMessage?: string;
  /**
   * Série éparse (une pesée tous les deux ou trois jours) : on relie les
   * mesures entre elles et on marque chaque point réellement saisi, plutôt que
   * de laisser des fragments de courbe isolés.
   */
  connectGaps?: boolean;
};

export function LineChart({
  title,
  points,
  color,
  unit,
  height = 180,
  fromZero = true,
  reference,
  formatValue = (value) => compactNumber(value),
  emptyMessage = 'Pas encore de données sur cette période.',
  connectGaps = false,
}: Props) {
  const theme = useTheme();
  const rawId = useId();
  const gradientId = `grad${rawId.replace(/[^a-zA-Z0-9]/g, '')}`;
  const [width, setWidth] = useState(0);
  const [activeIndex, setActiveIndex] = useState<number | null>(null);
  const widthRef = useRef(0);

  const values = useMemo(() => points.map((point) => point.value), [points]);
  const hasData = values.some((value) => value !== null && value > 0);

  const scale = useMemo(
    () =>
      buildScale({
        values,
        width: width || 320,
        height,
        padding: PADDING,
        fromZero,
        minimumTop: reference?.value,
      }),
    [values, width, height, fromZero, reference?.value],
  );

  const segments = useMemo(
    () => (connectGaps ? [filledPoints(values)].filter((segment) => segment.length > 0) : contiguousSegments(values)),
    [values, connectGaps],
  );
  // L'aire n'a de sens que si la base du graphique est le zéro : sous une
  // courbe de poids tronquée, elle donnerait une fausse impression de volume.
  const showArea = fromZero;
  const measuredPoints = useMemo(
    () => (connectGaps ? filledPoints(values) : []),
    [values, connectGaps],
  );

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: () => true,
        onPanResponderTerminationRequest: () => false,
        onPanResponderGrant: (event) => updateActive(event.nativeEvent.locationX),
        onPanResponderMove: (event) => updateActive(event.nativeEvent.locationX),
        onPanResponderRelease: () => setActiveIndex(null),
        onPanResponderTerminate: () => setActiveIndex(null),
      }),
    // `points.length` suffit : la fonction ne dépend que du nombre de points.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [points.length],
  );

  function updateActive(locationX: number) {
    const currentWidth = widthRef.current || 320;
    const plotWidth = Math.max(1, currentWidth - PADDING.left - PADDING.right);
    const ratio = (locationX - PADDING.left) / plotWidth;
    const index = Math.round(ratio * Math.max(1, points.length - 1));
    setActiveIndex(Math.max(0, Math.min(points.length - 1, index)));
  }

  const lastFilledIndex = (() => {
    for (let i = values.length - 1; i >= 0; i -= 1) {
      if (values[i] !== null) return i;
    }
    return null;
  })();

  const readoutIndex = activeIndex ?? lastFilledIndex;
  const readoutPoint = readoutIndex !== null ? points[readoutIndex] : null;
  const labelIndices = axisLabelIndices(points.length);

  return (
    <View>
      <View style={styles.header}>
        <View style={styles.headerText}>
          <Text style={[typography.strong, { color: theme.ink }]}>{title}</Text>
          {readoutPoint ? (
            <Text style={[typography.tiny, { color: theme.inkMuted, marginTop: 2 }]}>{readoutPoint.label}</Text>
          ) : null}
        </View>
        {readoutPoint && readoutPoint.value !== null ? (
          <View style={styles.readout}>
            <Text style={[styles.readoutValue, { color: theme.ink }]}>
              {formatValue(readoutPoint.value)}
              {unit ? <Text style={[typography.small, { color: theme.inkMuted }]}> {unit}</Text> : null}
            </Text>
          </View>
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
            <Defs>
              <LinearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={color} stopOpacity={0.22} />
                <Stop offset="1" stopColor={color} stopOpacity={0.02} />
              </LinearGradient>
            </Defs>

            {/* grille discrète */}
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
                    x={scale.plotLeft - 8}
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

            {reference && reference.value > 0 ? (
              <G>
                <Line
                  x1={scale.plotLeft}
                  y1={scale.y(reference.value)}
                  x2={scale.plotLeft + scale.plotWidth}
                  y2={scale.y(reference.value)}
                  stroke={theme.inkMuted}
                  strokeWidth={1}
                  strokeDasharray="4 4"
                  opacity={0.7}
                />
                <SvgText
                  x={scale.plotLeft + scale.plotWidth}
                  y={scale.y(reference.value) - 5}
                  fill={theme.inkMuted}
                  fontSize={10}
                  fontWeight="700"
                  textAnchor="end">
                  {reference.label}
                </SvgText>
              </G>
            ) : null}

            {hasData ? (
              <G>
                {showArea
                  ? segments.map((segment, index) => (
                      <Path key={`area-${index}`} d={areaPath(segment, scale)} fill={`url(#${gradientId})`} />
                    ))
                  : null}
                {segments.map((segment, index) => (
                  <Path
                    key={`line-${index}`}
                    d={linePath(segment, scale)}
                    stroke={color}
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    fill="none"
                  />
                ))}
                {/* marqueurs : une mesure isolée ne doit jamais être invisible */}
                {(connectGaps && measuredPoints.length <= 45
                  ? measuredPoints
                  : segments.filter((segment) => segment.length === 1).map((segment) => segment[0])
                ).map((point) => (
                  <Circle
                    key={`dot-${point.index}`}
                    cx={scale.x(point.index)}
                    cy={scale.y(point.value)}
                    r={3.5}
                    fill={color}
                    stroke={theme.surface}
                    strokeWidth={1.5}
                  />
                ))}
              </G>
            ) : null}

            {activeIndex !== null && points[activeIndex]?.value !== null ? (
              <G>
                <Line
                  x1={scale.x(activeIndex)}
                  y1={scale.plotTop}
                  x2={scale.x(activeIndex)}
                  y2={scale.plotTop + scale.plotHeight}
                  stroke={theme.inkMuted}
                  strokeWidth={1}
                />
                <Circle
                  cx={scale.x(activeIndex)}
                  cy={scale.y(points[activeIndex].value as number)}
                  r={5}
                  fill={color}
                  stroke={theme.surface}
                  strokeWidth={2}
                />
              </G>
            ) : lastFilledIndex !== null && hasData ? (
              <Circle
                cx={scale.x(lastFilledIndex)}
                cy={scale.y(values[lastFilledIndex] as number)}
                r={4.5}
                fill={color}
                stroke={theme.surface}
                strokeWidth={2}
              />
            ) : null}

            <G>
              {labelIndices.map((index) => (
                <SvgText
                  key={`x-${index}`}
                  x={scale.x(index)}
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
  headerText: { flex: 1 },
  readout: { alignItems: 'flex-end' },
  readoutValue: { fontSize: 20, fontWeight: '800', letterSpacing: -0.4 },
});
