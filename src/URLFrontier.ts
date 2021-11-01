import IORedis from "ioredis";
import { URLFrontierConfig } from "./URLFrontierConfig";
import * as fs from 'fs'

export class URLFrontier {
    redisClient: IORedis.Redis;
    config: URLFrontierConfig;
    defaultConfig: URLFrontierConfig = {
        frontierName: 'frontier',
        priorities: {
            'high':     {probability: 0.6},
            'normal':   {probability: 0.3},
            'low':      {probability: 0.1},
        },
        defaultCrawlDelay: 1000
    }

    /**
     * @param  {Redis} redisClient - Your ioredis client
     * @param  {UrlFrontierConfig=defaultConfig} config - UrlFrontier configuration
     */
    constructor(configuration: {config?: URLFrontierConfig, redisClient?: IORedis.Redis, redisOptions?: IORedis.RedisOptions}) {
        const {config, redisClient, redisOptions} = configuration
        if (!redisOptions && !redisClient || redisOptions && redisClient)
            throw new Error("URLFrontier needs at most one of redisClient or redisOptions to connect to redis, not both or none.")

        this.config = {...this.defaultConfig, ...(config ? config : {})};

      
        if (redisOptions)
            this.redisClient = new IORedis(redisOptions)

        if (redisClient)
            this.redisClient = redisClient

        this.redisClient.defineCommand("zfetchpostpone", {
            numberOfKeys: 1,
            lua: fs.readFileSync(__dirname + '/LUA/zfetchpostpone.lua', 'utf8')
        }); 
        this.redisClient.defineCommand("urlfetchandclear", {
            numberOfKeys: 3,
            lua: fs.readFileSync(__dirname + '/LUA/urlfetchandclear.lua', 'utf8')
        }); 
    }
    
    /**
     * Add an URL to the frontier Front-end queue
     * @param  {string} url - URL to be added  
     * @param  {string} priority - Priority queue name
     */
    public async add(url: string, priority: string, meta?: any){
        // Check if priority queue exists
        if(!(priority in this.config.priorities))
        throw new Error('Wrong priority specified');

        // Push the url to the front-end queue
        const queueName = URLFrontier.getFrontendQueueName(this.config,priority)
        await this.redisClient.lpush(queueName, JSON.stringify({url, meta}))
    }

    /**
     * Set a hostname crawl delay
     * @param  {string} hostname - eg. www.google.com
     * @param  {number} delay - In milliseconds
     */
    public async setHostnameCrawlDelay(hostname: string, delay: number){
        return await this.redisClient.hset(URLFrontier.getHostnameCrawlDelayName(this.config), hostname, delay);
    }
    
    /**
     * Get redis key name for queue+priority
     * @param  {string} priority
     */
    static getFrontendQueueName(config: URLFrontierConfig, priority: string){
         // Check if priority queue exists
         if(!(priority in config.priorities))
         throw new Error('Wrong priority specified');
         return config.frontierName+':priority:'+priority
    }

    static getBackendQueueName(config: URLFrontierConfig, hostname: string){
        return config.frontierName+':'+hostname
    }

    static getHeapName(config: URLFrontierConfig){
        return config.frontierName+':heap'
    }

    static getHostnameUrlCountName(config: URLFrontierConfig){
        return config.frontierName+':hostnameUrls'
    }

    static getHostnameCrawlDelayName(config: URLFrontierConfig){
        return config.frontierName+':crawlDelays'
    }

    async get(){
        // Read from HEAP
        const now = new Date().getTime();
        const nextFallbackCrawlTime = now + this.config.defaultCrawlDelay;
        const heapName = URLFrontier.getHeapName(this.config)
        const hostnameCrawlDelayName = URLFrontier.getHostnameCrawlDelayName(this.config)
        const hostToBeFetched = await (this.redisClient as any).zfetchpostpone(heapName, now, nextFallbackCrawlTime, hostnameCrawlDelayName);

        // No hosts in the heap to be fetched right now
        if(!hostToBeFetched || hostToBeFetched.length == 0)
        return null

        const [host] = hostToBeFetched

        const backendQueue = URLFrontier.getBackendQueueName(this.config, host)
        const hostnameCounter = URLFrontier.getHostnameUrlCountName(this.config)
        const backPopped = await (this.redisClient as any).urlfetchandclear(backendQueue, hostnameCounter, heapName, host)
        if(!backPopped)
        return null

        const parsedUrl = JSON.parse(backPopped)
        return parsedUrl
    }

    async getHeap(cursor: number = 0){
        return await this.redisClient.zscan(URLFrontier.getHeapName(this.config), cursor);
    }

    async getHostnameUrlsCount(hostname: string){
        const n = await this.redisClient.zscore(URLFrontier.getHostnameUrlCountName(this.config), hostname);
        if(n){
            return parseInt(n)
        }else{
            return null
        }
    }

    async getBackend(hostname: string, cursor: number = 0, start:number = 0, stop:number = 100){
        return await this.redisClient.lrange(URLFrontier.getBackendQueueName(this.config, hostname), start, stop);
    }
}
