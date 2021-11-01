
import { FrontendWorker } from './FrontendWorker';
import {
  Worker, isMainThread, parentPort, workerData
} from 'worker_threads';

const worker = new FrontendWorker(workerData);
worker.start();
