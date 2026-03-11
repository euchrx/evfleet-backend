const { spawnSync, spawn } = require('child_process');

const env = {
  ...process.env,
  PRISMA_CLI_BINARY_TARGETS:
    process.env.PRISMA_CLI_BINARY_TARGETS || 'debian-openssl-3.0.x',
};

function run(command, args) {
  const result = spawnSync(command, args, {
    stdio: 'inherit',
    env,
    shell: process.platform === 'win32',
  });

  if (result.status !== 0) {
    process.exit(result.status || 1);
  }
}

run('npx', ['prisma', 'migrate', 'deploy']);
run('npm', ['run', 'seed']);

const app = spawn('node', ['dist/main'], {
  stdio: 'inherit',
  env,
  shell: false,
});

app.on('exit', (code) => {
  process.exit(code || 0);
});