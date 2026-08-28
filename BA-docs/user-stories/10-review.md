# Review System — User Stories (`REV`)

**Document type:** User Story Specification — domain
**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/10-review.md`](../use-cases/10-review.md) (source use cases) · [`../srs.md`](../srs.md)
**Audience:** Product Management, Engineering, Quality Assurance

---

## US-REV-01 — Submit Product Review

**As a** Customer
**I want** to rate and review a product I bought
**So that** I can record my experience for other shoppers

**Realises:** `UC-REV-01` · `FR-REV-01`, `FR-REV-02`, `FR-REV-03`, `FR-REV-06`
**Priority:** Must

**Acceptance Criteria**
- Given I hold an order in Delivered or Completed containing the product and have not already reviewed it, when I submit a rating, text, and optional images within the configured limits, then the review is recorded, marked from a verified buyer, published, and the product's aggregate rating recalculated.
- Given I submit a rating without text, when I do, then it is accepted and still contributes to the aggregate.
- Given I review a specific variant, when I submit it, then the review is recorded against that variant and shown on the parent product.
- Given I am prompted after delivery, when the notification arrives, then it invites me to review at the point I have something to say.
- Given I have not purchased the product, when I try to submit a review, then it is declined regardless of my role or entry point.
- Given my order is not yet delivered, when I try to review, then I am told review becomes available after delivery.
- Given I have already reviewed this product, when I try to submit again, then I am declined and offered to amend my existing review instead.
- Given my rating is out of range or my text too long, when I submit, then I am told the problem and nothing is recorded.
- Given an image fails validation, when I submit it, then it is declined with the reason and I may submit the review without it.
- Given my account is unverified, when I try to review, then I am declined and offered a verification resend.
- Given the product was removed since my purchase, when I review it, then the review is accepted and recorded against the order's product reference.

---

## US-REV-02 — Edit Own Review

**As a** Customer
**I want** to amend my own review within the edit window
**So that** I can revise it after longer use of the product

**Realises:** `UC-REV-02` · `FR-REV-04`
**Priority:** Should

**Acceptance Criteria**
- Given I authored the review and it is within the edit window, when I submit an amendment, then it is validated, stored, the review marked amended with its date, and the aggregate rating recalculated if the rating changed.
- Given I change images, when I do, then they are validated as at original submission.
- Given a moderator wants to change a review's content, when they act, then they hide or remove it rather than amending my words.
- Given the edit window has passed, when I try to amend, then I am declined and told when it closed.
- Given the review is authored by another customer, when I try to amend it, then it is declined and the attempt recorded.
- Given the review was removed by a moderator, when I try to amend it, then I am declined and told it is no longer available.
- Given the amended content fails validation, when submitted, then the original review stands unchanged.

---

## US-REV-03 — Delete Own Review

**As a** Customer
**I want** to delete my own review
**So that** I can withdraw an opinion I no longer stand behind

**Realises:** `UC-REV-03` · `FR-REV-05`
**Priority:** Should

**Acceptance Criteria**
- Given I authored the review, when I delete it, then it is no longer displayed, no longer contributes to the aggregate rating, and the deletion is confirmed.
- Given I delete a review, when I later choose to, then I may submit a new review for the same product since the one-review limit is released.
- Given my account is deleted, when that happens, then my reviews are withdrawn with it.
- Given the review is authored by another customer, when I try to delete it, then it is declined and the attempt recorded.
- Given the review is already deleted, when I try to delete it again, then success is reported.
- Given aggregate recalculation fails after deletion, when it happens, then the review is still withdrawn from display and recalculation is retried.

---

## US-REV-04 — View Product Reviews

**As a** Guest
**I want** to see a product's published reviews and aggregate rating
**So that** I can use them to decide whether to buy

**Realises:** `UC-REV-04` · `FR-REV-07`, `FR-CAT-04`
**Priority:** Must

**Acceptance Criteria**
- Given a product with published reviews, when I open them, then the aggregate rating, its distribution, and a paginated list of reviews are presented, each showing rating, text, images, date, amendment status, and verified-buyer status, excluding anything hidden or removed by moderation.
- Given I sort or filter, when I choose most recent, most helpful, or a rating value, then the list reflects my choice.
- Given no reviews exist yet, when I open the section, then this is stated plainly, with a verified buyer invited to review.
- Given reviews across variants, when shown, then each identifies the variant it reviews on the parent product.
- Given reviews are unavailable, when I open a product, then the product page is presented in full without the section.
- Given the aggregate rating is briefly stale, when shown, then this is acceptable since no purchasing decision the platform makes depends on it.
- Given the product is unpublished, when I try to view its reviews, then they are not presented independently of the product.

---

## US-REV-05 — Moderate Review

**As a** Customer Support Agent
**I want** to hide or remove a review that breaches policy
**So that** the review channel stays trustworthy and abuse is attributable

**Realises:** `UC-REV-05` · `FR-REV-08`, `FR-ADM-07`, `FR-AUD-01`
**Priority:** Should

**Acceptance Criteria**
- Given a reported or identified review and a role permitting moderation, when I hide or remove it with the policy breached stated as reason, then it is withdrawn from display, the aggregate rating recalculated, an audit entry recorded, and the author notified.
- Given the report does not breach policy, when I dismiss it, then the review stays published and the dismissal is recorded.
- Given a moderation decision is reversed, when I reinstate a review, then it returns to display, the aggregate is recalculated, and both decisions remain in the audit trail.
- Given a confirmed breach, when I examine the author's other reviews, then this examination is part of the ordinary moderation flow.
- Given content is removed for being unlawful, when I do so, then it is removed rather than hidden and escalated to Legal.
- Given I lack authority to moderate, when I attempt it, then it is declined and the attempt recorded.
- Given the review is already moderated, when I try to act on it again, then the existing decision is presented rather than a second applied.
- Given no reason is supplied, when I submit a moderation action, then it is declined.
- Given the author deletes the review during moderation, when this happens, then the moderation decision is still recorded against it.
- Given the audit entry cannot be written, when this happens, then the moderation is not applied.
- Given the notification to the author fails, when it happens, then the moderation decision stands and the notification is retried.
