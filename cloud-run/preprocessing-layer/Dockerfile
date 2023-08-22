FROM node:20

ENV APP_HOME /app
WORKDIR $APP_HOME
COPY . ./

RUN npm install

EXPOSE 8080
CMD [ "node", "index.js" ]