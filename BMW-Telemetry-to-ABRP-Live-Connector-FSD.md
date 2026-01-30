# Functional Specification Document (FSD)  
## BMW → ABRP Live Connector  
**Runtime:** Bun (JavaScript/TypeScript)  
**Deployment:** Home Server or VPS  
**User Scope:** Single user / single vehicle (VIN)

---

## 1. Overview

### 1.1 Purpose  
Build a live connector that:  
- **Ingests real-time BMW charging and telematics data** via BMW CarData Streaming,  
- **Normalizes and forwards** it to the **ABRP (A Better Routeplanner) Telemetry API** so ABRP can reflect live SoC, charging status, and optionally position/speed.

### 1.2 Goals (MVP)  
- Minimum required fields: **State of Charge (SoC)**; include charging status, plugged-in status, charging power if available.  
- Optionally include GPS and speed for enhanced ABRP live tracking.  
- Provide an **initial setup CLI/UI** to complete BMW CarData device-code OAuth flow, fetch tokens, and persist them for continuous streaming.

---

## 2. External Interfaces

### 2.1 BMW CarData — Authentication & Streaming

**Authentication Flow:**  
- A **Device Code Flow** is used to generate BMW CarData API tokens including `access_token`, `refresh_token`, `id_token` (MQTT password), and `gcid` (MQTT username). These are required for streaming.  [oai_citation:1‡openHAB Community](https://community.openhab.org/t/connect-to-new-bmw-cardata-service-through-mqtt/166693?utm_source=chatgpt.com)

**MQTT Streaming:**  
- Use MQTT over TLS with `gcid` as username and `id_token` as password.  
- Subscribe to the topic namespace including the vehicle VIN (e.g., `{gcid}/{VIN}`).  
- Streaming provides real-time JSON event payloads based on what data points the user has selected in the CarData portal.  [oai_citation:2‡openHAB Community](https://community.openhab.org/t/connect-to-new-bmw-cardata-service-through-mqtt/166693?utm_source=chatgpt.com)

**BMW CarData Notes:**  
- Data availability, update frequency, and the exact field names vary by model and what has been configured in the BMW portal’s “Change data selection” section.  [oai_citation:3‡openHAB Community](https://community.openhab.org/t/connect-to-new-bmw-cardata-service-through-mqtt/166693?utm_source=chatgpt.com)

### 2.2 ABRP Telemetry API

- Endpoint for ingestion:  
  `POST https://api.iternio.com/1/tlm/send`  
- Authentication:  
  - Header `Authorization: APIKEY <ABRP_API_KEY>`  
  - Query param `token=<ABRP_USER_TOKEN>`  
- Minimum recommended fields include at least `utc`, `soc`, and `is_charging`. Additional fields enhance ABRP’s model (e.g., `lat`, `lon`, `speed`, `power`).  
- ABRP expects a JSON body with a `tlm` object containing these fields.

---

## 3. Requirements

### 3.1 Functional Requirements

#### BMW Integration

**FR-BMW-01 — Initial Setup / Auth:**  
- Provide a CLI/UX step to start the BMW Device Code Flow and guide the user through authorizing their ConnectedDrive account and selecting CarData & CarData Streaming scopes for the Client ID.

**FR-BMW-02 — Token Lifecycle:**  
- Persist `refresh_token`, `access_token`, `id_token`, and `gcid`.  
- Implement automatic refresh of tokens using `refresh_token` before expiry.  
- Detect if `id_token` rotates and reconnect MQTT accordingly.

**FR-BMW-03 — MQTT Streaming Connection:**  
- Connect to the BMW CarData MQTT broker with TLS.  
- Subscribe to relevant topics for the configured VIN.  
- Reconnect automatically on network fault or token refresh.

**FR-BMW-04 — Payload Handling:**  
- Parse incoming JSON streaming messages, extract relevant telemetry, gracefully handle missing fields, and normalize them.

---

### 3.2 Data Normalization / Mapping

Define a mapping configuration that translates BMW stream JSON paths to normalized telemetry fields.

| Normalized Field | Description | Notes |
|------------------|-------------|-------|
| `utc` | Unix timestamp of data event | Required for ABRP |
| `soc` | State of Charge (%) | Mandatory |
| `is_charging` | Charging active boolean | Recommended |
| `is_plugged_in` | Plugged-in state boolean | Optional |
| `power` | Power (kW) | Useful for ABRP live refinement |
| `lat`, `lon` | GPS coordinates | Optional |
| `speed` | Vehicle speed | Optional |
| `charging_power` | Charging-specific power | Optional |
| `remaining_charge_time` | Time left | Optional |

- Use JSONPath or equivalent for mapping.  
- Each normalized field may have multiple BMW candidate JSON paths, as stream payload structure varies by model and CarData configuration.

---

### 3.3 ABRP Telemetry Export

**FR-ABRP-01 — Telemetry Push:**  
- Prepare a `tlm` JSON body with at least required fields.  
- Respect ABRP documentation for required fields and formats.

**FR-ABRP-02 — Rate Limiting:**  
- Implement configurable push intervals or event triggers to avoid excessive API usage.

**FR-ABRP-03 — Response Handling:**  
- Log and handle ABRP API responses: success vs. errors. If ABRP returns field-missing errors, log them and continue with available data.

---

## 4. Token and MQTT Lifecycle

### Device Code Flow (One-time)
1. CLI triggers BMW Device Code OAuth endpoint with Client ID.
2. User authenticates via browser and enters user code.
3. Persist returned tokens: `access_token`, `refresh_token`, `id_token`, and `gcid`.  [oai_citation:4‡openHAB Community](https://community.openhab.org/t/connect-to-new-bmw-cardata-service-through-mqtt/166693?utm_source=chatgpt.com)

### MQTT Streaming
- Connect using TLS and subscribe to `{gcid}/{VIN}`.  
- Refresh tokens before expiry.  
- On refresh, if `id_token` changes, rotate MQTT credentials and reconnect.

---

## 5. Observability & Reliability

- Structured logs with redaction of secrets.
- Metrics: MQTT connection status, ABRP push success/failure, last received timestamp.
- Optional health HTTP endpoint for readiness/liveness.

---

## 6. Configuration Schema (YAML / JSON)

**Connector Config**
```yaml
bmw:
  clientId: "<BMW_CLIENT_ID>"
  tokens:
    access: "<BMW_ACCESS_TOKEN>"
    refresh: "<BMW_REFRESH_TOKEN>"
    id: "<BMW_ID_TOKEN>"
  vin: "<VEHICLE_VIN>"
abrp:
  apiKey: "<ABRP_API_KEY>"
  userToken: "<ABRP_USER_TOKEN>"
mqtt:
  brokerUrl: "<BROKER_HOST:PORT>"
  tls: true
mapping:
  soc: ["vehicle.powertrain.electric.battery.stateOfCharge.target"]
  is_charging: ["vehicle.drivetrain.electricEngine.charging.status"]
  lat: ["location.latitude"]
  lon: ["location.longitude"]
  speed: ["vehicle.speed"]
rateLimitSeconds: 10
```

---

## 7. Acceptance Criteria

- Successfully complete the BMW Device Code Flow and obtain tokens.  
- Connect and stream SoC + charging status for a supported BMW vehicle.  
- Push valid telemetry to ABRP with minimal required fields without manual retries.

---

## 8. Optional Enhancements

- REST fallback polling using BMW CarData API REST when stream doesn’t provide SoC in a timely fashion (respect API quotas).  
- Webhook or local dashboard UI.  
- Support for multiple vehicles.

---

## 9. Assumptions & Notes

- Users must enable both **CarData API** and **CarData Streaming** in the BMW portal, and select the required data points.  [oai_citation:5‡openHAB Community](https://community.openhab.org/t/connect-to-new-bmw-cardata-service-through-mqtt/166693?utm_source=chatgpt.com)
- Streaming payloads vary by vehicle; therefore configurable mapping is essential.

---

## 10. Risks & Considerations

- Some BMW models may not stream all desired fields (e.g., SoC sometimes only appears sporadically).  
- BMW API quotas may limit REST fallback frequency.

---

## Next Steps

Once approved, the next deliverables will include:  
1) A complete JSON Schema for config,  
2) Sequence diagrams for token, MQTT, and ABRP interaction,  
3) A starter Bun/TypeScript code outline for the connector.
