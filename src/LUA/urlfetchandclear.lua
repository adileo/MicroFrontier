local backendQueue = KEYS[1]
local hostnameCounter = KEYS[2]
local heap = KEYS[3]

local hostname = ARGV[1]

local popped = redis.call('RPOP', backendQueue);

if popped then
    local newCount = redis.call('ZINCRBY', hostnameCounter, -1, hostname);
    if tonumber(newCount) <= 0 then
        redis.call('ZREM', hostnameCounter, hostname);
        redis.call('ZREM', heap, hostname);
    end;
else
    redis.call('ZREM', hostnameCounter, hostname);
    redis.call('ZREM', heap, hostname);
end;

return popped;