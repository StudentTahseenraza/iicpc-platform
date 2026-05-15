FROM node:18-alpine

WORKDIR /app

COPY package*.json ./

RUN npm install

COPY . .

EXPOSE 8080

HEALTHCHECK --interval=5s --timeout=3s CMD node -e "require('http').get('http://localhost:8080/health',(r)=>{r.statusCode===200?process.exit(0):process.exit(1)})"

CMD ["npm", "start"]
