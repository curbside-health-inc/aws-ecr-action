const core = require("@actions/core");
const exec = require("@actions/exec");
async function run() {
  try {
    core.info('🚿 Removing builder instance...');
    await exec.exec('docker', ['buildx', 'rm', `builder-${process.env.GITHUB_SHA}`]);
  } catch (error) {
    core.warning(error.message);
  }
}

run()
