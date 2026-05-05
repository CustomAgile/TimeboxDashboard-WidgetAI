# Timebox Dashboard — Setup Guide

End-to-end setup: get the widget running locally, connect it to Rally, and deploy it as a Custom View.

---

## Prerequisites

- Node.js 18+ and npm
- A Rally workspace and project you can access
- A Rally API key (instructions below)

---

## 1. Generate a Rally API key

1. Sign in to Rally.
2. Open the API key page: **https://rally1.rallydev.com/#/api_key** (or click your avatar → API Keys).
3. Click **Create**, give the key a name (e.g. `widget-dev`), pick the workspaces it can access, and copy the full key. It starts with `_` and is ~43 chars long.
4. Treat it like a password — don't paste it into anything that gets committed.

---

## 2. Configure credentials (pick one)

The Vite dev server proxies `/slm/*` (WSAPI) and `/analytics/*` (Lookback API) to Rally. It needs a server URL and API key.

### Option A — `auth.json` (recommended, gitignored)

Create `auth.json` in the `timebox-dashboard/` folder:

```json
{
  "server": "https://rally1.rallydev.com",
  "apiKey": "_your_api_key_here"
}
```

`auth.json` is gitignored by default — your key never gets committed.

### Option B — Environment variables

```bash
export RALLY_SERVER=https://rally1.rallydev.com
export RALLY_API_KEY=_your_api_key_here
```

Or create a `.env.local` file (also gitignored):

```dotenv
RALLY_SERVER=https://rally1.rallydev.com
RALLY_API_KEY=_your_api_key_here
```

Restart `npm run dev` after changing either source.

---

## 3. Run the dev server

```bash
cd examples/timebox-dashboard
npm install
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

By default the widget runs in **mock mode** — no Rally connection needed. You see a realistic mid-iteration health scenario (60% accepted, At-Risk status, all four charts populated).

To use live Rally data, visit [http://localhost:5173?live=true](http://localhost:5173?live=true). The widget fetches the current iteration from the Rally project context and loads real data.

---

## 4. Understanding the charts

### Health badge and acceptance bar

The status badge classifies the iteration as:
- **Good** (✓ green) — accepted work is on pace with elapsed time
- **At Risk** (⚠ blue) — acceptance is lagging, or open defects exist
- **Critical** (✕ red) — acceptance is significantly behind

The progress bar shows % accepted (filled) against % elapsed (vertical blue marker). These two metrics together tell you whether the team is keeping up.

### Schedule State chart

Counts all work items (stories, defects, defect suites) in the timebox by their Schedule State: Defined, In-Progress, Completed, Accepted.

### Defect State chart

Counts defects in Submitted / Open / Fixed / Closed states. Includes both:
1. Defects directly scheduled in the timebox (Iteration or Release field set)
2. Defects linked to stories scheduled in the timebox (per Broadcom spec)

### Test Case Last Verdict chart

Counts test cases associated with timebox stories by their LastVerdict field: Pass, Fail, Error, Blocked, Inconclusive.

### Burndown chart

Plots remaining plan estimate per day (blue line) against an ideal burndown trend (gray dashed line). Data comes from the Rally Lookback API. Future days show null actuals (gap in the line). If Lookback is unavailable, the chart renders the ideal line only.

---

## 5. Settings (Edit Mode)

In Rally, click **Edit** on the Custom View to open Settings:

| Setting | Description |
|---------|-------------|
| **Timebox Type** | Iteration (default) or Release |
| **Hide Defect Charts** | Suppress the Defect State chart |
| **Hide Test Case Charts** | Suppress the Test Case Last Verdict chart |

---

## 6. Deploy to Rally

### Build

```bash
npm run build         # live Rally data
npm run build:mock    # mock data baked in (no Rally dependency at runtime)
```

Both commands output `dist/app.js`.

### Create the Custom View

1. In Rally, open a Custom Page or any page that supports Custom Views.
2. Add a **Custom HTML** widget.
3. Paste the contents of `dist/app.js` into the widget's HTML editor.
4. Save. The widget loads immediately.

### Set up the View Filter

The Timebox Dashboard reads the iteration or release from Rally's **View Filter**. For the widget to show data:
- Set a View Filter to the Iteration or Release you want to track.
- The widget automatically picks up the selected timebox.

If no timebox is selected, the widget shows a "no iteration found" message.

---

## 7. Troubleshooting

**Widget shows "Loading dashboard…" indefinitely**
- Check the browser console for network errors.
- Verify your `auth.json` has the correct server URL and API key.
- Confirm the Rally API key has access to the workspace.

**Burndown chart is empty / shows only ideal line**
- The Lookback API may not be enabled for your subscription.
- Check the browser console for "Lookback HTTP" errors.

**Status shows "No Iteration Selected"**
- Set a View Filter in Rally (Iteration or Release context).
- In dev mode, the mock context always has an iteration set, so this only appears in live mode without a view filter.

**Typecheck failures**
```bash
cd examples/timebox-dashboard
npx tsc --noEmit
```

If you see errors about missing `@customagile/widget-ai` types, run `npm install` first.
