
interface URLFrontierPriority{
    probability: number
}

export interface URLFrontierConfig{
    frontierName: string
    priorities: Record<string, URLFrontierPriority>,
    frontendQueueWorkers: number,
    backendQueueWorkers: number,
    frontendPrioritizationStrategy?: (config: URLFrontierConfig)=>string,
    defaultCrawlDelay: number
}
