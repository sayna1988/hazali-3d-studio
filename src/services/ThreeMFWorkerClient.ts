import type { Parsed3MF } from "./ThreeMFParser";

type WorkerResponse =
  | { ok: true; result: Parsed3MF }
  | { ok: false; error: string };

export function parse3MFInWorker(file: File): Promise<Parsed3MF> {
  return new Promise((resolve, reject) => {
    const worker = new Worker(new URL("./ThreeMFParser.worker.ts", import.meta.url), { type: "module" });
    const cleanup = () => worker.terminate();

    worker.onmessage = (event: MessageEvent<WorkerResponse>) => {
      cleanup();
      if (event.data.ok) resolve(event.data.result);
      else reject(new Error(event.data.error));
    };
    worker.onerror = (event) => {
      cleanup();
      reject(new Error(event.message || "De 3MF-analyse is onverwacht gestopt."));
    };
    worker.postMessage(file);
  });
}
