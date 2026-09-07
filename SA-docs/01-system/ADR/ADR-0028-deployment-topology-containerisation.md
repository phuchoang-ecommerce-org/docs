# ADR-0028 — Docker Compose on Two VMs as the Deployment Topology

**Document type:** Architecture Decision Record
**Status:** **Proposed**
**Date:** 2026-09-07
**Deciders:** Solution Architecture
**Traces to:** `CON-08` · `CON-09` · `NFR-AVAIL-01` · `NFR-AVAIL-02` · `NFR-SCAL-06` · `NFR-MAINT-05` · `NFR-OBS-03` · `NFR-OBS-04`
**Related documents:** [Deployment Diagram](../Deployment%20Diagram.md) · [Solution Architecture](../Solution%20Architecture.md) · [ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md) · [ADR-0027](./ADR-0027-java-21-spring-boot-4-gradle.md)

---

## 1. Context and Problem Statement

[`ADR-0002`](./ADR-0002-modular-monolith-deployment-unit.md) settles *what* is deployed — a single Spring Boot application containing thirteen Modulith modules. It closes with an explicit gap:

> *"Deployment topology, containerisation, and CI provider remain undecided; SRS §1.2 explicitly leaves them open and no record covers them yet."*

That gap is now blocking. `example-folder-structure.md` reserves `01-system/Deployment Diagram.md`, and a deployment diagram cannot be drawn without a topology. More concretely, four decisions already made are sized against a runtime nobody has specified: [`ADR-0015`](./ADR-0015-redis-cache-and-rate-limiting.md) assumes Redis is reachable with sub-millisecond latency, [`ADR-0012`](./ADR-0012-transactional-outbox-and-kafka.md) assumes an operable Kafka cluster, [`ADR-0014`](./ADR-0014-elasticsearch-search-read-model.md) assumes an Elasticsearch tier that scales independently of the application, and [`ADR-0013`](./ADR-0013-mongodb-scoped-to-read-models.md) adds a fifth data service. The platform therefore needs **five stateful services plus an application and a web tier** running somewhere, and no document says where.

SRS §1.2 places deployment outside business-analysis scope, so there is no upstream answer to defer to. This record makes the decision for the first time and is therefore `Proposed`, per [ADR/README](./README.md) §2.

The question is: **what is the least operational surface that runs seven services and still leaves `CON-08`'s door open?**

## 2. Decision Drivers

- `CON-09` fixes the platform as a modular monolith in this release, so the topology needs to run **one** application artefact well, not orchestrate twelve.
- `CON-08` requires the architecture to support gradual migration toward distributed services without mandating it now — so the topology must not make that migration harder.
- The scale is concrete and modest (SRS §6): ≥ 10,000 products, ≥ 100,000 customers, **thousands of orders per day** (`NFR-SCAL-03`), thousands of concurrent customers, and 10× median throughput at peak (`NFR-SCAL-06`, assumption **[A-04]**).
- `NFR-AVAIL-01` targets 99.9% monthly on the purchase path — but rests on assumption **[A-12]**, unconfirmed by the Product Owner.
- `NFR-MAINT-05` — the platform's structure must be maintainable and reproducible, which at the deployment layer means an environment that can be recreated from a file rather than from a runbook.
- `NFR-OBS-03` and `NFR-OBS-04` — traces and metrics must be available without code change, which constrains how processes are packaged and how their output is collected.
- The team already carries PostgreSQL, Redis, Kafka, Elasticsearch, and MongoDB. [`ADR-0012`](./ADR-0012-transactional-outbox-and-kafka.md) §5 already names Kafka alone as *"significant operational surface."* Every unit of platform complexity added on top of that is spent, not free.

## 3. Considered Options

**Option 1 — Docker Compose on two VMs: `app-01` (nginx, `ecp-web`, `ecp-api`) and `data-01` (the five stateful services).** *(chosen)*

- **Pros:** Environments are declared in a file and reproducible from it, satisfying `NFR-MAINT-05` at the deployment layer. Images are identical across dev, staging, and production, so a version-dependent defect reproduces locally rather than in staging. The split lets the application tier scale by adding replicas and the data tier scale by growing the machine, and it means an application redeploy never restarts a database. Containerisation is the prerequisite for every richer topology, so choosing it now makes Option 2 a re-provisioning exercise later rather than a rewrite. Operational surface is close to the floor for seven services: two hosts, two Compose files, one ingress.
- **Cons:** No structural redundancy. `data-01` is a single failure domain, so `NFR-AVAIL-01` is met operationally — by backup, monitoring, and tested restores — rather than architecturally. Scaling is vertical first, and `NFR-SCAL-06`'s ceiling is a machine size. Running `ecp-api` at `N > 1` introduces a scheduled-work contention problem that does not exist at `N = 1`. Compose has no scheduler, no rolling-deploy primitive, and no self-healing beyond container restart policies.

**Option 2 — Kubernetes, cloud-agnostic.**

- **Pros:** The genuine answer to both weak points above. Horizontal autoscaling addresses `NFR-SCAL-06` elastically rather than up to a machine ceiling; multi-node scheduling and readiness-gated rolling deploys address `NFR-AVAIL-01` structurally rather than operationally. Leader election for scheduled work is a solved primitive. Stateful services run as operator-managed clusters with real replication.
- **Cons:** Disproportionate to the problem. It adds a control plane, ingress controllers, operators for five data services, and a manifest-management tool to a team already told that Kafka alone is significant operational surface — in order to elastically scale a platform sized at **thousands of orders per day**. `CON-09` also means there is exactly one application workload to schedule, so most of what an orchestrator provides has nothing to orchestrate. Rejected as premature, not as wrong: §5 names the evidence that would reverse this.

**Option 3 — Direct installation on VMs, no containers.**

- **Pros:** Fewest moving parts. No image build, no registry, no container runtime. Familiar to any operator.
- **Cons:** The environment becomes a runbook rather than a file, which is what `NFR-MAINT-05` exists to prevent — dev, staging, and production drift, and "works on staging" stops being evidence. Five stateful services at pinned versions must be installed and upgraded by hand on every host. Worst, it forecloses the cheap path to Option 2: migrating from hand-installed services to an orchestrator is a rebuild, whereas migrating from containers is a re-provision. Rejected.

**Option 4 — Managed PaaS / cloud-native services (application platform + managed PostgreSQL, Redis, Kafka, Elasticsearch, MongoDB).**

- **Pros:** Operationally the lightest of all — no VM, no patching, no backup scripting, and every data service gets replication and point-in-time recovery as a product feature. Would satisfy `NFR-AVAIL-01` structurally with the least work.
- **Cons:** Pins the architecture to one cloud vendor that no upstream document has chosen, and SRS §1.2 gives no mandate to choose one. Managed Kafka and managed Elasticsearch in particular carry pricing that is disproportionate at this scale. It also weakens local development: the closer production gets to vendor-specific managed services, the less a developer's stack resembles it. Rejected for now, and explicitly the right answer if the platform is later committed to a specific cloud.

## 4. Decision Outcome

**Chosen: Option 1.** Two virtual machines, each running a Docker Compose project.

```nano
  VM  app-01   (networks: edge, app)
  ├── nginx            TLS termination · reverse proxy · static · rate-limit backstop
  ├── ecp-web   {1..N} Next.js standalone
  └── ecp-api   {1..N} ecp-app.jar — 13 Modulith modules + in-process outbox relay

  VM  data-01  (network: data — not routable from the public internet)
  ├── postgres         transactional source of truth + outbox table
  ├── redis            cache-aside · hot data · rate limit · flash-sale pre-filter
  ├── kafka (KRaft)    event backbone
  ├── elasticsearch    Catalog search read model
  └── mongodb          reporting · flexible read models

  External             Payment Gateway · Shipping Carrier · Email Service Provider
```

Three commitments make the choice mean something:

- **PostgreSQL and the outbox table are the same instance.** Not a deployment convenience — [`ADR-0012`](./ADR-0012-transactional-outbox-and-kafka.md)'s whole guarantee is that the outbox insert is part of the business transaction. Splitting them would silently break `NFR-REL-05`.
- **`ecp-api` holds no state.** Session state is a server-side refresh token plus an httpOnly cookie ([ADR-0016](./ADR-0016-jwt-refresh-rotation-rbac.md), [ADR-0025](./ADR-0025-httponly-cookie-session.md)); hot data is in Redis. So `nginx` needs no sticky sessions and replacing a container is routine.
- **Images are tagged with the build's commit SHA and are identical across environments.** Only the injected configuration differs. An image promoted from staging to production is byte-identical.

**Explicitly not decided here:** the CI provider, the image registry, and the cloud or datacentre hosting the two VMs. None is an architecture decision, and this topology is compatible with any choice of each. `CON-08` remains open: containerised workloads with enforced module boundaries are the cheapest possible starting point for both Option 2 and eventual module extraction.

The concrete node inventory, networks, ports, volumes, and operational procedures are in [`Deployment Diagram.md`](../Deployment%20Diagram.md).

## 5. Consequences

### Positive

- `NFR-MAINT-05` holds at the deployment layer: the environment is a file, and dev, staging, and production run the same images.
- `CON-06` ("transactional and analytical workloads do not compete for the same resources") holds at the process level rather than only logically — reporting queries reach MongoDB, a separate service from PostgreSQL.
- `NFR-AVAIL-02` is helped: Elasticsearch, MongoDB, and the reporting read model are separate containers, so each can fail without touching browse, cart, checkout, or payment.
- `NFR-OBS-03` and `NFR-OBS-04` are cheap: structured logs to stdout per container, and Actuator/Micrometer on a management port.
- Every richer topology stays close. Option 2 becomes a re-provisioning exercise against images that already exist.

### Negative

- **`data-01` is a single failure domain.** Losing the VM loses all five data services at once, and recovery time is restore time. `NFR-AVAIL-01`'s 99.9% (≈ 43 minutes monthly) is therefore an operational commitment backed by tested restores, not a structural property. Redis, Elasticsearch, and MongoDB hold only derived state and are replayable from Kafka ([ADR-0008](./ADR-0008-cqrs-command-query-separation.md)); PostgreSQL is the one that must actually be recoverable.
- **Scaling is vertical first and capped by one machine.** `NFR-SCAL-06`'s 10× peak is absorbed by Redis, Elasticsearch, and `N` application replicas — but `N` is bounded by `app-01`'s cores, and write capacity is bounded by `data-01`. This must be validated by a peak-load test against this topology before `NFR-SCAL-06` is claimed.
- **Scheduled work contends at `N > 1`.** The Scheduler actor (Solution Architecture §4) drives cart expiry, flash-sale start and end, and promotion expiry; the in-process outbox relay has the same property. Each must fire once, not once per replica. Two mitigations exist — a dedicated `scheduler` profile on exactly one container, or a database-backed lock — and neither is chosen here; `Backend Architecture.md` decides. Until then, `N > 1` is unsafe for time-based behaviour.
- **A single application host makes deployment user-visible at `N = 1`.** Rolling restarts require `N > 1`, which requires the previous point resolved first. These two constraints are coupled, and it is worth stating that they must be lifted together.
- **`NFR-AVAIL-02` is still not process isolation.** All thirteen modules share one JVM, so a memory leak in Reporting can take down checkout — [`ADR-0002`](./ADR-0002-modular-monolith-deployment-unit.md) §5's concession is unchanged by this record. Containerising the data tier isolates data-tier failures only.
- **Compose provides no orchestration.** No scheduler, no leader election, no self-healing beyond restart policies, no rolling-deploy primitive. Each is a script or a manual procedure, and each is a small ongoing cost that Option 2 would absorb.

### Neutral / follow-on

- The relay-implementation choice ([ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md) §5) and the scheduler-contention mitigation are both deferred to `Backend Architecture.md`. This record only fixes where they run.
- CI provider, image registry, and hosting location remain open, as does the question of whether `NFR-AVAIL-01`'s assumption **[A-12]** becomes a ratified commitment. If it does, Option 2 should be revisited immediately — the reason for rejecting it was proportionality, and a ratified availability target changes what is proportionate.
- Container image hardening, base-image patch cadence, and network-level access to `data-01` are security-operational concerns no record covers yet.

## 6. Related Decisions

[ADR-0002](./ADR-0002-modular-monolith-deployment-unit.md) · [ADR-0012](./ADR-0012-transactional-outbox-and-kafka.md) · [ADR-0015](./ADR-0015-redis-cache-and-rate-limiting.md) · [ADR-0018](./ADR-0018-architecture-governance-ci-gate.md) · [ADR-0027](./ADR-0027-java-21-spring-boot-4-gradle.md)
