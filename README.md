# MicroFrontier &middot; [![npm](https://img.shields.io/npm/dm/microfrontier.svg?style=flat-square)](https://npm-stat.com/charts.html?package=microfrontier) [![npm version](https://img.shields.io/npm/v/microfrontier.svg?style=flat-square)](https://www.npmjs.com/package/microfrontier) ![Docker Pulls](https://img.shields.io/docker/pulls/adileo/microfrontier?style=flat-square) ![Docker Image Size (tag)](https://img.shields.io/docker/image-size/adileo/microfrontier/latest?style=flat-square) [![License: GPL v3](https://img.shields.io/badge/License-GPLv3-blue.svg?style=flat-square)](https://www.gnu.org/licenses/gpl-3.0)



A web crawler frontier implementation in TypeScript backed by Redis.
MicroFrontier is a scalable and distributed frontier implemented through Redis Queues.

- [x] Fast Ingestion & High throughput
- [x] Easy to use HTTP Microservice or Javascript Client
- [x] Multiple configurable priority queues
- [x] Customizable stochastic function for priority queue picking
- [x] Politeness Policy: Per-Hostname crawl rate limit or default fallback delay
- [x] Multi-processing & concurrency support
- [ ] Prioritization Strategy: Breadth-first Crawl, Depth-first crawl, PageRank etc... - TODO
- [ ] URL Re-visit policy - TODO
- [ ] URL canonicalization and Bloom filtering - TODO
- [ ] URL Selection Policy - TODO

<br>

MicroFrontier is inspired by the Mercator Frontier<sup>[1](#footnote1)</sup>

![Queue](./docs/images/queue.png)

## Why you need MicroFrontier?

The frontier essentially answer a simple question: "What URL should i crawl next?".
This seems a simple problem until you realize that you have to consider a lot of factors:

- That multiple crawlers should be able to work concurrently without overlapping
- You have to be polite with websites (DDoSing a website isn't fun)
- You have to visit a web page just once, or once in a while
- Some pages are more important than others to be crawled early on while others are just spider traps

Since I couldn't find a lightweight frontier implementation with the technologies I love the most, I made MicroFrontier, hoping that could help researchers.


## Usage

MicroFrontier can be used both as a Javascript library SDK, from the command line or with a Docker instance working as a microservice.

### Command line usage
Install microfrontier with:
```
npm i -g microfrontier
```
Run microfrontier
```bash
microfrontier --host localhost --port 8090 --redis:host localhost --redis:port 6379
#see configuration section below for additional parameters
```


### As a javascript library

```bash
npm i microfrontier

# or

yarn add microfrontier
```
See below the examples for using the Javascript Client.

### Docker
```
docker pull adileo/microfrontier
```
You can configure the docker instance with the environment variables described below.

## Configuration

| ENV VAR  | CLI PARAMS | Description |
| ------------- | --- |------------- |
| host  | --host | Host name to start the microservice http server. <br>Default value: `127.0.0.1`  
| port  | --port| Port to start the microservice http server.<br> Default value: `8090`   |
| redis_host | --redis:host | Redis server host.<br> Default value: `127.0.0.1`   |
| redis_port | --redis:port | Redis server port.<br> Default value: `6379`   |
| redis_* | --redis:* | Parameters are interpreted by `nconf` and passed to `ioredis` as the client config.  
| config_frontierName | --config:frontierName | Prefix used for Redis keys.  |
| config_* | --config:* | Parameters are interpreted by `nconf`, you can find an example of default values below.  |

```typescript
{
    frontierName: 'frontier', // Example ENV: config_frontierName=frontier
    priorities: { // Example ENV: config_priorities={"high":{"probability":0.6},...}
        'high':     {probability: 0.6},
        'normal':   {probability: 0.3},
        'low':      {probability: 0.1},
    },
    defaultCrawlDelay: 1000 // Example ENV: config_defaultCrawlDelay=1000
}
```

# How to
## Adding an URL to the frontier
Via HTTP
```bash
curl --location --request POST 'http://127.0.0.1:8090/frontier' \
--header 'Content-Type: application/json' \
--data-raw '{
    "url": "http://www.example.com",
    "priority": "normal",
    "meta": {
        "foo": "bar"
    }
}'
```
Via SDK
```javascript
import { URLFrontier } from "microfrontier"

const frontier = new URLFrontier(config)

frontier.add("http://www.example.com", "normal", {"foo": "bar"}).then(() => {
    console.log('URL added')
})
```

## Getting an URL from the frontier
```bash
curl --location --request GET 'http://127.0.0.1:8090/frontier'
```
```javascript
import { URLFrontier } from "microfrontier"

const frontier = new URLFrontier(config)

frontier.get().then((item) => {
    // {url: "http://www.example.com", meta: {"foo":"bar"}}
})
```
## Scaling the frontend queue workers
TODO

<br>

# Citations

<a id="footnote1">[1]</a>: [High-Performance Web Crawling](http://www.cs.cornell.edu/courses/cs685/2002fa/mercator.pdf) - Marc Najork, Allan Heydon
