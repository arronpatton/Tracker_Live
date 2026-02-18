FROM node:22-slim

# Install LibreOffice for PDF conversion
RUN apt-get update && \
    apt-get install -y --no-install-recommends \
    libreoffice-core \
    libreoffice-calc \
    libreoffice-writer \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy package files and install dependencies
COPY package.json ./
RUN npm install

# Copy application code
COPY . .

EXPOSE 10000

CMD ["node", "backend/server.js"]
