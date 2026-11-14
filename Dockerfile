FROM node:22-alpine

ENV NODE_ENV=production \
    DATA_DIR=/data \
    PORT=8765 \
    HOST=0.0.0.0

RUN apk add --no-cache tzdata

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force
COPY src ./src
COPY assets ./assets
COPY shortcut ./shortcut

RUN chmod -R a+rX /app/shortcut && mkdir -p /data && chown -R node:node /data
USER node
VOLUME /data
EXPOSE 8765

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s \
  CMD node -e "fetch('http://127.0.0.1:'+process.env.PORT+'/version').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "src/index.js"]
