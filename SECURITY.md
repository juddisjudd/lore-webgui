# Security policy

## How to report

Keep security issues out of public issues, discussions and pull requests.

1. Open the [Security tab](https://github.com/juddisjudd/lore-webgui/security) of this repository.
2. Click **Report a vulnerability**.
3. Describe the problem in the private form.

Only you and the maintainer can see the report. The maintainer replies in the same private thread and publishes an advisory once a fix is out.

Include what you can of the following:

- What an attacker can do, and what they need first (network access, a link a user must open, and so on)
- Steps to reproduce, or a request that triggers the problem
- The web UI version, shown in the page footer
- How you run it: Docker image, Docker Compose, `bun run start` or `bun run dev`

## Lore server and CLI

This repository covers the web UI and its gateway only. Report vulnerabilities in the Lore server or CLI to Epic Games through [HackerOne](https://hackerone.com/epicgames) or security@epicgames.com, as the [Lore security policy](https://github.com/EpicGames/lore/blob/main/SECURITY.md) describes.

If you are not sure which side a problem belongs to, report it here. The maintainer will pass it on.

## Supported versions

The project is before 1.0. Fixes go into `main` and ship in the next image published to `ghcr.io/juddisjudd/lore-webgui`. Older images do not get backported fixes, so update to `latest` or the newest version tag.

## Deploy it safely

The gateway requires sign-in by default. Every signed-in person reaches Lore through the gateway's one connection, so the web UI's roles decide what each person can do there. With `AUTH=off`, anyone who can reach the gateway can do what its `LORE_TOKEN` allows: read every repository, create repositories and branches, delete branches, and delete repositories through the API.

- Keep the gateway on a private network or VPN. Accounts protect the web UI, but the Lore server behind it may accept anyone who reaches it.
- Serve it over HTTPS when traffic leaves a trusted network. The session cookie is marked `Secure` when a proxy sends `X-Forwarded-Proto: https`.
- Give `LORE_TOKEN` the least access that still works. Every signed-in person uses it.
- Protect the `DATA_DIR` folder. It holds the accounts database.
- Treat the gateway log as secret until the first admin exists. The setup code in it creates that admin.

Passwords are hashed with Argon2id, and the database stores only a hash of each session token. A session lasts 30 days. It ends earlier when the person signs out or changes their password, or when an admin disables the account or resets its password.

Repository files are untrusted content. The gateway serves them with `Content-Security-Policy: sandbox` and `X-Content-Type-Options: nosniff`, so an HTML or SVG file opened from a repository cannot run scripts in the web UI.
