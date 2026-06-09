# ===== Frontend Dockerfile =====
FROM node:20-alpine AS builder

WORKDIR /app

# 安装依赖
COPY package*.json ./
RUN npm ci

# 构建
COPY tsconfig.json tsconfig.node.json vite.config.ts ./
COPY index.html ./
COPY src ./src

# 设置 API URL（生产时使用相对路径，由 nginx 反代）
ENV VITE_API_URL=/api
RUN npm run build

# ===== 运行阶段：Nginx =====
FROM nginx:alpine AS runner

# 复制构建产物
COPY --from=builder /app/dist /usr/share/nginx/html

# Nginx 配置：SPA fallback + 反代 /api 到 backend
RUN cat > /etc/nginx/conf.d/default.conf << 'EOF'
server {
    listen 80;
    server_name _;
    root /usr/share/nginx/html;
    index index.html;

    # Gzip
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml;

    # SPA fallback
    location / {
        try_files $uri $uri/ /index.html;
    }

    # API 反向代理到 backend 容器
    location /api/ {
        proxy_pass http://backend:3001/api/;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
EOF

EXPOSE 80

CMD ["nginx", "-g", "daemon off;"]
