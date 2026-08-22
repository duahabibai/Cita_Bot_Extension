export class QueueManager {
  private queue: (() => Promise<void>)[] = [];
  private activeCount: number = 0;
  private concurrencyLimit: number;

  constructor(concurrencyLimit: number = 3) {
    this.concurrencyLimit = concurrencyLimit;
  }

  public enqueue(task: () => Promise<void>, onWait?: (position: number) => void) {
    return new Promise<void>((resolve, reject) => {
      const wrappedTask = async () => {
        try {
          // Wrap task in a Promise.race to prevent indefinite hangs
          const timeoutPromise = new Promise((_, rejectTimeout) => {
            setTimeout(() => rejectTimeout(new Error("Queue task timed out after 3 minutes")), 180000);
          });
          await Promise.race([task(), timeoutPromise]);
          resolve();
        } catch (error) {
          console.error("Queue Task Error/Timeout:", error);
          reject(error);
        } finally {
          this.activeCount--;
          this.processQueue();
        }
      };

      this.queue.push(wrappedTask);
      
      if (this.activeCount < this.concurrencyLimit) {
        this.processQueue();
      } else {
        if (onWait) {
          onWait(this.queue.length);
        }
      }
    });
  }

  private processQueue() {
    if (this.activeCount < this.concurrencyLimit && this.queue.length > 0) {
      const nextTask = this.queue.shift();
      if (nextTask) {
        this.activeCount++;
        nextTask();
      }
    }
  }
}

export const browserQueue = new QueueManager(1); // Allow max 3 parallel browsers
