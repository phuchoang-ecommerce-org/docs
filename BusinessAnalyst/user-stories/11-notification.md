# Notification Center — User Stories (`NTF`)

**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/11-notification.md`](../use-cases/11-notification.md) (source use cases) · [`../srs.md`](../srs.md)

---

## US-NTF-01 — Deliver Email Notification

**As a** Customer
**I want** to receive an email when a business event concerning my order occurs
**So that** I know my order exists, was paid for, and is on its way

**Realises:** `UC-NTF-01` · `FR-NTF-01`, `FR-NTF-03`, `FR-NTF-06`
**Priority:** Must

**Acceptance Criteria**
- Given a business event naming a recipient with a registered address, when the notification is raised, then it is recorded before delivery is attempted, and the provider's acceptance is recorded against it.
- Given a transactional notification about my own order, payment, or shipment, when raised, then it is sent regardless of my promotional preferences.
- Given a promotional notification, when raised, then it is sent only if I have not opted out.
- Given several updates for me within a short window, when raised, then they may be batched rather than sent as a flurry.
- Given the provider rejects the message, when this happens, then it is recorded failed and retried with backoff, and marked undeliverable and surfaced operationally after attempts are exhausted — never marked delivered.
- Given the provider is unreachable, when this happens, then the notification stays pending and is retried, with nothing lost.
- Given my address is rejected as invalid or bouncing, when this happens, then it is recorded undeliverable and my address flagged for correction.
- Given the same event is raised more than once, when this happens, then one notification is sent.
- Given I have no registered address, when a notification is raised for me, then it is recorded undeliverable with the reason, not discarded.
- Given the notification cannot be recorded before delivery, when this happens, then no delivery is attempted.
- Given composition of the message fails, when this happens, then it is recorded failed and escalated, and the business event it reports is unaffected.

---

## US-NTF-02 — Deliver In-App Notification

**As a** Customer
**I want** to receive in-app notifications for events on my account
**So that** I see updates where I am already looking, without depending on email

**Realises:** `UC-NTF-02` · `FR-NTF-02`, `FR-NTF-03`
**Priority:** Must

**Acceptance Criteria**
- Given a business event naming an account holder, when raised, then it is recorded against my account, unread, and made visible in my notification list, subject to my channel preferences.
- Given the same event also raises an email notification, when both channels apply, then each is delivered independently so a failure on one never suppresses the other.
- Given I am not currently signed in, when the notification is raised, then it waits in my list until I next open it.
- Given the notification relates to an order, when shown, then it links to that order.
- Given recording fails, when this happens, then it is retried and the underlying business event is unaffected.
- Given the same event is raised more than once, when this happens, then it is recorded once.
- Given my account is suspended or deleted, when a notification would be raised, then it is recorded undeliverable with the reason.
- Given a notification is requested for another customer's account, when attempted, then it is refused and recorded.

---

## US-NTF-03 — View In-App Notifications

**As a** Customer
**I want** to see my in-app notifications
**So that** I have a single place showing what has happened to my orders

**Realises:** `UC-NTF-03` · `FR-NTF-04`
**Priority:** Must

**Acceptance Criteria**
- Given an authenticated session, when I open my notifications, then they are presented most recent first, paginated, with unread ones distinguished.
- Given I open one, when I do, then it is marked read and follows through to the order or product it concerns.
- Given I mark all as read, when I do, then every unread notification is marked read in one action.
- Given I mark a read notification as unread, when I do, then it is restored to unread.
- Given I filter to unread or a category, when I apply the filter, then only matching notifications are shown.
- Given I dismiss a notification, when I do, then it is removed from the list while delivery remains recorded.
- Given I have no notifications, when I open the list, then an empty list is presented explicitly.
- Given I request another customer's notifications, when attempted, then it is declined and recorded.
- Given marking as read fails, when this happens, then the notification content is still presented and the state change is retried.
- Given a notification references a deleted order or product, when opened, then it is presented with its recorded text and following it reports the target is no longer available.

---

## US-NTF-04 — Manage Notification Preferences

**As a** Customer
**I want** to control my promotional notification preferences
**So that** I keep transactional updates but can opt out of marketing

**Realises:** `UC-NTF-04` · `FR-NTF-05`
**Priority:** Should

**Acceptance Criteria**
- Given an authenticated session, when I open preferences, then promotional categories per channel are presented, with transactional notifications marked not optional and explained.
- Given I opt in or out per category and channel, when I save, then preferences are stored and honoured from the next notification onward.
- Given I follow an unsubscribe link without signing in, when I use a valid single-use token, then I am unsubscribed from that category without requiring login.
- Given I opt out of everything promotional in one action, when I do, then every promotional category on every channel is disabled.
- Given an Administrator suspends a promotional category platform-wide, when they do, then transactional categories are unaffected.
- Given I attempt to opt out of transactional notifications, when I try, then it is declined and explained that order, payment, and shipment notifications about my own transactions cannot be disabled.
- Given the unsubscribe token is expired or consumed, when used, then I am offered sign-in to manage preferences instead.
- Given storing preferences fails, when this happens, then nothing changes and I am told the change did not apply.
- Given a notification is already in flight when preferences change, when it is delivered, then it may still arrive, since preferences are evaluated when a notification is raised.
- Given another customer's preferences are requested, when attempted, then it is declined and recorded.
