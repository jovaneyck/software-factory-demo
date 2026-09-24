# Backend Architecture - Component Diagrams

## Architecture primitives

* Repositories for data-access
* DDD aggregates for aggregate-level behavior
* Domain services for aggregate-spanning behavior
* Core (domain services+aggregates) gets unit tested using large-scale unit tests using in-memory adapters (repositories etc.)
* The adapters (e.g. routes) should be thin and contain no business logic.

## Component diagram

### Dogs

```mermaid
flowchart TD
    subgraph Dogs
        dogRoutes["dogRoutes<br/>GET/POST /dogs<br/>GET/DELETE /dogs/:id<br/>PUT/DELETE /dogs/:id/plan"]
        DogRepository["DogRepository<br/>interface"]
        FsDogRepository["FsDogRepository<br/>file-system impl"]
        FakeDogRepository["FakeDogRepository<br/>in-memory impl"]
    end

    subgraph Shared
        Dog["Dog<br/>id, name, picture, planId?"]
        validateUuid["validateUuid<br/>middleware"]
    end

    dogRoutes -->|uses| DogRepository
    dogRoutes -->|uses| validateUuid
    DogRepository -->|uses| Dog
    FsDogRepository -.->|implements| DogRepository
    FakeDogRepository -.->|implements| DogRepository
```

### Trainings

```mermaid
flowchart TD
    subgraph Trainings
        trainingRoutes["trainingRoutes<br/>GET/POST /trainings<br/>GET/PUT/DELETE /trainings/:id<br/>POST /trainings/:id/images"]
        TrainingRepository["TrainingRepository<br/>interface"]
        FsTrainingRepository["FsTrainingRepository<br/>file-system impl"]
        FakeTrainingRepository["FakeTrainingRepository<br/>in-memory impl"]
    end

    subgraph Shared
        Training["Training<br/>id, name, procedure, tips"]
        validateUuid["validateUuid<br/>middleware"]
    end

    trainingRoutes -->|uses| TrainingRepository
    trainingRoutes -->|uses| validateUuid
    TrainingRepository -->|uses| Training
    FsTrainingRepository -.->|implements| TrainingRepository
    FakeTrainingRepository -.->|implements| TrainingRepository
```

### Plans

```mermaid
flowchart TD
    subgraph Plans
        planRoutes["planRoutes<br/>GET/POST /plans<br/>GET/PUT/DELETE /plans/:id"]
        PlanRepository["PlanRepository<br/>interface"]
        FsPlanRepository["FsPlanRepository<br/>file-system impl"]
        FakePlanRepository["FakePlanRepository<br/>in-memory impl"]
    end

    subgraph Shared
        Plan["Plan<br/>id, name, schedule"]
        validateUuid["validateUuid<br/>middleware"]
    end

    planRoutes -->|uses| PlanRepository
    planRoutes -->|uses| validateUuid
    PlanRepository -->|uses| Plan
    FsPlanRepository -.->|implements| PlanRepository
    FakePlanRepository -.->|implements| PlanRepository
```

### Sessions

```mermaid
flowchart TD
    subgraph Sessions
        sessionRoutes["sessionRoutes<br/>GET/POST/PUT/DELETE<br/>/dogs/:dogId/sessions"]
        SessionListingService["SessionListingService<br/>merges schedule + sessions"]
        SessionRepository["SessionRepository<br/>interface"]
        FsSessionRepository["FsSessionRepository<br/>file-system impl"]
        FakeSessionRepository["FakeSessionRepository<br/>in-memory impl"]
        sessionCsv["sessionCsv<br/>recorded history to safe CSV"]
    end

    subgraph Shared
        Session["Session<br/>id, dogId, trainingId, date,<br/>status, planId?, score?, notes?"]
        Plan["Plan<br/>id, name, schedule"]
        validateUuid["validateUuid<br/>middleware"]
    end

    subgraph Dogs
        DogRepository["DogRepository<br/>interface"]
    end

    subgraph Plans
        PlanRepository["PlanRepository<br/>interface"]
    end

    sessionRoutes -->|uses| DogRepository
    sessionRoutes -->|uses| SessionRepository
    sessionRoutes -->|uses| SessionListingService
    sessionRoutes -->|uses| validateUuid
    sessionRoutes -->|uses| Session
    sessionRoutes -->|reads training names| TrainingRepository
    sessionRoutes -->|serializes export| sessionCsv
    sessionCsv -->|CSV escaping| PapaParse["Papa Parse"]
    SessionListingService -->|reads dogs| DogRepository
    SessionListingService -->|reads plans| PlanRepository
    SessionListingService -->|reads sessions| SessionRepository
    SessionListingService -->|uses| Plan
    SessionRepository -->|uses| Session
    FsSessionRepository -.->|implements| SessionRepository
    FakeSessionRepository -.->|implements| SessionRepository
```

`GET /api/dogs/:dogId/sessions/export.csv` downloads the selected dog's entire
recorded completed/skipped history, sorted by date and then session ID. It reads
the session repository directly, so it neither generates planned entries nor
inherits the progress graph's training/date filters. Unknown dogs return 404;
invalid UUIDs return 400; empty histories return a header-only CSV.

The UTF-8 BOM/CRLF CSV contains `date`, `dogName`, `dogId`, `trainingName`,
`trainingId`, `planId`, `sessionId`, `status`, `score`, and `notes`. Missing values
are empty cells; deleted training names are blank while their IDs are retained.
Names reflect current repository data, not historical snapshots. Papa Parse
quotes CSV delimiters and multiline text and prefixes formula-like text with an
apostrophe for spreadsheet safety.

The download action lives in `ProgressReport`, including its graph view, and is
available without an assigned plan. Download errors stay on the report and can
be retried. No persistence schema changes are required.
