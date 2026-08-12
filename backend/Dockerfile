FROM node:18-alpine

WORKDIR /app

# 先複製 package.json 和 package-lock.json (如果有) 以利用 Docker 快取
COPY package*.json ./

RUN npm install

# 複製其餘專案檔案
COPY . .

EXPOSE 8080

# 因為沒有設定 start 指令，但一般 production 可以用 node 啟動，
# 若 package.json 中無 start 指令，也可以直接執行 node ./bin/www.js
CMD ["node", "./bin/www.js"]
