
interface URLFrontierPriority{
    probability: number
}

export interface URLFrontierConfig{
    frontierName: string
    priorities: Record<string, URLFrontierPriority>,
    frontendPrioritizationStrategy?: (config: URLFrontierConfig)=>string,
    defaultCrawlDelay: number
}
