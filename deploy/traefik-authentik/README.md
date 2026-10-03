# Deploy osapidev with Traefik and Authentik

One Docker Compose stack that runs:

- **Traefik**: HTTPS reverse proxy with automatic Let's Encrypt certificates
- **Authentik**: identity provider; users sign in to osapidev with their Authentik account
- **osapidev**: the All-in-One container (app, admin dashboard and API on one hostname)
- **PostgreSQL**: one database container each for osapidev and Authentik

| URL | What |
| --- | --- |
| `https://OSAPIDEV_HOST/` | osapidev app |
| `https://OSAPIDEV_HOST/admin` | osapidev admin dashboard |
| `https://OSAPIDEV_HOST/backend` | osapidev API (GraphQL at `/backend/graphql`) |
| `https://AUTHENTIK_HOST/` | Authentik (sign-in, user management) |

Authentik's OIDC application for osapidev is created automatically from
[`authentik-blueprints/osapidev.yaml`](authentik-blueprints/osapidev.yaml), and osapidev is
configured for it from the environment, so neither needs setting up by hand.

## Requirements

- A server with Docker Engine and Docker Compose v2
- Two DNS names (A/AAAA records) pointing at the server, for example `osapidev.example.com` and `auth.example.com`
- Ports **80** and **443** reachable from the internet (Let's Encrypt validates on 443)

## 1. Configure

```sh
cd deploy/traefik-authentik
cp .env.example .env
```

Edit `.env`:

| Variable | Value |
| --- | --- |
| `OSAPIDEV_HOST`, `AUTHENTIK_HOST` | Your two DNS names |
| `ACME_EMAIL` | Email for Let's Encrypt notices |
| `DATA_ENCRYPTION_KEY` | Exactly 32 characters: `openssl rand -hex 16`. **Never change it later**: it encrypts secrets stored in the database. |
| `OSAPIDEV_DB_PASSWORD`, `AUTHENTIK_DB_PASSWORD` | `openssl rand -hex 24` each |
| `AUTHENTIK_SECRET_KEY` | `openssl rand -hex 32` |
| `OIDC_CLIENT_SECRET` | `openssl rand -hex 32` (`OIDC_CLIENT_ID` can stay `osapidev`) |
| `AUTHENTIK_ADMIN_EMAIL`, `AUTHENTIK_ADMIN_PASSWORD` | The Authentik admin account (`akadmin`) created on first start |

## 2. Start

```sh
docker compose up -d
```

On first start:

1. Traefik requests the certificates.
2. Authentik creates its admin user and the osapidev application. It takes about 2 minutes to report healthy.
3. `osapidev-migrate` sets up the osapidev database and exits.
4. osapidev starts once Authentik is healthy, because it reads Authentik's OIDC settings at startup.

Follow progress with `docker compose ps` and `docker compose logs -f osapidev`.

## 3. Sign in

1. Open `https://AUTHENTIK_HOST` and sign in as `akadmin` with `AUTHENTIK_ADMIN_PASSWORD`.
   Under **Directory → Users**, create accounts for your team. Each user needs an email address, which osapidev uses to identify the account.
2. Open `https://OSAPIDEV_HOST/admin` and choose **Continue with SSO**.
   **The first account to sign in to the admin dashboard becomes the osapidev admin**, so do this yourself first.
3. Everyone else just opens `https://OSAPIDEV_HOST`. Sign-in is required (`OSAPIDEV_REQUIRE_LOGIN=true`), so visitors go straight to Authentik's sign-in page and come back signed in.
   After signing out of osapidev they see a **Sign in to continue** page instead of being signed straight back in.

To limit who can use osapidev, open **Applications → osapidev** in Authentik and bind a group or user policy to it.

## Upgrading

```sh
# Set OSAPIDEV_VERSION / AUTHENTIK_TAG / TRAEFIK_TAG in .env, then:
docker compose pull
docker compose up -d
```

Database migrations run automatically before the new osapidev version starts. Read
[Authentik's release notes](https://docs.goauthentik.io/releases/) before raising `AUTHENTIK_TAG`.

## Backups

Everything stateful lives in Docker volumes: `osapidev-db`, `authentik-db`, `authentik-data`
and `letsencrypt`. At a minimum, back up both databases:

```sh
docker compose exec osapidev-db pg_dump -U osapidev osapidev > osapidev.sql
docker compose exec authentik-db pg_dump -U authentik authentik > authentik.sql
```

Also keep a copy of `.env`. Without `DATA_ENCRYPTION_KEY`, the secrets in the osapidev database can't be decrypted.

## How sign-in is wired

- osapidev reads its SSO settings (`OIDC_*`, `VITE_ALLOWED_AUTH_PROVIDERS` and `REQUIRE_LOGIN`) from the environment
  on first start and whenever they change. Edits made in the admin dashboard under
  **Settings → Auth providers** are kept until you change the matching variable in `.env`.
- With sign-in required, share links (`/r/...`) only open for signed-in users. Published documentation
  (`/view/...`) stays public, since publishing is an explicit share.
- osapidev matches users by email and refuses emails the identity provider marks as unverified.
  Authentik's built-in `email` scope always says "unverified". The blueprint replaces it with
  a scope that reports an email as verified only when the user **cannot change it themselves**.
  That's Authentik's default, so an admin manages every address.
  - If you allow users to change their own email (System → Settings, or the
    `goauthentik.io/user/can-change-email` attribute), those users can no longer sign in to osapidev.
    This is intentional: otherwise a user could take over someone else's osapidev account by
    switching to that person's email.
  - If you enable self-registration in Authentik, include an **Email verification** stage in the
    enrollment flow. Otherwise anyone could register with someone else's address.
- The osapidev container reaches Authentik through Traefik. A network alias resolves
  `AUTHENTIK_HOST` to Traefik inside the Docker network, so the server doesn't need hairpin NAT.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| **Continue with SSO** returns `503 auth/oidc_provider_unavailable` | osapidev couldn't reach Authentik when it started. Check `docker compose logs osapidev \| grep OIDC`, then `docker compose restart osapidev`. |
| Sign-in fails with `auth/email_not_verified_by_oidc` | The user may change their own email in Authentik. See *How sign-in is wired*. |
| Sign-in fails with `auth/email_not_provided_by_oauth` | The Authentik user has no email address. |
| Browser shows a certificate warning | Let's Encrypt couldn't validate: check DNS and that port 443 is open, then `docker compose logs traefik`. |
| Authentik says `redirect_uri` is invalid | `OSAPIDEV_HOST` changed after first start. Run `docker compose restart authentik-worker` so the blueprint is re-applied. |
