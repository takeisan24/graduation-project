import * as BullMQ from "bullmq";
import IORedis from "ioredis";

const connection = new IORedis(process.env.REDIS_URL!);
const { Queue, Worker } = BullMQ;
const QueueScheduler = (BullMQ as any).QueueScheduler;

export function createQueue(name: string) {
  if (QueueScheduler) {
    new QueueScheduler(name, { connection });
  } else {
    console.warn(`[queue] QueueScheduler not available for queue ${name}, continuing without scheduler.`);
  }
  return new Queue(name, { connection });
}

export function createWorker(name: string, processor: any, opts = {}) {
  return new Worker(name, processor, { connection, ...opts });
}
