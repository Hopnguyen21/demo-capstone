# EF Core Code First for SmartFarm

Source of truth: Domain entities and Infrastructure Fluent API mappings. Use migrations to produce PostgreSQL schema; never generate entities by reverse engineering an existing database. Review the full ERD before the first migration.

## Project ownership

- `Domain`: entities, enum/value objects and invariants, with no EF attributes or EF reference.
- `Application`: use cases and repository abstractions.
- `Infrastructure/Persistence/SmartFarmDbContext.cs`: `DbSet` and EF configuration assembly; mappings live in `Configurations`; migrations live in `Migrations`.
- `Api`: registers DbContext and reads connection string from configuration.

## Migration commands (from `backend/`)

Install .NET 8 SDK and `dotnet-ef`; add compatible EF Core 8 packages (`Microsoft.EntityFrameworkCore.Design` to the startup project, `Microsoft.EntityFrameworkCore` and `Npgsql.EntityFrameworkCore.PostgreSQL` to Infrastructure). Record exact package versions in csproj and keep major versions aligned. Then:

```bash
dotnet ef migrations add InitialCreate \
  --project src/SmartFarm.Infrastructure \
  --startup-project src/SmartFarm.Api \
  --output-dir Persistence/Migrations

dotnet ef database update \
  --project src/SmartFarm.Infrastructure \
  --startup-project src/SmartFarm.Api
```

Run commands from the backend root. Use environment variables for production credentials. Review migration SQL before applying to shared or production databases. Add migrations for later schema changes; do not drop/recreate a database with user data.

## First schema slice

Implement Tenant, AppUser, Farm, Field, Zone and membership/access first. A Farmer belongs to exactly one Farm and can have access to multiple Zones inside that Farm. Add crop/profile/season, device/deployment and later flows through incremental migrations. Define FK and uniqueness constraints as well as service-level checks for race conditions.

For spatial polygons, add Npgsql spatial/NetTopologySuite and enable PostGIS only after confirming the database supports it. For TimescaleDB and pgvector, use extension-aware migrations only after extension availability is confirmed. A basic local PostgreSQL container does not automatically provide these extensions.
