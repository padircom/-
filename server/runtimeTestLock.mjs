/** Suites using the user's mandated runtime directory must not race JSON caches.
 * Older suites using isolated temporary directories do not need this lock.
 * Stop the interactive API before running these suites: this is a test lock,
 * not a production multi-process storage lock.
 */
import { mkdir, rmdir } from 'node:fs/promises';
import { setTimeout } from 'node:timers/promises';
export async function lockRuntimeTests() {
  await mkdir('./server/rundata', { recursive: true });
  const path = './server/rundata/.rest-test-lock';
  const deadline = Date.now() + 120000;
  while (true) {
    try { await mkdir(path); return () => rmdir(path); }
    catch (err) {
      if (err.code !== 'EEXIST') throw err;
      if (Date.now() > deadline) throw new Error('Runtime test lock timed out; check for an interrupted test before removing server/rundata/.rest-test-lock');
      await setTimeout(100);
    }
  }
}
