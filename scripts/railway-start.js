const { spawnSync, spawn } = require('child_process');

const env = {
  ...process.env,
  PRISMA_CLI_BINARY_TARGETS:
    process.env.PRISMA_CLI_BINARY_TARGETS || 'debian-openssl-3.0.x',
};

function run(command, args, options = {}) {
  const { required = true, label = `${command} ${args.join(' ')}` } = options;
  console.log(`[startup] running: ${label}`);

  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  if (result.error) {
    console.error(`[startup] failed to execute: ${label}`, result.error);
    if (required) process.exit(1);
    return false;
  }

  if (result.status !== 0) {
    console.error(`[startup] command failed (${result.status}): ${label}`);
    if (required) process.exit(result.status || 1);
    return false;
  }

  return true;
}

run('npx', ['prisma', 'migrate', 'deploy'], {
  required: true,
  label: 'prisma migrate deploy',
});

run('npm', ['run', 'seed'], {
  required: false,
  label: 'npm run seed (optional)',
});

console.log('[startup] starting api: node dist/main');
const app = spawn('node', ['dist/main'], {
  stdio: 'inherit',
  env,
  shell: false,
});

app.on('exit', (code) => {
  process.exit(code || 0);
});