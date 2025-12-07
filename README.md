# Musix — Minimal Web Audio Player

A small, self-contained web audio player that combines tracks from Audius and Jamendo and supports searching and playback. The project uses vanilla HTML/CSS/JS and the Web Audio API for visualization.

This README explains where the app fetches data from, how to obtain and configure API keys (where needed), how to run locally, and common troubleshooting tips.

## What this project includes

- `index.html` — markup for the player and search UI.
- `style.css` — styling and responsive layout.
- `script.js` — player implementation, API fetching, search, and Web Audio visualization.

## Data sources / APIs used

The app integrates with two public music APIs:

1. Audius
   - Purpose: Trending tracks and searching for tracks. The app uses the Audius public discovery endpoints to obtain a working host, then requests streaming endpoints from that host.
   - No API key is required for the discovery endpoints used in this project. The client requests `https://api.audius.co` to get an available host and then calls endpoints on that host (for example `/v1/tracks/trending` and `/v1/tracks/search`).
   - Notes: Audius hosts are provided dynamically and may change. Some hosts or specific tracks might not allow cross-origin streaming or may have rate limits. If you see occasional failures, it's often due to the chosen Audius host or temporary CORS policy differences.

2. Jamendo
   - Purpose: Public track search and direct MP3 previews.
   - Jamendo requires a `client_id` for API requests. The repository currently uses a public/test `client_id` in `script.js` (variable `JAMENDO_CLIENT_ID`). For production or long-term use, register your own client id.
   - How to register: Go to https://developer.jamendo.com and create an application. The developer dashboard will provide you a `client_id` and usage instructions.

3. (Optional) Other APIs
   - The code is structured so you can add other providers if you need more results, better CORS support, or a different catalogue.

## Configuration

1. Jamendo client id
   - Open `script.js` and locate the top-level constant `JAMENDO_CLIENT_ID`.
   - Replace the example/test client id with your own (e.g., `const JAMENDO_CLIENT_ID = "your_client_id_here";`).

2. Audius
   - No API keys are required for the discovery calls used here. The app requests a host from `https://api.audius.co` and uses that host for subsequent streaming/search calls.

## How to run locally

1. Simple file server (recommended)

It's best to serve the files over a local HTTP server (some browsers block audio CORS or module loading from `file://`):

- Using Python 3:

```bash
# from the project root (/home/aman/DDD/musix)
python3 -m http.server 8080
# then open http://localhost:8080 in your browser
```

- Using Node.js `serve` (if you have npm):

```bash
npm install -g serve
serve .
```

2. Open the page in a modern browser (Chrome, Firefox, Edge). Audio and the Web Audio API require a browser with active audio support. Mobile browsers work, but some autoplay restrictions may apply.

## Using the search

- Type an artist or track name into the search box and press Enter or click Search.
- The app queries Audius and Jamendo in parallel and populates the playlist with results.
- Click a playlist item to load and play the preview/stream.

## Troubleshooting

- No results / empty playlist
  - Check your network and ensure the host returned by `https://api.audius.co` is reachable.
  - Verify `JAMENDO_CLIENT_ID` is set and valid (if Jamendo returns no results, it could be due to an invalid key or quota). You can test the Jamendo search endpoint directly in the browser using the dashboard examples.

- Tracks won't play
  - The streaming URL may not allow cross-origin requests. Check the browser console for CORS errors. If the audius host refuses cross-origin streaming for a track, try another search or wait for a different host.
  - Autoplay restrictions: browsers may block autoplay for un-muted audio. Interact with the page (click anywhere) to allow audio playback, or toggle the play button manually.

- Rate limits or 403/429 responses
  - Public APIs can return rate-limiting responses. If you hit a limit, consider caching results or using your own API credentials (Jamendo) and respecting API terms.

## Extending the project

- Add artwork and metadata: Modify `setupPlaylist` in `script.js` to include artwork URLs returned by the APIs and display them in the playlist items.
- Add debounce for search input to avoid hitting rate limits when typing.
- Add pagination or infinite scroll for large result sets.
- Add server-side proxy (optional) to handle CORS or to cache results.

## Security & legal notes

- Respect the API terms of service for Audius and Jamendo. Jamendo content is typically licensed for non-commercial use unless you license it otherwise.
- Do not ship secret keys in client-side JS. Jamendo `client_id` is public by design, but any confidential credentials or proxies should be kept server-side.

## Contacts and references

- Audius API docs: https://docs.audius.org
- Jamendo API docs: https://developer.jamendo.com

If you'd like, I can:
- Add a small example environment file and a short script to inject a Jamendo client id without editing `script.js` directly.
- Add a troubleshooting section that captures sample console errors and quick fixes.

Tell me which extras you'd like and I'll add them to the README and project.    