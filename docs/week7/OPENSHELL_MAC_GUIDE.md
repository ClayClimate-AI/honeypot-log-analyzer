# OpenShell on Joseph's Mac: proven setup (Week 7)

Status: PROVEN on this Mac, Oct 30 2026. OpenShell 0.1.6, macOS 26.6.2 (arm64), Docker Desktop 4.96.3 (engine 29.9.2).
Every step below was run on this Mac by the builder with a fake key, then Joseph ran the real-key check himself (Claude Code inside answered "OK").
Your real Anthropic key stays on your Mac, typed by you into the OpenShell provider. Never paste it into chat, a repo file, or a commit.

Already done on this Mac (skip unless you reinstall): Steps 1 to 4. The provider with your real key from the key check is still in the gateway.

Official sources:
- Install: https://docs.nvidia.com/openshell/latest/about/installation
- Support matrix (macOS Docker Desktop, Apple Silicon: Supported; Docker 28.0+): https://docs.nvidia.com/openshell/latest/about/support-matrix
- Policy schema: https://docs.nvidia.com/openshell/latest/how-it-works/policies/schema
- Network rules (real paths, not symlinks): https://docs.nvidia.com/openshell/latest/how-it-works/policies/network-rules
- Provider profiles: https://docs.nvidia.com/openshell/latest/how-it-works/providers/profiles
- claude-code profile: https://github.com/NVIDIA/OpenShell/blob/main/providers/claude-code.yaml
- macOS callback routing (bridge networking): https://github.com/NVIDIA/OpenShell/pull/2739

## What changed from the first draft (and why)
```
Fix
├─ Install: official install.sh, not "brew install nvidia/openshell/openshell"
│  (the script creates that tap locally; there is no public tap to install from)
├─ Gateway: supervisor_network_mode = "bridge" in gateway.toml
│  (default host mode puts the sandbox in Docker Desktop's VM, where 127.0.0.1 is not the Mac;
│   every sandbox failed with "Startup configuration fetch failed after 5 attempts")
├─ Image: copy the real claude binary to /usr/local/bin/claude
│  (npm makes /usr/bin/claude a symlink; OpenShell matches real paths, so the
│   provider would inject no key and deny Claude Code)
├─ Policy: three named build rules for /usr/bin/node (npm registry, Google Fonts)
│  (npm ci and next build were DENIED without them)
└─ Upload nests the folder: upload <dir> /sandbox lands at /sandbox/<dir-name>
```

## Step 0. Prerequisites (proven)
```bash
uname -m
```
Expected: `arm64`.
```bash
docker version --format '{{.Server.Version}}'
```
Expected: 28.0 or higher. If it errors, start Docker Desktop first.

## Step 1. Install (done Oct 30)
```bash
curl -fsSL -o ~/Downloads/openshell-install.sh https://raw.githubusercontent.com/NVIDIA/OpenShell/main/install.sh
```
```bash
OPENSHELL_VERSION=v0.1.6 sh ~/Downloads/openshell-install.sh
```
Expected last line: `openshell status reports connected`.
```bash
openshell --version
```
Expected: `openshell 0.1.6`.

## Step 2. Gateway settings (done Oct 30)
Telemetry off (the Homebrew service sources this file):
```bash
printf 'OPENSHELL_TELEMETRY_ENABLED=false\n' >> ~/.config/openshell/gateway.env
```
Bridge networking for Docker Desktop. Set `/opt/homebrew/var/openshell/gateway.toml` to exactly:
```toml
[openshell]
version = 2

[openshell.gateway]

[openshell.drivers.docker]
supervisor_network_mode = "bridge"
```
```bash
brew services restart openshell
```
Wait a few seconds, then:
```bash
openshell status
```
Expected: `Status: Connected`, `Version: 0.1.6`. If "Connection refused", wait 5 s and run it again.
```bash
lsof -nP -iTCP:17670 -sTCP:LISTEN
```
Expected: `127.0.0.1:17670` only.

## Step 3. Sandbox image (done Oct 30)
The Dockerfile is committed at `lab/openshell/Dockerfile`.
```bash
docker build -t os-agent:local lab/openshell
```
Check claude resolves to a real file:
```bash
docker run --rm os-agent:local sh -c 'readlink -f "$(which claude)"'
```
Expected: `/usr/local/bin/claude`.

## Step 4. Provider profile and your key (done Oct 30)
```bash
curl -fsSLo ~/Downloads/claude-code.yaml https://raw.githubusercontent.com/NVIDIA/OpenShell/main/providers/claude-code.yaml
```
```bash
openshell profile lint -f ~/Downloads/claude-code.yaml
```
```bash
openshell profile import -f ~/Downloads/claude-code.yaml --global
```
Type the key at a hidden prompt (no echo, not in history):
```bash
read -s ANTHROPIC_API_KEY
```
```bash
export ANTHROPIC_API_KEY
```
```bash
openshell provider create --name anth-joseph --type claude-code --credential ANTHROPIC_API_KEY
```
```bash
unset ANTHROPIC_API_KEY
```
Note the provider name you used; the steps below call it `anth-joseph`.

## Step 5. Fresh clone (only committed files ride along)
```bash
cd ~/Downloads
```
```bash
git clone https://github.com/ClayClimate-AI/honeypot-log-analyzer.git hp-fresh
```
```bash
ls -a hp-fresh | grep "^\.env"
```
Expected: `.env.example` only. If anything else prints, stop.

## Step 6. Start the build sandbox
The policy is committed at `lab/openshell/policy.yaml` (run from the repo root).
```bash
openshell sandbox create --name build --from os-agent:local --policy lab/openshell/policy.yaml --provider anth-joseph --no-auto-providers --detach
```
```bash
openshell sandbox list
```
Expected: `build` in phase `Ready`.
```bash
openshell sandbox upload build ~/Downloads/hp-fresh /sandbox
```
The repo lands at `/sandbox/hp-fresh`.

## Step 7. The 4 tests (all passed Oct 30)
Test 1a, allowed host:
```bash
openshell sandbox exec -n build --no-login-shell -- /usr/bin/curl -sS -o /dev/null -w '%{http_code}\n' https://api.github.com/zen
```
Expected: `200`.

Test 1b, denied host:
```bash
openshell sandbox exec -n build --no-login-shell -- /usr/bin/curl -sS -m 10 https://example.com
```
Expected: `Couldn't connect to server`.

Test 1c, allowed host but a program not on the list:
```bash
openshell sandbox exec -n build --no-login-shell -- /usr/bin/python3 -c "import urllib.request as u; print(u.urlopen('https://api.github.com/zen').status)"
```
Expected: `Permission denied`. Rules are per program (the log names it `/usr/bin/python3.12`, its real path).

Test 2, OCSF deny log:
```bash
openshell logs build --since 5m --source sandbox
```
Expected line: `NET:OPEN [MED] DENIED /usr/bin/curl(0) -> example.com:443 [reason:transparent_tcp_policy_denied]`.

Test 3, the key inside is a placeholder (first 18 characters only):
```bash
openshell sandbox exec -n build --no-login-shell -- sh -c 'printf %s "$ANTHROPIC_API_KEY" | cut -c1-18; echo'
```
Expected: `openshell:resolve:`.
```bash
openshell sandbox exec -n build --no-login-shell -- sh -c '/usr/bin/curl -sS -H "Authorization: Bearer $ANTHROPIC_API_KEY" https://api.github.com/zen'
```
Expected: `{"error":"credential_endpoint_mismatch",...}`.

Test 4, Claude Code reaches Anthropic through the provider:
```bash
openshell sandbox exec -n build --no-login-shell -- sh -c 'cd /sandbox/hp-fresh && claude -p "reply with OK"'
```
Expected: `OK`. The log shows `ALLOWED /usr/local/bin/claude(0) -> api.anthropic.com:443`.

## Step 8. Work inside (the build session)
```bash
openshell sandbox connect build
```
Inside:
```bash
cd /sandbox/hp-fresh
```
```bash
git config user.name "Joseph Clay (sandbox builder)"
```
```bash
git config user.email "j.clay.2064@gmail.com"
```
```bash
claude
```
Paste `docs/week7/HANDOFF.md` as the first message. The builder commits on its feature branch inside the sandbox. github.com is blocked, so nothing leaves on its own.

## Step 9. Bring a finished step out (you, on the Mac)
```bash
openshell sandbox download build /sandbox/hp-fresh ~/Downloads/hp-out
```
```bash
cd ~/Downloads/hp-out/hp-fresh
```
Check where the download landed with `ls ~/Downloads/hp-out` first; download may nest the folder the same way upload does.
Review with `git log --oneline -5` and `git diff main --stat`, then push the branch from your Mac and merge as usual.

## End of day
```bash
openshell sandbox stop build
```
`stop` keeps the workspace; `start` resumes it. Keep the provider until after Monday's demo.

## After Monday's demo only: remove the key
```bash
openshell provider delete anth-joseph
```
```bash
brew services stop openshell
```

## Troubleshooting (from the Oct 30 run)
```
Problem
├─ Sandbox phase Error, "Startup configuration fetch failed" → gateway.toml missing the bridge setting (Step 2)
├─ "openshell status": Connection refused right after restart → gateway still starting; wait 5 s
├─ Claude Code "Invalid API key" → provider holds a wrong key; recreate it (Step 4)
├─ Claude Code denied to api.anthropic.com → image claude is a symlink; rebuild (Step 3)
├─ npm or fonts DENIED → sandbox started without lab/openshell/policy.yaml
├─ A new host DENIED during the build (for example binaries.prisma.sh) → stop and tell Joseph;
│  he adds a named rule to policy.yaml and runs: openshell policy set build --policy lab/openshell/policy.yaml
├─ Datadog DENIED for claude → expected; Claude Code telemetry, harmless
└─ git push denied → expected; github.com is blocked on purpose; push from the Mac (Step 9)
```

## Demo script (about 3 minutes; the words are yours, these are the actions)
```
1. Show lab/openshell/policy.yaml: deny by default, named rules, Anthropic only via the provider
2. Test 1a: api.github.com → 200
3. Test 1b: example.com → refused
4. Test 2: logs → DENIED line
5. Test 3: placeholder prefix; wrong host → credential_endpoint_mismatch
6. Test 4: Claude Code inside answers through the provider
7. Close: the code changes left only through a download Joseph reviewed and pushed
Cut line: if the live run fails, play the backup recording plus the saved DENIED line.
```
