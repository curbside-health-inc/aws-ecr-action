const httpm = require("@actions/http-client");

const getRelease = async (version) => {
  const url = `https://github.com/docker/buildx/releases/${version}`;
  const http = new httpm.HttpClient("ghaction-docker-buildx");
  return (await http.getJson(url)).result;
};

module.exports = { getRelease };
