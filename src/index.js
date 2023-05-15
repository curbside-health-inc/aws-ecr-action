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

    core.info("🏃 Booting builder...");
    await exec.exec("docker", ["buildx", "inspect", "--bootstrap"]);

    core.info("🐳 Docker info");
    await exec.exec("docker", ["info"]);
    core.info("Docker build");
    const inputDockerfile = core.getInput("dockerfile");
    const platform = core.getInput("platform");
    const inputPath = core.getInput("path") || ".";
    await core.exec("docker", [
      "buildx",
      "build",
      "-f",
      inputDockerfile,
      "--platform",
      platform,
      "test",
      path,
    ]);
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
    const dockerCmd = `docker build buildx ${extraBuildArgs} -f ${inputDockerfile} ${dockerTagArgs} ${inputPath}`;
    core.info(`Running: ${dockerCmd}`);
    await exec.exec(dockerCmd);
  } catch (error) {
    core.setFailed(error.message);
  }
}

if (!stateHelper.IsPost) {
  run();
}
