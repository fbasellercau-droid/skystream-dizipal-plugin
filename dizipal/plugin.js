(function () {
  const DEFAULT_BASE = "https://dizipal.im";
  const DOMAIN_LIST_URL = "https://raw.githubusercontent.com/fbasellercau-droid/skystream-dizipal-plugin/main/domains.txt";
  const UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36";

  let cachedBaseUrl = null;

  function cbFrom(args) {
    for (let i = args.length - 1; i >= 0; i--) {
      if (typeof args[i] === "function") return args[i];
    }
    return function () {};
  }

  function cleanBase(url) {
    return String(url || DEFAULT_BASE).replace(/\/+$/, "");
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

  function htmlDecode(value) {
    return String(value || "")
      .replace(/&amp;/g, "&")
      .replace(/&quot;/g, '"')
      .replace(/&#039;/g, "'")
      .replace(/&apos;/g, "'")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
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

  async function resolveBaseUrl() {
    const configured = cleanBase((typeof manifest !== "undefined" && manifest.baseUrl) || DEFAULT_BASE);
    if (cachedBaseUrl) return cachedBaseUrl;
    if (configured !== DEFAULT_BASE) {
      cachedBaseUrl = configured;
      return cachedBaseUrl;
    }

    try {
      const body = await request(DOMAIN_LIST_URL, { "Accept": "text/plain,*/*" });
      const lines = body.split(/\r?\n/);
      const candidates = [];
      for (const line of lines) {
        const match = /^(?:\|)?(DiziPal|DiziPalOrijinal)\s*[:=]\s*(https?:\/\/\S+)/i.exec(line.trim());
        if (match) candidates.push({ name: match[1], url: cleanBase(match[2]) });
      }
      const primary = candidates.find(function (x) { return x.name.toLowerCase() === "dizipal"; });
      const original = candidates.find(function (x) { return x.name.toLowerCase() === "dizipalorijinal"; });
      cachedBaseUrl = (primary && primary.url) || (original && original.url) || configured;
    } catch (_) {
      cachedBaseUrl = configured;
    }
    return cachedBaseUrl;
  }

  function itemTypeFromUrl(url) {
    if (/\/anime\//i.test(url)) return "anime";
    if (/\/dizi\//i.test(url)) return "series";
    return "movie";
  }

  function parseCards(html, base, limit) {
    const cards = [];
    const re = /<div[^>]+class=["'][^"']*post-item[^"']*["'][\s\S]*?<\/div>\s*<\/div>/gi;
    let match;
    while ((match = re.exec(html)) && cards.length < (limit || 36)) {
      const card = match[0];
      const link = /<a[^>]+href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i.exec(card);
      if (!link) continue;
      const poster = /<img[^>]+data-src=["']([^"']+)["'][^>]*wp-post-image/i.exec(card)
        || /<img[^>]+data-src=["']([^"']+)["']/i.exec(card)
        || /<img[^>]+src=["']([^"']+)["'][^>]*wp-post-image/i.exec(card)
        || /<img[^>]+src=["']([^"']+)["']/i.exec(card);
      const url = absoluteUrl(base, link[1]);
      const title = htmlDecode(link[2]).trim();
      if (!title || /\/oyuncular\//i.test(url)) continue;
      cards.push(new MultimediaItem({
        title: title,
        url: url,
        posterUrl: poster ? absoluteUrl(base, poster[1]) : "",
        type: itemTypeFromUrl(url)
      }));
    }
    return uniqueByUrl(cards);
  }

  function metaContent(html, name) {
    const re = new RegExp("<meta[^>]+(?:property|name)=[\"']" + name + "[\"'][^>]+content=[\"']([^\"']*)[\"']", "i");
    const match = re.exec(html);
    return match ? htmlDecode(match[1]).trim() : "";
  }

  function parseDescription(html) {
    const meta = metaContent(html, "og:description");
    if (meta) return meta;
    const block = /<h6[^>]*>\s*(?:Film|Dizi)\s*[^<]*<\/h6>\s*<p[^>]*>([\s\S]*?)<\/p>/i.exec(html);
    return block ? stripTags(block[1]) : "";
  }

  function parseTags(html) {
    const tags = [];
    const blocks = html.match(/<span[^>]*>\s*T[^<]*r\s*<\/span>[\s\S]{0,900}?<\/div>/gi) || [];
    for (const block of blocks) {
      const links = block.match(/<a[^>]*rel=["']tag["'][^>]*>[\s\S]*?<\/a>/gi) || [];
      for (const link of links) {
        const tag = stripTags(link);
        if (tag && tags.indexOf(tag) === -1) tags.push(tag);
      }
    }
    return tags;
  }

  function parseYear(html) {
    const match = /\/yapim\/(\d{4})\//i.exec(html);
    return match ? parseInt(match[1], 10) : undefined;
  }

  function parseSeasonEpisode(text, url) {
    const fromUrl = /(\d+)-sezon-(\d+)-bolum/i.exec(url);
    if (fromUrl) return { season: parseInt(fromUrl[1], 10), episode: parseInt(fromUrl[2], 10) };
    const fromText = /(\d+)\D+Sezon\D+(\d+)/i.exec(text || "");
    return {
      season: fromText ? parseInt(fromText[1], 10) : undefined,
      episode: fromText ? parseInt(fromText[2], 10) : undefined
    };
  }

  function parseEpisodes(html, base) {
    const episodes = [];
    const re = /<div[^>]+class=["'][^"']*episode-item[^"']*["'][\s\S]*?<\/div>\s*<\/div>\s*<\/div>/gi;
    let match;
    while ((match = re.exec(html))) {
      const card = match[0];
      const link = /<a[^>]+href=["']([^"']+)["'][^>]*title=["']([^"']+)["']/i.exec(card);
      if (!link) continue;
      const url = absoluteUrl(base, link[1]);
      const title = htmlDecode(link[2]).trim();
      const nameMatch = /<h4[^>]*>\s*<a[^>]*>([\s\S]*?)<\/a>\s*<\/h4>/i.exec(card);
      const poster = /<img[^>]+data-src=["']([^"']+)["']/i.exec(card)
        || /<img[^>]+src=["']([^"']+)["']/i.exec(card);
      const se = parseSeasonEpisode(title, url);
      const epName = stripTags(nameMatch ? nameMatch[1] : "") || title;
      const label = (se.season && se.episode ? "S" + String(se.season).padStart(2, "0") + "E" + String(se.episode).padStart(2, "0") + " - " : "") + epName;
      episodes.push(new Episode({
        name: label,
        url: url,
        season: se.season,
        episode: se.episode,
        posterUrl: poster ? absoluteUrl(base, poster[1]) : ""
      }));
    }
    return uniqueByUrl(episodes);
  }

  function parseSeasonLinks(html, base) {
    const links = [];
    const re = /<a[^>]+href=["']([^"']*sezon=\d+[^"']*)["'][^>]*>/gi;
    let match;
    while ((match = re.exec(html))) {
      const url = absoluteUrl(base, match[1]);
      if (links.indexOf(url) === -1) links.push(url);
    }
    return links;
  }

  function parseIframeUrl(html, base) {
    const scoped = /<div[^>]+class=["'][^"']*(?:responsive-player|series-player-container)[^"']*["'][\s\S]*?<iframe[^>]+src=["']([^"']+)["']/i.exec(html);
    if (scoped) return absoluteUrl(base, scoped[1]);
    const vast = /<div[^>]+id=["']vast_new["'][\s\S]*?<iframe[^>]+src=["']([^"']+)["']/i.exec(html);
    if (vast) return absoluteUrl(base, vast[1]);
    const any = /<iframe[^>]+src=["']([^"']*embed[^"']*)["']/i.exec(html);
    return any ? absoluteUrl(base, any[1]) : "";
  }

  function parseSubtitles(html) {
    const match = /"subtitle"\s*:\s*"([^"]+)"/i.exec(html);
    if (!match) return [];
    const raw = htmlDecode(match[1]);
    const parts = raw.split(",");
    const subtitles = [];
    for (const part of parts) {
      const item = /^\[([^\]]+)\](https?:\/\/.+)$/i.exec(part.trim());
      if (!item) continue;
      const label = item[1].trim();
      subtitles.push({
        label: label,
        lang: /ingilizce|english/i.test(label) ? "en" : "tr",
        url: item[2].trim()
      });
    }
    return subtitles;
  }

  async function getHome() {
    const cb = cbFrom(arguments);
    try {
      const base = await resolveBaseUrl();
      const data = {};
      const pages = [
        ["Yeni Diziler", base + "/diziler/"],
        ["Yeni Filmler", base + "/filmler/"],
        ["Animeler", base + "/animeler/"],
        ["Aksiyon Dizileri", base + "/dizi-kategori/aksiyon/"],
        ["Bilim Kurgu Dizileri", base + "/dizi-kategori/bilim-kurgu/"],
        ["Dram Dizileri", base + "/dizi-kategori/dram/"],
        ["Komedi Dizileri", base + "/dizi-kategori/komedi/"],
        ["Romantik Dizileri", base + "/dizi-kategori/romantik/"],
        ["Savas Dizileri", base + "/dizi-kategori/savas/"]
      ];
      for (const page of pages) {
        try {
          data[page[0]] = parseCards(await request(page[1]), base, 24);
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
      const base = await resolveBaseUrl();
      const html = await request(base + "/?s=" + encodeURIComponent(String(query || "")));
      cb({ success: true, data: parseCards(html, base, 40) });
    } catch (e) {
      cb({ success: false, errorCode: "SEARCH_FAILED", message: String(e && e.message || e) });
    }
  }

  async function load(url) {
    const cb = cbFrom(arguments);
    try {
      const base = await resolveBaseUrl();
      const html = await request(url);
      const pageUrl = absoluteUrl(base, url);
      const type = itemTypeFromUrl(pageUrl);
      const title = (metaContent(html, "og:title") || stripTags((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1] || "")).replace(/\s+izle\s+-\s+Dizipal$/i, "").trim();
      const item = {
        title: title,
        url: pageUrl,
        posterUrl: metaContent(html, "og:image"),
        type: type,
        description: parseDescription(html),
        year: parseYear(html),
        tags: parseTags(html)
      };

      if (type === "series" || type === "anime") {
        let episodes = parseEpisodes(html, base);
        const seasonLinks = parseSeasonLinks(html, base);
        for (const seasonUrl of seasonLinks) {
          if (seasonUrl === pageUrl) continue;
          try {
            episodes = episodes.concat(parseEpisodes(await request(seasonUrl, { Referer: pageUrl }), base));
          } catch (_) {}
        }
        item.episodes = uniqueByUrl(episodes).sort(function (a, b) {
          return (a.season || 0) - (b.season || 0) || (a.episode || 0) - (b.episode || 0);
        });
      }

      cb({ success: true, data: new MultimediaItem(item) });
    } catch (e) {
      cb({ success: false, errorCode: "LOAD_FAILED", message: String(e && e.message || e) });
    }
  }

  async function loadStreams(url) {
    const cb = cbFrom(arguments);
    try {
      const pageHtml = await request(url);
      const iframeUrl = parseIframeUrl(pageHtml, url);
      if (!iframeUrl) throw new Error("Iframe not found");

      const iframeHtml = await request(iframeUrl, { Referer: url });
      const fetchMatch = /fetch\(['"]([^'"]*get_stream[^'"]*)['"]\)/i.exec(iframeHtml);
      let streamUrl = "";

      if (fetchMatch) {
        const apiUrl = absoluteUrl(iframeUrl, fetchMatch[1]);
        const apiBody = await request(apiUrl, {
          Referer: iframeUrl,
          Origin: originOf(iframeUrl),
          "X-Requested-With": "XMLHttpRequest",
          Accept: "application/json,text/plain,*/*"
        });
        const parsed = JSON.parse(apiBody);
        streamUrl = parsed && parsed.url ? parsed.url : "";
      }

      if (!streamUrl) {
        const m3u8 = /https?:\/\/[^"'<>\s]+\.m3u8[^"'<>\s]*/i.exec(iframeHtml);
        streamUrl = m3u8 ? htmlDecode(m3u8[0]) : "";
      }
      if (!streamUrl) throw new Error("Stream URL not found");

      cb({
        success: true,
        data: [
          new StreamResult({
            url: streamUrl,
            source: "DiziPal",
            headers: {
              Referer: iframeUrl,
              Origin: originOf(iframeUrl),
              "User-Agent": UA
            },
            subtitles: parseSubtitles(iframeHtml)
          })
        ]
      });
    } catch (e) {
      cb({ success: false, errorCode: "STREAM_FAILED", message: String(e && e.message || e) });
    }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
