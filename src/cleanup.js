try {
  core.info('🚿 Removing builder instance...');
  await exec.exec('docker', ['buildx', 'rm', `builder-${process.env.GITHUB_SHA}`]);
} catch (error) {
  core.warning(error.message);
}
