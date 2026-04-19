

## Redeploy `naval-ingest` edge function with YouTube support

The function at `supabase/functions/naval-ingest/index.ts` has been updated in the repo (commit 23075a2) with YouTube transcript support and source_type detection, but the deployed version needs to be refreshed.

### What will be done
1. Deploy the updated `naval-ingest` edge function using `supabase--deploy_edge_functions`.
2. Verify deployment succeeded by checking edge function logs for a fresh boot entry.
3. Test the YouTube transcript feature with a sample YouTube URL to confirm it works.

### Deployment command
```
supabase--deploy_edge_functions with function_names: ["naval-ingest"]
```

### Verification steps
- Check `supabase--edge_function_logs` for `naval-ingest` to confirm successful boot with new version.
- Run `supabase--curl_edge_functions` POST to `/naval-ingest` with a YouTube URL test payload to verify transcript extraction works.

