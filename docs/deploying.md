# Deploying NeuroSpark

## The problem this replaces

For several weeks `neurospark.co` served a build older than every fix in the
repository. Nothing in the code showed it. CI was green on the parts it
covered, `main` was correct, and the site was stale — because publishing was
a button in a hosting UI that somebody had to remember to press.

That failure mode is invisible by construction, so the fix is structural:
**a push to `main` publishes the site**, and the artifact is inspected
before it goes out.

## How it works now

`.github/workflows/deploy.yml` runs on every push to `main`:

1. Installs dependencies and a Chromium (the prerender step drives a real
   browser — without it the marketing pages ship as an empty shell to the
   AI-search crawlers they exist for).
2. `bun run build` — Vite build, then `scripts/postbuild-seo.mjs`
   prerenders the public routes and writes `sitemap.xml`.
3. Copies `index.html` to `404.html`. GitHub Pages serves a static tree, so
   client-side routes with no file on disk (`/today`, `/auth`,
   `/exercise/*`) would 404 without this.
4. Writes `dist/CNAME` so Pages serves at the domain root, which is what
   lets every asset path stay root-relative.
5. **`node scripts/verify-dist.mjs`** — refuses to publish a build that lost
   its brand, lost the downloadable practice pack, or baked a `127.0.0.1`
   origin into a canonical. Missing prerenders or sitemap warn but still
   ship; those degrade discovery, they don't break the app.
6. Enables Pages if it isn't already, uploads, deploys.

## The one manual step: DNS

The workflow publishes to GitHub Pages. The domain has to point there before
`neurospark.co` shows the new build. Until that happens the deploy still
runs and still verifies — the domain simply keeps serving whatever it served
before, so this is safe to have merged ahead of the switch.

At the DNS provider (the domain is behind Cloudflare today):

| Record | Name | Value |
| --- | --- | --- |
| CNAME | `@` (apex, uses CNAME flattening) | `rnocek14.github.io` |
| CNAME | `www` | `rnocek14.github.io` |

Set the records to **DNS-only** (grey cloud, not proxied) until GitHub has
issued the TLS certificate — the proxy can interfere with issuance. Turn the
proxy back on afterwards if you want Cloudflare in front.

Then in **Settings → Pages**, confirm the custom domain reads
`neurospark.co` and tick **Enforce HTTPS** once the certificate is issued.

> The exact records GitHub wants are shown on that settings page. If they
> disagree with the table above, believe the settings page.

## Verifying a deploy actually landed

```
node scripts/verify-live.mjs                      # checks https://neurospark.co
node scripts/verify-live.mjs https://example.com  # or any origin
```

It fetches the live origin and checks the things that are only true of a
current build: the shell title carries the brand, `manifest.json`,
`sitemap.xml` and the practice-pack PDF are served, each marketing route
renders its own page instead of falling through to the app shell, and
`robots.txt` is the version that allows the AI-search crawlers. Non-zero
exit on any failure, so it can gate a release.

Run it after every deploy. "The deploy succeeded" and "the site changed" are
different claims.

## If you stay on the previous host instead

Publishing there is a button in that project's UI (`Share → Publish`). It
works, and it is one click — but it is exactly the step that silently went
un-pressed for weeks, and nothing in this repository can see whether it
happened. `scripts/verify-live.mjs` is the check either way.
