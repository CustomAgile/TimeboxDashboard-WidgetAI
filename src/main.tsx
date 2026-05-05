/**
 * Copyright (c) 2026 Custom Agile LLC. All rights reserved.
 *
 * Timebox Dashboard — entry point.
 *
 * __USE_MOCK__ is set at compile time by Vite define:
 *   npm run build       → false (live Rally data)
 *   npm run build:mock  → true  (mock data baked in)
 *   npm run dev         → unset → defaults to true (mock mode in dev server)
 */

import '@customagile/widget-ai/styles/rally-app-tokens.css';
import { createRoot } from 'react-dom/client';
import React from 'react';
import { DEFAULT_RALLY_CONTEXT } from '@customagile/widget-ai/types/rally-context';
import type { RallyContext } from '@customagile/widget-ai/types/rally-context';
import App from './App';
import { mockProvider, mockContext } from './mock-data';
import { createRallyProvider } from './data-provider';

declare const __USE_MOCK__: boolean | undefined;
declare const $RallyContext: RallyContext | undefined;

// Build-time flag wins; fall back to mock for dev server (safe default)
const useMock: boolean = typeof __USE_MOCK__ !== 'undefined' ? __USE_MOCK__ : true;

const rallyContext: RallyContext =
  !useMock && typeof $RallyContext !== 'undefined'
    ? $RallyContext
    : useMock
      ? mockContext
      : {
          ...DEFAULT_RALLY_CONTEXT,
          Url: { origin: window.location.origin, href: window.location.href },
          WidgetName: 'Timebox Dashboard',
          WidgetUUID: 'dev-uuid',
        };

const data = useMock ? mockProvider : createRallyProvider(rallyContext);

createRoot(document.getElementById('root')!).render(
  <App rallyContext={rallyContext} data={data} isMock={useMock} />,
);
