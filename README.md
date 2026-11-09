# Lore Web UI

[![Build status](https://img.shields.io/github/actions/workflow/status/juddisjudd/lore-webgui/docker.yml?branch=main&style=flat-square&label=build&labelColor=000000)](https://github.com/juddisjudd/lore-webgui/actions/workflows/docker.yml)
[![License: MIT](https://img.shields.io/github/license/juddisjudd/lore-webgui?style=flat-square&labelColor=000000&color=555555)](LICENSE)
[![Container image on GHCR](https://img.shields.io/badge/image-ghcr.io-555555?style=flat-square&labelColor=000000&logo=docker&logoColor=white)](https://github.com/juddisjudd/lore-webgui/pkgs/container/lore-webgui)

A web interface for [Lore](https://github.com/EpicGames/lore), the open source version control system from Epic Games. Browse repositories, read history, inspect files and diffs, and manage branches from a browser.

![Repository page with code and asset breakdown](docs/screenshots/repository.png)

## Features

- **Files.** Browse any branch or revision. Text files open with line numbers. Images, audio and video play inline. Everything else downloads.
- **History and diffs.** Each revision shows its changed files with line diffs for text and side-by-side previews for images.
- **Branches.** Create a branch from any revision and delete branches you no longer need. Create new repositories.
- **Compare branches.** See what one branch would bring into another: its revisions, its changed files, and the files both branches changed, which will conflict when you merge.
- **File locks.** The Locks tab lists every locked file on a branch, with its owner and lock time. Locked files and the folders that contain them show a lock in the file list. Locks are read-only here; take and release them with `lore lock`.
- **Live updates.** Open pages refresh by themselves when someone pushes, creates or deletes a branch, or locks or unlocks a file.
- **Accounts.** People sign in with accounts an admin creates. Roles decide who only browses, who creates repositories and branches, and who manages users.
- **Repository stats.** Badges show the languages on a branch and its game assets by type: textures, models, sounds, video, fonts, and Unreal, Unity and Godot assets.
- **Keyboard and themes.** Press `1` to `4` to switch between Files, History, Branches and Locks. Light and dark themes follow your system setting.

## Quick start

You need [Bun](https://bun.sh) 1.4 or newer, Node.js 22.17 or newer, and a running Lore server. Setup takes about 2 minutes.

1. Clone the repository and install dependencies:

   ```sh
   git clone https://github.com/juddisjudd/lore-webgui.git
   cd lore-webgui
   bun install
   ```

2. Start the app and point it at your Lore server:

   ```sh
   LORE_HOST=lore.local bun run dev
   ```

   In PowerShell:

   ```powershell
   $env:LORE_HOST = "lore.local"; bun run dev
   ```

3. Open <http://localhost:5173>. The first visit asks for the setup code that the gateway printed in your terminal, then creates your admin account.

Leave out `LORE_HOST` to connect to a server on `localhost`.

## How it works

Browsers cannot talk to a Lore server directly. Lore speaks gRPC over HTTP/2 and QUIC, and offers no gRPC-Web or CORS support. A small gateway runs next to the web app and translates.

```
browser ──JSON──▶ gateway ──gRPC──▶ Lore server :41337
                          ──HTTP──▶ Lore server :41339  (file content)
```

For live updates, the gateway subscribes to the Lore server's event stream for each open repository and passes the events to the browser as Server-Sent Events. A browser tab connects only while it is visible.

The project is a Bun workspace with three packages:

| Package | Role |
| --- | --- |
| `packages/api` | The HTTP contract between browser and gateway, written once with [Effect](https://effect.website) `HttpApi` and `Schema`. Both sides import it, so the type checker catches any mismatch between them. |
| `packages/gateway` | A Bun server built with Effect. It calls Lore through gRPC clients generated from Lore's protobuf files, computes text diffs and repository stats, streams file content, and serves the built web app. |
| `packages/web` | A [SvelteKit](https://svelte.dev) single-page app using Svelte 5. |

The gateway also publishes OpenAPI documentation at `/api/docs`.

## Run in production

1. Build the web app:

   ```sh
   bun run build
   ```

2. Start the gateway:

   ```sh
   LORE_HOST=lore.local bun run start
   ```

3. Open <http://localhost:7337>. One process serves both the app and the API.

If a reverse proxy sits in front of the gateway, it must not buffer `/api/repositories/*/events`, or live updates arrive late. The gateway sends `X-Accel-Buffering: no`, which nginx honors.

## Run with Docker

Images for `linux/amd64` and `linux/arm64` are published to the GitHub Container Registry. Each image contains the built web app and the gateway bundled into a single file. It runs as a non-root user and reports its status through a Docker health check on `/api/health`.

1. Start the container:

   ```sh
   docker run -d --name lore-webgui -p 7337:7337 -v lore-webgui-data:/data -e LORE_HOST=lore.local ghcr.io/juddisjudd/lore-webgui:latest
   ```

2. Print the setup code for the first admin:

   ```sh
   docker logs lore-webgui
   ```

3. Open <http://localhost:7337> and enter the code.

Keep the volume at `/data`. It holds the accounts database, and without it the accounts are lost each time the container is recreated.

### Update a container from a version without accounts

Newer images require sign-in. To update a container that runs an older image:

1. Pull the new image: `docker pull ghcr.io/juddisjudd/lore-webgui:latest`
2. Remove the old container: `docker rm -f lore-webgui`
3. Start it again with the volume at `/data`, as in step 1 above.
4. Run `docker logs lore-webgui` and copy the setup code.
5. Open the web UI, enter the code and create the admin.

To see who did what in Lore, also set `trust_unsigned_identity = true` on the Lore server, as [Names in Lore](#names-in-lore) describes.

Each push to `main` publishes `latest` and a tag for the short commit hash. Each version tag such as `v0.1.0` publishes `0.1.0` and `0.1`.

### Docker Compose

From a clone of this repository:

```sh
LORE_HOST=lore.local docker compose up -d
```

In PowerShell:

```powershell
$env:LORE_HOST = "lore.local"; docker compose up -d
```

Run `docker compose logs lore-webgui` to see the setup code. Compose keeps the accounts database in the `lore-webgui-data` volume.

Compose pulls the published image. Add `--build` to build it from your local source instead. Leave out `LORE_HOST` to reach a Lore server running on the Docker host itself. Compose passes `PORT` and `LORE_TOKEN` through as well.

## Accounts

The web UI keeps its own accounts in a SQLite file in `DATA_DIR`.

### First admin

On first start, the gateway has no accounts and prints a one-time setup code in its log:

```
No accounts yet. Open the web UI and enter this setup code to create the first admin: …
```

1. Open the web UI. It shows the setup page.
2. Paste the code, then choose the admin's username and password.

The code works once. If the gateway restarts before anyone uses it, the gateway prints a new one.

### Roles

| Role | Can |
| --- | --- |
| Viewer | Browse repositories, history, files, locks and branch comparisons. |
| Member | Everything a viewer can, plus create repositories and create or delete branches. |
| Admin | Everything a member can, plus manage users and delete repositories through the API. |

An admin adds people on the Users page with a temporary password. Each person chooses their own password at first sign-in. Ten wrong passwords in a row lock a username for 15 minutes.

### Names in Lore

The gateway sends the signed-in username with each call to Lore, so branches and repositories created in the web UI show who made them. Lore reads the name only when its configuration trusts unsigned identities:

```toml
[server]
trust_unsigned_identity = true
```

Without that setting, Lore records web UI actions as `<unknown>`. Lore does not check these names, so turn the setting on only if you trust everyone who can reach the Lore server. When `LORE_TOKEN` is set, the gateway sends that token instead, and Lore records the token's identity.

### Turning accounts off

Set `AUTH=off` to run without sign-in, for example behind a reverse proxy that signs people in. Everyone then has full access.

## Configuration

The gateway reads these environment variables:

| Variable | Default | Purpose |
| --- | --- | --- |
| `LORE_HOST` | `localhost` | Host of the Lore server. Sets both URLs below. |
| `LORE_GRPC_URL` | `http://$LORE_HOST:41337` | Lore gRPC endpoint. |
| `LORE_HTTP_URL` | `http://$LORE_HOST:41339` | Lore HTTP endpoint, used for file content. |
| `LORE_TOKEN` | none | Bearer token to send when the Lore server requires authentication. |
| `PORT` | `7337` | Port the gateway listens on. |
| `STATIC_DIR` | `packages/web/build` | Folder of the built web app. |
| `MAX_DIFF_BYTES` | `2097152` | Files larger than this are not diffed. |
| `HISTORY_CONCURRENCY` | `16` | Parallel revision lookups per page of history. |
| `AUTH` | `accounts` | `accounts` requires sign-in. `off` gives everyone full access. |
| `DATA_DIR` | `data` | Folder for the accounts database, relative to the gateway's working folder. The Docker image uses `/data`. |

In development, set `GATEWAY_URL` to point the Vite dev server at a gateway on another address. The default is `http://localhost:7337`.

## Repository stats

The badges describe the latest revision of the selected branch. Code badges show languages weighted by file size, the way GitHub counts them. Data and prose files such as Markdown, JSON and TOML do not count. Asset badges show the file count and total size for each asset type.

The gateway classifies files by extension. It skips vendored code and engine output folders, including `ThirdParty`, `Intermediate`, `DerivedDataCache`, `Library` and `node_modules`. Results are cached per revision. Revisions never change, so the cache never needs clearing. The first request for a large repository reads its full file tree once.

![Revision page with an image diff and a text diff](docs/screenshots/revision.png)

## Development

```sh
bun run check   # type checks: tsc for api and gateway, svelte-check for web
bun run test    # gateway unit tests
bun run build   # production build of the web app
```

The generated gRPC code in `packages/gateway/src/gen` is committed. To refresh it after Lore's protobuf files change:

1. Clone [EpicGames/lore](https://github.com/EpicGames/lore) into a folder named `lore` next to this repository.
2. Run `bun run gen`.

## Known limitations

- Accounts protect the web UI only. Anyone who can reach the Lore server directly can still use the Lore CLI with whatever access the server allows.
- Repositories can only be deleted through the API (`DELETE /api/repositories/:repo`). Lore deletes them permanently, so the UI has no button for it.
- Downloads show no progress bar. Bun drops the `Content-Length` header on streamed responses.
- The server does not implement `ContentDiff` yet, so the gateway computes diffs itself. `RevisionTree` also leaves out the folder you ask for, so the gateway reads it from the parent folder.
- The clone command shown on an empty branch uses the gateway's `LORE_HOST`. A gateway that uses `localhost` shows `localhost` to every visitor.

## License

[MIT](LICENSE)
