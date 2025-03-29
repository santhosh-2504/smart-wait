import { randomUUID } from 'node:crypto';

const activeTimeouts = new Map();

class TimeoutController {
  constructor() {
    this.promise = new Promise((resolve, reject) => {
      this.resolve = resolve;
      this.reject = reject;
    });
  }
}

class TimeoutError extends Error {
  constructor(id, reason) {
    super(reason || `Timeout ${id} cancelled`);
    this.name = 'TimeoutError';
    this.code = 'ETIMEOUT';
    this.id = id;
  }
}

class RetryError extends Error {
  constructor(originalError, attemptsMade, finalDelay) {
    super(`Retry failed after ${attemptsMade} attempts`);
    this.name = 'RetryError';
    this.cause = originalError instanceof Error ? originalError : new Error(originalError);
    this.attempts = attemptsMade;
    this.finalDelay = finalDelay;
  }
}

const wait = (ms) => new Promise((resolve) => {
  const timer = setTimeout(resolve, ms);
  return () => clearTimeout(timer);
});

const waitWithId = (ms) => {
  const id = randomUUID();
  const controller = new TimeoutController();
  let timeout;

  const cleanup = () => {
    clearTimeout(timeout);
    activeTimeouts.delete(id);
  };

  timeout = setTimeout(() => {
    controller.resolve(`Completed timeout ID: ${id}`);
    cleanup();
  }, ms);

  activeTimeouts.set(id, { controller, cleanup });

  return { id, promise: controller.promise };
};

const cancelWait = (id, reason) => {
  const entry = activeTimeouts.get(id);
  if (!entry) return false;

  entry.controller.reject(new TimeoutError(id, reason));
  entry.cleanup();
  return true;
};

const updateWait = (id, newMs) => {
  const entry = activeTimeouts.get(id);
  if (!entry) {
    throw new TimeoutError(id, 'Timeout not found');
  }
  const newController = new TimeoutController();
  entry.cleanup();

  const newTimeout = setTimeout(() => {
    newController.resolve(`Updated timeout ID: ${id}`);
    activeTimeouts.delete(id);
  }, newMs);

  activeTimeouts.set(id, {
    controller: newController,
    cleanup: () => {
      clearTimeout(newTimeout);
      activeTimeouts.delete(id);
    }
  });

  return newController.promise;
};

const waitWithRetry = async (
  fn,
  { retries = 3, delay = 2000, backoff = 'fixed' } = {}
) => {
  let attempt = 0;
  let currentDelay = delay;
  let lastError;

  while (attempt <= retries) {
    try {
      return await fn();
    } catch (error) {
      lastError = error;
      if (attempt >= retries) break;
      
      if (backoff === 'exponential') {
        currentDelay *= 2;
      }
      
      await new Promise((resolve) => setTimeout(resolve, currentDelay));
      attempt++;
    }
  }

  throw new RetryError(lastError, attempt + 1, currentDelay);
};

process.on('exit', () => {
  for (const [id, entry] of activeTimeouts) {
    try {
      entry.controller.reject(new TimeoutError(id, 'Process exiting'));
      entry.cleanup();
    } catch (e) {
      console.error('Cleanup error:', e);
    }
  }
});

export { wait, waitWithId, cancelWait, updateWait, waitWithRetry, TimeoutError, RetryError };