const fs = require("fs");
const os = require("os");
const path = require("path");
const semver = require("semver");
const util = require("util");
const github = require("./github");
const core = require("@actions/core");
const tc = require("@actions/tool-cache");

const osPlat = os.platform();

async function buildx(inputVersion, dockerConfigHome) {
  const release = await github.getRelease(inputVersion);
  if (!release) {
    throw new Error(`Cannot find buildx ${inputVersion} release`);
  }
  core.debug(`Release found: ${release.tag_name}`);
  const version = release.tag_name.replace(/^v+|v+$/g, "");

  let toolPath;
  toolPath = tc.find("buildx", version);
  if (!toolPath) {
    const c = semver.clean(version) || "";
    if (!semver.valid(c)) {
      throw new Error(`Invalid Buildx version "${version}".`);
    }
    toolPath = await installBuildx(version);
  }

  const pluginsDir = path.join(dockerConfigHome, "cli-plugins");
  core.debug(`Plugins dir is ${pluginsDir}`);
  if (!fs.existsSync(pluginsDir)) {
    fs.mkdirSync(pluginsDir, { recursive: true });
  }

  const filename = osPlat == "win32" ? "docker-buildx.exe" : "docker-buildx";
  const pluginPath = path.join(pluginsDir, filename);
  core.debug(`Plugin path is ${pluginPath}`);
  fs.copyFileSync(path.join(toolPath, filename), pluginPath);

  core.info("🔨 Fixing perms...");
  fs.chmodSync(pluginPath, "0755");

  return pluginPath;
}

async function installBuildx(version) {
  version = semver.clean(version) || "";
  const platform = osPlat == "win32" ? "windows" : osPlat;
  const ext = osPlat == "win32" ? ".exe" : "";
  const filename = util.format("buildx-v%s.%s-amd64%s", version, platform, ext);
  const targetFile = osPlat == "win32" ? "docker-buildx.exe" : "docker-buildx";

  const downloadUrl = util.format(
    "https://github.com/docker/buildx/releases/download/v%s/%s",
    version,
    filename
  );
  let downloadPath;

  core.info(`⬇️ Downloading ${downloadUrl}...`);
  downloadPath = await tc.downloadTool(downloadUrl);
  core.debug(`Downloaded to ${downloadPath}`);

  return await tc.cacheFile(downloadPath, targetFile, "buildx", version);
}
module.exports = { buildx };
