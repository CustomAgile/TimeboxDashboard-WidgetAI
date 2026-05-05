/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

import React from 'react';
import { RallyChart } from '@customagile/widget-ai/components/RallyChart';
import type { ChartData, ChartOptions } from 'chart.js';
import type { ChartSegment } from '../types';

interface DonutChartProps {
  title: string;
  segments: ChartSegment[];
  total: number;
  height?: number;
  emptyMessage?: string;
}

/**
 * Reusable doughnut chart for Schedule State, Defect State, and Test Case
 * Last Verdict charts. Colors come from the segment data (pre-assigned in
 * the data provider / mock) so the chart is purely presentational.
 *
 * x-axis note: doughnut charts have no time axis — no date adapter needed.
 */
export function DonutChart({
  title,
  segments,
  total,
  height = 160,
  emptyMessage = 'No data found.',
}: DonutChartProps) {
  const chartData: ChartData = {
    labels: segments.map((s) => `${s.label} (${s.count})`),
    datasets: [
      {
        data: segments.map((s) => s.count),
        backgroundColor: segments.map((s) => s.color),
        borderColor: segments.map((s) => s.color),
        borderWidth: 1,
        hoverOffset: 4,
      },
    ],
  };

  const chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 1.6,
    plugins: {
      title: {
        display: false, // title shown outside the chart in the grid header
      },
      legend: {
        display: true,
        position: 'right' as const,
        labels: {
          font: { size: 11 },
          color: 'var(--ca-text-primary, #333)',
          boxWidth: 12,
          padding: 6,
          // Truncate long labels in the legend
          generateLabels: (chart) => {
            const data = chart.data;
            return (data.labels as string[]).map((label, i) => ({
              text: label.length > 20 ? label.slice(0, 18) + '…' : label,
              fillStyle: (data.datasets[0].backgroundColor as string[])[i],
              strokeStyle: (data.datasets[0].borderColor as string[])[i],
              lineWidth: 1,
              index: i,
              hidden: false,
            }));
          },
        },
      },
      tooltip: {
        callbacks: {
          label: (ctx) => {
            const count = ctx.parsed;
            const pct = total > 0 ? Math.round((count / total) * 100) : 0;
            return ` ${count} (${pct}%)`;
          },
        },
      },
    },
  };

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ca-space-1)',
      }}
    >
      <div
        style={{
          fontSize: 'var(--ca-font-size-sm)',
          fontWeight: 600,
          color: 'var(--ca-text-primary)',
          paddingLeft: 'var(--ca-space-1)',
        }}
      >
        {title}
        <span
          style={{
            marginLeft: 'var(--ca-space-1)',
            fontSize: 'var(--ca-font-size-xs)',
            color: 'var(--ca-text-secondary)',
            fontWeight: 400,
          }}
        >
          ({total} total)
        </span>
      </div>

      <div style={{ height, width: '100%', position: 'relative', overflow: 'hidden' }}>
        <RallyChart
          type="doughnut"
          data={chartData}
          options={chartOptions}
          height={height}
          emptyMessage={emptyMessage}
        />
      </div>
    </div>
  );
}
