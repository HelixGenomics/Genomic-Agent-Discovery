FROM node:20-slim

WORKDIR /app

# Install dependencies
COPY package*.json ./
RUN npm ci --production

# Copy source
COPY src/ src/
COPY config/ config/
COPY data/ data/
COPY glama.json ./

# Create state directory for MCP server
RUN mkdir -p /app/state

# Environment variables for MCP server
# These point to empty/placeholder paths — Glama inspection only needs
# the server to start and respond to tools/list, not run actual analyses
ENV UNIFIED_DB=/app/data/helix-unified.db
ENV GENOTYPE_DB=/app/data/genotype.db
ENV HELIX_STATE_DIR=/app/state
ENV HELIX_AGENT_ID=inspector

# MCP server runs on stdio
CMD ["node", "src/mcp-server.mjs"]
