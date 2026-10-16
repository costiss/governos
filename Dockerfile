FROM node:24-alpine AS build
WORKDIR /app

# pnpm fixado na versão que gerou o lockfile — o pnpm-workspace.yaml usa a chave
# `allowBuilds`, que não existe em versões antigas.
RUN npm i -g pnpm@12.11.2
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# O build não acessa a rede: os dados que não vêm de API ao vivo estão
# versionados em src/lib/indicadores/dados/.
COPY . .
RUN pnpm build

# O runtime serve arquivos estáticos e nada mais. O navegador fala direto com as
# APIs oficiais (SIDRA, Ipea, Banco Central) — nenhuma requisição passa por aqui.
FROM nginx:alpine
COPY docker/default.conf /etc/nginx/conf.d/default.conf
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
