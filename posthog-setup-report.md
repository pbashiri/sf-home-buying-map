<wizard-report>
# PostHog post-wizard report

The wizard has completed a deep integration of PostHog analytics into Theami (theami.ai). PostHog is initialized client-side via `instrumentation-client.ts` (the recommended approach for Next.js 15.3+), with a reverse proxy through `/ingest` configured in `next.config.ts` to reduce ad-blocker interference. A shared server-side PostHog client (`src/lib/posthog-server.ts`) is used in API routes for server-side event tracking. Environment variables are stored in `.env.local`.

| Event | Description | File |
|---|---|---|
| `address_selected` | User selects an address from search suggestions — the core conversion action | `src/components/search/address-search.tsx` |
| `address_cleared` | User clears the current address and returns to the home/search state | `src/app/home-client.tsx` |
| `horizon_changed` | User changes the time horizon (5y/7y/10y/15y) for concern analysis | `src/components/panel/horizon-selector.tsx` |
| `layer_toggled` | User toggles a map layer on or off (e.g. flood, BART, schools) | `src/components/map/layer-toggles.tsx` |
| `share_clicked` | User clicks the share permalink button to copy the current URL | `src/app/home-client.tsx` |
| `address_saved_to_compare` | User saves an address to the compare list | `src/app/home-client.tsx` |
| `address_removed_from_compare` | User removes an address from the compare list | `src/app/home-client.tsx` |
| `compare_viewed` | User navigates to the compare page — top of the comparison funnel | `src/app/compare/compare-client.tsx` |
| `compare_cleared` | User clears all saved addresses from the compare list | `src/components/compare/compare-toast.tsx` |
| `concern_source_clicked` | User clicks the external source link on a concern card | `src/components/panel/panel.tsx` |
| `address_geocoded` | Server-side: address geocoded successfully (cache MISS only) | `src/app/api/geocode/route.ts` |
| `concerns_fetched` | Server-side: concerns fetched, includes severity counts and cache status | `src/app/api/concerns/route.ts` |

## Next steps

We've built some insights and a dashboard for you to keep an eye on user behavior, based on the events we just instrumented:

- **Dashboard — Analytics basics**: https://us.posthog.com/project/397931/dashboard/1511449
- **Address searches over time** (line chart, 30d): https://us.posthog.com/project/397931/insights/B6ebREwC
- **Compare funnel: Save → Compare viewed** (funnel): https://us.posthog.com/project/397931/insights/A4IqvJDH
- **Most toggled map layers** (bar chart by layer): https://us.posthog.com/project/397931/insights/mZ1CPh5r
- **Share & engagement actions** (line chart): https://us.posthog.com/project/397931/insights/BKEYAGyS
- **Address churn: Cleared vs Saved** (bar chart): https://us.posthog.com/project/397931/insights/fBd4KvdF

### Agent skill

We've left an agent skill folder in your project. You can use this context for further agent development when using Claude Code. This will help ensure the model provides the most up-to-date approaches for integrating PostHog.

</wizard-report>
