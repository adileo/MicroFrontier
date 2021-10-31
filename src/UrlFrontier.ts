import { Redis } from "ioredis";

interface UrlFrontierPriority{
    probability: number
}

interface UrlFrontierConfig{
    frontierName: string
    priorities: Record<string, UrlFrontierPriority>
}

const defaultConfig: UrlFrontierConfig = {
    frontierName: 'frontier',
    priorities: {
        'high':     {probability: 0.6},
        'normal':   {probability: 0.3},
        'low':      {probability: 0.1},
    }
}
class UrlFrontier {
    redisClient: Redis;
    config: UrlFrontierConfig;
    constructor(redisClient: Redis, config: UrlFrontierConfig = defaultConfig) {
        this.config = config;
        this.redisClient = redisClient;
    }
    async add(url: string, priority: string){
        await this.redisClient.lpush(this.config.frontierName+':priority:'+priority, url)
    }
}