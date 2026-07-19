/* eslint-disable */
// Runs in every jest worker before the test files load, so the Nest app boots
// against the isolated e2e database (see test-env.ts).
import './test-env';
