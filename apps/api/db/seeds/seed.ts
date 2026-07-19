import 'reflect-metadata';
import { readdirSync } from 'fs';
import { join } from 'path';
import dataSource from '../../src/data-source';

async function run() {
  await dataSource.initialize();

  const seedsDir = __dirname;
  const files = readdirSync(seedsDir)
    .filter((f) => f.endsWith('.seed.ts') || f.endsWith('.seed.js'))
    .sort();

  for (const file of files) {
    console.log(`Running seed: ${file}`);
    // require (not dynamic import) so ts-node's CommonJS hook transforms the
    // .ts seed + resolves its tsconfig-paths/relative imports. Dynamic import()
    // goes through Node's ESM loader, which can't resolve extensionless .ts.
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const mod = require(join(seedsDir, file));
    if (typeof mod.run === 'function') {
      await mod.run(dataSource);
    }
  }

  await dataSource.destroy();
  console.log('Seeding complete.');
}

run().catch((err) => {
  console.error('Seeding failed:', err);
  process.exit(1);
});
