// Copies SQL migration files from src/main/migrations to dist/main/migrations
// TypeScript compiler only emits .js files; .sql files must be copied separately.
const { mkdirSync, readdirSync, copyFileSync } = require('fs');
const { join } = require('path');

const src = join(__dirname, '..', 'src', 'main', 'migrations');
const dest = join(__dirname, '..', 'dist', 'main', 'migrations');

mkdirSync(dest, { recursive: true });

for (const file of readdirSync(src).filter(f => f.endsWith('.sql'))) {
  copyFileSync(join(src, file), join(dest, file));
}

console.log(`Copied migration files to dist/main/migrations/`);
