
## Redeploy `wisely-ai` edge function

The file `supabase/functions/wisely-ai/index.ts` is up to date in the repo (731 lines, latest commits applied), but the deployed edge function is stale ("Last updated 3 days ago"). The fix is a single action: trigger a fresh deploy of `wisely-ai` so the runtime picks up the current `main` branch source.

### Plan
1. Switch to default mode and call `supabase--deploy_edge_functions` with `["wisely-ai"]`.
2. Verify the deploy succeeded by checking `supabase--edge_function_logs` for a fresh boot entry.
3. (Optional sanity check) Run a small `supabase--curl_edge_functions` POST to `/wisely-ai` with a trivial chat payload to confirm the new code responds without errors.

No code changes, no migrations, no config edits. Just a redeploy + verification.
