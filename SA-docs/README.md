# Solution Architecture

- [`SOLUTION-ARCHITECTURE.md`](./SOLUTION-ARCHITECTURE.md) — maps each business problem from [Business Problem Analysis](../BA-docs/BUSINESS-PROBLEM-ANALYSIS.md) to the architecture decision and technology that addresses it.

# Tech stack

- Spring Framework/Spring Boot
- Clean Architecture
- Domain-Driven Design (Strategy Design/Tactical Design)
- Spring Modulith
- CQRS - Command Query Responsibility Segregation.
- Redis
- ArchUnit
- Lombok
- MapStruct
- JMolecules
- MongoDB/PostgreSQL (Using both of Spring Data JPA and Spring Data JDBC)
- ElasticSearch
- Event-Driven Architecture
- Trasactional Outbox pattern
- Database Indexing
- Expand Annotation's name meeting context's demand (Avoid using only @Service, @Repository as simple WebMVC which is not flexible for review code).
- Apache Kafka
- Benchmark performance
