FROM nvcr.io/nvidia/base/ubuntu:24.04
RUN apt-get update && DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends curl git ca-certificates python3 lsof && rm -rf /var/lib/apt/lists/*
RUN curl -fsSL https://deb.nodesource.com/setup_22.x | bash - && apt-get install -y --no-install-recommends nodejs && rm -rf /var/lib/apt/lists/*
RUN npm install -g @anthropic-ai/claude-code
# OpenShell matches real paths, not symlinks; /usr/bin/claude is a symlink into node_modules.
# A real copy at /usr/local/bin/claude matches the stock claude-code provider profile.
RUN cp "$(readlink -f /usr/bin/claude)" /usr/local/bin/claude && chmod 755 /usr/local/bin/claude
