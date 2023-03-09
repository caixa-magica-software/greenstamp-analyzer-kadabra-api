FROM node:14-alpine

RUN apk add openjdk11

RUN mkdir /analyzer-kadabra-api
# Create app directory
WORKDIR /analyzer-kadabra-api

COPY ./package*.json ./

RUN npm install

# Bundle app source
COPY . .
EXPOSE 3000

CMD [ "npm", "start" ]