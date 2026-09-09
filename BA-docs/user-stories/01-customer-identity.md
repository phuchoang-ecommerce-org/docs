# Customer & Identity — User Stories (`CUS`)

**Related documents:** [`README.md`](./README.md) (index and template) · [`../use-cases/01-customer-identity.md`](../use-cases/01-customer-identity.md) (source use cases) · [`../srs.md`](../srs.md)

Each story below restates its source use case as a backlog item. It introduces no behaviour the use case does not already specify — see the source for the full rationale behind each rule.

---

## US-CUS-01 — Register Customer Account

**As a** Guest
**I want** to create an account with an email address and a password
**So that** I can place orders and track my purchase history

**Realises:** `UC-CUS-01` · `FR-CUS-01`, `FR-CUS-02`
**Priority:** Must

**Acceptance Criteria**
- Given a unique email address and a password meeting the strength policy, when I submit registration, then an account is created in state unverified, a verification message is dispatched, and no session is issued.
- Given I register from an abandoned checkout, when registration completes, then my guest cart is preserved for merging at first login rather than discarded.
- Given only email and password are supplied, when I submit registration, then the account is created and any other profile detail can be added later.
- Given an email address already registered, when I submit registration, then no second account is created, the response does not disclose that the address is taken, and the real owner is notified of the attempt.
- Given a password that fails the strength policy, when I submit registration, then I am told which criterion was not met and no account is created.
- Given the verification message cannot be dispatched, when registration otherwise succeeds, then the account remains created and unverified, delivery is retried, and I am offered a resend.
- Given I am outside my rate limit, when I submit registration, then the request is rejected without evaluation and no account is created.

---

## US-CUS-02 — Verify Email Address

**As a** Guest
**I want** to verify my email address
**So that** I can unlock ordering and reviewing

**Realises:** `UC-CUS-02` · `FR-CUS-02`
**Priority:** Must

**Acceptance Criteria**
- Given a valid, unexpired, unused verification token, when I follow the link, then my account is marked verified and the token is consumed.
- Given I follow an already-used valid link a second time, when I click it, then the platform reports success without further action.
- Given I request a new verification message, when I do so, then any outstanding token is invalidated and exactly one new token is issued and dispatched, subject to rate limiting.
- Given an expired token, when I follow the link, then I am told the link expired, the token is consumed, and I am offered a new one.
- Given an unrecognised or already-consumed token, when I follow the link, then I am told the link is not valid, without disclosing which case applies.
- Given the account was deleted after the message was sent, when I follow the link, then I am told the link is no longer valid.

---

## US-CUS-03 — Log In

**As a** Guest
**I want** to log in with my credentials
**So that** I can access my account, cart, orders, and addresses

**Realises:** `UC-CUS-03` · `FR-CUS-03`, `FR-CRT-06`
**Priority:** Must

**Acceptance Criteria**
- Given correct credentials and an account within rate limit, when I log in, then an access token and refresh token are issued and any guest cart is merged into my stored cart.
- Given my account is unverified, when I log in with correct credentials, then I receive a session restricted from ordering and reviewing, with the restriction and its remedy stated.
- Given no guest cart exists, when I log in, then login proceeds unaffected.
- Given incorrect credentials, when I log in, then I receive one generic failure message regardless of whether the email or the password was wrong, and the attempt counts toward my rate limit.
- Given I have exceeded the authentication rate limit, when I attempt to log in, then the attempt is rejected without evaluating credentials.
- Given my account is suspended, when I log in with correct credentials, then I am told the account is unavailable and directed to Support, without the reason being disclosed.
- Given the cart merge fails, when I log in, then login still succeeds, my guest cart is preserved for retry, and I am told my previous items were not carried over.

---

## US-CUS-04 — Log Out

**As a** Customer
**I want** to log out
**So that** my session ends, particularly on a shared device

**Realises:** `UC-CUS-04` · `FR-CUS-04`
**Priority:** Must

**Acceptance Criteria**
- Given an active session, when I log out, then my refresh token is invalidated and cannot be exchanged again, while my cart persists for next time.
- Given I choose to log out of all sessions, when I confirm, then every refresh token for my account is invalidated, ending sessions on every device.
- Given my session or token is already invalid, when I log out, then the platform reports success.
- Given invalidation cannot be completed, when I log out, then the session still ends for me and the token is recorded for retry.

---

## US-CUS-05 — Refresh Authenticated Session

**As a** Customer
**I want** my session refreshed automatically before it expires
**So that** I stay logged in without re-entering credentials

**Realises:** `UC-CUS-05` · `FR-CUS-05`
**Priority:** Must

**Acceptance Criteria**
- Given a valid, unexpired, unconsumed refresh token, when it is presented, then a new access token and refresh token are issued and the presented one is consumed.
- Given my roles changed since the token was issued, when I refresh, then the new access token carries my current roles.
- Given an expired refresh token, when it is presented, then the request is declined and I must authenticate again.
- Given a refresh token that was already consumed, when it is presented again, then the entire token chain for that session is invalidated and re-authentication is required.
- Given my account was suspended since the token was issued, when I refresh, then the request is declined and all tokens for the account are invalidated.

---

## US-CUS-06 — Change Password

**As a** Customer
**I want** to change my password
**So that** I can rotate a credential I believe is exposed

**Realises:** `UC-CUS-06` · `FR-CUS-06`
**Priority:** Must

**Acceptance Criteria**
- Given my correct current password and a new one meeting the strength policy, when I submit the change, then the stored hash is updated, every other session is ended, and I am notified.
- Given I choose to end my current session too, when I submit the change, then every session including the current one ends.
- Given an incorrect current password, when I submit the change, then the credential is left unchanged.
- Given a new password that fails the strength policy, when I submit the change, then I am told which criterion failed and nothing changes.
- Given a new password identical to the current one, when I submit the change, then the platform declines.
- Given the change notification cannot be dispatched, when the change otherwise succeeds, then the password change stands and the notification is retried.

---

## US-CUS-07 — Reset Forgotten Password

**As a** Guest
**I want** to reset my forgotten password
**So that** I can regain access to my account

**Realises:** `UC-CUS-07` · `FR-CUS-07`
**Priority:** Must

**Acceptance Criteria**
- Given a registered email address, when I request a reset, then a single-use, time-limited token is issued and dispatched, and the response is identical to that for an unregistered address.
- Given a valid token and a new password meeting the strength policy, when I complete the reset, then the credential is replaced, the token is consumed, every session is ended, and I am notified.
- Given my account was unverified, when I complete a reset, then the account is also marked verified.
- Given a second reset is requested before the first is used, when I request it, then the earlier token is invalidated and one new token is issued.
- Given an unregistered email address, when I request a reset, then the same response is given as for a registered one and nothing is dispatched.
- Given an expired or already-consumed token, when I attempt to complete the reset, then I am declined and offered a fresh request.
- Given a new password that fails the strength policy, when I attempt to complete the reset, then I am told the failure and the token is not consumed.
- Given I am outside my rate limit, when I request a reset, then the request is rejected without evaluation.

---

## US-CUS-08 — Manage Profile

**As a** Customer
**I want** to view and update my profile
**So that** my details stay current

**Realises:** `UC-CUS-08` · `FR-CUS-08`
**Priority:** Must

**Acceptance Criteria**
- Given valid amended field values, when I submit my profile, then the profile reflects the new values.
- Given I change my email address, when I submit the change, then my current address remains active until the new one is verified, the old address is notified of the request, and the new address receives a verification message.
- Given no field was actually changed, when I submit my profile, then nothing is stored and success is reported.
- Given a new email address already registered to another account, when I submit the change, then it is declined without confirming an account exists on it, and my current address is retained.
- Given a field fails validation, when I submit my profile, then no field is stored — the update applies wholly or not at all.

---

## US-CUS-09 — Manage Shipping Addresses

**As a** Customer
**I want** to manage my shipping addresses
**So that** checkout is quick and deliveries arrive correctly

**Realises:** `UC-CUS-09` · `FR-CUS-09`
**Priority:** Must

**Acceptance Criteria**
- Given a new address with valid fields, when I add it, then it is stored in my address book and marked default if it is my first.
- Given an existing address, when I amend it, then the amendment is stored and orders already placed against it keep the values recorded at placement.
- Given an address I no longer want, when I remove it, then it is removed from my address book without affecting past orders.
- Given more than one address, when I nominate a new default, then exactly one address is marked default afterward.
- Given I add an address mid-checkout, when I select it, then it is used for the checkout in progress and the shipping fee is recalculated.
- Given invalid address fields, when I submit an address, then I am told which field is wrong and nothing is stored.
- Given I remove my only address, when I do so, then the removal is allowed and my address book is left empty until checkout requires one.
- Given I amend an address in use by an in-flight checkout, when I save the amendment, then the shipping fee for that checkout is recalculated.

---

## US-CUS-10 — View Purchase History

**As a** Customer
**I want** to view the history of my orders
**So that** I can find a past order, reorder, or start a return

**Realises:** `UC-CUS-10` · `FR-CUS-10`, `FR-ORD-12`
**Priority:** Must

**Acceptance Criteria**
- Given I am authenticated, when I open my order history, then my orders are presented most recent first, each with its date, line items, charged total, and current state.
- Given a Support Agent or Administrator views a nominated customer's history, when they do so, then access is granted by role rather than ownership and the access is recorded.
- Given I have no orders yet, when I open my history, then an empty history is presented explicitly.
- Given I narrow by state or period, when I apply the filter, then only matching orders are presented.
- Given I request another customer's order, when I do so, then I receive the same response as for an order that does not exist, and the attempt is recorded.
- Given an order references a deleted product, when I view it, then it still presents in full using the name and price recorded at placement.
