// Import the smart-wait package
import {
  wait,
  waitWithRetry,
  waitWithId,
  cancelWait
} from 'https://cdn.jsdelivr.net/npm/smart-wait@latest/dist/browser.js';

const outputDiv = document.getElementById('output');

function logOutput(message) {
  const p = document.createElement('p');
  p.textContent = message;
  outputDiv.appendChild(p);
}

async function runBasicWait() {
  logOutput('Running Basic Wait...');
  const start = Date.now();
  await wait(2000); // Wait for 2 seconds
  const duration = Date.now() - start;
  logOutput(`Basic Wait completed in ${duration}ms`);
}

async function runRetry() {
  logOutput('Running Retry...');
  let attempts = 0;
  try {
    const result = await waitWithRetry(
      async () => {
        attempts++;
        if (attempts < 3) throw new Error('Retrying...');
        return 'Success!';
      },
      { retries: 3, delay: 1000, backoff: 'exponential' }
    );
    logOutput(`Retry succeeded: ${result}`);
  } catch (err) {
    logOutput(`Retry failed: ${err.message}`);
  }
}

async function runCancellableWait() {
  logOutput('Running Cancellable Wait...');
  const { id, promise } = waitWithId(5000); // 5-second timeout
  setTimeout(() => cancelWait(id, 'Cancelled by user'), 2000); // Cancel after 2 seconds
  try {
    await promise;
  } catch (err) {
    logOutput(`Cancellable Wait: ${err.message}`);
  }
}