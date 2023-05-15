const core = require("@actions/core");
const exec = require("@actions/exec");
const os = require("os");
const installer = require("./installer");
const path = require("path");
const stateHelper = require("./state-helper");

async function run() {
  try {
    const buildxVer = core.getInput("buildx-version") || "latest";
    const dockerConfigHome =
      process.env.DOCKER_CONFIG || path.join(os.homedir(), ".docker");
    await installer.buildx(buildxVer, dockerConfigHome);

    core.info("📣 Buildx info");
    await exec.exec("docker", ["buildx", "version"]);

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

    // core.info("🏃 Booting builder...");
    // await exec.exec("docker", ["buildx", "inspect", "--bootstrap"]);

    // core.info("🐳 Docker info");
    // await exec.exec("docker", ["info"]);
    core.info('Docker Login');
    process.env.AWS_ACCESS_KEY_ID = core.getInput('access_key_id');
    process.env.AWS_SECRET_ACCESS_KEY = core.getInput('secret_access_key');
    process.env.AWS_DEFAULT_REGION = core.getInput('region');
    await exec.exec(`aws ecr get-login-password --region ${core.getInput('region')} \| docker login --username AWS --password-stdin ${core.getInput('account_id')}.dkr.ecr.${core.getInput('region')}.amazonaws.com`)
    core.info("Docker build");
    const inputDockerfile = core.getInput("dockerfile");
    const platform = core.getInput("platform");
    const inputPath = core.getInput("path") || ".";
    let dockerTagArgs = "";
    const dockerTags = core.getInput("tags").split(",");
    const accountUrl = `${core.getInput("account_id")}.dkr.ecr.${core.getInput(
      "region"
    )}.amazonaws.com`;
    const repo = core.getInput("repo");
    dockerTags.forEach((tag) => {
      dockerTagArgs = `${dockerTagArgs} -t ${accountUrl}/${repo}:${tag}`;
    });
    const cacheFrom = core.getInput("cache_from");
    let extraBuildArgs = core.getInput("extra_build_args");
    if (cacheFrom) {
      dockerTagArgs = `${extraBuildArgs} --cache-from ${accountUrl}/${repo}:${cacheFrom}`;
    }
    if (platform) {
      extraBuildArgs = `${extraBuildArgs} --platform ${platform}`;
    }
    const dockerCmd = `docker buildx build ${extraBuildArgs} -f ${inputDockerfile} ${dockerTagArgs} ${inputPath}`;
    core.info(`CMD: ${dockerCmd}`);
    await exec.exec(dockerCmd);
    for(const tag of dockerTags) {
      core.info(`Pushing ${accountUrl}/${repo}:${tag}`);
      await exec.exec('docker', ['push', `${accountUrl}/${repo}:${tag}`])
    }
  } catch (error) {
    core.setFailed(error.message);
  }
}
async function cleanup() {
  try {
    core.info('🚿 Removing builder instance...');
    await exec.exec('docker', ['buildx', 'rm', `builder-${process.env.GITHUB_SHA}`]);
  } catch (error) {
    core.warning(error.message);
  }
}

// Main
if (!stateHelper.IsPost) {
  run();
}
// Post
else {
  cleanup();
}
