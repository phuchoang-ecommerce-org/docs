# Private Web Revalidation Callback v1

**Document type:** Versioned internal HTTP contract
**Status:** Proposed
**Audience:** `ecp-api`, `ecp-web`, QA, Architecture Review
**Related documents:** [Event Contract](./README.md) · [Data Fetching](../../03-frontend/Data%20Fetching.md) §7 · [ADR-0038](../../01-system/ADR/ADR-0038-event-driven-catalog-revalidation.md)

---

`POST /api/internal/revalidate` is an internal `ecp-api` to `ecp-web` callback.
It is not an `ecp-api` operation and is therefore intentionally absent from the
public OpenAPI contract. It is reachable only on the internal network.

## Request authentication and body

| Part | Contract |
|---|---|
| Method and path | `POST /api/internal/revalidate` |
| Content type | `application/json` |
| Body | One UTF-8 catalog event envelope matching a version-1 schema in [`catalog/`](./catalog/) |
| `X-ECP-Signature` | `sha256=<lowercase-hex>` where the digest is `HMAC-SHA-256(ECP_REVALIDATE_SECRET, raw request body bytes)` |
| Secret | `ECP_REVALIDATE_SECRET`, shared only by `ecp-api` and `ecp-web` |

`ecp-web` compares the signature in constant time before parsing or acting on
the body. A missing, malformed, or mismatched signature returns `401`; it never
invalidates a tag and is logged with the request correlation context where one is
available.

## Supported event mapping

The callback computes tags itself. The sender never supplies tags, cache content,
or a page URL.

| Event type | Required payload fields | Tags revalidated |
|---|---|---|
| `ProductPriceChanged` | `productId`, `variantSkus` | `product:{productId}` and `variant-price:{sku}` for every SKU |
| `ProductDiscontinued` | `productId`, `variantSkus` | `product:{productId}` and `variant-price:{sku}` for every SKU |
| `ProductPublished` | `productId`, `variantSkus`, `affectedCategorySlugs` | `product:{productId}`, `variant-price:{sku}` for every SKU, and `category:{slug}` for every affected slug |
| `CategoryChanged` | `affectedCategorySlugs` | `category:{slug}` for every affected slug |

A valid but unsupported event type returns `204`, revalidates nothing, and emits
a structured warning containing its `eventId`, `eventType`, and `correlationId`.
The operation is replay-safe: repeated valid deliveries may revalidate the same
tags again and return `204`.

## Responses

| Status | Meaning |
|---|---|
| `204` | Signature was valid. Supported events were mapped and submitted for revalidation; an unsupported event was intentionally a logged no-op. |
| `401` | Signature was missing, malformed, or invalid. No event parsing, tag mapping, or revalidation occurred. |

The Kafka consumer retries a failed delivery. `204` is terminal; `401` is a
configuration or trust-boundary failure and must alert rather than be retried as
a transient transport failure.
