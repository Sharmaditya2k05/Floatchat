# Deploying FloatChat on Oracle Cloud (Always Free tier)

Everything below stays inside Oracle's **Always Free** allowance — no card charges, no upgrade to Pay-As-You-Go needed:

| Resource | Always Free allowance | What FloatChat uses |
|---|---|---|
| Ampere A1 (ARM) compute | 4 OCPU + 24 GB RAM total | 1 VM: 2 OCPU / 12 GB (leaves headroom) |
| Block/boot storage | 200 GB total | 100 GB boot volume |
| Outbound data | 10 TB / month | negligible |

The VM runs the whole stack with Docker Compose: PostGIS, the FastAPI backend, and Caddy serving the built frontend (`docker-compose.prod.yml`). The database is shipped up as a `pg_dump`, so the server never re-downloads ARGO.

---

## 1 · Create the account

1. Go to <https://www.oracle.com/cloud/free/> → **Start for free**. You'll need a card for identity verification; it is not charged on Always Free resources.
2. **Home region** — pick one close to you (e.g. *India South (Hyderabad)* or *India West (Mumbai)*). This can't be changed later, and Always Free VMs can only be created in the home region.
3. Once in the console, note your **compartment** (the root one is fine for this).

## 2 · Create the VM

**Compute → Instances → Create instance**

- **Name:** `floatchat`
- **Image:** click *Change image* → **Canonical Ubuntu 24.04** (the *aarch64* build will be selected automatically once you pick the ARM shape).
- **Shape:** *Change shape* → **Ampere** → `VM.Standard.A1.Flex` → **2 OCPUs, 12 GB** (the "Always Free-eligible" badge must show).
- **Networking:** keep *Create new virtual cloud network* + *Assign a public IPv4 address*.
- **SSH keys:** *Generate a key pair* → download the private key (`ssh-key-….key`), or paste your own public key.
- **Boot volume:** tick *Specify a custom boot volume size* → **100 GB**.
- **Create.**

> **"Out of host capacity"?** This is common for free A1 shapes. Try: another availability domain (AD-1/2/3) if your region has more than one; a smaller shape (1 OCPU / 6 GB also works); or simply retry a few times a day — capacity frees up. If A1 capacity never appears, the AMD `VM.Standard.E2.1.Micro` shape (1 GB RAM) also works with a few adjustments — see **[Running on the 1 GB E2.1.Micro shape](#running-on-the-1-gb-e21micro-shape)** below. The live demo runs on exactly that.

## 3 · Open ports 80 and 443 in the cloud firewall

Oracle has two firewalls. First the cloud one:

**Networking → Virtual cloud networks → your VCN → Security Lists → Default Security List → Add Ingress Rules**

| Source CIDR | Protocol | Dest. port |
|---|---|---|
| `0.0.0.0/0` | TCP | `80` |
| `0.0.0.0/0` | TCP | `443` |

(SSH on 22 is already there.) The second firewall — inside Ubuntu — is opened by the setup script in step 5.

## 4 · Connect

From your laptop (Git Bash / PowerShell), with the key you downloaded:

```bash
chmod 400 ~/Downloads/ssh-key-*.key
```

```bash
ssh -i ~/Downloads/ssh-key-*.key ubuntu@<VM_PUBLIC_IP>
```

The public IP is on the instance page.

## 5 · Set up the server (one time)

From your laptop (Git Bash) — this works even though the repo is private, because the script is piped over SSH:

```bash
ssh -i ~/.ssh/floatchat.key ubuntu@<VM_PUBLIC_IP> 'bash -s' < deploy/server_setup.sh
```

This installs Docker + Compose, adds a 4 GB swap file, and opens 80/443 in Ubuntu's iptables.

## 6 · Get the code and configure it

Copy the repo snapshot to the VM (again from your laptop):

```bash
git archive HEAD | ssh -i ~/.ssh/floatchat.key ubuntu@<VM_PUBLIC_IP> 'mkdir -p ~/FloatChat && tar -x -C ~/FloatChat'
```

Then SSH in and `cd ~/FloatChat`.

Create the production `.env` (this file is git-ignored; it's the only secret on the box):

```bash
cat > .env <<'EOF'
LLM_PROVIDER=groq
LLM_MODEL=openai/gpt-oss-120b
GROQ_API_KEY=gsk_...your key...
EMBED_BACKEND=tfidf
RAG_TOP_K=6
MAX_ROWS=500
SQL_STATEMENT_TIMEOUT_MS=5000
DEV_MODE=false
POSTGRES_PASSWORD=choose-a-long-random-password
EOF
```

`DATABASE_URL` / `DATABASE_URL_ADMIN` are set by `docker-compose.prod.yml` to point at the `db` container, so don't add them here. Leave `SITE_ADDRESS` unset for plain HTTP on the IP.

## 7 · Build the images on your laptop and start the stack

Ship the images (builds locally, uploads ~200 MB, loads them on the VM):

```bash
bash deploy/ship_images.sh ubuntu@<VM_PUBLIC_IP> ~/.ssh/floatchat.key
```

> On an ARM (A1) VM you can instead build on the server with `docker compose -f docker-compose.prod.yml up -d --build` — but note the laptop-built images are x86, so for ARM you must build on the server.

Then on the VM:

```bash
docker compose -f docker-compose.prod.yml up -d
```

Check:

```bash
docker compose -f docker-compose.prod.yml ps
```

All three (`floatchat-db`, `floatchat-api`, `floatchat-web`) should be `running`/`healthy`. The database is empty at this point — the UI loads, but every answer is "no matching records".

## 8 · Ship the data

**On your laptop** (with the local `floatchat-db` container running):

```bash
bash deploy/dump_db.sh
```

That writes `deploy/floatchat.dump` (~200 MB, compressed). Copy it up:

```bash
scp -i ~/Downloads/ssh-key-*.key deploy/floatchat.dump ubuntu@<VM_PUBLIC_IP>:~/FloatChat/deploy/
```

**On the VM**, restore it (a few minutes):

```bash
bash deploy/restore_db.sh
```

It prints row counts for `profiles`, `pfz_advisories`, `sst_composites` at the end.

## 9 · Open it

`http://<VM_PUBLIC_IP>` — the header pill should read **Data live**; try *"Current fishing zones near Kochi"*.

## 10 · Keep the satellite data fresh (automatic)

The fisheries layer comes from open NOAA feeds, so the server can refresh itself. Once, from your laptop:

```bash
ssh -i ~/.ssh/floatchat.key ubuntu@<VM_PUBLIC_IP> 'bash ~/FloatChat/deploy/install_cron.sh'
```

That schedules `deploy/refresh_fisheries.sh` every day at 03:30 UTC (09:00 IST). It runs `python -m ingest.fisheries_fetch` inside the API container: the last 14 days of NOAA OISST sea-surface temperature, the last 7 days of VIIRS chlorophyll, and freshly derived fishing zones — replacing the previous window, so the tables never grow unbounded. No laptop involved, nothing for you to do. Check on it any time:

```bash
ssh -i ~/.ssh/floatchat.key ubuntu@<VM_PUBLIC_IP> 'tail -20 ~/fisheries_refresh.log'
```

Run it by hand (e.g. right after deploying):

```bash
ssh -i ~/.ssh/floatchat.key ubuntu@<VM_PUBLIC_IP> 'bash ~/FloatChat/deploy/refresh_fisheries.sh'
```

Only the fisheries tables refresh; the ARGO float data is a fixed pilot window and still moves via dump/restore.

---

## Running on the 1 GB E2.1.Micro shape

`VM.Standard.E2.1.Micro` (1 OCPU, 1 GB RAM, x86) is the shape Oracle always has capacity for. The stack fits, with three changes from the walkthrough above — this is how the live demo at <http://80.225.245.19> is deployed:

1. **Never build the frontend on the server.** A Vite/Node build needs more than 1 GB. Build it on your laptop and copy the result up; `docker-compose.micro.yml` serves it with a stock Caddy image, so only the small API image is built on the VM.

   ```bash
   cd frontend && npm ci && npm run build && cd ..
   tar --exclude=frontend/node_modules -czf /tmp/floatchat.tgz Dockerfile .dockerignore requirements.txt docker-compose.micro.yml app rag ingest db deploy frontend/dist frontend/Caddyfile
   scp -i ~/.ssh/floatchat.key /tmp/floatchat.tgz ubuntu@<VM_PUBLIC_IP>:/tmp/
   ssh -i ~/.ssh/floatchat.key ubuntu@<VM_PUBLIC_IP> 'mkdir -p ~/FloatChat && tar -xzf /tmp/floatchat.tgz -C ~/FloatChat'
   ```

   Then on the VM, after creating `.env` as in step 6:

   ```bash
   cd ~/FloatChat && docker compose -f docker-compose.micro.yml build api && docker compose -f docker-compose.micro.yml up -d
   ```

   Use `-f docker-compose.micro.yml` in place of `docker-compose.prod.yml` in every later command (restarts, `exec`, cron). `deploy/refresh_fisheries.sh` works unchanged because both files share the same project name and container names.

2. **Load the data on the server instead of shipping a dump.** With no local Docker there is nothing to `pg_dump`, so run the ingest inside the API container, a few months at a time (each 3-month window of the Indian Ocean takes ~10 minutes and ~200 MB):

   ```bash
   docker compose -f docker-compose.micro.yml exec -T api python -m ingest.fisheries_fetch --days 14
   docker compose -f docker-compose.micro.yml exec -T api python -m ingest.build_db --start 2023-10-01 --end 2023-12-31
   docker exec floatchat-db psql -U floatchat_admin -d floatchat -c "GRANT SELECT ON ALL TABLES IN SCHEMA public TO floatchat_ro;"
   ```

   Run a long load under `nohup … &` so an SSH drop doesn't kill it. The 4 GB swap file from `server_setup.sh` is what keeps Postgres + the ingest alive at 1 GB; expect ~200 MB of RAM free while a load runs.

3. **Tell users what's loaded.** The frontend shows a one-time notice (`DataLimitNotice.tsx`) with the loaded ARGO date range, read live from `/api/data/overview`, so questions outside the window don't look like bugs.

Memory headroom on this shape is small: `docker-compose.micro.yml` runs Postgres with `shared_buffers=96MB`, `work_mem=4MB` and 20 connections. Full 2019–2023 ARGO (≈40 M measurements) will not fit comfortably; one year is a sensible ceiling.

---

## Updating later

Run these from Git Bash on your laptop (the repo is private and the VM is small, so images are built locally and shipped over SSH rather than pulled/built on the server).

**Code changed** — rebuild, ship, restart:

```bash
bash deploy/ship_images.sh ubuntu@<VM_PUBLIC_IP> ~/.ssh/floatchat.key
ssh -i ~/.ssh/floatchat.key ubuntu@<VM_PUBLIC_IP> 'cd ~/FloatChat && docker compose -f docker-compose.prod.yml up -d'
```

**Config / scripts changed** (`docker-compose.prod.yml`, `db/*.sql`, `deploy/*`) — copy the repo snapshot first, then the same `up -d`:

```bash
git archive HEAD | ssh -i ~/.ssh/floatchat.key ubuntu@<VM_PUBLIC_IP> 'tar -x -C ~/FloatChat'
```

**Satellite fisheries data** — refreshes itself nightly (step 10); nothing to do.

**ARGO data changed** (re-ingest) or fisheries CSV exports loaded locally — dump locally, upload, restore:

```bash
bash deploy/dump_db.sh
scp -i ~/.ssh/floatchat.key deploy/floatchat.dump ubuntu@<VM_PUBLIC_IP>:~/FloatChat/deploy/
ssh -i ~/.ssh/floatchat.key ubuntu@<VM_PUBLIC_IP> 'cd ~/FloatChat && bash deploy/restore_db.sh'
```

**`.env` changed** (LLM key, `SITE_ADDRESS`) — edit it on the VM with `nano ~/FloatChat/.env`, then `docker compose -f docker-compose.prod.yml up -d`.

**Small-VM note.** On a 1 GB shape, never run `up --build` on the server — always ship images from your laptop. `server_setup.sh` adds a 4 GB swap file and the compose file uses low-memory Postgres settings for this reason.

## Adding HTTPS with a domain (optional, still free)

1. Point an `A` record at the VM's public IP.
2. Add `SITE_ADDRESS=floatchat.yourdomain.in` to `.env`.
3. `docker compose -f docker-compose.prod.yml up -d` — Caddy fetches a Let's Encrypt certificate automatically and redirects HTTP → HTTPS.

## Troubleshooting

| Symptom | Fix |
|---|---|
| Browser can't reach the IP at all | Security-list rule (step 3) missing, or `server_setup.sh` didn't run — check `sudo iptables -L INPUT -n \| grep 80` |
| Page loads, pill says **DB offline** | `docker compose -f docker-compose.prod.yml logs api` — usually the restore hasn't run or `POSTGRES_PASSWORD` in `.env` changed after first start (the db volume keeps the original; `docker volume rm floatchat_pgdata` to reset) |
| Answers come from the rule engine (badge says *rule*) | Groq key invalid/expired — check `logs api` for `401` |
| "Out of host capacity" when creating the VM | See step 2 |
| VM reclaimed after inactivity | Oracle can reclaim idle Always Free VMs; the compose stack restarts itself on reboot (`restart: unless-stopped`). Keeping it in use avoids reclamation |
| Fisheries "latest" dates stop advancing | `tail ~/fisheries_refresh.log` on the VM — usually NOAA ERDDAP was briefly down; the next night's run catches up. `crontab -l` should show the `refresh_fisheries.sh` line |
