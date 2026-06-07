globalThis.manifest = {
  packageName: "com.qwe.skystream.dizipal",
  name: "DiziPal",
  version: 1,
  baseUrl: "https://dizipal.im"
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

await import(new URL("../dizipal/plugin.js", import.meta.url).href);

const home = await call("getHome");
const homeCategories = home.success ? Object.entries(home.data || {}).filter(([, items]) => items?.length) : [];
const posterless = homeCategories.flatMap(([, items]) => items || []).filter((item) => !item.posterUrl || /no-thumbnail/i.test(item.posterUrl));
const shortCategories = homeCategories.filter(([, items]) => items.length < 8);
console.log("home", home.success, homeCategories.length, homeCategories.map(([name, items]) => `${name}:${items.length}`).join(", "));
console.log("posters", posterless.length ? "bad" : "ok", posterless[0]?.posterUrl || "");
if (!home.success || homeCategories.length < 4 || shortCategories.length || posterless.length) process.exit(1);

const search = await call("search", "dutton");
console.log("search", search.success, search.data?.length || 0, search.data?.[0]?.title, search.data?.[0]?.url);
if (!search.success || !search.data?.length) process.exit(1);

const details = await call("load", search.data[0].url);
console.log("load", details.success, details.data?.title, details.data?.episodes?.length || 0);
if (!details.success || !details.data?.episodes?.length) process.exit(1);

const streams = await call("loadStreams", details.data.episodes[0].url);
console.log("streams", streams.success, streams.data?.length || 0, streams.data?.[0]?.url?.includes(".m3u8"));
if (!streams.success || !streams.data?.[0]?.url?.includes(".m3u8")) process.exit(1);
