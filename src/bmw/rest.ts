import { logger } from '../logger'
import { BMW_REST_BASE_URL } from './rest-config'
import type { BmwConfig, BmwRestConfig } from '../types'

const BMW_API_VERSION = 'v1'
export { BMW_REST_BASE_URL }
const DEFAULT_CONTAINER_NAME = 'abrp-live-connector'
const DEFAULT_CONTAINER_PURPOSE = 'abrp'

type TelematicDataEntry = {
    value?: string
    unit?: string
    timestamp?: string
}

type TelematicDataResponse = {
    telematicData?: Record<string, TelematicDataEntry>
}

type ContainerSummary = {
    containerId?: string
    name?: string
    state?: string
}

type ContainerListResponse = {
    containers?: ContainerSummary[]
}

type ContainerDetails = {
    containerId?: string
}

const buildHeaders = (bmw: BmwConfig): Record<string, string> => ({
    Authorization: `Bearer ${bmw.tokens.access}`,
    'x-version': BMW_API_VERSION,
})

const requestJson = async (
    baseUrl: string,
    path: string,
    options: RequestInit,
): Promise<{ status: number; data: unknown }> => {
    const url = new URL(path, baseUrl)
    const response = await fetch(url, options)
    const status = response.status
    if (!response.ok) {
        const text = await response.text()
        const error = new Error(`BMW REST request failed (${status}): ${text}`) as Error & {
            status?: number
        }
        error.status = status
        throw error
    }
    const data = (await response.json()) as unknown
    return { status, data }
}

const listContainers = async (config: BmwRestConfig, bmw: BmwConfig) => {
    const { data } = await requestJson(
        config.baseUrl,
        '/customers/containers',
        {
            method: 'GET',
            headers: buildHeaders(bmw),
        },
    )
    return data as ContainerListResponse
}

const createContainer = async (
    config: BmwRestConfig,
    bmw: BmwConfig,
    name: string,
    technicalDescriptors: string[],
) => {
    const { data } = await requestJson(
        config.baseUrl,
        '/customers/containers',
        {
            method: 'POST',
            headers: {
                ...buildHeaders(bmw),
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                purpose: DEFAULT_CONTAINER_PURPOSE,
                technicalDescriptors,
            }),
        },
    )
    return data as ContainerDetails
}

export const resolveContainerId = async (
    config: BmwRestConfig,
    bmw: BmwConfig,
): Promise<string> => {
    const containerName = config.containerName ?? DEFAULT_CONTAINER_NAME
    const list = await listContainers(config, bmw)
    const match = list.containers?.find(
        (container) =>
            container?.name === containerName && container?.state === 'ACTIVE',
    )
    if (match?.containerId) {
        return match.containerId
    }

    const descriptors = config.technicalDescriptors ?? []
    if (descriptors.length === 0) {
        throw new Error(
            'BMW REST container not found and no technicalDescriptors were provided.',
        )
    }

    logger.info('Creating BMW REST container', { name: containerName })
    const created = await createContainer(config, bmw, containerName, descriptors)
    if (!created.containerId) {
        throw new Error('BMW REST container creation succeeded but no containerId returned.')
    }
    return created.containerId
}

export const fetchTelematicData = async (
    config: BmwRestConfig,
    bmw: BmwConfig,
    vin: string,
    containerId: string,
): Promise<{ data: Record<string, TelematicDataEntry> }> => {
    const path = `/customers/vehicles/${encodeURIComponent(vin)}/telematicData`
    const url = new URL(path, config.baseUrl)
    url.searchParams.set('containerId', containerId)

    const { data } = await requestJson(
        config.baseUrl,
        `${url.pathname}?${url.searchParams.toString()}`,
        {
            method: 'GET',
            headers: buildHeaders(bmw),
        },
    )

    const payload = data as TelematicDataResponse
    if (!payload.telematicData || typeof payload.telematicData !== 'object') {
        logger.warn('BMW REST response missing telematicData')
        return { data: {} }
    }

    return { data: payload.telematicData }
}
