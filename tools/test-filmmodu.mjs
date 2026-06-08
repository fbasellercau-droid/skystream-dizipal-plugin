globalThis.manifest = {
  packageName: "com.qwe.skystream.filmmodu",
  name: "FilmModu",
  version: 1,
  baseUrl: "https://filmmodu.cc"
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

globalThis.http_post = async function httpPost(url, headers = {}, body = "") {
  const response = await fetch(url, { method: "POST", headers, body, redirect: "follow" });
  const text = await response.text();
  return {
    status: response.status,
    body: text,
    headers: Object.fromEntries(response.headers.entries())
  };
};

function call(fn, ...args) {
  return new Promise((resolve) => {
    globalThis[fn](...args, resolve);
  });
}

await import(new URL("../filmmodu/plugin.js", import.meta.url).href);

const home = await call("getHome");
const homeCategories = home.success ? Object.entries(home.data || {}).filter(([, items]) => items?.length) : [];
const posterless = homeCategories.flatMap(([, items]) => items || []).filter((item) => !item.posterUrl);
console.log("home", home.success, homeCategories.length, homeCategories.map(([name, items]) => `${name}:${items.length}`).join(", "));
console.log("posters", posterless.length ? "bad" : "ok", posterless[0]?.title || "");
if (!home.success || homeCategories.length < 3 || posterless.length) process.exit(1);

const search = await call("search", "captain");
console.log("search", search.success, search.data?.length || 0, search.data?.[0]?.title, search.data?.[0]?.url);
if (!search.success || !search.data?.length) process.exit(1);

const details = await call("load", search.data[0].url);
console.log("load", details.success, details.data?.title, details.data?.posterUrl ? "poster" : "no-poster");
if (!details.success || !details.data?.title || !details.data?.posterUrl) process.exit(1);

const streams = await call("loadStreams", details.data.url);
const hls = streams.data?.find((stream) => /m3u8|master\.txt/i.test(stream.url));
console.log("streams", streams.success, streams.data?.length || 0, hls?.source, hls?.url?.slice(0, 80));
if (!streams.success || !hls) process.exit(1);

const manifest = await fetch(hls.url, { headers: hls.headers || {} });
const manifestText = await manifest.text();
console.log("manifest", manifest.status, manifestText.slice(0, 7));
if (manifest.status >= 400 || !manifestText.startsWith("#EXTM3U")) process.exit(1);
