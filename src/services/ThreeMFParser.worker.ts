import { parse3MF } from "./ThreeMFParser";

self.onmessage = async (event: MessageEvent<File>) => {
  try {
    const result = await parse3MF(event.data);
    self.postMessage({ ok: true, result });
  } catch (error) {
    self.postMessage({
      ok: false,
      error: error instanceof Error ? error.message : "Het 3MF-bestand kon niet worden geanalyseerd."
    });
  }
};
