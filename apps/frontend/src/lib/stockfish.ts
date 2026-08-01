/**
 * Thin wrapper around the Stockfish UCI engine, running entirely client-side
 * in a Web Worker (public/stockfish/stockfish.js — single-threaded "lite" NNUE
 * build, chosen specifically because it needs no SharedArrayBuffer / COOP-COEP
 * headers, so it works as a plain Worker with zero next.config changes).
 *
 * Bot games never touch Socket.IO, Redis, or the backend for move calculation —
 * this class is the entire "opponent".
 */
export class StockfishEngine {
  private worker: Worker | null = null;
  private readyPromise: Promise<void>;
  private resolveReady!: () => void;

  constructor() {
    this.readyPromise = new Promise((resolve) => {
      this.resolveReady = resolve;
    });
    if (typeof window !== 'undefined') {
      this.worker = new Worker('/stockfish/stockfish.js');
      this.worker.onmessage = (e: MessageEvent<string>) => {
        if (e.data === 'uciok') {
          this.worker?.postMessage('isready');
        } else if (e.data === 'readyok') {
          this.resolveReady();
        }
      };
      this.worker.postMessage('uci');
    }
  }

  private async ready() {
    await this.readyPromise;
  }

  async setElo(elo: number) {
    await this.ready();
    const clamped = Math.max(400, Math.min(3200, elo));
    this.worker?.postMessage('setoption name UCI_LimitStrength value true');
    this.worker?.postMessage(`setoption name UCI_Elo value ${clamped}`);
  }

  async newGame() {
    await this.ready();
    this.worker?.postMessage('ucinewgame');
  }

  async getBestMove(fen: string, movetimeMs: number): Promise<string> {
    await this.ready();
    return new Promise((resolve) => {
      const handler = (e: MessageEvent<string>) => {
        if (e.data.startsWith('bestmove')) {
          this.worker?.removeEventListener('message', handler);
          resolve(e.data.split(' ')[1]);
        }
      };
      this.worker?.addEventListener('message', handler);
      this.worker?.postMessage(`position fen ${fen}`);
      this.worker?.postMessage(`go movetime ${movetimeMs}`);
    });
  }

  destroy() {
    this.worker?.terminate();
    this.worker = null;
  }
}

/** Response-time budget per level — weak bots move fast, strong bots think longer. */
export function movetimeForLevel(level: number): number {
  return Math.min(2000, 200 + (level - 1) * 250);
}
