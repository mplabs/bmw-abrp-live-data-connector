import type { Telemetry, TelemetryMapping } from './types'

const parsePathSegment = (segment: string): { key: string; index?: number } => {
    const match = /^([^\[]+)(?:\[(\d+)\])?$/.exec(segment)
    if (!match) {
        return { key: segment }
    }
    const key = match[1]
    const index = match[2] ? Number(match[2]) : undefined
    return { key, index }
}

const getByPath = (input: unknown, path: string): unknown => {
    if (!input || typeof input !== 'object') {
        return undefined
    }
    const segments = path.split('.')
    let current: unknown = input
    for (const segment of segments) {
        if (!current || typeof current !== 'object') {
            return undefined
        }
        const { key, index } = parsePathSegment(segment)
        const value = (current as Record<string, unknown>)[key]
        if (typeof index === 'number') {
            if (!Array.isArray(value)) {
                return undefined
            }
            current = value[index]
            continue
        }
        current = value
    }
    return current
}

const toNumber = (value: unknown): number | undefined => {
    if (typeof value === 'number' && Number.isFinite(value)) {
        return value
    }
    if (typeof value === 'string') {
        const parsed = Number(value)
        return Number.isFinite(parsed) ? parsed : undefined
    }
    return undefined
}

const toBoolean = (value: unknown): boolean | undefined => {
    if (typeof value === 'boolean') {
        return value
    }
    if (typeof value === 'number') {
        return value !== 0
    }
    if (typeof value === 'string') {
        const normalized = value.trim().toLowerCase()
        if (['true', '1', 'yes', 'on', 'charging', 'plugged'].includes(normalized)) {
            return true
        }
        if (['false', '0', 'no', 'off', 'idle', 'unplugged'].includes(normalized)) {
            return false
        }
    }
    return undefined
}

const pickFirstValue = (payload: unknown, paths: string[] | undefined): unknown => {
    if (!paths || paths.length === 0) {
        return undefined
    }
    for (const path of paths) {
        const value = getByPath(payload, path)
        if (value !== undefined && value !== null) {
            return value
        }
    }
    return undefined
}

export const extractTelemetry = (payload: unknown, mapping: TelemetryMapping): Telemetry => {
    const nowUtc = Math.floor(Date.now() / 1000)

    const rawUtc = pickFirstValue(payload, mapping.utc)
    const utc = toNumber(rawUtc) ?? nowUtc

    const telemetry: Telemetry = { utc }

    const soc = toNumber(pickFirstValue(payload, mapping.soc))
    if (soc !== undefined) telemetry.soc = soc

    const isCharging = toBoolean(pickFirstValue(payload, mapping.is_charging))
    if (isCharging !== undefined) telemetry.is_charging = isCharging

    const isPlugged = toBoolean(pickFirstValue(payload, mapping.is_plugged_in))
    if (isPlugged !== undefined) telemetry.is_plugged_in = isPlugged

    const power = toNumber(pickFirstValue(payload, mapping.power))
    if (power !== undefined) telemetry.power = power

    const lat = toNumber(pickFirstValue(payload, mapping.lat))
    if (lat !== undefined) telemetry.lat = lat

    const lon = toNumber(pickFirstValue(payload, mapping.lon))
    if (lon !== undefined) telemetry.lon = lon

    const speed = toNumber(pickFirstValue(payload, mapping.speed))
    if (speed !== undefined) telemetry.speed = speed

    const chargingPower = toNumber(pickFirstValue(payload, mapping.charging_power))
    if (chargingPower !== undefined) telemetry.charging_power = chargingPower

    const remainingChargeTime = toNumber(pickFirstValue(payload, mapping.remaining_charge_time))
    if (remainingChargeTime !== undefined) telemetry.remaining_charge_time = remainingChargeTime

    return telemetry
}
