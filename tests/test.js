import { test } from 'node:test';
import assert from 'node:assert';
import {
  wait,
  waitWithId,
  cancelWait,
  updateWait,
  waitWithRetry,
  TimeoutError,
  RetryError
} from '../index.js';

test('Smart Wait Functionality', async (t) => {
  await t.test('Basic wait()', async () => {
    const start = Date.now();
    await wait(200);
    const duration = Date.now() - start;
    assert.ok(duration >= 190 && duration <= 250, `Duration ${duration}ms out of range`);
  });

  await t.test('Natural timeout completion', async () => {
    const { id, promise } = waitWithId(100);
    const result = await promise;
    assert.match(result, /Completed timeout ID: /);
  });

  await t.test('Cancellation', async () => {
    const { id, promise } = waitWithId(500);
    setTimeout(() => cancelWait(id, 'Test cancellation'), 50);
    await assert.rejects(promise, {
      name: 'TimeoutError',
      message: 'Test cancellation'
    });
  });

  await t.test('Update timeout', async () => {
    const { id } = waitWithId(500);
    const newPromise = updateWait(id, 100);
    const result = await newPromise;
    assert.match(result, /Updated timeout ID: /);
  });

  await t.test('Retry with success', async () => {
    let attempts = 0;
    const result = await waitWithRetry(
      () => ++attempts >= 3 ? 'success' : Promise.reject('retry'),
      { retries: 3, delay: 50 }
    );
    assert.strictEqual(result, 'success');
  });

  await t.test('Retry with failure', async () => {
    await assert.rejects(
      waitWithRetry(() => Promise.reject('permanent'), { retries: 2 }),
      (err) => {
        assert.strictEqual(err.attempts, 3);
        assert.strictEqual(err.cause.message, 'permanent');
        return true;
      }
    );
  });

  await t.test('Exponential backoff with success', async () => {
    const start = Date.now();
    let attempts = 0;
    
    const result = await waitWithRetry(
      () => {
        attempts++;
        if (attempts < 3) throw 'retry';
        return 'success';
      },
      { retries: 3, delay: 100, backoff: 'exponential' }
    );

    const duration = Date.now() - start;
    assert.strictEqual(result, 'success');
    assert.ok(duration >= 300 && duration <= 700, `Took ${duration}ms`);
  });

  await t.test('Exponential backoff failure', async () => {
    const start = Date.now();
    
    await assert.rejects(
      waitWithRetry(
        () => { throw 'permanent'; },
        { retries: 2, delay: 100, backoff: 'exponential' }
      ),
      (err) => {
        assert.strictEqual(err.attempts, 3);
        assert.strictEqual(err.finalDelay, 400);
        return true;
      }
    );
  });

  await t.test('Exponential backoff timing', async () => {
    const timestamps = [];
    
    try {
      await waitWithRetry(
        () => {
          timestamps.push(Date.now());
          throw 'fail';
        },
        { retries: 2, delay: 100, backoff: 'exponential' }
      );
    } catch (err) {
      const delays = timestamps.slice(1).map((t, i) => t - timestamps[i]);
      assert.deepStrictEqual(
        delays.map(d => Math.round(d/100)*100),
        [200, 400]
      );
    }
  });

  await t.test('Multiple concurrent timeouts', async () => {
    const timeout1 = waitWithId(200);
    const timeout2 = waitWithId(300);
    
    setTimeout(() => cancelWait(timeout1.id, 'Cancel first'), 50);
    await assert.rejects(timeout1.promise, { message: 'Cancel first' });
    await assert.doesNotReject(timeout2.promise);
  });

  await t.test('Cancel non-existent timeout returns false', () => {
    assert.strictEqual(cancelWait('fake-id'), false);
  });

  await t.test('Update non-existent timeout throws', async () => {
    await assert.rejects(
      async () => updateWait('invalid-id', 100),
      {
        name: 'TimeoutError',
        message: 'Timeout not found',
        code: 'ETIMEOUT'
      }
    );
  });

  await t.test('Update to longer timeout duration', async () => {
    const { id } = waitWithId(100);
    const newPromise = updateWait(id, 300);
    const start = Date.now();
    await newPromise;
    const duration = Date.now() - start;
    assert.ok(duration >= 290 && duration <= 350, `Duration ${duration}ms after update`);
  });

  await t.test('Fixed backoff delay between retries', async () => {
    const timestamps = [];
    let attempts = 0;

    await assert.rejects(
      waitWithRetry(
        () => {
          timestamps.push(Date.now());
          attempts++;
          throw 'fail';
        },
        { retries: 2, delay: 100, backoff: 'fixed' }
      ),
      (err) => {
        const delays = timestamps.slice(1).map((t, i) => t - timestamps[i]);
        const roundedDelays = delays.map(d => Math.round(d/100)*100);
        assert.deepStrictEqual(roundedDelays, [100, 100]);
        assert.strictEqual(attempts, 3);
        return true;
      }
    );
  });

  await t.test('Zero retries attempts once', async () => {
    let attempts = 0;
    await assert.rejects(
      waitWithRetry(
        () => { attempts++; throw 'error'; },
        { retries: 0 }
      ),
      { attempts: 1 }
    );
    assert.strictEqual(attempts, 1);
  });

  await t.test('Default cancellation message', async () => {
    const { id, promise } = waitWithId(200);
    cancelWait(id);
    await assert.rejects(promise, {
      message: `Timeout ${id} cancelled`
    });
  });

  await t.test('Cleanup on process exit simulation', async () => {
    const { id, promise } = waitWithId(100);
    await assert.doesNotReject(promise);
  });

  await t.test('Non-Error rejection handling', async () => {
    await assert.rejects(
      waitWithRetry(() => Promise.reject(42), { retries: 1 }),
      (err) => {
        assert.strictEqual(err.cause.message, '42');
        return true;
      }
    );
  });

  await t.test('Cancel after update', async () => {
    const { id } = waitWithId(500);
    const updatedPromise = updateWait(id, 1000);
    setTimeout(() => cancelWait(id, 'Late cancel'), 50);
    await assert.rejects(updatedPromise, { message: 'Late cancel' });
  });

  await t.test('Cleanup after completion', async () => {
    const { id, promise } = waitWithId(100);
    await promise;
    assert.strictEqual(cancelWait(id), false);
  });
  
  await t.test('Cleanup after cancellation', async () => {
    const { id, promise } = waitWithId(100);
    cancelWait(id);
    await assert.rejects(promise);
    assert.strictEqual(cancelWait(id), false);
  });

  await t.test('Immediate resolution retry', async () => {
    let counter = 0;
    const result = await waitWithRetry(
      () => ++counter === 1 ? 'success' : Promise.reject(),
      { retries: 2 }
    );
    assert.strictEqual(result, 'success');
    assert.strictEqual(counter, 1);
  });
});