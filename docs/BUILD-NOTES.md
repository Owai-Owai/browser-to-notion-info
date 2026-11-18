# Build validation

## GitHub and optional analytics — 18 November 2026

- Preserved the existing GitHub Pages history and pushed the working 0.1.2 application source to `main` in `Owai-Owai/browser-to-notion-info` (commit `3aa74ca`). Optional analytics is prepared separately on `codex/github-analytics`. Private environment files, build output, local screenshots, and research image downloads are excluded. The source scanner checks known local credential values and token patterns before commits.
- Prepared 0.1.3 with default-off opt-in controls, a finite content-free event schema, a bounded retry queue, and authenticated Supabase forwarding. A service-only migration caps analytics traffic per connection. Analytics does not block bookmark saving.
- Fixed disconnect clearing optional connection/destination fields as part of the new consent-reset check.
- PostHog project creation and live analytics remain pending: the connected organization permits one project and already has one. No existing project was changed. See [ANALYTICS.md](ANALYTICS.md) for activation and proposed metric definitions.
- The owner confirmed the previous 0.1.2 package and listing are saved in the unpublished store draft. Version 0.1.3 requires a new package and updated privacy disclosures before release.
- Validation: 68 logic/HTTP/PostgreSQL tests passed. Eight browser scenarios passed in the full run; the remaining scenario passed after correcting its stale plural-folder assertion. The installed public package passed default-off, opt-in, opt-out and content-free-payload checks with intercepted service requests. Type checking, lint, public/service/Supabase builds, Deno check, and the 125-file source scan passed. No live PostHog ingestion or dashboard verification has occurred. The hosted service and published privacy page were not changed for analytics; the revised root privacy file is part of the analytics draft.

## Final listing preparation — 18 November 2026

- The owner confirmed version 0.1.1 was accepted in the existing draft and that a new bookmark saved using ID `aneibajfligcbdfodclcfelpgcenmojk`. The last saved-operation timestamp was later than the store-ID function deployment, independently corroborating the hosted test without reading bookmark details or tokens.
- The owner reported passing pause/resume, excluded-folder behavior, browser restart, reconnect, optional import from a small test folder, and disconnect/connecting again. Previously saved Notion entries remained after disconnect.
- Version 0.1.2 corrects singular folder labels in setup, Settings, and the popup. Its 128px icon has 16px transparent padding around 96px artwork, checked from pixel alpha bounds. Smaller toolbar icons retain their size.
- Type checking, lint, the public build, isolated installed-package check, live public verification, and store ZIP verification passed for 0.1.2. The store ID is unchanged and the ZIP omits the development-only `key` field.
- Captured three 1280x800 listing images through the browser using a development-only fixture with real UI components and fictional data. Checked every image's dimensions. Viewport overrides were reset and the temporary server/tabs closed. Assets are in `release/store-assets`.

Remaining owner actions are uploading `release/browser-to-notion-public-0.1.2.zip` to the existing draft, filling listing/disclosure fields using the prepared copy/images, and reviewing/submitting the final draft. No store submission or publication has been performed.

## Store-assigned identity — 18 November 2026

- The owner supplied the draft's public key and ID `aneibajfligcbdfodclcfelpgcenmojk`. RSA/SPKI parsing and SHA-256 ID derivation confirmed they match.
- Version 0.1.1 uses the store key for public builds. Added `localKey` for local builds/setup so the existing pilot retains `gfedamiejepepigapmomljgcpjoioiak`; the local environment and installed `dist` files were not changed.
- Rebuilt the public extension and built local mode into a separate release-check directory. Verified the public/store ID and version, plus the local ID and service scope. Type checking and lint passed.
- Updated only the hosted `ALLOWED_EXTENSION_ID` setting, then redeployed only `notion-sync`. Live public verification passed with the new identity and published privacy URL.
- The isolated installed-browser package check passed with the new build. Its service calls remain intercepted; a real Notion save under the new ID still requires owner verification.
- Created and verified `release/browser-to-notion-public-0.1.1.zip`. Packaging now rejects a stale version or public key. The ZIP omits `key`; the unpacked manifest retains the store key for identity matching.

The owner subsequently confirmed the draft update, new-ID live save, and remaining behavior checks. Current release status is recorded in the final listing preparation section above.

## Web Store upload packaging — 18 November 2026

- Corrected the upload ZIP after the developer console rejected the manifest's development-only `key` field.
- Added `npm run package:store` to verify the public build and create the store archive with `key` omitted. The unpacked manifest retains its current identity.
- Verified all 13 archived files and their contents, then independently opened the ZIP with .NET to check the root manifest, missing `key` field, and required assets. Targeted ESLint passed.
- The corrected 0.1.0 package was accepted as a draft; the owner supplied its assigned public key/ID. The replacement package is now 0.1.1, as recorded above.

## Hosted Supabase deployment — 18 November 2026

- Linked project `vgmltpmcqulxrbjnsflj` after the owner completed CLI sign-in.
- The migration dry run identified only `202611180001_bookmark_service.sql`; that migration was then applied successfully.
- Installed the hourly cleanup job. Read-only live checks confirmed row security on all five private tables, denied anonymous/signed-in schema/table/RPC access, allowed service-role RPC access, and an active `bns-hourly-cleanup` schedule of `13 * * * *`.
- Uploaded the eight publisher configuration values from the ignored environment file without printing credentials, then deployed only `notion-sync` through API deployment.
- Live `/healthz` returned `ok: true`, `mode: hosted`, `provider: supabase`, the current extension ID `gfedamiejepepigapmomljgcpjoioiak`, and the published GitHub Pages privacy URL.
- Deno checking, the self-contained function build, the real-address public extension build, and live public package/secret/privacy verification passed.
- The installed public-package browser check passed after waiting for the extension's asynchronous initial state write before seeding isolated test data. It captured a real Chrome bookmark and verified prefixed API routing. Its service calls were intercepted; this does not establish a real Notion save.

- The owner confirmed a new bookmark appeared in Notion using `dist-public` in a separate profile. A read-only Supabase metadata check independently confirmed one connected installation and one saved operation. No bookmark titles/URLs or credentials were read for this check.

The remaining hosted behavior checks, store submission, and final store-assigned identity checks remain unfinished. The existing local pilot and its working Notion library were preserved.

## Supabase migration — 18 November 2026

- All 60 logic/HTTP tests passed with Vitest 5.1.1. Thirteen Supabase cases execute the actual SQL migration/RPC in PostgreSQL through PGlite, including role restrictions, OAuth replay protection, isolated sessions, encrypted credential portability, durable refresh, recovery, and concurrent saves across installations.
- All nine existing browser checks passed after extracting shared Notion mapping/payload rules and updating the public client configuration.
- Type checking, ESLint, Deno checking, the local extension build, Node service build, and self-contained Supabase function build passed. The function bundle is about 223 KB.
- A public build with a test Supabase URL passed package/secret verification. An isolated installed-browser check captured a real Chrome bookmark and verified complete `/functions/v1/notion-sync` API routing, service-session headers, a separate privacy URL, and absence of sample mode. Backend calls were intercepted; no live Notion requests were made.
- Production dependency audit: zero reported vulnerabilities. Critical development-tool findings were addressed by updating the test runner. Eleven high-severity findings remain in development glob/tooling dependencies; they are not part of the extension or Supabase runtime bundles.
- Supabase CLI 3.2.0 commands were checked, including explicit `db push --remote` syntax. CLI configuration reached the local container check, which could not run because Docker/Podman is unavailable. Hosted deployment uses `--use-api` and does not require that local stack.

The hosted deployment steps are now complete as recorded above. See [SUPABASE-SETUP.md](SUPABASE-SETUP.md) for the operational commands and remaining live Notion checks. The protected publisher files preserve the pilot's credentials and working Notion library separately.

## Public deployment preparation — 18 November 2026

- 46 logic and HTTP-boundary tests passed, including independent installations in the same workspace, reconnect recovery, callback/ticket replay protection, and per-client authorization limits.
- All nine browser checks passed across the full run and the targeted rerun after fixing Help navigation. They cover the installed extension, both setup paths, retained drafts, keyboard access, privacy accessibility, the local service, and the compiled hosted service.
- Type checking, lint, local extension build, and service bundle build passed.
- A public-mode build using a test HTTPS address passed package verification: single HTTPS host permission, no source maps, no development guide, no sample-data behavior, and no local service secrets in the extension.
- The public-mode package was loaded in a fresh Edge profile. Clean onboarding, Help, Privacy, and the hosted privacy-policy action were checked. Screenshots are in `docs/screenshots/public-setup-clean.png` and `public-privacy.png`. No live Notion requests were made by this check.
- Attempting a public build with the existing localhost configuration was rejected as intended.

The Render configuration is prepared, but no hosted service has been provisioned and no public store submission has been made. Live verification against the final public URL, production OAuth credentials, assigned store identity, publisher contact, and public policy remains necessary. See [PUBLIC-RELEASE.md](PUBLIC-RELEASE.md).

## Initial pilot validation

Validated on 18 November 2026 using Node.js 24 and an isolated Microsoft Edge profile on Windows.

## Passed

- Strict TypeScript check and ESLint.
- Production build with the official shadcn/ui Radix components installed through the CLI.
- 28 unit/integration-boundary tests covering folder inheritance, new-only baselining, moves, unsupported URLs, paused work, persistent operation IDs, rate limits, destination changes, mapping repair, history clearing, duplicate prevention, and ambiguous-write reconciliation.
- Five browser checks covering the setup journey, keyboard operation, draft restoration, popup pause/resume, real extension bookmark events, service worker termination/recovery, and local-service origin/session enforcement.
- Automated axe checks on the healthy popup and folder setup screen, with no violations in those checked states. This is not a full assistive-technology audit.
- Visual inspection of rendered popup/settings screens.
- Production dependency audit: no reported vulnerabilities at the time checked.

The real bookmark test ran in a fresh temporary browser profile. It did not read or alter the user's personal bookmarks. It deliberately paused sending and used a test connection reference, so it verifies extension behavior without claiming a live Notion save.

## Requires the user's Notion setup

Live authorization, destination permissions, actual workspace schema compatibility, and the first real save must be verified after OAuth credentials are configured. Follow [LOCAL-SETUP.md](LOCAL-SETUP.md). Credentials must be entered directly into `.env.local`.

## Known limits

- The complete development dependency audit reports 12 high-severity entries tracing to the transitive `picomatch` advisory [GHSA-fc5q-39xc-vjpf](https://github.com/advisories/GHSA-fc5q-39xc-vjpf). The reported latest release, 4.0.7, was still in the affected range when checked. These dependencies are development tooling and are not part of the production dependency audit or the extension's runtime graph. Recheck before exposing a development server or upgrading tooling; this has not been reported as fixed.
- Performance targets in the PRD, including the large-library cases and 95th-percentile save latency, have not yet been measured in a real pilot.
- No independent cross-installation coordination is provided. Use one active installation per destination.
- A genuinely uncertain create can remain under reconciliation rather than being retried blindly. This protects against duplicates but may require manual inspection in Notion.
- Chrome must be open and the local service must be running for new work to reach Notion. Enqueued records persist while either is unavailable.
- Import cancellation leaves already-attempted/uncertain work available for reconciliation. It does not undo completed entries.

The built `dist` folder contains the unpacked extension. The local service source and setup guide remain in the project folder and are not embedded in the extension package.
