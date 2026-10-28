# Read-only infrastructure report (no changes made)

## Directly observed
1. **Linked backend is an external Supabase project, ref `wjedbpjaiqdxhmjzkcxo`.** Lovable's project metadata says "external Supabase connected by the user", service-role key not stored. `supabase/config.toml` has `project_id = "wjedbpjaiqdxhmjzkcxo"`, and the only Supabase URL host in `.env` is the same ref. This is why `query_database` returns `database_not_managed`: that endpoint only works for Lovable-managed (Cloud) databases.
2. **No dedicated non-production speech-test backend found.** There's one `supabase/config.toml` with one ref. `.env` has no second URL. `.github/workflows/ci.yml` and `deploy.yml` trigger only on `main` and name no staging or preview project. No Supabase branch config shows in the repo. I didn't check Supabase dashboard branching or other Lovable drafts; those can't be inspected from here.
3. **Azure Speech config names are present (values not read):** project secrets include `AZURE_SPEECH_KEY`, `AZURE_SPEECH_REGION` and `LOG_AZURE_PA_SAMPLE`. Code that reads them: `analyze-pronunciation`, `analyze-speech` and `pipeline-ops`. These secrets belong to the single production backend.

## Not checked (unavailable)
- Supabase org membership, MCP token scopes, and whether Supabase Branching is turned on (no dashboard or management API access).
- Whether the Azure secret values are valid, or which region they point to.

## Recommendations (owner actions)
- **Management access:** the owner of org `wrnaphbitylwehsrdeho` adds the operator to the Supabase org, or issues an MCP or personal access token scoped to project `wjedbpjaiqdxhmjzkcxo`. Re-adding Lovable won't fix this, because the database is external.
- **Safe test backend (preferred):** create a separate Supabase project, or turn on Supabase Branching for a preview branch. Apply the migrations there, set separate `AZURE_SPEECH_*` secrets (ideally a separate Azure resource with a low quota), and point PR #76's live checks at it. Don't run the four live Azure checks against production.
- Separately, rotate the presentation-admin password, which is still exposed in chat.
