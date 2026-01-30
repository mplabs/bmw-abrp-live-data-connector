# AGENT.md — BMW → ABRP Live Connector

## 🧠 Project Overview

Du arbeitest an einem **Bun-basierten Live-Connector**, der:
- Echtzeit-Telemetrie von **BMW CarData Streaming (MQTT)** empfängt,
- Relevante Fahrzeugdaten extrahiert (mind. SoC, Ladezustand),
- Und diese an die **ABRP Telemetry API** (Iternio) sendet.

Der Agent wird genutzt, um **systematisch Code zu schreiben, zu testen, zu committen und zu dokumentieren**.

---

## 🎯 Primary Objectives

Ein Agent, der:
1. **Code schreibt, refactored, testet**, in TypeScript für Bun,
2. **API-Integration implementiert** (OAuth2 Device Code Flow, MQTT, HTTP Push),
3. **Regelmäßig Git commits & pushes** (work-in-progress),
4. **Eine PLAN.md führt und regelmäßig aktualisiert**,
5. **Dokumentation generiert** (z. B. README, FSD),
6. **Deployment-Artefakte erstellt** (env, systemd, Docker optional).

---

## 📌 Git Workflow Requirements

Der Agent **muss**:
- Alle Changes regelmäßig **committen** mit aussagekräftigen Commit-Messages,
- Klar zwischen **feature**, **bugfix**, **refactor**, **docs**, **test** commits unterscheiden,
- Commits *atomar* halten (nicht zu viele Logiken in einem Commit),
- Auf Branches arbeiten (z. B. `feat/auth`, `feat/mqtt`, `test/mapper`),
- Am Ende eines abgeschlossenen Arbeitspakets in den Hauptbranch **pushen**,
- Konflikte selbstständig erkennen und lösen, oder um Anleitung fragen, falls menschlicher Input nötig ist.

**Commit Message Guidelines**
- Prefix: `feat:`, `fix:`, `refactor:`, `docs:`, `test:`
- Kurzbeschreibung im Präsens
- Optional: Bezug auf Ticket/Issue in Repository (z. B. `feat: add BMW device code OAuth flow (#12)`)

---

## 🧾 PLAN.md — Purpose & Structure

Der Agent **muss** eine `PLAN.md` im Projekt-Root pflegen.  
Diese Datei beschreibt, was als Nächstes passiert, was erledigt ist, und wie der Stand ist.

`PLAN.md` **muss enthalten**:
1. **Project Summary:** kurze Zielbeschreibung.
2. **Milestones:** geordnete Liste mit Status (`Todo`, `In Progress`, `Done`).
3. **Tasks:** klare kleine Arbeitspakete mit:
   - Status
   - Owner (Agent)
   - Estimate (z. B. 1–3 Stunden)
4. **Decisions:** getroffene Architektur-/Design-Entscheidungen mit kurzer Begründung.
5. **Risks/Blockers:** Dinge, die Aufmerksamkeit brauchen oder externe Infos benötigen.

Der Agent **aktualisiert PLAN.md**:
- Vor jedem größeren Task-Start,
- Nach Abschluss eines Tasks,
- Bei jeder Änderung der Priorität/Scope.

Beispiel-Abschnitt:

```markdown
# PLAN.md — BMW → ABRP Live Connector

## Project Summary
MVP: Streaming SoC & charging status from BMW CarData via MQTT → push to ABRP Telemetry API.

## Milestones
- [x] Initial repo & config
- [ ] BMW OAuth Device Code Flow
- [ ] BMW MQTT connection
- [ ] Parsing & mapping of telemetry
- [ ] ABRP Telemetry posting
- [ ] Tests & CI
- [ ] Documentation

## Tasks
### BMW OAuth Device Code Flow
- **Status:** In Progress
- **Estimate:** 3h
- **Notes:** Building CLI setup helper.

## Decisions
- Use Bun for runtime
- Structured logging JSON

## Risks/Blockers
- Some BMW models vary in payload fields
```

---

## 🛠️ Supported Tasks

### 📦 Project Setup
- Initialize `bun install`
- Create directory layout (`src/`, `tests/`, `config/`)
- Sample config files

### 🔐 BMW Authentication
- Implement Device Code Flow
- Persist & refresh tokens
- Rotate MQTT credentials

### 📡 BMW MQTT Streaming
- Connect to broker with TLS
- Normalize incoming JSON
- Auto reconnect

### 🔁 Data Normalization
- JSON path mappings (configurable)
- Test coverage for mapping

### 🚀 ABRP Telemetry Push
- HTTP client
- Error handling
- Rate limiting

### 🧪 Testing
- Unit tests for modules
- Integration tests with mocks

### 🧾 Documentation
- README
- FSD
- API contracts
- Usage examples

### 🖥️ Deployment Helpers
- systemd unit
- sample env
- metrics/health endpoint

---

## 📊 Conventions & Best Practices

### 🧹 Code Style
- TypeScript + Bun
- Strict typing enabled
- Structured JSON logging

### 🛡️ Secrets Handling
- Tokens in `.env`, ignored in Git
- Redaction in logs

### 📄 Documentation
- Markdown for FSD, README, API specs
- Diagrams optional

---

## 👇 Do’s & Don’ts

✅ **Do**
- Commit early & often
- Write tests alongside code
- Update PLAN.md with every scope change

❌ **Don’t**
- Hardcode secrets
- Make giant commits
- Skip documentation

---

## 🤖 Agent Prompts & Commands

Der Agent soll folgende **operator prompts** erkennen und ausführen:

#### Code­-Generierung
```
agent: generate BMW MQTT connector module using Bun
```

#### Auth & Token
```
agent: implement device code flow and token store
```

#### API Integration
```
agent: write ABRP Telemetry poster with retries
```

#### Mapping Logic
```
agent: create parser + mapper from sample BMW JSON
```

#### Tests
```
agent: add unit tests for telemetry mapper
```

#### Docs
```
agent: update FSD, update README
```

#### Git
```
agent: commit current changes with proper message
agent: push branch “feat/mqtt”
agent: merge “feat/mqtt” into main
```

---

## 📌 Agent Failure Modes

Wenn der Agent nicht weiterkommt:
- Fehlende API-Info → Nachfrage stellen
- Merge Conflicts → Automatisch lösen oder um Anleitung fragen
- Fehlende Tests → Vorschlag zur Teststrategie machen

---

## 🚀 Final Goal

Ein reliabler Bun-Connector, der:
- Echtzeitdaten von BMW streamt,
- Saubere Telemetrie an ABRP liefert,
- Voll versioniert und dokumentiert ist,
- Und dessen Entwicklung **durch Git & PLAN.md transparent nachvollziehbar ist**.
