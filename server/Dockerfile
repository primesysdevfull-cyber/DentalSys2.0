FROM node:22-slim

RUN apt-get update -y && apt-get install -y openssl && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY package*.json ./
RUN npm install

COPY . .

EXPOSE 3333

CMD ["sh", "-c", "npx prisma generate && npx prisma migrate deploy && npx prisma db seed && npm run dev"]
