globalThis.manifest = {
  packageName: "com.qwe.skystream.dizibox",
  name: "DiziBox",
  version: 1,
  baseUrl: "https://diziboxizle.com"
};

globalThis.MultimediaItem = class MultimediaItem {
  constructor(data) {
    Object.assign(this, data);
  }
};

globalThis.Episode = class Episode {
  constructor(data) {
    Object.assign(this, data);
  }
};

globalThis.StreamResult = class StreamResult {
  constructor(data) {
    Object.assign(this, data);
  }
};

globalThis.http_get = async function httpGet(url, headers = {}) {
  const response = await fetch(url, { headers, redirect: "follow" });
  const body = await response.text();
  return {
    status: response.status,
    body,
    headers: Object.fromEntries(response.headers.entries())
  };
};

function call(fn, ...args) {
  return new Promise((resolve) => {
    globalThis[fn](...args, resolve);
  });
}

await import(new URL("../dizibox/plugin.js", import.meta.url).href);

const home = await call("getHome");
const homeCounts = Object.fromEntries(Object.entries(home.data || {}).map(([name, items]) => [name, items.length]));
console.log("home", home.success, JSON.stringify(homeCounts));
if (!home.success || (home.data?.["Son Bolumler"]?.length || 0) < 10) process.exit(1);

const target = home.data["Son Bolumler"][0];
const details = await call("load", target.url);
console.log("load", details.success, details.data?.title, details.data?.episodes?.length || 0);
if (!details.success || !details.data?.episodes?.length) process.exit(1);

const streams = await call("loadStreams", details.data.episodes[0].url);
const hls = streams.data?.find((stream) => /m3u8/i.test(stream.url));
const direct = streams.data?.find((stream) => !/m3u8/i.test(stream.url));
console.log("streams", streams.success, streams.data?.length || 0, streams.data?.[0]?.source, hls?.url?.slice(0, 60));
if (!streams.success || !hls || !direct || streams.data[0] !== direct) process.exit(1);

const manifest = await fetch(hls.url, { headers: hls.headers || {} });
const manifestText = await manifest.text();
console.log("manifest", manifest.status, manifestText.slice(0, 7));
if (manifest.status >= 400 || !manifestText.startsWith("#EXTM3U")) process.exit(1);

const directHead = await fetch(direct.url, { method: "HEAD", headers: direct.headers || {} });
const directRange = await fetch(direct.url, { headers: Object.assign({ Range: "bytes=0-0" }, direct.headers || {}) });
console.log("direct", directHead.status, directHead.headers.get("content-length"), directRange.status, directRange.headers.get("content-range"));
if (directHead.status >= 400 || !directHead.headers.get("content-length") || directRange.status !== 206) process.exit(1);
