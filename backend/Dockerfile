# ===== Backend Dockerfile =====
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖（含 devDeps，用于编译）
COPY package*.json ./
RUN npm ci

# 复制源码和配置
COPY tsconfig.json ./
COPY src ./src
COPY prisma ./prisma

# 生成 Prisma Client
RUN npx prisma generate

# 编译 TS -> JS（同时把 seed.ts 单独编译）
RUN npm run build

# 单独编译 seed.ts
RUN npx tsc prisma/seed.ts --outDir prisma --esModuleInterop --module commonjs --target es2020 --skipLibCheck || true

# ===== 运行阶段 =====
FROM node:20-alpine AS runner

WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3001
ENV DATABASE_URL="file:/app/prisma/dev.db"
ENV CORS_ORIGIN="*"

# 复制运行时依赖
COPY package*.json ./
RUN npm ci --omit=dev

# 从 builder 复制产物
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

# 启动脚本
RUN cat > /app/start.sh << 'SHELLEOF'
#!/bin/sh
set -e

echo "🔄 检查数据库..."
cd /app

# 如 db 不存在，则执行初始化迁移
if [ ! -f /app/prisma/dev.db ]; then
  echo "🆕 数据库不存在，执行初始化..."
  npx prisma db push --skip-generate
else
  echo "✅ 数据库已存在，执行迁移部署..."
  npx prisma migrate deploy 2>/dev/null || npx prisma db push --skip-generate
fi

# 种子数据
if [ ! -f /app/prisma/.seeded ]; then
  echo "🌱 首次启动：生成种子数据..."
  if [ -f /app/prisma/seed.js ]; then
    node /app/prisma/seed.js && touch /app/prisma/.seeded || true
  fi
else
  echo "✅ 种子数据已生成，跳过"
fi

echo ""
echo "================================================"
echo "🚀 Darkroom Backend API running on port ${PORT}"
echo "   Health: http://localhost:${PORT}/api/health"
echo "================================================"
exec node dist/index.js
SHELLEOF
RUN chmod +x /app/start.sh

EXPOSE 3001

CMD ["/app/start.sh"]
