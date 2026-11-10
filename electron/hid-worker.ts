/// <reference types="node" />
import { parentPort, workerData } from 'node:worker_threads';
import { Gmk87HidDriver } from './hid-driver';

interface WorkerRequestMessage {
  id: number;
  method: string;
  args: any[];
}

const dataDir = typeof workerData?.dataDir === 'string' ? workerData.dataDir : undefined;

const driver = new Gmk87HidDriver(dataDir, (progress) => {
  parentPort?.postMessage({ type: 'progress', data: progress });
});

let queue: Promise<unknown> = Promise.resolve();

function enqueue<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.then(
    () => undefined,
    () => undefined
  );
  return next;
}

parentPort?.on('message', (msg: WorkerRequestMessage) => {
  if (!msg || typeof msg.id !== 'number') return;

  enqueue(async () => {
    switch (msg.method) {
      case 'checkAttached':
        return driver.checkAttached();
      case 'getSlotCacheCounts':
        return driver.getSlotCacheCounts();
      case 'getUploadProgress':
        return driver.getUploadProgress();
      case 'getStatus':
        return driver.getStatus(Boolean(msg.args[0]), Boolean(msg.args[1]));
      case 'writeConfigPatch':
        return driver.writeConfigPatch(msg.args[0] || {}, Boolean(msg.args[1]));
      case 'syncClockNow':
        return driver.syncClockNow();
      case 'uploadFrames':
        return driver.uploadFrames(msg.args[0]);
      case 'readViaKeymap':
        return driver.readViaKeymap();
      case 'setViaKeycode':
        return driver.setViaKeycode(msg.args[0], msg.args[1], msg.args[2], msg.args[3]);
      case 'batchSetViaKeycodes':
        return driver.batchSetViaKeycodes(msg.args[0]);
      case 'readViaMacros':
        return driver.readViaMacros();
      case 'writeViaMacros':
        return driver.writeViaMacros(msg.args[0]);
      case 'shutdown':
        driver.shutdown();
        return { ok: true };
      default:
        throw new Error(`Unknown HID worker method: ${msg.method}`);
    }
  })
    .then((result) => {
      parentPort?.postMessage({ id: msg.id, ok: true, result });
    })
    .catch((err: any) => {
      parentPort?.postMessage({
        id: msg.id,
        ok: false,
        error: err?.message || String(err || 'Worker call failed'),
      });
    });
});
