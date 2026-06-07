# SkyStream TR Plugins

SkyStream plugin repository for Turkish sources.

## Plugins

- DiziPal: movies, series, anime, search, details, episodes, and streams.
- HDFilmCehennemi: movies, home lists, list-based search, details, and streams.

## Repository URL

Add this URL in SkyStream:

```text
https://raw.githubusercontent.com/fbasellercau-droid/skystream-dizipal-plugin/main/repo.json
```

## Shortcode

SkyStream resolves shortcodes through Cuttly. The intended shortcode is:

```text
egici
```

For this to work, `https://cutt.ly/sky-egici` must redirect to the repository URL above.

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
npm run test:hdfilmcehennemi
```

## Layout

- `dizipal/`: DiziPal plugin source.
- `hdfilmcehennemi/`: HDFilmCehennemi plugin source.
- `dist/`: packaged `.sky` files and plugin list.
- `domains.txt`: remote domain hints for sources that change domains.
