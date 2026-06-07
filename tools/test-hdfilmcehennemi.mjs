globalThis.manifest = {
  packageName: "com.qwe.skystream.hdfilmcehennemi",
  name: "HDFilmCehennemi",
  version: 1,
  baseUrl: "https://www.hdfilmcehennemi.nl"
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

await import(new URL("../hdfilmcehennemi/plugin.js", import.meta.url).href);

const home = await call("getHome");
const homeCategories = home.success ? Object.entries(home.data || {}).filter(([, items]) => items?.length) : [];
const items = homeCategories.flatMap(([, list]) => list || []);
const posterless = items.filter((item) => !item.posterUrl || /^data:image/i.test(item.posterUrl));
console.log("home", home.success, homeCategories.length, items.length);
console.log("posters", posterless.length ? "bad" : "ok", posterless[0]?.posterUrl || "");
if (!home.success || homeCategories.length < 2 || !items.length || posterless.length) process.exit(1);

const target = items.find((item) => /mummy|mumya/i.test(item.title)) || items[0];
const searchTerm = target.title.split(/\s+/)[0];
const search = await call("search", searchTerm);
console.log("search", search.success, search.data?.length || 0, searchTerm);
if (!search.success || !search.data?.length) process.exit(1);

const details = await call("load", target.url);
console.log("load", details.success, details.data?.title, details.data?.posterUrl);
if (!details.success || !details.data?.title || !details.data?.posterUrl) process.exit(1);

const streams = await call("loadStreams", target.url);
const streamUrl = streams.data?.[0]?.url || "";
console.log("streams", streams.success, streams.data?.length || 0, /master\.txt|\.m3u8/i.test(streamUrl));
if (!streams.success || !/master\.txt|\.m3u8/i.test(streamUrl)) process.exit(1);
