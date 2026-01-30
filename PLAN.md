# PLAN.md — BMW → ABRP Live Connector

## Project Summary
MVP: Stream BMW CarData MQTT telemetry, normalize to ABRP fields, and push to ABRP Telemetry API via Bun/TypeScript.

## Milestones
- [x] Project setup & skeleton
- [ ] BMW OAuth Device Code Flow
- [ ] BMW MQTT connection
- [ ] Parsing & mapping of telemetry
- [ ] ABRP Telemetry posting
- [ ] Tests & CI
- [ ] Documentation

## Tasks
### CI pipeline (GitHub Actions)
- **Status:** Done
- **Owner:** Agent
- **Estimate:** 0.5–1h
- **Notes:** Added CI workflow to install deps, run tests, and build on pushes to main.

### Release helper script
- **Status:** Done
- **Owner:** Agent
- **Estimate:** 0.5h
- **Notes:** Added script to tag releases based on package.json version (push optional).

### GitHub Release workflow
- **Status:** Done
- **Owner:** Agent
- **Estimate:** 0.5h
- **Notes:** Added workflow to auto-create GitHub Releases on v* tag pushes.

### Unit tests (mapping/config/rate limiter)
- **Status:** Done
- **Owner:** Agent
- **Estimate:** 1h
- **Notes:** Added Bun unit tests for telemetry mapping, config loading, rate limiting, ABRP client, and MQTT connect setup.

### Project setup & skeleton
- **Status:** Done
- **Owner:** Agent
- **Estimate:** 1–2h
- **Notes:** Bun/TS scaffolding, config loader, MQTT + ABRP client skeleton.

### BMW MQTT connection
- **Status:** In Progress
- **Owner:** Agent
- **Estimate:** 2–3h
- **Notes:** TLS connection, subscribe, reconnect behavior.

### Telemetry mapping
- **Status:** In Progress
- **Owner:** Agent
- **Estimate:** 1–2h
- **Notes:** JSON-path mapping and normalization.

### ABRP telemetry posting
- **Status:** In Progress
- **Owner:** Agent
- **Estimate:** 1–2h
- **Notes:** HTTP client, retries, error handling.

### BMW OAuth device code flow
- **Status:** In Progress
- **Owner:** Agent
- **Estimate:** 2–3h
- **Notes:** CLI for device code flow and token persistence.

## Decisions
- Use Bun + TypeScript for runtime.
- Structured JSON logging with secret redaction.
- Config file supports JSON/YAML.

## Risks/Blockers
- BMW stream payloads vary by model; mapping must be flexible.
- BMW device code and token endpoints need confirmation for the target tenant.
