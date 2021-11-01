local now = tonumber(ARGV[1]);
local nextCrawl = tonumber(ARGV[2]);
local crawlDelaySetName = ARGV[3];

local val = redis.call('ZRANGEBYSCORE', KEYS[1], '-inf', now, 'LIMIT', 0, 1);

if val[1] then 
    local crawlDelay = redis.call('HGET', crawlDelaySetName, val[1]);

    if crawlDelay then
        nextCrawl = now + tonumber(crawlDelay);
    end;
    
    redis.call('ZADD', KEYS[1], nextCrawl, val[1]); 
end; 

return val;