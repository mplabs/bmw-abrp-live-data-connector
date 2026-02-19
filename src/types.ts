export type Telemetry = {
    utc: number
    soc?: number
    is_charging?: boolean
    is_plugged_in?: boolean
    power?: number
    heading?: number
    lat?: number
    lon?: number
    elevation?: number
    speed?: number
    charging_power?: number
    remaining_charge_time?: number
    remaining_range?: number
    tire_pressure_fl?: number
    tire_pressure_fr?: number
    tire_pressure_rl?: number
    tire_pressure_rr?: number
}

export type TelemetryMapping = Record<string, string[]>

export type AbrpConfig = {
    apiKey: string
    userToken: string
}

export type BmwTokens = {
    access: string
    refresh: string
    id: string
}

export type BmwConfig = {
    clientId?: string
    username?: string
    topic: string
    deviceCodeEndpoint?: string
    tokenEndpoint?: string
    tokens: BmwTokens
}

export type BmwRestConfig = {
    enabled: boolean
    intervalSeconds: number
    baseUrl: string
    containerName?: string
    technicalDescriptors?: string[]
}

export type MqttConfig = {
    source?: 'bmw' | 'mirror'
    brokerUrl: string
    enabled?: boolean
    tls?: boolean
    clientId?: string
    keepaliveSeconds?: number
    username?: string
    password?: string
    topicPrefix?: string
}

export type AppConfig = {
    bmw: BmwConfig
    bmwRest: BmwRestConfig
    abrp: AbrpConfig
    mqtt: MqttConfig
    mapping: TelemetryMapping
    rateLimitSeconds?: number
    logLevel?: 'debug' | 'info' | 'warn' | 'error'
}
