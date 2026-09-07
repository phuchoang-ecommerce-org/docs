# ADR-0029 — Flyway for Versioned Schema Migrations

**Document type:** Architecture Decision Record
**Status:** Accepted (Flyway as the migration tool) · the migration governance rules in §4 are **Proposed**
**Date:** 2026-09-07
**Deciders:** Solution Architecture
**Traces to:** `P15` · `NFR-MAINT-05` · `NFR-REL-01` · `NFR-REL-03` · `NFR-AVAIL-01` · `NFR-OBS-02` · `AC-04`
**Related documents:** [Deployment Diagram](../Deployment%20Diagram.md) · [Technology Stack](../Technology%20Stack.md) · [Domain Model](../../02-backend/Domain%20Model.md) · [ADR-0009](./ADR-0009-postgresql-source-of-truth.md) · [ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md) · [ADR-0027](./ADR-0027-java-21-spring-boot-4-gradle.md) · [ADR-0028](./ADR-0028-deployment-topology-containerisation.md)

---

## 1. Context and Problem Statement

[`ADR-0009`](./ADR-0009-postgresql-source-of-truth.md) settles *what* the transactional store is and makes seven schema-level commitments about it. It closes with an explicit gap:

> *"Migration tooling, HA topology, and backup/restore policy are undecided and not covered by any record."*

[`Technology Stack.md`](../Technology%20Stack.md) names Flyway in its list. A name in a list is not a decision: nothing records why it was chosen over Liquibase, what governs a migration script, or how one linear schema history coexists with thirteen module boundaries that [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) spent a whole record separating.

That gap is now load-bearing, because two documents already assume the answer. [`Deployment Diagram.md`](../Deployment%20Diagram.md) §3 lists *"versioned migration scripts in the `app` subproject"* as a deployable artefact, and §8 commits to two behaviours — readiness fails while migrations run, and *"at `N > 1` the migration tool's own lock ensures one runner."* Both are written against a tool nobody has chosen.

The sharper pressure is that **a default exists and it is the wrong one.** [`ADR-0010`](./ADR-0010-jpa-write-model-jdbc-read-models.md) puts Hibernate on the write path, and Hibernate can generate the schema from entity mappings. If no record decides otherwise, the schema becomes a side effect of Java field declarations — which quietly discards most of what ADR-0009 committed to. Module-prefixed table names, the prohibition on cross-module foreign keys, partial indexes for the outbox's unpublished rows and for active promotions, and the unique constraints that `Domain Model.md` §7 makes *the actual enforcement point* for `BR-CAT-01`, `BR-CUS-01`, `BR-REV-02`, and `BR-AUD-03` are none of them things an ORM will emit on its own. Neither is [ADR-0017](./ADR-0017-append-only-audit-log.md)'s database-level protection of the audit table, which has no Java representation at all.

The question is therefore narrower than "which migration tool": **what makes the schema a reviewed, versioned artefact rather than a side effect — across thirteen modules that share one database and one linear history?**

## 2. Decision Drivers

- `NFR-MAINT-05` — *"structural constraints are enforced automatically and continuously, so that a violation is caught when it is introduced rather than discovered later."* Its measurement is an automated build check. ADR-0009's schema commitments are structural constraints; today nothing checks them.
- `NFR-OBS-02` — the audit trail cannot be amended through any interface the platform exposes. [ADR-0017](./ADR-0017-append-only-audit-log.md) §5 puts the enforcement in the database, so those grants and triggers need somewhere to live that is reproducible.
- `NFR-REL-01` and `NFR-REL-03` are verified by [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)'s Testcontainers suites against *"real PostgreSQL — an optimistic-locking guarantee cannot be verified against an in-memory database."* That verification is only worth anything if the test database has production's schema, constraints included.
- `NFR-AVAIL-01` — [Deployment Diagram](../Deployment%20Diagram.md) §8 gates readiness on migrations completing, so migration execution has to be an observable, ordered startup phase rather than an ambient behaviour.
- **Rolling restarts make backward compatibility mandatory, not advisory.** [ADR-0028](./ADR-0028-deployment-topology-containerisation.md) deploys `ecp-api` by restarting replicas one at a time; during that window two application versions run against one schema.
- **`N > 1` replicas start concurrently.** ADR-0028 §5 already flags scheduled work as contended at `N > 1`; schema migration has the identical shape and needs exactly one runner.
- [ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md) puts Spring Data JDBC on the read side with hand-written SQL. Read-model and reporting tables have no entity mapping, so an entity-derived schema could not describe them even in principle.
- [ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md)'s outbox table is infrastructure with no aggregate behind it, and needs a partial index that `Deployment Diagram` §8 calls out by name.
- [ADR-0027](./ADR-0027-java-21-spring-boot-4-gradle.md) makes `app` the only subproject applying the Spring Boot plugin and producing an artifact, which constrains where a single schema history can physically live.

## 3. Considered Options

**Option 1 — Flyway: versioned plain-SQL migrations, executed at application startup, with Hibernate restricted to `validate`.** *(chosen)*

- **Pros:** Plain SQL means every construct these records actually need is expressible with nothing to fight — partial indexes, check constraints, revoked grants, triggers, and the `pgcrypto`/`uuid` extensions are just statements. Versions are immutable and checksummed, so an edited-after-the-fact migration fails loudly instead of leaving two environments quietly different, which is `NFR-MAINT-05`'s "caught when it is introduced" applied to the schema. On PostgreSQL, Flyway takes its own lock before migrating, so the `N > 1` single-runner requirement in `Deployment Diagram` §8 is satisfied by the tool rather than by a hand-written mitigation — unlike the scheduler and the outbox relay, which still need one. Spring Boot auto-configures Flyway and orders it *before* the JPA `EntityManagerFactory` is built, so `ddl-auto: validate` runs against an already-migrated schema and entity/schema drift becomes a startup failure. Testcontainers can build every test database from the same script set, which is what makes ADR-0018's `NFR-REL-01`/`NFR-REL-03` suites credible.
- **Cons:** No rollback in the free edition — `undo` is a paid feature, so correcting a mistake is always a new forward migration, and some mistakes (a dropped column that held data) no forward script can undo. Raw SQL is PostgreSQL-specific, making the migration set a second, quieter commitment to ADR-0009's database choice. Thirteen modules writing into one linear version sequence is a genuine coordination surface.

**Option 2 — Liquibase: database-agnostic changelogs.**

- **Pros:** The rollback story is materially better — many change types generate their inverse automatically, which is exactly the weakness of Option 1. Changelog `include` makes per-module files a first-class structure rather than a filename convention, which maps more naturally onto ADR-0006's module boundaries than a flat directory does. Abstracted change types are portable across databases.
- **Cons:** The portability is the whole value proposition, and ADR-0009 has already committed to PostgreSQL as the single transactional source of truth — so it is paid for and not consumed. Worse, the constructs this platform specifically needs fall outside the abstraction: partial indexes, ADR-0017's revoked `UPDATE`/`DELETE` grants, and any audit trigger drop through to raw `<sql>` blocks with hand-written `<rollback>` counterparts. At that point the changelog is SQL wrapped in a DSL, and the automatic-rollback advantage — the reason to prefer it — no longer applies to the changes that matter most. Rejected on proportionality rather than capability; this is the closest call in this record, and §5 names what would reverse it.

**Option 3 — Hibernate `ddl-auto: update`: schema generated from entity mappings.**

- **Pros:** No tool, no scripts, no coordination. The schema tracks the entities by construction, and early development moves faster.
- **Cons:** Structurally unable to express this platform's schema. Only the JPA write model has entities — ADR-0010's JDBC read models, ADR-0012's outbox, and ADR-0017's audit protections are invisible to it. `update` is additive-only: it never drops or narrows, so environments accumulate divergent dead columns and "works on staging" stops being evidence. And it removes the schema from review entirely — renaming a Java field becomes production DDL that no one approved, which is the precise inversion of `NFR-MAINT-05`. Rejected outright.

**Option 4 — Hand-maintained SQL scripts run from a runbook (or Spring Boot's `schema.sql`).**

- **Pros:** No dependency and no abstraction; what runs is exactly what was written.
- **Cons:** The environment becomes a runbook rather than a file — the same failure mode [ADR-0028](./ADR-0028-deployment-topology-containerisation.md) rejected its Option 3 for, one layer down. Nothing records which scripts have been applied to which database, so there is no checksum, no ordering guarantee, no concurrency lock, and nothing for `NFR-AVAIL-01`'s readiness gate to actually gate on. Rejected.

## 4. Decision Outcome

**Chosen: Option 1.** Flyway owns the schema; Hibernate only validates it.

| Commitment | Reason |
|---|---|
| **The schema is defined by migration scripts and nothing else.** `spring.jpa.hibernate.ddl-auto=validate` in every environment, tests included | The ORM checks the schema; it never owns it. Drift between an entity mapping and the real schema becomes a startup failure rather than a silent DDL change ([ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md)). This is the automated check `NFR-MAINT-05` asks for, applied to the store. |
| **Scripts live in the `app` subproject** at `app/src/main/resources/db/migration/` | `app` is the only subproject producing an artifact ([ADR-0027](./ADR-0027-java-21-spring-boot-4-gradle.md)), and there is one database with one history ([ADR-0009](./ADR-0009-postgresql-source-of-truth.md)) — thirteen subprojects cannot each own a slice of a linear sequence. [`Deployment Diagram`](../Deployment%20Diagram.md) §3 already states this placement. |
| **Naming: `V<yyyyMMddHHmm>__<module>_<description>.sql`** — e.g. `V202609071430__ordering_create_order.sql` | A timestamp removes the collision two teams reaching for `V7__` in parallel branches would otherwise cause. The module prefix mirrors ADR-0009's table-prefix rule, so a script's owning module is legible from its filename and reviewable without opening it. |
| **One script touches one module's tables.** A migration altering two modules' tables is a review failure | Keeps [ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md)'s ownership visible in the schema's own history, and keeps the later extraction ADR-0009 §5 contemplates mechanical rather than archaeological. |
| **Applied migrations are immutable; checksum validation stays on** | Editing an applied script is how two environments silently diverge. Correction is always a new forward script — the same rule ADR/README §2 applies to superseded records, for the same reason. |
| **Every change is backward compatible for one release (expand → migrate → contract)** | A rolling restart runs two application versions against one schema ([`Deployment Diagram`](../Deployment%20Diagram.md) §8). So: add the nullable column, backfill it, *then* make it non-null in a later release. Never rename or drop in the same release that stops using the old name. |
| **Repeatable migrations (`R__`) only for replaceable objects** — views and functions | Their body *is* the source of truth and they re-run when their checksum changes. Never for tables, where history is the point. |
| **`clean` is never enabled anywhere.** Flyway disables it by default; that default is not overridden outside a developer's own machine | `clean` drops the schema. Against a deployed database it is data loss with no undo, and Option 1 has no undo. |
| **`baselineOnMigrate` stays off** | No production database exists yet — the first migration builds the schema from empty. Enabling it would let a database whose real state nobody knows be silently adopted as version 1. |
| **Test databases are built from the same script set** — Testcontainers PostgreSQL runs the migrations, never a separate test DDL | [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md)'s persistence and concurrency suites verify `NFR-REL-01` and `NFR-REL-03` against the real constraints, including the ones `Domain Model.md` §7 makes the enforcement point. A test schema that differs from production's tests nothing. |
| **[ADR-0017](./ADR-0017-append-only-audit-log.md)'s database-level protections ship as migrations** — revoked `UPDATE`/`DELETE` grants and any audit trigger | They have no Java representation, so if they are not in a migration they are not reproducible in any environment. ADR-0017 §5's caveat is unchanged: a migration run as a superuser can still alter the table, and `NFR-OBS-02` covers the platform's interfaces, not operational access. |
| **Dependencies: `org.flywaydb:flyway-core` plus `org.flywaydb:flyway-database-postgresql`**, versions from Spring Boot's dependency management and overridable in `gradle/libs.versions.toml` | Since Flyway 10, PostgreSQL support ships as a separate module — omitting it fails at runtime, not at compile time. The version catalog is where ADR-0027 puts every other pinned version. |

```nano
  app/src/main/resources/db/migration/
  ├── V202609071400__shared_enable_extensions.sql
  ├── V202609071405__identity_create_customer.sql
  ├── V202609071410__catalog_create_product.sql          unique SKU — BR-CAT-01
  ├── V202609071415__inventory_create_stock_item.sql     version column — ADR-0011
  ├── V202609071420__ordering_create_order.sql
  ├── V202609071425__ordering_create_outbox.sql          partial index, unpublished rows — ADR-0012
  ├── V202609071430__audit_create_audit_log.sql          revoked UPDATE/DELETE — ADR-0017
  └── R__reporting_order_summary_view.sql                repeatable; re-runs on checksum change
```

**Explicitly not decided here:** whether migrations eventually move out of application startup into a pre-start job or init container (`Deployment Diagram` §8 owns the startup sequence); the backfill strategy for tables large enough that a migration cannot finish inside a readiness window; and reference-data seeding, which is treated below as an open question rather than settled by omission.

## 5. Consequences

### Positive

- ADR-0009's schema commitments become artefacts that exist, run, and show up in a pull-request diff — `NFR-MAINT-05` reaches the storage layer instead of stopping at the code.
- ADR-0017's database-level protections get a reproducible home, which is what `NFR-OBS-02` needs to be true in more than one environment.
- ADR-0018's Testcontainers suites run against production's actual schema, so an optimistic-locking or uniqueness guarantee is verified against the real constraint rather than an approximation of it.
- `Deployment Diagram` §8's single-runner requirement at `N > 1` is met by Flyway's own lock. Of the three concurrency hazards ADR-0028 §5 lists at `N > 1` — scheduled work, the outbox relay, and migrations — this record removes the third.
- Any environment, including a developer's laptop, is reconstructible from an empty database plus the script set.

### Negative

- **There is no rollback.** Undo is always a new forward migration, and a forward migration cannot restore data a previous one destroyed. The real mitigation is the WAL archiving and restore drill in `Deployment Diagram` §8, which makes backup discipline a *dependency* of this decision rather than an adjacent nicety.
- **Expand/contract is a permanent tax on every schema change.** A column rename that would be one statement becomes three releases. The cost is real and the temptation to skip it is strongest at `N = 1`, where nothing breaks today — and skipping it is precisely what makes moving to `N > 1` unsafe later. That coupling is easy to discover too late.
- **One linear history across thirteen modules.** Timestamp versioning removes numeric collisions but not semantic ones: two modules' scripts still apply in arrival order, not dependency order, and neither author necessarily considered the other's. Review is the only control, and this is the sharpest place where Option 2's per-module changelogs would have helped.
- **Migration time is deploy time.** A long-running migration extends the readiness gate, and at `N = 1` that is user-visible downtime. Any migration that cannot finish quickly must be split or moved out of startup — the change this record defers rather than solves.
- **The migration set is a second commitment to PostgreSQL.** Every script is dialect-specific, so a database change means rewriting all of them, on top of everything ADR-0009 already makes hard. Intended, but it should be counted rather than discovered.
- **`validate` will refuse to start on drift, including drift someone introduced on purpose.** That is the point of it, and it will still look like the tool is the problem the first time it happens mid-incident.

### Neutral / follow-on

- **Option 2 is the right answer if either of its two premises changes:** a second database dialect enters the transactional path, or the coordination cost of one linear history across thirteen modules turns out in practice to exceed the cost of a changelog DSL. Neither is true today; both are observable.
- **Reference and seed data** — countries, roles, promotion types — could be versioned migrations or application bootstrap. It is not decided here, and the two choices diverge on whether an environment's data is reproducible from the repository.
- **The database role migrations run as, versus the least-privilege role the application runs as,** is unaddressed and interacts directly with ADR-0017 §5's superuser caveat. It belongs with the security-operational gap `Deployment Diagram` already leaves open.
- **A CI rule that a pull request touching a JPA entity must also touch a migration** is a natural extension of ADR-0018's gate. Not decided here — it would need care to avoid blocking legitimate non-schema entity edits.
- HA topology and backup/restore policy — the other two items in ADR-0009 §5's open list — remain open. This record closes only the first.

## 6. Related Decisions

[ADR-0006](./ADR-0006-spring-modulith-module-boundaries.md) · [ADR-0009](./ADR-0009-postgresql-source-of-truth.md) · [ADR-0010](./ADR-0010-jpa-write-model-jdbc-read-models.md) · [ADR-0011](./ADR-0011-optimistic-locking-reservation-model.md) · [ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0017](./ADR-0017-append-only-audit-log.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) · [ADR-0027](./ADR-0027-java-21-spring-boot-4-gradle.md) · [ADR-0028](./ADR-0028-deployment-topology-containerisation.md)
