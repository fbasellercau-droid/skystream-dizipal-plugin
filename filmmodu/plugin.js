(function () {
  const DEFAULT_BASE = "https://filmmodu.cc";
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

  function cbFrom(args) {
    for (let i = args.length - 1; i >= 0; i--) {
      if (typeof args[i] === "function") return args[i];
    }
    return function () {};
  }

  function cleanBase(url) {
    return String(url || DEFAULT_BASE).replace(/\/+$/, "");
  }

  function baseUrl() {
    return cleanBase((typeof manifest !== "undefined" && manifest.baseUrl) || DEFAULT_BASE);
  }

  function htmlDecode(value) {
    return String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&uuml;/g, "ü")
      .replace(/&Uuml;/g, "Ü")
      .replace(/&ouml;/g, "ö")
      .replace(/&Ouml;/g, "Ö")
      .replace(/&ccedil;/g, "ç")
      .replace(/&Ccedil;/g, "Ç")
      .replace(/&scedil;/g, "ş")
      .replace(/&Scedil;/g, "Ş")
      .replace(/&nbsp;/g, " ")
      .replace(/&#(\d+);/g, function (_, n) {
        return String.fromCharCode(parseInt(n, 10));
      })
      .replace(/&#x([0-9a-f]+);/gi, function (_, n) {
        return String.fromCharCode(parseInt(n, 16));
      });
  }

  function stripTags(value) {
    return htmlDecode(String(value || "").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
  }

  function absoluteUrl(base, value) {
    if (!value) return "";
    const raw = htmlDecode(value).trim();
    if (raw.startsWith("//")) return "https:" + raw;
    if (/^https?:\/\//i.test(raw)) return raw;
    return new URL(raw, cleanBase(base) + "/").toString();
  }

  function originOf(url) {
    return new URL(url).origin;
  }

  async function request(url, headers) {
    const res = await http_get(url, Object.assign({
      "User-Agent": UA,
      "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
    }, headers || {}));
    if (!res || res.status < 200 || res.status >= 400) {
      throw new Error("HTTP " + (res ? res.status : "0") + " for " + url);
    }
    return res.body || "";
  }

  async function post(url, body, headers) {
    const res = await http_post(url, Object.assign({
      "User-Agent": UA,
      "Accept": "application/json,text/plain,*/*",
      "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8"
    }, headers || {}), body);
    if (!res || res.status < 200 || res.status >= 400) {
      throw new Error("HTTP " + (res ? res.status : "0") + " for " + url);
    }
    return res.body || "";
  }

  function uniqueByUrl(items) {
    const seen = {};
    const out = [];
    for (const item of items) {
      if (!item || !item.url || seen[item.url]) continue;
      seen[item.url] = true;
      out.push(item);
    }
    return out;
  }

  function metaContent(html, name) {
    const re = new RegExp("<meta[^>]+(?:property|name)=[\"']" + name + "[\"'][^>]+content=[\"']([^\"']*)[\"']", "i");
    const match = re.exec(html);
    return match ? htmlDecode(match[1]).trim() : "";
  }

  function firstImageUrl(block, base) {
    const image = /<img[^>]+data-src=["']([^"']+)["']/i.exec(block)
      || /<img[^>]+src=["']([^"']+)["']/i.exec(block)
      || /<source[^>]+data-srcset=["']([^"'\s,]+)["']/i.exec(block);
    if (!image || /^data:/i.test(image[1])) return "";
    return absoluteUrl(base, image[1]);
  }

  function parseYear(block) {
    const year = /<span[^>]+class=["'][^"']*\byear\b[^"']*["'][^>]*>(\d{4})<\/span>/i.exec(block)
      || /\b(19\d{2}|20\d{2})\b/.exec(block);
    return year ? parseInt(year[1], 10) : undefined;
  }

  function parseMovieCards(html, base, limit) {
    const items = [];
    const re = /<article[^>]+class=["'][^"']*\bmovie_box\b[^"']*["'][\s\S]*?<\/article>/gi;
    let match;
    while ((match = re.exec(html)) && items.length < (limit || 40)) {
      const card = match[0];
      const link = /<a[^>]+href=["']([^"']*\/film\/[^"']+)["'][^>]*(?:title=["']([^"']+)["'])?/i.exec(card);
      if (!link) continue;
      const h2 = /<h2[^>]*>([\s\S]*?)<\/h2>/i.exec(card);
      const title = stripTags(h2 ? h2[1] : link[2] || "").replace(/\s+izle$/i, "").trim();
      if (!title) continue;
      const posterUrl = firstImageUrl(card, base);
      if (!posterUrl) continue;
      const tags = [];
      const category = /<span[^>]+class=["'][^"']*\bktg\b[^"']*["'][^>]*>([\s\S]*?)<\/span>/i.exec(card);
      const categoryText = stripTags(category ? category[1] : "");
      if (categoryText) tags.push(categoryText);
      items.push(new MultimediaItem({
        title: title,
        url: absoluteUrl(base, link[1]),
        posterUrl: posterUrl,
        type: "movie",
        year: parseYear(card),
        tags: tags
      }));
    }
    return uniqueByUrl(items);
  }

  function parseDescription(html) {
    const desc = /<div[^>]+itemprop=["']description["'][^>]*>([\s\S]*?)<\/div>/i.exec(html)
      || /<div[^>]+class=["'][^"']*\bdesc\b[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html);
    return stripTags(desc ? desc[1] : metaContent(html, "og:description"));
  }

  function parseTags(html) {
    const tags = [];
    const block = /<ul[^>]+class=["'][^"']*\bbottom\b[^"']*["'][\s\S]*?<\/ul>/i.exec(html);
    const source = block ? block[0] : html;
    const re = /<a[^>]+href=["'][^"']*\/filmizle\/[^"']+["'][^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = re.exec(source))) {
      const tag = stripTags(match[1]);
      if (tag && tags.indexOf(tag) === -1) tags.push(tag);
    }
    return tags;
  }

  function reverse(value) {
    return String(value || "").split("").reverse().join("");
  }

  function decodeBase64(value) {
    const input = String(value || "").replace(/\s+/g, "");
    if (typeof atob === "function") return atob(input);
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let output = "";
    let buffer = 0;
    let bits = 0;
    for (let i = 0; i < input.length; i++) {
      const c = input.charAt(i);
      if (c === "=") break;
      const n = chars.indexOf(c);
      if (n < 0) continue;
      buffer = (buffer << 6) | n;
      bits += 6;
      if (bits >= 8) {
        bits -= 8;
        output += String.fromCharCode((buffer >> bits) & 255);
      }
    }
    return output;
  }

  function addIframeFromEncoded(out, encoded, prefix) {
    if (!encoded) return;
    let value = encoded;
    if (!/^PG/i.test(value) && prefix) value = prefix + value;
    let decoded = "";
    try {
      decoded = decodeBase64(value);
    } catch (_) {
      return;
    }
    const re = /<iframe[^>]+src=["']([^"']+)["']/gi;
    let match;
    while ((match = re.exec(decoded))) {
      const url = absoluteUrl(DEFAULT_BASE, match[1]).replace(/\s+$/, "");
      if (out.indexOf(url) === -1) out.push(url);
    }
  }

  function parseVidlopIframes(html) {
    const urls = [];
    const prefixMatch = /rvali\(['"]([^'"]+)['"]\)/i.exec(html);
    const prefix = prefixMatch ? reverse(prefixMatch[1]) : "";
    const first = /ilkpartkod\s*=\s*['"]([^'"]+)['"]/i.exec(html);
    if (first) addIframeFromEncoded(urls, first[1], prefix);
    const re = /pdata\[['"]prt_[^'"]+['"]\]\s*=\s*['"]([^'"]+)['"]/gi;
    let match;
    while ((match = re.exec(html))) addIframeFromEncoded(urls, match[1], prefix);
    return urls.filter(function (url) {
      return /vidlop\.com\/video\//i.test(url);
    });
  }

  async function streamsFromVidlop(iframeUrl, pageUrl) {
    const id = (/\/video\/([^/?#]+)/i.exec(iframeUrl) || [])[1];
    if (!id) return [];
    const api = originOf(iframeUrl) + "/player/index.php?data=" + encodeURIComponent(id) + "&do=getVideo";
    const body = "hash=" + encodeURIComponent(id) + "&r=" + encodeURIComponent(pageUrl);
    const apiBody = await post(api, body, {
      Referer: iframeUrl,
      Origin: originOf(iframeUrl),
      "X-Requested-With": "XMLHttpRequest"
    });
    const data = JSON.parse(apiBody);
    const headers = { Referer: iframeUrl, "User-Agent": UA };
    const streams = [];
    if (data.hls && (data.securedLink || data.videoSource)) {
      streams.push(new StreamResult({
        url: data.securedLink || data.videoSource,
        source: "FilmModu HLS",
        headers: headers
      }));
    }
    const direct = data.videoSources || data.sources || [];
    for (const item of direct) {
      if (!item || !item.file && !item.url) continue;
      streams.push(new StreamResult({
        url: item.file || item.url,
        source: "FilmModu " + String(item.label || item.name || "Video"),
        headers: headers
      }));
    }
    return streams;
  }

  async function getHome() {
    const cb = cbFrom(arguments);
    try {
      const base = baseUrl();
      const pages = [
        ["Öne Çıkanlar", base + "/"],
        ["Yeni Filmler", base + "/yeni-filmler"],
        ["Popüler Filmler", base + "/populer-filmler"],
        ["Trend Filmler", base + "/trend-filmler"],
        ["Aksiyon", base + "/filmizle/aksiyon-filmleri-izle"]
      ];
      const data = {};
      for (const page of pages) {
        try {
          data[page[0]] = parseMovieCards(await request(page[1]), base, 36);
        } catch (_) {
          data[page[0]] = [];
        }
      }
      cb({ success: true, data: data });
    } catch (e) {
      cb({ success: false, errorCode: "HOME_FAILED", message: String(e && e.message || e) });
    }
  }

  async function search(query) {
    const cb = cbFrom(arguments);
    try {
      const base = baseUrl();
      const html = await request(base + "/arama/" + encodeURIComponent(String(query || "").trim()));
      cb({ success: true, data: parseMovieCards(html, base, 40) });
    } catch (e) {
      cb({ success: false, errorCode: "SEARCH_FAILED", message: String(e && e.message || e) });
    }
  }

  async function load(url) {
    const cb = cbFrom(arguments);
    try {
      const base = baseUrl();
      const pageUrl = absoluteUrl(base, url);
      const html = await request(pageUrl);
      const title = stripTags((/<div[^>]+class=["'][^"']*\bsng_titles\b[^"']*["'][\s\S]*?<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1] || "")
        || metaContent(html, "og:title").replace(/\s*\|\s*Filmmodu.*$/i, "").trim();
      cb({
        success: true,
        data: new MultimediaItem({
          title: title,
          url: pageUrl,
          posterUrl: metaContent(html, "og:image") || firstImageUrl(html, base),
          type: "movie",
          description: parseDescription(html),
          year: parseYear(html),
          tags: parseTags(html)
        })
      });
    } catch (e) {
      cb({ success: false, errorCode: "LOAD_FAILED", message: String(e && e.message || e) });
    }
  }

  async function loadStreams(url) {
    const cb = cbFrom(arguments);
    try {
      const base = baseUrl();
      const pageUrl = absoluteUrl(base, url);
      const html = await request(pageUrl);
      const iframeUrls = parseVidlopIframes(html);
      let streams = [];
      for (const iframeUrl of iframeUrls) {
        streams = streams.concat(await streamsFromVidlop(iframeUrl, pageUrl));
      }
      if (!streams.length) throw new Error("Stream URL not found");
      cb({ success: true, data: uniqueByUrl(streams) });
    } catch (e) {
      cb({ success: false, errorCode: "STREAM_FAILED", message: String(e && e.message || e) });
    }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
