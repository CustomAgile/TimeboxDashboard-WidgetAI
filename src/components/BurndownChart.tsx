/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

import React from 'react';
import { RallyChart } from '@customagile/widget-ai/components/RallyChart';
import type { ChartData, ChartOptions } from 'chart.js';
import type { BurndownData } from '../types';

interface BurndownChartProps {
  burndown: BurndownData;
  height?: number;
}

/**
 * Day-by-day burndown vs ideal line chart.
 *
 * x-axis: type:'category' with pre-formatted MM/DD date labels.
 * This avoids the chart.js time-axis date-adapter requirement entirely
 * (same approach as cycle-time-chart's linear tick callback).
 *
 * Two datasets:
 *   - Actual remaining (line, blue) — null points skipped
 *   - Ideal remaining  (line, dashed gray)
 */
export function BurndownChart({ burndown, height = 280 }: BurndownChartProps) {
  const { points, initialScope } = burndown;

  // Build category labels (MM/DD)
  const labels = points.map((p) => {
    const d = new Date(p.date + 'T00:00:00Z');
    return `${(d.getUTCMonth() + 1).toString().padStart(2, '0')}/${d.getUTCDate().toString().padStart(2, '0')}`;
  });

  const actualData = points.map((p) => p.remaining);
  const idealData = points.map((p) => p.ideal);

  const chartData: ChartData = {
    labels,
    datasets: [
      {
        label: 'Actual Remaining',
        data: actualData,
        borderColor: '#0076c0',
        backgroundColor: '#0076c033',
        borderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 6,
        tension: 0.1,
        spanGaps: false, // null points leave gaps — correct behavior
      },
      {
        label: 'Ideal',
        data: idealData,
        borderColor: '#888888',
        backgroundColor: 'transparent',
        borderWidth: 2,
        borderDash: [6, 3],
        pointRadius: 2,
        pointHoverRadius: 4,
        tension: 0,
        spanGaps: true,
      },
    ],
  };

  const chartOptions: ChartOptions = {
    responsive: true,
    maintainAspectRatio: true,
    aspectRatio: 4,
    plugins: {
      legend: {
        display: true,
        position: 'bottom' as const,
        labels: {
          font: { size: 11 },
          color: 'var(--ca-text-primary, #333)',
          boxWidth: 20,
          padding: 8,
        },
      },
      tooltip: {
        mode: 'index' as const,
        intersect: false,
        callbacks: {
          label: (ctx) => {
            const v = ctx.parsed.y;
            if (v === null) return '';
            return ` ${ctx.dataset.label}: ${v} pts`;
          },
        },
      },
    },
    scales: {
      x: {
        type: 'category' as const,
        title: {
          display: true,
          text: 'Date',
          font: { size: 11 },
          color: 'var(--ca-text-secondary, #666)',
        },
        ticks: {
          maxRotation: 45,
          font: { size: 10 },
          color: 'var(--ca-text-secondary, #666)',
          // Show fewer ticks on crowded x-axis
          maxTicksLimit: 12,
        },
        grid: {
          color: 'var(--ca-border-default, #DDE3ED)',
        },
      },
      y: {
        type: 'linear' as const,
        min: 0,
        suggestedMax: Math.ceil(initialScope * 1.05),
        title: {
          display: true,
          text: 'Points Remaining',
          font: { size: 11 },
          color: 'var(--ca-text-secondary, #666)',
        },
        ticks: {
          font: { size: 10 },
          color: 'var(--ca-text-secondary, #666)',
          precision: 0,
        },
        grid: {
          color: 'var(--ca-border-default, #DDE3ED)',
        },
      },
    },
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--ca-space-1)' }}>
      <div
        style={{
          fontSize: 'var(--ca-font-size-sm)',
          fontWeight: 600,
          color: 'var(--ca-text-primary)',
          paddingLeft: 'var(--ca-space-1)',
        }}
      >
        Burndown
        <span
          style={{
            marginLeft: 'var(--ca-space-1)',
            fontSize: 'var(--ca-font-size-xs)',
            color: 'var(--ca-text-secondary)',
            fontWeight: 400,
          }}
        >
          (initial scope: {initialScope} pts)
        </span>
      </div>

      <div style={{ height, position: 'relative', overflow: 'hidden' }}>
        <RallyChart
          type="line"
          data={chartData}
          options={chartOptions}
          height={height}
          emptyMessage="No burndown data available for this timebox."
        />
      </div>
    </div>
  );
}
