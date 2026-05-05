/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 */

import React from 'react';
import type { HealthSummary, HealthStatus } from '../types';

// ── Status config ─────────────────────────────────────────────────────────────
// Three levels: green / blue / red — colorblind-safe (no red/green adjacency
// in a two-adjacent sense; blue is the middle tier).
// Each level has a symbol + text label so color is never the sole indicator.

interface StatusConfig {
  label: string;
  symbol: string;
  color: string;
  bgColor: string;
}

const STATUS_CONFIG: Record<HealthStatus, StatusConfig> = {
  Good: {
    label: 'Good',
    symbol: '✓', // ✓
    color: 'var(--ca-status-green, #3A874F)',
    bgColor: 'var(--ca-status-green-bg, #EAF5EC)',
  },
  'At-Risk': {
    label: 'At Risk',
    symbol: '⚠', // ⚠
    color: 'var(--ca-status-blue, #0076c0)',
    bgColor: 'var(--ca-status-blue-bg, #E3F1FB)',
  },
  Critical: {
    label: 'Critical',
    symbol: '✕', // ✕
    color: 'var(--ca-status-red, #C0444B)',
    bgColor: 'var(--ca-status-red-bg, #FCECEA)',
  },
};

interface HealthBadgeProps {
  health: HealthSummary;
}

export function HealthBadge({ health }: HealthBadgeProps) {
  const cfg = STATUS_CONFIG[health.status];

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: 'var(--ca-space-2)',
        padding: 'var(--ca-space-3)',
        backgroundColor: 'var(--ca-surface-raised)',
        border: '1px solid var(--ca-border-default)',
        borderRadius: 'var(--ca-radius-md)',
      }}
    >
      {/* Status badge */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--ca-space-2)' }}>
        <span
          aria-hidden="true"
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 32,
            height: 32,
            borderRadius: '50%',
            backgroundColor: cfg.bgColor,
            color: cfg.color,
            fontSize: 18,
            fontWeight: 700,
            flexShrink: 0,
          }}
        >
          {cfg.symbol}
        </span>
        <span
          style={{
            fontSize: 'var(--ca-font-size-lg)',
            fontWeight: 700,
            color: cfg.color,
          }}
          aria-label={`Status: ${cfg.label}`}
        >
          {cfg.label}
        </span>
      </div>

      {/* Message */}
      <p
        style={{
          margin: 0,
          fontSize: 'var(--ca-font-size-sm)',
          color: 'var(--ca-text-secondary)',
        }}
      >
        {health.message}
      </p>

      {/* Acceptance progress bar */}
      <AcceptanceBar health={health} />

      {/* Summary stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          gap: 'var(--ca-space-1)',
          fontSize: 'var(--ca-font-size-xs)',
          color: 'var(--ca-text-secondary)',
          textAlign: 'center',
        }}
      >
        <Stat label="Accepted" value={`${health.acceptedPct}%`} />
        <Stat label="Points" value={`${health.acceptedPoints} / ${health.totalPoints}`} />
        <Stat label="Days Remaining" value={String(health.daysRemaining)} />
      </div>
    </div>
  );
}

// ── Acceptance progress bar ───────────────────────────────────────────────────

function AcceptanceBar({ health }: { health: HealthSummary }) {
  const { acceptedPct, elapsedPct } = health;

  return (
    <div>
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          fontSize: 'var(--ca-font-size-xs)',
          color: 'var(--ca-text-secondary)',
          marginBottom: 4,
        }}
      >
        <span>Accepted: {acceptedPct}%</span>
        <span>Elapsed: {elapsedPct}%</span>
      </div>

      {/* Track */}
      <div
        role="progressbar"
        aria-valuenow={acceptedPct}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${acceptedPct}% accepted`}
        style={{
          position: 'relative',
          height: 12,
          backgroundColor: 'var(--ca-border-default)',
          borderRadius: 6,
          overflow: 'visible',
        }}
      >
        {/* Accepted fill */}
        <div
          style={{
            position: 'absolute',
            left: 0,
            top: 0,
            height: '100%',
            width: `${acceptedPct}%`,
            backgroundColor: 'var(--ca-status-green, #3A874F)',
            borderRadius: 6,
            transition: 'width 0.3s ease',
          }}
        />

        {/* Elapsed-time marker (vertical line) */}
        <div
          aria-label={`${elapsedPct}% time elapsed`}
          title={`${elapsedPct}% of timebox elapsed`}
          style={{
            position: 'absolute',
            left: `${Math.min(elapsedPct, 100)}%`,
            top: -3,
            height: 18,
            width: 2,
            backgroundColor: 'var(--ca-status-blue, #0076c0)',
            borderRadius: 1,
            transform: 'translateX(-50%)',
          }}
        />
      </div>

      <div
        style={{
          fontSize: 'var(--ca-font-size-xs)',
          color: 'var(--ca-text-disabled)',
          marginTop: 2,
          textAlign: 'right',
        }}
      >
        <span style={{ color: 'var(--ca-status-blue, #0076c0)' }}>|</span> = time elapsed
      </div>
    </div>
  );
}

// ── Small stat cell ───────────────────────────────────────────────────────────

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div style={{ fontWeight: 600, color: 'var(--ca-text-primary)' }}>{value}</div>
      <div>{label}</div>
    </div>
  );
}
