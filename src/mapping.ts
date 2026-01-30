import type { Telemetry, TelemetryMapping } from './types'

type PathSegment = { type: 'key'; key: string } | { type: 'index'; index: number }

const splitPath = (path: string): string[] => {
    const segments: string[] = []
    let current = ''
    let inBracket = false

    for (const char of path) {
        if (char === '.' && !inBracket) {
            if (current.length > 0) {
                segments.push(current)
                current = ''
            }
            continue
        }
        if (char === '[' && !inBracket) {
            if (current.length > 0) {
                segments.push(current)
                current = ''
            }
            inBracket = true
            current += char
            continue
        }
        if (char === ']' && inBracket) {
            current += char
            inBracket = false
            segments.push(current)
            current = ''
            continue
        }
        current += char
    }

    if (current.length > 0) {
        segments.push(current)
    }

    return segments
}

const parsePathSegment = (segment: string): PathSegment => {
    if (segment.startsWith('[') && segment.endsWith(']')) {
        const inner = segment.slice(1, -1)
        if (/^\d+$/.test(inner)) {
            return { type: 'index', index: Number(inner) }
        }
        return { type: 'key', key: inner }
    }
    return { type: 'key', key: segment }
}

const getByPath = (input: unknown, path: string): unknown => {
    if (!input || typeof input !== 'object') {
        return undefined
    }
    const segments = splitPath(path).map(parsePathSegment)
    let current: unknown = input
    for (const segment of segments) {
        if (segment.type === 'index') {
            if (!Array.isArray(current)) {
                return undefined
            }
            current = current[segment.index]
            continue
        }
        if (!current || typeof current !== 'object') {
            return undefined
        }
        current = (current as Record<string, unknown>)[segment.key]
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
