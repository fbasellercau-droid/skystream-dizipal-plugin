(function () {
  const DEFAULT_BASE = "https://www.hdfilmcehennemi.nl";
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
      .replace(/&uuml;/g, "u")
      .replace(/&Uuml;/g, "U")
      .replace(/&ouml;/g, "o")
      .replace(/&Ouml;/g, "O")
      .replace(/&ccedil;/g, "c")
      .replace(/&Ccedil;/g, "C")
      .replace(/&ş;/g, "s")
      .replace(/&Ş;/g, "S")
      .replace(/&iacute;/g, "i")
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

  function firstImageUrl(card, base) {
    const candidates = [];
    const attrRe = /\s(?:data-src|src)=["']([^"']+)["']/gi;
    let attr;
    while ((attr = attrRe.exec(card))) candidates.push(attr[1]);

    const srcsetRe = /\s(?:data-srcset|srcset)=["']([^"']+)["']/gi;
    let srcset;
    while ((srcset = srcsetRe.exec(card))) {
      const parts = srcset[1].split(",");
      for (const part of parts) candidates.push(part.trim().split(/\s+/)[0]);
    }

    for (const candidate of candidates) {
      if (!candidate || /^data:image/i.test(candidate)) continue;
      return absoluteUrl(base, candidate);
    }
    return "";
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

  function parseCards(html, base, limit) {
    const cards = [];
    const re = /<a\b(?=[^>]*\bclass=["'][^"']*poster[^"']*["'])(?=[^>]*\bhref=["']([^"']+)["'])(?=[^>]*\btitle=["']([^"']+)["'])[\s\S]*?<\/a>/gi;
    let match;
    while ((match = re.exec(html)) && cards.length < (limit || 40)) {
      const url = absoluteUrl(base, match[1]);
      if (/\/dizi\//i.test(url) || /\/oyuncu\//i.test(url) || /\/yonetmen\//i.test(url)) continue;
      const title = htmlDecode(match[2]).replace(/\s+/g, " ").trim();
      if (!title || /^Poster$/i.test(title)) continue;
      cards.push(new MultimediaItem({
        title: title,
        url: url,
        posterUrl: firstImageUrl(match[0], base),
        type: "movie"
      }));
    }
    return uniqueByUrl(cards);
  }

  function splitHomeSections(html, base) {
    const all = parseCards(html, base, 80);
    return {
      "Yeni Eklenen Filmler": all.slice(0, 24),
      "One Cikan Filmler": all.slice(24, 48),
      "Populer Filmler": all.slice(48, 72)
    };
  }

  function metaContent(html, name) {
    const re = new RegExp("<meta[^>]+(?:property|name)=[\"']" + name + "[\"'][^>]+content=[\"']([^\"']*)[\"']", "i");
    const match = re.exec(html);
    return match ? htmlDecode(match[1]).trim() : "";
  }

  function parseJsonLd(html) {
    const scripts = html.match(/<script[^>]+type=["']application\/ld\+json["'][^>]*>[\s\S]*?<\/script>/gi) || [];
    for (const script of scripts) {
      const raw = script.replace(/^<script[^>]*>/i, "").replace(/<\/script>$/i, "").trim();
      try {
        const parsed = JSON.parse(raw);
        const item = Array.isArray(parsed) ? parsed.find(function (x) { return x && x["@type"] === "Movie"; }) : parsed;
        if (item && item["@type"] === "Movie") return item;
      } catch (_) {}
    }
    return {};
  }

  function parseYear(value) {
    const match = /(\d{4})/.exec(String(value || ""));
    return match ? parseInt(match[1], 10) : undefined;
  }

  function parseIframeUrl(html, base) {
    const iframe = /<iframe[^>]+(?:data-src|src)=["']([^"']+)["'][^>]*>/i.exec(html);
    return iframe ? absoluteUrl(base, iframe[1]) : "";
  }

  function parseStreamUrl(html) {
    const direct = /https?:\/\/[^"'<>\s]+(?:master\.txt|\.m3u8)(?:\?[^"'<>\s]*)?/i.exec(html);
    return direct ? htmlDecode(direct[0]) : "";
  }

  function parseSubtitles(html) {
    const subtitles = [];
    const re = /https?:\/\/[^"'<>\s]+\.vtt[^"'<>\s]*/gi;
    let match;
    while ((match = re.exec(html))) {
      subtitles.push({ label: "Subtitle", lang: "tr", url: htmlDecode(match[0]) });
    }
    return subtitles;
  }

  async function getHome() {
    const cb = cbFrom(arguments);
    try {
      const base = baseUrl();
      const html = await request(base + "/");
      cb({ success: true, data: splitHomeSections(html, base) });
    } catch (e) {
      cb({ success: false, errorCode: "HOME_FAILED", message: String(e && e.message || e) });
    }
  }

  async function search(query) {
    const cb = cbFrom(arguments);
    try {
      const base = baseUrl();
      const normalized = stripTags(query).toLocaleLowerCase("tr-TR");
      const html = await request(base + "/");
      const results = parseCards(html, base, 120).filter(function (item) {
        return item.title.toLocaleLowerCase("tr-TR").indexOf(normalized) !== -1;
      });
      cb({ success: true, data: results });
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
      const jsonLd = parseJsonLd(html);
      const genres = Array.isArray(jsonLd.genre) ? jsonLd.genre : (jsonLd.genre ? [jsonLd.genre] : []);
      const title = htmlDecode(jsonLd.name || metaContent(html, "og:title") || stripTags((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1] || "")).trim();

      cb({
        success: true,
        data: new MultimediaItem({
          title: title,
          url: pageUrl,
          posterUrl: absoluteUrl(base, jsonLd.image || metaContent(html, "og:image")),
          type: "movie",
          description: stripTags(jsonLd.description || metaContent(html, "og:description")),
          year: parseYear(jsonLd.datePublished),
          tags: genres.map(function (genre) { return stripTags(genre); }).filter(Boolean)
        })
      });
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
      const streamUrl = parseStreamUrl(iframeHtml);
      if (!streamUrl) throw new Error("Stream URL not found");

      cb({
        success: true,
        data: [
          new StreamResult({
            url: streamUrl,
            source: "HDFilmCehennemi",
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
