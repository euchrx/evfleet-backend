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
    stdio: 'pipe',
    env,
    encoding: 'utf-8',
    shell: process.platform === 'win32',
  });
  const stdout = result.stdout || '';
  const stderr = result.stderr || '';
  if (stdout) process.stdout.write(stdout);
  if (stderr) process.stderr.write(stderr);

  if (result.error) {
    console.error(`[startup] failed to execute: ${label}`, result.error);
    if (required) process.exit(1);
    return { ok: false, status: 1, stdout, stderr };
  }

  if (result.status !== 0) {
    console.error(`[startup] command failed (${result.status}): ${label}`);
    if (required) process.exit(result.status || 1);
    return { ok: false, status: result.status || 1, stdout, stderr };
  }

  return { ok: true, status: 0, stdout, stderr };
}

function extractFailedMigration(outputText) {
  const match = outputText.match(/The `([^`]+)` migration .* failed/i);
  return match?.[1] || null;
}

function tryResolveFailedMigration(deployOutput) {
  const migrationName = extractFailedMigration(deployOutput);
  if (!migrationName) {
    return false;
  }

  console.warn(
    `[startup] detected failed migration state (P3009). attempting resolve for: ${migrationName}`,
  );

  const resolveResult = run(
    'npx',
    ['prisma', 'migrate', 'resolve', '--rolled-back', migrationName],
    {
      required: false,
      label: `prisma migrate resolve --rolled-back ${migrationName}`,
    },
  );

  if (!resolveResult.ok) {
    console.error('[startup] automatic resolve failed. manual intervention required.');
    return false;
  }

  console.warn('[startup] migration marked as rolled-back. retrying migrate deploy...');
  const retryDeploy = run('npx', ['prisma', 'migrate', 'deploy'], {
    required: false,
    label: 'prisma migrate deploy (retry)',
  });
  return retryDeploy.ok;
}

const migrateDeploy = run('npx', ['prisma', 'migrate', 'deploy'], {
  required: false,
  label: 'prisma migrate deploy',
});

if (!migrateDeploy.ok) {
  const output = `${migrateDeploy.stdout}\n${migrateDeploy.stderr}`;
  const isP3009 = output.includes('P3009');

  if (isP3009 && tryResolveFailedMigration(output)) {
    console.log('[startup] migrations recovered and applied.');
  } else {
    process.exit(migrateDeploy.status || 1);
  }
}

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
