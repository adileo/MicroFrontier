
import { URLFrontier } from '../src/URLFrontier';
import Redis from 'ioredis-mock';
import * as IORedis from 'ioredis';
import { FrontendWorker } from '../src/FrontendWorker';
import MockDate from 'mockdate'


test('Frontier - URL Insertion, frontend only', async () => {
    const redisClient = new Redis() as unknown as IORedis.Redis;
    const frontier = new URLFrontier({redisClient});
    const addUrl = 'https://test.com/this/is/a/page';
    frontier.add(addUrl, 'normal')
    const popped = await redisClient.rpop(URLFrontier.getFrontendQueueName(frontier.config,'normal'));
    expect(addUrl).toBe(JSON.parse(popped).url);
});

test('Frontier - URL Insertion, frontend + backend', async () => {
    const redisClient = new Redis() as unknown as IORedis.Redis;
    const frontier = new URLFrontier({redisClient});
    const addUrl = 'https://test.com/this/is/a/page';
    frontier.add(addUrl, 'normal')

    const worker = new FrontendWorker({config: frontier.config, redisClient});
    await worker.workOnce('normal');

    const popped = await redisClient.rpop(URLFrontier.getBackendQueueName(frontier.config,'test.com'));
    
    expect(addUrl).toBe(JSON.parse(popped).url);
})

test('Frontier - URL Insertion, frontend, backend, heap & counters', async () => {
    MockDate.set(new Date(1466424490000))

    const redisClient = new Redis() as unknown as IORedis.Redis;
    const frontier = new URLFrontier({redisClient});
    
    const agreedDelay = 500
    await frontier.add('https://test.com/this/is/a/page', 'normal')
    await frontier.add('https://test.com/this/is/a/page2', 'normal')
    await frontier.setHostnameCrawlDelay('test.com', agreedDelay);

    const worker = new FrontendWorker({config: frontier.config, redisClient});
    await worker.workOnce('normal');
    await worker.workOnce('normal');

    expect(await frontier.getHeap()).toMatchObject(['0', ['test.com', '1466424490000']])
    expect((await frontier.getBackend('test.com')).length).toBe(2);
    expect(await frontier.getHostnameUrlsCount('test.com')).toBe(2);

    // FETCH the first item
    const item = await frontier.get();
    expect(item).toMatchObject({url: 'https://test.com/this/is/a/page'});
    expect(await frontier.getHostnameUrlsCount('test.com')).toBe(1);
    expect(await frontier.getHeap()).toMatchObject(['0', ['test.com', '1466424490500']])
    
    // Second Item is null since the frontier has postponed the next crawl of the same host
    const item2 = await frontier.get();
    expect(item2).toBeNull();

    // Test a new item before the next delayed hostname
    MockDate.set(new Date(1466424490000 + 10))
    await frontier.add('https://sub.test2.com/this/is/a/page3', 'normal', {test: 'hello'})
    await worker.workOnce('normal');
    const item3 = await frontier.get();
    expect(item3).toMatchObject({url: 'https://sub.test2.com/this/is/a/page3', meta: {test: 'hello'}});

    expect(await frontier.getHeap()).toMatchObject(['0', ['test.com', '1466424490500']])

    // Shift time ahead in order to fetch the delayed hostname
    MockDate.set(new Date(1466424490000 + frontier.config.defaultCrawlDelay + 1))
    const item4 = await frontier.get();
    expect(item4).toMatchObject({url: 'https://test.com/this/is/a/page2'});


    // Check Frontier Cleanup
    expect(await frontier.getHeap()).toMatchObject(['0', []])
    expect(await frontier.getHostnameUrlsCount('test.com')).toBeNull()
    expect(await frontier.getBackend('test.com')).toMatchObject([])
    expect(await frontier.getBackend('sub.test2.com')).toMatchObject([])
})



