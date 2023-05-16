const core = require("@actions/core");
const exec = require("@actions/exec");
const os = require("os");
const installer = require("./installer");
const path = require("path");

try {
  const buildxVer = core.getInput("buildx-version") || "latest";
  const dockerConfigHome =
    process.env.DOCKER_CONFIG || path.join(os.homedir(), ".docker");
  await installer.buildx(buildxVer, dockerConfigHome);

  // core.info("📣 Buildx info");
  // await exec.exec("docker", ["buildx", "version"]);

  core.info(`⬇️ Downloading qemu-user-static Docker image...`);
  const qemuVer = core.getInput('qemu-version') || 'latest';
  await exec.exec('docker', ['pull', '-q', `multiarch/qemu-user-static:${qemuVer}`]);
  core.info(`💎 Installing QEMU static binaries...`);
  await exec.exec('docker', [
    'run',
    '--rm',
    '--privileged',
    `multiarch/qemu-user-static:${qemuVer}`,
    '--reset',
    '-p',
    'yes',
    '--credential',
    'yes'
  ]);
  core.info('🔨 Creating a new builder instance...');
  await exec.exec('docker', [
    'buildx',
    'create',
    '--name',
    `builder-${process.env.GITHUB_SHA}`,
    '--driver',
    'docker-container',
    '--use'
  ]);

  core.info("🏃 Booting builder...");
  await exec.exec("docker", ["buildx", "inspect", "--bootstrap"]);

  // core.info("🐳 Docker info");
  // await exec.exec("docker", ["info"]);
  core.info('Docker Login');
  process.env.AWS_ACCESS_KEY_ID = core.getInput('access_key_id');
  process.env.AWS_SECRET_ACCESS_KEY = core.getInput('secret_access_key');
  process.env.AWS_DEFAULT_REGION = core.getInput('region');
  await exec.exec(`/bin/bash -c "aws ecr get-login-password --region ${core.getInput('region')} | docker login --username AWS --password-stdin ${core.getInput('account_id')}.dkr.ecr.${core.getInput('region')}.amazonaws.com"`);
  core.info("Docker build");
  const inputDockerfile = core.getInput("dockerfile");
  const platform = core.getInput("platform");
  const inputPath = core.getInput("path") || ".";
  let dockerTagArgs = "";
  const accountUrl = `${core.getInput("account_id")}.dkr.ecr.${core.getInput(
    "region"
  )}.amazonaws.com`;
  const repo = core.getInput("repo");
  const dockerTags = core.getInput("tags").split(",").map((tag) => `${accountUrl}/${repo}:${tag.trim()}`);
  dockerTags.forEach((tag) => {
    dockerTagArgs = `${dockerTagArgs} -t ${tag}`;
  });
  const cacheFrom = core.getInput("cache_from");
  let extraBuildArgs = core.getInput("extra_build_args");
  if (cacheFrom) {
    extraBuildArgs = `${extraBuildArgs} --cache-from ${cacheFrom}`;
    await exec.exec('docker', ['pull', cacheFrom]);
  }
  if (platform) {
    extraBuildArgs = `${extraBuildArgs} --platform ${platform}`;
  }
  const dockerCmd = `docker buildx build ${extraBuildArgs} -f ${inputDockerfile} ${dockerTagArgs} ${inputPath}`;
  core.info(`CMD: ${dockerCmd}`);
  await exec.exec(dockerCmd);
  for(const tag of dockerTags) {
    core.info(`Pushing ${tag}`);
    await exec.exec('docker', ['tag', `${repo}:latest`, tag])
    await exec.exec('docker', ['push', tag])
  }
} catch (error) {
  core.setFailed(error.message);
}
