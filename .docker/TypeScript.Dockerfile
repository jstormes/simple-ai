FROM debian:trixie-backports  AS ai-dev

############################################################################
# Install system commands and libraries
############################################################################
RUN apt-get -y update \
    && apt-get install -y \
       curl \
       wget \
       git \
       zip \
       unzip \
       dos2unix \
       findutils \
       jq \
       grep \
       gawk \
       sed


############################################################################
# Create proper security higene for enviornemnt.
# Manage SSH keys https://medium.com/trabe/use-your-local-ssh-keys-inside-a-docker-contaieragener-ea1d117515dc
############################################################################
#ENV GIT_SSL_NO_VERIFY="1"
RUN useradd -m user \
    && mkdir -p /home/user/.ssh \
#    && ssh-keyscan github.com >> /home/user/.ssh/known_hosts \
#    && echo "Host *\n\tStrictHostKeyChecking no\n" >> /home/user/.ssh/config \
    && chown -R user:user /home/user/.ssh \
    && echo "password\npassword" | passwd root

############################################################################
# Install Node.js LTS from NodeSource
############################################################################
RUN curl -fsSL https://deb.nodesource.com/setup_lts.x | bash - \
    && apt-get install -y nodejs

############################################################################
# Install Typescript
############################################################################
RUN npm install -g typescript

############################################################################
# Install Python3, pip, and AWS CLI
############################################################################
RUN apt-get update && apt-get install -y \
    python3 \
    python3-pip \
    python3-venv \
    && rm -rf /var/lib/apt/lists/*

# Install AWS CLI v2
RUN curl "https://awscli.amazonaws.com/awscli-exe-linux-x86_64.zip" -o "awscliv2.zip" \
    && unzip awscliv2.zip \
    && ./aws/install \
    && rm -rf aws awscliv2.zip

# Install AWS SAM CLI
RUN pip3 install --break-system-packages aws-sam-cli

############################################################################
# Install Docker CLI for SAM local testing
############################################################################
RUN apt-get update && apt-get install -y \
    ca-certificates \
    gnupg \
    lsb-release \
    && mkdir -m 0755 -p /etc/apt/keyrings \
    && curl -fsSL https://download.docker.com/linux/debian/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg \
    && echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/debian \
      $(lsb_release -cs) stable" | tee /etc/apt/sources.list.d/docker.list > /dev/null \
    && apt-get update \
    && apt-get install -y docker-ce-cli \
    && rm -rf /var/lib/apt/lists/* \
    # Create docker group and add user to it (GID 999 is common for docker group)
    && groupadd -g 1001 docker || true \
    && usermod -aG docker user \
    && usermod -aG root user

############################################################################
# Install Puppeteer dependencies and Chromium
############################################################################
RUN apt-get update && apt-get install -y \
    chromium \
    chromium-sandbox \
    fonts-liberation \
    libasound2 \
    libatk-bridge2.0-0 \
    libatk1.0-0 \
    libatspi2.0-0 \
    libcups2 \
    libdbus-1-3 \
    libdrm2 \
    libgbm1 \
    libgtk-3-0 \
    libnspr4 \
    libnss3 \
    libwayland-client0 \
    libxcomposite1 \
    libxdamage1 \
    libxfixes3 \
    libxkbcommon0 \
    libxrandr2 \
    xdg-utils \
    libu2f-udev \
    libvulkan1 \
    && rm -rf /var/lib/apt/lists/*

# Set environment variable for Puppeteer to use system Chromium
ENV PUPPETEER_SKIP_CHROMIUM_DOWNLOAD=true \
    PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium

USER user
WORKDIR /app
# CMD ["npm", "run", "dev:build"]
# Add our script files to the path so they can be found
ENV PATH /home/user/.npm-packages/bin:/app/bin:$PATH
ENV NODE_PATH="/home/user/.npm-packages/lib/node_modules:$NODE_PATH"
ENV MANPATH="/home/user/.npm-packages/share/man:$(manpath)"

############################################################################
# Install Claude CLI
############################################################################
RUN cd /home/user \
    && mkdir "/home/user/.npm-packages" \
    && echo "prefix=/home/user/.npm-packages" >> /home/user/.npmrc \
    && npm install -g @anthropic-ai/claude-code

############################################################################
# Fix git permissions issue
############################################################################
RUN git config --global --add safe.directory /project

############################################################################
# Inside Docker Let Claude Run Free...
############################################################################
RUN echo "alias claude='claude --dangerously-skip-permissions'\n" >> /home/user/.bashrc

############################################################################
# Set Claude Code timeouts to 10 minutes
############################################################################
ENV BASH_DEFAULT_TIMEOUT_MS=600000
ENV BASH_MAX_TIMEOUT_MS=600001
ENV MCP_TOOL_TIMEOUT=600000

############################################################################
# Install Gemini CLI
############################################################################
RUN cd /home/user \
    && npm install -g @google/gemini-cli

############################################################################
# Inside Docker Let Gemini Run Free...
############################################################################
RUN echo "alias gemini='gemini --yolo'\n" >> /home/user/.bashrc

############################################################################
# Setup Claude/Gemini configuration file copying
############################################################################
RUN mkdir -p /home/user/.claude \
    chown user /home/user/.claude


RUN echo "# Check for Claude system configuration and copy if exists" >> /home/user/.bashrc \
    && echo "if [ -f /home/user/.claude.json.system ]; then" >> /home/user/.bashrc \
    && echo "    cp /home/user/.claude.json.system /home/user/.claude.json" >> /home/user/.bashrc \
    && echo "fi" >> /home/user/.bashrc \
    && echo "if [ -f /home/user/.claude.system/.credentials.json ]; then" >> /home/user/.bashrc \
    && echo "    mkdir -p /home/user/.claude" >> /home/user/.bashrc \
    && echo "    cp /home/user/.claude.system/.credentials.json /home/user/.claude/.credentials.json" >> /home/user/.bashrc \
    && echo "fi" >> /home/user/.bashrc \
    && echo "if [ -d /home/user/.gemini.system ]; then" >> /home/user/.bashrc \
    && echo "    mkdir -p /home/user/.gemini" >> /home/user/.bashrc \
    && echo "    cp /home/user/.gemini.system/installation_id /home/user/.gemini/installation_id" >> /home/user/.bashrc \
#    && echo "    cp /home/user/.gemini.system/credentials.json /home/user/.gemini/credentials.json" >> /home/user/.bashrc \
    && echo "    cp /home/user/.gemini.system/google_accounts.json /home/user/.gemini/google_accounts.json" >> /home/user/.bashrc \
    && echo "    cp /home/user/.gemini.system/oauth_creds.json /home/user/.gemini/oauth_creds.json" >> /home/user/.bashrc \
    && echo "    cp /home/user/.gemini.system/settings.json /home/user/.gemini/settings.json" >> /home/user/.bashrc \
    && echo "fi" >> /home/user/.bashrc

RUN npm install -g @qwen-code/qwen-code@latest
