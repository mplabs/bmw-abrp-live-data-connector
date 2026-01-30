import { describe, expect, it, beforeEach, afterEach } from 'bun:test'
import { extractTelemetry } from '../src/mapping'
import type { TelemetryMapping } from '../src/types'

const baseMapping: TelemetryMapping = {
    soc: ['vehicle.soc', 'fallback.soc'],
    is_charging: ['vehicle.charging.status'],
    is_plugged_in: ['vehicle.charging.plugged'],
    lat: ['location.lat'],
    lon: ['location.lon'],
    speed: ['vehicle.speed'],
    power: ['vehicle.power'],
    charging_power: ['vehicle.charging.power'],
    remaining_charge_time: ['vehicle.charging.remaining'],
    utc: ['timestamps.utc'],
}

describe('extractTelemetry', () => {
    const realNow = Date.now

    beforeEach(() => {
        Date.now = () => 1_700_000_000_000
    })

    afterEach(() => {
        Date.now = realNow
    })

    it('maps numeric and boolean fields using configured paths', () => {
        const payload = {
            vehicle: {
                soc: 82.5,
                charging: {
                    status: 'charging',
                    plugged: 'yes',
                    power: '6.7',
                    remaining: 42,
                },
                speed: '88',
                power: 12.3,
            },
            location: { lat: 52.52, lon: 13.4 },
            timestamps: { utc: 1_699_999_999 },
        }

        const telemetry = extractTelemetry(payload, baseMapping)

        expect(telemetry).toEqual({
            utc: 1_699_999_999,
            soc: 82.5,
            is_charging: true,
            is_plugged_in: true,
            power: 12.3,
            lat: 52.52,
            lon: 13.4,
            speed: 88,
            charging_power: 6.7,
            remaining_charge_time: 42,
        })
    })

    it('falls back to secondary paths and default utc when missing', () => {
        const payload = {
            fallback: { soc: '64' },
            vehicle: {
                charging: {
                    status: 'idle',
                    plugged: 'no',
                },
            },
        }

        const telemetry = extractTelemetry(payload, baseMapping)

        expect(telemetry.utc).toBe(1_700_000_000)
        expect(telemetry.soc).toBe(64)
        expect(telemetry.is_charging).toBe(false)
        expect(telemetry.is_plugged_in).toBe(false)
    })

    it('supports array indices in path segments', () => {
        const mapping: TelemetryMapping = {
            soc: ['vehicles[1].soc'],
        }
        const payload = {
            vehicles: [{ soc: 10 }, { soc: 77 }],
        }

        const telemetry = extractTelemetry(payload, mapping)

        expect(telemetry.soc).toBe(77)
    })

    it('supports bracketed literal keys containing dots', () => {
        const mapping: TelemetryMapping = {
            soc: ['data[vehicle.powertrain.electric.battery.stateOfCharge.target].value'],
        }
        const payload = {
            data: {
                'vehicle.powertrain.electric.battery.stateOfCharge.target': {
                    value: 64,
                },
            },
        }

        const telemetry = extractTelemetry(payload, mapping)

        expect(telemetry.soc).toBe(64)
    })
})
