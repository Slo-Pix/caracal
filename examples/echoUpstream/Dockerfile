# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Minimal echo upstream image for the self-contained first tutorial.

FROM node:22-alpine
WORKDIR /app
COPY package.json ./
COPY server.mjs ./
EXPOSE 8088
CMD ["node", "server.mjs"]
