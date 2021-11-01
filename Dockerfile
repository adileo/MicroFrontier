FROM node:14-alpine
WORKDIR /usr/src/app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 8090
CMD [ "node", "./dist/MicroServer.js" ]