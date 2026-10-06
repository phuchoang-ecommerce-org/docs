# IH-1 — Session & Catalog: Hardening Findings

**Status:** Active verification record  
**Source:** [`release-plan.md`](./release-plan.md) §IH-1  
**Last run:** 2026-09-20

This record is the handoff for implementation and re-verification work. A
unit, contract, or structural check is not evidence that an IH row has passed;
the required L4/L5 path must be re-run after every repair.

## Implemented repairs awaiting re-verification

| ID | Finding | Repair owner | Required re-verification |
|---|---|---|---|
| IH1-04-FE | The sole session issuer defaulted both cookies to `SameSite=Lax`, leaving the `(admin)` posture unexercised. | Frontend | Log in as a Customer and as an operator against real `ecp-web` + `ecp-api`; inspect actual `Set-Cookie` attributes and verify the customer admin shell/server-refusal flow. |
| IH1-08-BE | The catalog Kafka consumer did not restore the envelope correlation ID to MDC, so consumer-side logs could not be joined to REST, outbox, Kafka, and callback evidence. | Backend | Make a real catalog write with a known correlation ID and correlate the HTTP response/log, outbox row, Kafka envelope, consumer log, and callback header. |
| IH1-06-BE | A signed revalidation callback rejection (`401`) was classified as a transient callback failure and retried. | Backend | Force a real callback `401`; prove one handler attempt, a consumer-scoped DLT record/alert, no successful processed-event or cache mutation, and no secret in logs. Separately prove a `5xx` uses the bounded retry policy. |

### Session-posture decision

IH-1 ratifies **operator-session-wide `SameSite=Strict`**. Cookie `SameSite`
is an issuance attribute, not a route-level attribute: the same `/`-scoped
cookie cannot be `Lax` on storefront requests and `Strict` on `(admin)`
requests. After a successful server-side login, `STAFF`,
`WAREHOUSE_OPERATOR`, `CUSTOMER_SUPPORT`, and `ADMINISTRATOR` sessions are
therefore issued Strict `ecp_session` and `ecp_csrf` cookies; sessions without
an operator role remain Lax. The posture is derived only from the validated
`POST /sessions` response, never a browser-supplied role or return path.

Backend authorization remains authoritative. The frontend session posture does
not grant permission, and middleware must not make role decisions. Privilege
grant/revocation flows must continue to rotate or invalidate sessions so an
old cookie posture and CSRF token cannot survive a role change.

## Code-level verification completed

On 2026-09-20, the focused backend revalidation suite passed:

```text
./gradlew :app:test --tests CatalogRevalidationListenerTest \\
  --tests HttpWebRevalidationGatewayTest \\
  --tests WebRevalidationKafkaConfigurationTest
```

It covers MDC restoration, immediate consumer-specific DLT routing for a
signature rejection (including source-partition retention), and the bounded
retry path for ordinary callback failures. Frontend type checking and the
session/action test set also passed. This is L2/L3 evidence only, not an IH-1
integration pass.

## Live-run observations

On 2026-09-20, the frontend was started on `:3000` and the API on `:8080`
against the local Compose dependencies. Playwright received `200` and the ECP
shell from `/`, but the storefront catalog content remained in its loading
fallback for more than 15 seconds. The direct unauthenticated request
`GET /api/v1/categories` returned `401`, even though the storefront calls it
as a guest and the permission/contract material describes catalog browse as a
guest-readable surface. `ApiRoutes.PUBLIC_GET` currently omits the category
paths; backend must resolve this with the authorization matrix owner.

The checked-in Playwright smoke spec also fails because it looks for an
`Enterprise Commerce Platform` heading that the current home page does not
render (the current page's intended heading is `Browse by category`). Update
the spec or the approved page contract before treating that check as green.

The API bound `:8080`, but its Kafka admin and consumer clients repeatedly
cannot resolve the broker's Compose-only advertised address `kafka:9092` from
the host. The broker also reports the catalog consumer topics as absent. These
conditions prevent a trustworthy catalog-to-revalidation integration run.

## Open hardening gaps

| ID | Verdict | Reason and required owner action |
|---|---|---|
| IH1-01 | BLOCKED | No current browser → web → API proof that tokens never enter browser-visible storage or responses. Add/execute an L5 browser test. |
| IH1-02 | BLOCKED | Unit coverage exists, but every cookie-authenticated write still needs a real missing/forged-CSRF rejection test through `ecp-web`. |
| IH1-03 | BLOCKED | The mutex has L2 coverage only. Drive concurrent expired-session requests through real `ecp-web` and assert exactly one API renewal. |
| IH1-05 | BLOCKED | Capture real customer navigation to `/admin` and three detail routes. Clarify the checklist wording: catalog reads intentionally granted to `GUEST` cannot be asserted as `403`; only reads actually requested by the page and denied by the Permission Matrix should be. |
| IH1-06 | BLOCKED | The full catalog-write → outbox → Kafka → signed callback → storefront-freshness path requires Docker/Colima and live processes. |
| IH1-07 | BLOCKED | Inspect production-build route manifests and served headers for static/public and private/noindex/sitemap posture. |
| IH1-08 | BLOCKED | Repair is present, but the real correlated trace remains unobserved. |
| IH1-09 | UNVERIFIED | The existing permission tests cover selected cells, not every delivered identity/catalog role × operation outcome. Add a matrix-driven real-API suite. |

## Execution blocker

On 2026-09-20, Colima was started with the project-documented 4 GB profile and
`docker compose up -d` successfully started PostgreSQL, Kafka, Elasticsearch,
MongoDB, `redis-cache`, and `redis-state`. The IH-1 path still could not run:

- the Gradle launcher terminated after task-graph calculation before
  `:app:bootRun` bound `ecp-api` to `:8080`;
- the host cannot resolve Kafka's internal advertised `kafka:9092` hostname,
  even though its mapped bootstrap port is reachable; and
- `ecp-web` was not running.

Resolve the Gradle-launcher failure and make the host-run API's Kafka metadata
endpoint reachable (or run the API on the Compose network), then launch both
applications with the test revalidation secret and re-run the original IH-1
flows. Do not reuse prior unit or mock evidence as a pass.
