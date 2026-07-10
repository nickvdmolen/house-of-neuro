import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Card } from './ui';
import { buildScoreTrajectories, DAY_IN_MS } from '../scoreTrajectory';
import { getSemesterRange, getSemesterTimeStatus } from '../semesterTimeline';

const colorForSeries = (index) => {
  const hue = (212 + index * 137.508) % 360;
  const lightness = 36 + (index % 3) * 4;
  return `hsl(${hue.toFixed(1)} 68% ${lightness}%)`;
};

const pointFormatter = new Intl.NumberFormat('nl-NL', {
  maximumFractionDigits: 1,
});
const summaryDateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
const summaryDateTimeFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});
const summaryTimeFormatter = new Intl.DateTimeFormat('nl-NL', {
  hour: '2-digit',
  minute: '2-digit',
});
const chartDateFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
});
const chartDateYearFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  year: '2-digit',
});
const chartDateTimeFormatter = new Intl.DateTimeFormat('nl-NL', {
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
});

const formatPoints = (value) => pointFormatter.format(value);
const formatSummaryDate = (timestamp) => summaryDateFormatter.format(new Date(timestamp));

const getNiceStep = (range, targetTicks = 5) => {
  const roughStep = range / targetTicks;
  const power = 10 ** Math.floor(Math.log10(roughStep));
  const fraction = roughStep / power;
  const niceFraction = fraction <= 1 ? 1 : fraction <= 2 ? 2 : fraction <= 5 ? 5 : 10;
  return niceFraction * power;
};

const getYScale = (values, includeZero = true) => {
  let rawMin = includeZero ? 0 : Number.POSITIVE_INFINITY;
  let rawMax = includeZero ? 0 : Number.NEGATIVE_INFINITY;
  values.forEach((value) => {
    rawMin = Math.min(rawMin, value);
    rawMax = Math.max(rawMax, value);
  });
  if (rawMin === rawMax) {
    const padding = Math.max(Math.abs(rawMin) * 0.1, 5);
    rawMin -= padding;
    rawMax += padding;
  } else if (!includeZero) {
    const padding = (rawMax - rawMin) * 0.12;
    rawMin -= padding;
    rawMax += padding;
  }

  const step = getNiceStep(rawMax - rawMin);
  const min = includeZero && rawMin >= 0 ? 0 : Math.floor(rawMin / step) * step;
  const max = Math.max(Math.ceil(rawMax / step) * step, min + step);
  const ticks = [];
  for (let value = min; value <= max + step / 1000; value += step) {
    ticks.push(Number(value.toFixed(10)));
  }
  return { min, max, ticks };
};

const buildDateTicks = (min, max, count) =>
  Array.from({ length: count }, (_, index) => min + ((max - min) * index) / (count - 1));

const describePoint = (trajectory, point) => {
  const score = `${formatPoints(point.value)} punten`;
  if (point.isBaseline) {
    return `${trajectory.name} · vóór eerste registratie · ${score} · afgeleid startpunt`;
  }
  if (point.isSnapshot) {
    return `${trajectory.name} · ${formatSummaryDate(point.timestamp)} · ${score} · huidige totaalscore${
      trajectory.hasHistory ? '' : ' (geen scorehistorie)'
    }`;
  }
  if (!Number.isFinite(point.delta)) {
    return `${trajectory.name} · ${formatSummaryDate(point.timestamp)} · ${score} · geen scorehistorie`;
  }
  const change = point.delta > 0 ? `+${formatPoints(point.delta)}` : formatPoints(point.delta);
  const mutations = point.eventCount > 1 ? ` · ${point.eventCount} mutaties` : '';
  return `${trajectory.name} · ${formatSummaryDate(point.timestamp)} · ${score} · ${change}${mutations}`;
};

const formatChange = (change, emptyLabel) => {
  if (!change) return emptyLabel;
  const prefix = change.delta > 0 ? '+' : '';
  if (change.fromIsBaseline) {
    return `Vóór eerste registratie → ${formatSummaryDate(
      change.toTimestamp
    )} · ${prefix}${formatPoints(change.delta)}`;
  }
  const from = new Date(change.fromTimestamp);
  const to = new Date(change.toTimestamp);
  const sameDay =
    from.getFullYear() === to.getFullYear() &&
    from.getMonth() === to.getMonth() &&
    from.getDate() === to.getDate();
  const period = sameDay
    ? `${summaryDateTimeFormatter.format(from)} → ${summaryTimeFormatter.format(to)}`
    : `${formatSummaryDate(change.fromTimestamp)} → ${formatSummaryDate(change.toTimestamp)}`;
  return `${period} · ${prefix}${formatPoints(change.delta)}`;
};

function ChangeMarker({ point, x, y, color, keyboardInteractive, onHover }) {
  const label = onHover.label;
  const interactionProps = {
    'aria-label': label,
    className: 'score-change-marker',
    focusable: keyboardInteractive ? 'true' : 'false',
    role: keyboardInteractive ? 'button' : 'img',
    tabIndex: keyboardInteractive ? 0 : undefined,
    onPointerEnter: () => onHover.show(label),
    onMouseLeave: onHover.hide,
    onFocus: () => onHover.show(label),
    onBlur: onHover.hide,
    onClick: () => onHover.show(label),
    onKeyDown: (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        onHover.show(label);
      }
    },
    style: { cursor: 'pointer' },
  };

  if (point.isBaseline || !Number.isFinite(point.delta) || point.delta === 0) {
    return (
      <g {...interactionProps}>
        <circle className="score-marker-hit-area" cx={x} cy={y} r="14" fill="transparent" />
        <circle
          cx={x}
          cy={y}
          r={point.isBaseline ? 3.5 : 4}
          fill={point.isBaseline || point.isSnapshot ? color : '#525252'}
          stroke="#ffffff"
          strokeWidth="1.5"
        />
        <title>{label}</title>
      </g>
    );
  }

  const points =
    point.delta > 0
      ? `${x},${y - 6} ${x - 5.5},${y + 4.5} ${x + 5.5},${y + 4.5}`
      : `${x},${y + 6} ${x - 5.5},${y - 4.5} ${x + 5.5},${y - 4.5}`;
  return (
    <g {...interactionProps}>
      <circle className="score-marker-hit-area" cx={x} cy={y} r="14" fill="transparent" />
      <polygon
        points={points}
        fill={point.delta > 0 ? '#047857' : '#be123c'}
        stroke="#ffffff"
        strokeWidth="1.5"
      />
      <title>{label}</title>
    </g>
  );
}

export default function ScoreTrajectoryChart({
  students = [],
  awards = [],
  semester = null,
  historyLoading = false,
  historyError = null,
}) {
  const now = useRef(Date.now());
  const chartContainerRef = useRef(null);
  const [chartWidth, setChartWidth] = useState(720);
  const [selectedStudentId, setSelectedStudentId] = useState(null);
  const [hoveredPointLabel, setHoveredPointLabel] = useState('');
  const semesterRange = useMemo(() => getSemesterRange(semester), [semester]);
  const semesterStatus = useMemo(
    () => getSemesterTimeStatus(semester, now.current),
    [semester]
  );
  const trajectories = useMemo(
    () =>
      buildScoreTrajectories(students, awards, now.current, {
        startTimestamp: semesterRange?.startTimestamp,
        endTimestamp: semesterRange
          ? semesterRange.endExclusiveTimestamp - 1
          : undefined,
      }),
    [students, awards, semesterRange]
  );
  const seriesColors = useMemo(
    () =>
      new Map(
        trajectories.map((trajectory, index) => [
          trajectory.id,
          colorForSeries(index),
        ])
      ),
    [trajectories]
  );

  useEffect(() => {
    if (
      selectedStudentId &&
      !trajectories.some((trajectory) => trajectory.id === selectedStudentId)
    ) {
      setSelectedStudentId(null);
    }
  }, [selectedStudentId, trajectories]);

  useEffect(() => {
    const element = chartContainerRef.current;
    if (!element) return undefined;

    const updateWidth = () => {
      const nextWidth = Math.max(Math.round(element.getBoundingClientRect().width), 280);
      setChartWidth(nextWidth);
    };
    updateWidth();

    if (typeof ResizeObserver === 'undefined') {
      window.addEventListener('resize', updateWidth);
      return () => window.removeEventListener('resize', updateWidth);
    }

    const observer = new ResizeObserver(updateWidth);
    observer.observe(element);
    return () => observer.disconnect();
  }, [trajectories.length, historyLoading, historyError]);

  if (historyLoading) {
    return (
      <Card title="Scoreverloop – Studenten" className="mt-4">
        <p className="text-sm text-neutral-600">Scorehistorie laden…</p>
      </Card>
    );
  }

  if (historyError) {
    return (
      <Card title="Scoreverloop – Studenten" className="mt-4">
        <p className="text-sm text-rose-700">
          De scorehistorie kon niet worden geladen. Open de Scores-tab opnieuw om het nogmaals te proberen.
        </p>
      </Card>
    );
  }

  if (trajectories.length === 0) {
    return (
      <Card title="Scoreverloop – Studenten" className="mt-4">
        <p className="text-sm text-neutral-600">Nog geen studenten om te tonen.</p>
      </Card>
    );
  }

  const selectedTrajectory = selectedStudentId
    ? trajectories.find((trajectory) => trajectory.id === selectedStudentId)
    : null;
  const visibleTrajectories = selectedTrajectory ? [selectedTrajectory] : trajectories;
  const allPoints = visibleTrajectories.flatMap((trajectory) => trajectory.points);
  const values = allPoints.map((point) => point.value);
  let xMin = semesterRange?.startTimestamp ?? Number.POSITIVE_INFINITY;
  let xMax = semesterRange
    ? semesterRange.endExclusiveTimestamp - 1
    : Number.NEGATIVE_INFINITY;
  if (!semesterRange) {
    allPoints.forEach((point) => {
      xMin = Math.min(xMin, point.timestamp);
      xMax = Math.max(xMax, point.timestamp);
    });
  }
  if (xMin === xMax) {
    xMin -= DAY_IN_MS;
    xMax += DAY_IN_MS;
  }

  const yScale = getYScale(values, !selectedTrajectory);
  const chartHeight = chartWidth < 480 ? 320 : 380;
  const margin = { top: 18, right: 16, bottom: 46, left: 58 };
  const plotWidth = Math.max(chartWidth - margin.left - margin.right, 1);
  const plotHeight = chartHeight - margin.top - margin.bottom;
  const scaleX = (timestamp) =>
    margin.left + ((timestamp - xMin) / (xMax - xMin)) * plotWidth;
  const scaleY = (value) =>
    margin.top + ((yScale.max - value) / (yScale.max - yScale.min)) * plotHeight;
  const dateTicks = buildDateTicks(xMin, xMax, chartWidth < 480 ? 3 : 5);
  const crossesCalendarYear =
    new Date(xMin).getFullYear() !== new Date(xMax).getFullYear();
  const dateSpan = xMax - xMin;
  const formatAxisDate = (timestamp) => {
    if (dateSpan <= DAY_IN_MS * 2) return chartDateTimeFormatter.format(new Date(timestamp));
    if (crossesCalendarYear) return chartDateYearFormatter.format(new Date(timestamp));
    return chartDateFormatter.format(new Date(timestamp));
  };
  const selectedFallbackLabel = selectedTrajectory
    ? describePoint(
        selectedTrajectory,
        selectedTrajectory.points[selectedTrajectory.points.length - 1]
      )
    : '';
  const todayInSemester = Boolean(
    semesterRange &&
      now.current >= semesterRange.startTimestamp &&
      now.current < semesterRange.endExclusiveTimestamp
  );
  const todayX = todayInSemester ? scaleX(now.current) : null;

  return (
    <Card title="Scoreverloop – Studenten" className="mt-4">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
        <p className="text-sm text-neutral-600 m-0">
          {semesterRange
            ? `${semester?.name || 'Semester'} · ${semesterStatus?.label || 'volledige semesterperiode'}`
            : 'Toon alle lijnen samen of licht één student uit.'}
        </p>
        <div className="flex items-center gap-3 text-xs text-neutral-600" aria-label="Betekenis van de markeringen">
          <span><span className="text-emerald-700" aria-hidden="true">▲</span> stijging</span>
          <span><span className="text-rose-700" aria-hidden="true">▼</span> daling</span>
          <span><span className="text-neutral-600" aria-hidden="true">●</span> start/gelijk</span>
        </div>
      </div>

      <div className="mb-4 w-full max-w-sm">
        <label htmlFor="score-chart-student" className="block text-sm font-medium mb-1">
          Student uitlichten
        </label>
        <select
          id="score-chart-student"
          value={selectedStudentId || ''}
          onChange={(event) => {
            setSelectedStudentId(event.target.value || null);
            setHoveredPointLabel('');
          }}
          aria-label="Student uitlichten in de scoregrafiek"
        >
          <option value="">Alle studenten</option>
          {trajectories.map((trajectory) => (
            <option key={trajectory.id} value={trajectory.id}>
              {trajectory.name}
            </option>
          ))}
        </select>
      </div>

      <div ref={chartContainerRef} className="w-full">
        <svg
          width="100%"
          height={chartHeight}
          viewBox={`0 0 ${chartWidth} ${chartHeight}`}
          role="group"
          aria-labelledby="student-score-chart-title student-score-chart-description"
          className="block"
          onMouseLeave={() => setHoveredPointLabel('')}
        >
          <title id="student-score-chart-title">Puntentraject per student</title>
          <desc id="student-score-chart-description">
            Tijd staat op de horizontale as en de cumulatieve totaalscore op de verticale as.
            {semesterRange
              ? ' De tijdas loopt van de start tot en met het einde van het semester.'
              : ''}{' '}
            Opwaartse driehoeken zijn stijgingen en neerwaartse driehoeken zijn dalingen.
          </desc>

          {todayInSemester && todayX < chartWidth - margin.right && (
            <rect
              x={todayX}
              y={margin.top}
              width={Math.max(chartWidth - margin.right - todayX, 0)}
              height={plotHeight}
              fill="#f5f5f5"
              aria-hidden="true"
            />
          )}

          {yScale.ticks.map((tick) => {
            const y = scaleY(tick);
            return (
              <g key={`y-${tick}`}>
                <line
                  x1={margin.left}
                  x2={chartWidth - margin.right}
                  y1={y}
                  y2={y}
                  stroke="#e5e7eb"
                  strokeWidth="1"
                />
                <text
                  x={margin.left - 10}
                  y={y + 4}
                  textAnchor="end"
                  fill="#525252"
                  fontSize="12"
                >
                  {formatPoints(tick)}
                </text>
              </g>
            );
          })}

          {dateTicks.map((tick, index) => {
            const x = scaleX(tick);
            return (
              <g key={`x-${index}`}>
                <line
                  x1={x}
                  x2={x}
                  y1={margin.top}
                  y2={chartHeight - margin.bottom}
                  stroke="#f3f4f6"
                  strokeWidth="1"
                />
                <text
                  x={x}
                  y={chartHeight - margin.bottom + 22}
                  textAnchor={index === 0 ? 'start' : index === dateTicks.length - 1 ? 'end' : 'middle'}
                  fill="#525252"
                  fontSize="12"
                >
                  {formatAxisDate(tick)}
                </text>
              </g>
            );
          })}

          <line
            x1={margin.left}
            x2={chartWidth - margin.right}
            y1={chartHeight - margin.bottom}
            y2={chartHeight - margin.bottom}
            stroke="#737373"
            strokeWidth="1"
          />
          <line
            x1={margin.left}
            x2={margin.left}
            y1={margin.top}
            y2={chartHeight - margin.bottom}
            stroke="#737373"
            strokeWidth="1"
          />
          <text
            x={margin.left + plotWidth / 2}
            y={chartHeight - 6}
            textAnchor="middle"
            fill="#404040"
            fontSize="12"
            fontWeight="600"
          >
            Datum
          </text>
          <text
            transform={`translate(16 ${margin.top + plotHeight / 2}) rotate(-90)`}
            textAnchor="middle"
            fill="#404040"
            fontSize="12"
            fontWeight="600"
          >
            Punten
          </text>

          {visibleTrajectories.map((trajectory) => {
            const color = seriesColors.get(trajectory.id);
            const coordinates = trajectory.points.map((point) => ({
              x: scaleX(point.timestamp),
              y: scaleY(point.value),
            }));
            const path = coordinates.reduce((result, point, index) => {
              if (index === 0) return `M ${point.x} ${point.y}`;
              return `${result} H ${point.x} V ${point.y}`;
            }, '');
            return (
              <g key={trajectory.id}>
                {trajectory.points.length > 1 && (
                  <path
                    d={path}
                    fill="none"
                    stroke={color}
                    strokeWidth={selectedTrajectory ? 3.5 : 2.25}
                    strokeLinejoin="round"
                    strokeLinecap="round"
                  />
                )}
                {trajectory.points.map((point, index) => {
                  const label = describePoint(trajectory, point);
                  return (
                    <ChangeMarker
                      key={`${trajectory.id}-${point.timestamp}-${index}`}
                      point={point}
                      x={scaleX(point.timestamp)}
                      y={scaleY(point.value)}
                      color={color}
                      keyboardInteractive={Boolean(selectedTrajectory)}
                      onHover={{
                        label,
                        show: setHoveredPointLabel,
                        hide: () => setHoveredPointLabel(''),
                      }}
                    />
                  );
                })}
              </g>
            );
          })}

          {todayInSemester && (
            <g aria-label={`Vandaag · ${semesterStatus?.label || ''}`} role="img">
              <line
                x1={todayX}
                x2={todayX}
                y1={margin.top}
                y2={chartHeight - margin.bottom}
                stroke="#7c3aed"
                strokeWidth="2"
                strokeDasharray="5 4"
              />
              <text
                x={Math.min(todayX + 5, chartWidth - margin.right)}
                y={margin.top + 12}
                textAnchor={todayX > chartWidth - margin.right - 70 ? 'end' : 'start'}
                fill="#6d28d9"
                fontSize="12"
                fontWeight="600"
              >
                Vandaag
              </text>
            </g>
          )}
        </svg>
      </div>

      <p className="min-h-5 mt-1 text-sm font-medium text-neutral-800" aria-live="polite">
        {hoveredPointLabel ||
          selectedFallbackLabel ||
          'Beweeg over of tik op een markering. Selecteer één student voor toetsenbordbediening.'}
      </p>
      <p className="mt-2 text-xs text-neutral-500">
        Elke markering is een geregistreerde mutatie. Het startpunt is afgeleid uit de huidige totaalscore en de geregistreerde mutaties, zodat iedere lijn op het actuele totaal eindigt.
        {semesterRange
          ? ' Het lichte vlak na Vandaag laat zien hoeveel tijd er binnen dit semester resteert.'
          : ''}
      </p>

      <section className="mt-6" aria-labelledby="student-score-summary-title">
        <h3 id="student-score-summary-title" className="text-base font-semibold mb-2">
          Samenvatting per student
        </h3>
        <table className="score-summary-table w-full text-sm">
          <thead>
            <tr className="text-left border-b">
              <th className="py-2 pr-2">Student</th>
              <th className="py-2 pr-2">Eerste registratie</th>
              <th className="py-2 pr-2">Hoogste score</th>
              <th className="py-2 pr-2">Sterkste stijging</th>
              <th className="py-2 pr-2">Sterkste daling</th>
            </tr>
          </thead>
          <tbody>
            {(selectedTrajectory ? [selectedTrajectory] : trajectories).map((trajectory) => (
              <tr key={trajectory.id} className="border-b last:border-0 align-top">
                <td className="py-2 pr-2 font-medium" data-label="Student">
                  <span className="inline-flex items-center gap-2">
                    <span
                      className="inline-block h-2.5 w-2.5 rounded-full"
                      style={{ backgroundColor: seriesColors.get(trajectory.id) }}
                      aria-hidden="true"
                    />
                    {trajectory.name}
                  </span>
                </td>
                <td className="py-2 pr-2" data-label="Eerste registratie">
                  {trajectory.firstRecorded
                    ? `${formatSummaryDate(trajectory.firstRecorded.timestamp)} · ${formatPoints(
                        trajectory.firstRecorded.value
                      )} punten`
                    : `Geen historie · ${formatPoints(trajectory.currentPoints)} punten huidig`}
                </td>
                <td className="py-2 pr-2" data-label="Hoogste score">
                  {trajectory.hasHistory
                    ? trajectory.highest.isBaseline
                      ? `${formatPoints(
                          trajectory.highest.value
                        )} punten · vóór eerste registratie (afgeleid startpunt)`
                      : `${formatPoints(trajectory.highest.value)} punten · ${formatSummaryDate(
                          trajectory.highest.timestamp
                        )}`
                    : `${formatPoints(trajectory.currentPoints)} punten · datum onbekend`}
                </td>
                <td className="py-2 pr-2" data-label="Sterkste stijging">
                  {formatChange(trajectory.steepestIncrease, 'Geen stijging')}
                </td>
                <td className="py-2 pr-2" data-label="Sterkste daling">
                  {formatChange(trajectory.steepestDecrease, 'Geen daling')}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </Card>
  );
}
