# SkyStream TR Plugins

SkyStream plugin repository for Turkish sources.

## Plugins

- DiziPal: movies, series, anime, search, details, episodes, and streams.
- DiziBox: series, episodes, search, details, and OK.ru streams.

HDFilmCehennemi is not in the active plugin list because the current stream
hosts resolve to unusable endpoints during verification. UğurFilm is not in the
active plugin list because the current public domains fail connection checks.

## Repository URL

Add this URL in SkyStream:

```text
https://raw.githubusercontent.com/fbasellercau-droid/skystream-dizipal-plugin/main/repo.json
```

## Shortcode

SkyStream resolves shortcodes through Cuttly. If Cuttly is unavailable on the
device or network, shortcodes will not work in the official SkyStream app.

The intended shortcode is:

```text
egici
```

For this to work, `https://cutt.ly/sky-egici` must redirect to the repository URL above.
Until that redirect exists and Cuttly is reachable, use the full repository URL.

Create or refresh it with a Cuttly API key:

```powershell
$env:CUTTLY_API_KEY = "your-api-key"
npm run shortcode:create
```

## Local checks

```powershell
npm test
```

Run one provider test:

```powershell
npm run test:dizipal
npm run test:dizibox
```

## Layout

- `dizipal/`: DiziPal plugin source.
- `dizibox/`: DiziBox plugin source.
- `dist/`: packaged `.sky` files and plugin list.
- `domains.txt`: remote domain hints for sources that change domains.
