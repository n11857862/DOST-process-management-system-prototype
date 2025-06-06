# Dockerfile (packages/backend)
FROM node:18-alpine 

WORKDIR /usr/src/app

# Copy only package files first for layer caching
COPY package*.json ./

# Install dependencies (use --only=production if you have separate devDeps)
RUN npm install

# Copy the rest of the backend code
COPY . .

EXPOSE 3001 

CMD [ "node", "server.js" ] 