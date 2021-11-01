import { send, json } from 'micro'
import { router } from 'microrouter'
import * as MR from 'microrouter';
import { URLFrontier } from './URLFrontier'
import { EnvJsonParser } from 'env-json-parser';
import micro from 'micro';
import { Worker } from 'worker_threads'

const { get, post } = MR as any;

const envJsonParser = new EnvJsonParser('MF_');
const mfConfig = envJsonParser.get();

const frontier = new URLFrontier({
    config: mfConfig ? mfConfig.config : null,
    redisOptions: mfConfig ? mfConfig.redis : {}
});
var frontendWorkerPool

/*
 * Initialize frontend workers
 */
var frontendWorkers = []
const FEW = process.env.FRONTEND_WORKERS ? process.env.FRONTEND_WORKERS : 1
for(var i = 0; i < FEW ; i++){
    const worker = new Worker(__dirname + '/FrontendWorkerPool.js', {
        workerData: {
            config: frontier.config,
            redisOptions: mfConfig ? mfConfig.redis : {}
        }
    });
    frontendWorkers.push(worker);
}


const postFrontier = async (req, res) => {
    const body = await json(req)
    try {
        await frontier.add(body.url, body.priority, body.meta);
        send(res, 200, { status: 'OK' })
    } catch (e) {

        send(res, 500, { status: 'ERROR', error: e })
    }
}

const getFrontier = async (req, res) => {
    try {
        const data = await frontier.get()
        send(res, 200, { status: 'OK', data })
    } catch (e) {
        console.error(e)
        send(res, 500, { status: 'ERROR', error: e })
    }
}

const postFrontendWorkers = async (req, res) => {
    const body = await json(req)

    if(frontendWorkers.length > 0 || body.workers === 0){
        for(var wk of frontendWorkers){
            await wk.terminate();
        }
        frontendWorkers = []
    }

    for(var i = 0; i < body.workers; i++){
        const worker = new Worker(__dirname + '/FrontendWorkerPool.js', {
            workerData: {
                config: frontier.config,
                redisOptions: mfConfig ? mfConfig.redis : {}
            }
        });
        frontendWorkers.push(worker);
    }
    
    send(res, 200, { status: 'OK', activeWorkers: frontendWorkers.length })
}

const notfound = (req, res) => send(res, 404, 'Not found')


const server = micro(router(
    post('/frontier', postFrontier),
    get('/frontier', getFrontier),
    post('/frontend-workers', postFrontendWorkers),
    get('/*', notfound)
))

const PORT = process.env.PORT ? process.env.PORT : 8090
const HOST = process.env.HOST ? process.env.HOST : '127.0.0.1'
server.listen(PORT, HOST)
server.addListener('listening', () => {
    console.log(`Server Started on ${HOST}:${PORT}`)
})