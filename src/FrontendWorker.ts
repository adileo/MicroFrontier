import IORedis from "ioredis";
import { URLFrontier } from "./URLFrontier";
import { URLFrontierConfig } from "./URLFrontierConfig";


export class FrontendWorker {
    redisClient: IORedis.Redis
    config: URLFrontierConfig
    stopped: boolean 
    orderedPriority: {probability: number, name: string}[]

    constructor(configuration: {config: URLFrontierConfig, redisClient?: IORedis.Redis, redisOptions?: IORedis.RedisOptions}) {
        const {config, redisClient, redisOptions} = configuration
        if (!config)
            throw new Error("FrontendWorker needs a URLFrontier configuration to be started")
        if (!redisOptions && !redisClient || redisOptions && redisClient)
            throw new Error("FrontendWorker needs at most one of redisClient or redisOptions to connect to redis, not both or none.")

        this.config = config
        this.stopped = false;

        // Sort priorities to be used later
        this.orderedPriority = Object.keys(this.config.priorities).map((k) => {
            return {probability: this.config.priorities[k].probability, name: k}
        }).sort((a,b) => a.probability-b.probability)

        if (redisOptions)
            this.redisClient = new IORedis(redisOptions)

        if (redisClient)
            this.redisClient = redisClient
    }

    public start() {
        this.stopped = false;
        this.work();
    }

    public stop() {
        this.stopped = true;
    }

    private pickPriorityQueueByPrioritizationStrategy(): string {
        // Custom Strategy
        if(this.config.frontendPrioritizationStrategy)
        return this.config.frontendPrioritizationStrategy(this.config)

        // Default Strategy: Random Partition
        const rand = Math.random();
        var picked
        for(var op of this.orderedPriority){
            if(rand < op.probability){
                picked = op.name
                break;
            }
        }
        // Last element not covered by the for loop above
        if(!picked){
            picked = this.orderedPriority[this.orderedPriority.length-1].name
        }
       
        return picked
    }

    async workOnce(forcedPriority?: string) {
        const queue = forcedPriority ?
            URLFrontier.getFrontendQueueName(this.config, forcedPriority) :
            URLFrontier.getFrontendQueueName(this.config, this.pickPriorityQueueByPrioritizationStrategy());

        const poppedItem = await this.redisClient.rpop(queue);
        if (!poppedItem)
            return false

        const { url, meta } = JSON.parse(poppedItem);
        const parsedUrl = new URL(url);

        // Since ioredis-mock doesn't support multi() & transaction
        if(process.env.JEST_WORKER_ID === undefined){
            await this.redisClient.multi()
            .lpush(URLFrontier.getBackendQueueName(this.config, parsedUrl.hostname), JSON.stringify({ url, meta })) // add to the backend queue
            .zincrby(URLFrontier.getHostnameUrlCountName(this.config), 1, parsedUrl.hostname) // Increment by one the hostname urls
            .zadd(URLFrontier.getHeapName(this.config),'NX', new Date().getTime(), parsedUrl.hostname) // In case of new hostname in the frontier, add it to the heap
            .exec()
        }else{
            await this.redisClient.lpush(URLFrontier.getBackendQueueName(this.config, parsedUrl.hostname), JSON.stringify({ url, meta })) // add to the backend queue
            await this.redisClient.zincrby(URLFrontier.getHostnameUrlCountName(this.config), 1, parsedUrl.hostname) // Increment by one the hostname urls
            await this.redisClient.zadd(URLFrontier.getHeapName(this.config),'NX', new Date().getTime(), parsedUrl.hostname) // In case of new hostname in the frontier, add it to the heap
        }
        return true
    }

    private async work() {
        while (true && !this.stopped) {
            if (!await this.workOnce()) {
                // If nothing found slow down requests to avoid DDoSing Redis
                await new Promise((resolve, reject) => {
                    setTimeout(resolve, 100)
                })
            }
        }
    }
}