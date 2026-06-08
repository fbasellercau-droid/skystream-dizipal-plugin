(function () {
  const DEFAULT_BASE = "https://diziboxizle.com";
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
      .replace(/&#8217;/g, "'")
      .replace(/&#038;/g, "&")
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

  function firstImageUrl(block, base) {
    const image = /<img[^>]+data-src=["']([^"']+)["']/i.exec(block)
      || /<img[^>]+src=["']([^"']+)["']/i.exec(block)
      || /<meta[^>]+(?:property|name)=["'](?:og:image|twitter:image)["'][^>]+content=["']([^"']+)["']/i.exec(block);
    if (!image || /lazy\.png/i.test(image[1])) return "";
    return absoluteUrl(base, image[1]);
  }

  function metaContent(html, name) {
    const re = new RegExp("<meta[^>]+(?:property|name)=[\"']" + name + "[\"'][^>]+content=[\"']([^\"']*)[\"']", "i");
    const match = re.exec(html);
    return match ? htmlDecode(match[1]).trim() : "";
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

  function parseEpisodeCards(html, base, limit) {
    const items = [];
    const re = /<a[^>]+href=["']([^"']*-\d+-sezon-\d+-bolum\/?[^"']*)["'][^>]*(?:title=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = re.exec(html)) && items.length < (limit || 60)) {
      const url = absoluteUrl(base, match[1]).replace(/\?.*$/, "");
      const title = stripTags(match[2] || match[3]);
      if (!title || /\btur=/i.test(match[1])) continue;
      const pos = Math.max(0, match.index - 900);
      const block = html.slice(pos, Math.min(html.length, re.lastIndex + 900));
      items.push(new MultimediaItem({
        title: title,
        url: url,
        posterUrl: firstImageUrl(block, base),
        type: "series"
      }));
    }
    return uniqueByUrl(items);
  }

  function parseSeriesCards(html, base, limit) {
    const items = [];
    const re = /<a[^>]+href=["']([^"']+)["'][^>]*(?:title=["']([^"']+)["'])?[^>]*>([\s\S]*?)<\/a>/gi;
    let match;
    while ((match = re.exec(html)) && items.length < (limit || 50)) {
      const url = absoluteUrl(base, match[1]).replace(/\?.*$/, "");
      if (!/^https?:\/\/[^/]+\/[^/?#]+\/$/i.test(url)) continue;
      if (/-\d+-sezon-\d+-bolum\/?$/i.test(url) || /\/(?:tur|dizi-arsivi|tum-bolumler|uye-ol|iletisim)\//i.test(url)) continue;
      const title = stripTags(match[2] || match[3]);
      if (!title || title.length < 2 || /^[A-Z#]$/i.test(title) || /Dizibox|Uye|Giris|Menu/i.test(title)) continue;
      const pos = Math.max(0, match.index - 700);
      const block = html.slice(pos, Math.min(html.length, re.lastIndex + 900));
      items.push(new MultimediaItem({
        title: title,
        url: url,
        posterUrl: firstImageUrl(block, base),
        type: "series"
      }));
    }
    return uniqueByUrl(items);
  }

  function parseEpisodes(html, base) {
    const episodes = [];
    const re = /<div[^>]+class=["'][^"']*bolumust[^"']*["'][\s\S]*?<a[^>]+href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>\s*<\/div>/gi;
    let match;
    while ((match = re.exec(html))) {
      const url = absoluteUrl(base, match[1]).replace(/\?.*$/, "");
      const title = stripTags(match[2]);
      const se = parseSeasonEpisode(title, url);
      episodes.push(new Episode({
        name: title || ("S" + se.season + "E" + se.episode),
        url: url,
        season: se.season,
        episode: se.episode
      }));
    }

    if (episodes.length) return uniqueByUrl(episodes).sort(function (a, b) {
      return (a.season || 0) - (b.season || 0) || (a.episode || 0) - (b.episode || 0);
    });

    return parseEpisodeCards(html, base, 80).map(function (item) {
      const se = parseSeasonEpisode(item.title, item.url);
      return new Episode({
        name: item.title,
        url: item.url,
        season: se.season,
        episode: se.episode,
        posterUrl: item.posterUrl
      });
    });
  }

  function parseIframeUrls(html, base) {
    const urls = [];
    const re = /<iframe[^>]+(?:src|data-src)=["']([^"']+)["'][^>]*>/gi;
    let match;
    while ((match = re.exec(html))) {
      const url = absoluteUrl(base, match[1]);
      if (/youtube/i.test(url)) continue;
      if (urls.indexOf(url) === -1) urls.push(url);
    }
    return urls;
  }

  function parseOkMetadata(html) {
    const match = /&quot;metadata&quot;:&quot;([\s\S]*?)&quot;,&quot;(?:saveLastPlayingTimeFrom|castId|noDownload)/.exec(html);
    if (!match) return null;
    const raw = match[1]
      .replace(/\\&quot;/g, '"')
      .replace(/&quot;/g, '"')
      .replace(/\\u0026/g, "&")
      .replace(/\\&/g, "&")
      .replace(/&amp;/g, "&");
    return JSON.parse(raw);
  }

  function qualityRank(name) {
    const ranks = { full: 6, hd: 5, sd: 4, low: 3, lowest: 2, mobile: 1 };
    return ranks[String(name || "").toLowerCase()] || 0;
  }

  function streamsFromOkMetadata(meta, iframeUrl) {
    const streams = [];
    const headers = { Referer: iframeUrl, "User-Agent": UA };
    const videos = (meta && meta.videos || []).filter(function (video) {
      return video && video.url && !video.disallowed;
    }).sort(function (a, b) {
      return qualityRank(b.name) - qualityRank(a.name);
    });
    for (const video of videos) {
      streams.push(new StreamResult({
        url: video.url,
        source: "OK.ru " + String(video.name || "Video").toUpperCase(),
        headers: headers
      }));
    }
    if (meta && meta.hlsManifestUrl) {
      streams.push(new StreamResult({
        url: meta.hlsManifestUrl,
        source: "OK.ru HLS",
        headers: headers
      }));
    }
    return streams;
  }

  async function getHome() {
    const cb = cbFrom(arguments);
    try {
      const base = baseUrl();
      const home = await request(base + "/");
      cb({
        success: true,
        data: {
          "Son Bolumler": parseEpisodeCards(home, base, 36),
          "Diziler": parseSeriesCards(home, base, 36)
        }
      });
    } catch (e) {
      cb({ success: false, errorCode: "HOME_FAILED", message: String(e && e.message || e) });
    }
  }

  async function search(query) {
    const cb = cbFrom(arguments);
    try {
      const base = baseUrl();
      const html = await request(base + "/?s=" + encodeURIComponent(String(query || "")));
      cb({ success: true, data: uniqueByUrl(parseEpisodeCards(html, base, 30).concat(parseSeriesCards(html, base, 30))) });
    } catch (e) {
      cb({ success: false, errorCode: "SEARCH_FAILED", message: String(e && e.message || e) });
    }
  }

  async function load(url) {
    const cb = cbFrom(arguments);
    try {
      const base = baseUrl();
      const pageUrl = absoluteUrl(base, url).replace(/\?.*$/, "");
      const html = await request(pageUrl);
      const h1 = stripTags((/<h1[^>]*>([\s\S]*?)<\/h1>/i.exec(html) || [])[1] || "");
      const poster = firstImageUrl(html, base) || metaContent(html, "og:image");
      const description = stripTags((/<div[^>]+class=["'][^"']*(?:category_desc|article-summary-content)[^"']*["'][^>]*>([\s\S]*?)<\/div>/i.exec(html) || [])[1] || metaContent(html, "og:description"));

      if (/-\d+-sezon-\d+-bolum\/?$/i.test(pageUrl)) {
        const se = parseSeasonEpisode(h1, pageUrl);
        cb({
          success: true,
          data: new MultimediaItem({
            title: h1.replace(/\s+\d+\.\s*Sezon\s+\d+\.\s*Bolum.*$/i, "").replace(/\s+\d+\.\s*Sezon\s+\d+\.\s*Bölüm.*$/i, "").trim() || h1,
            url: pageUrl,
            posterUrl: poster,
            type: "series",
            description: description,
            episodes: [
              new Episode({
                name: h1,
                url: pageUrl,
                season: se.season,
                episode: se.episode,
                posterUrl: poster
              })
            ]
          })
        });
        return;
      }

      cb({
        success: true,
        data: new MultimediaItem({
          title: h1.replace(/\s+Dizisi izle.*$/i, "").trim() || metaContent(html, "og:title"),
          url: pageUrl,
          posterUrl: poster,
          type: "series",
          description: description,
          episodes: parseEpisodes(html, base)
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
      const html = await request(url);
      const iframeUrls = parseIframeUrls(html, base);
      let streams = [];

      for (const iframeUrl of iframeUrls) {
        if (/ok\.ru\/videoembed\//i.test(iframeUrl)) {
          const iframeHtml = await request(iframeUrl, { Referer: url });
          streams = streams.concat(streamsFromOkMetadata(parseOkMetadata(iframeHtml), iframeUrl));
        }
      }

      if (!streams.length) throw new Error("Stream URL not found");
      cb({ success: true, data: streams });
    } catch (e) {
      cb({ success: false, errorCode: "STREAM_FAILED", message: String(e && e.message || e) });
    }
  }

  globalThis.getHome = getHome;
  globalThis.search = search;
  globalThis.load = load;
  globalThis.loadStreams = loadStreams;
})();
