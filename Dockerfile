# ─────────────────────────────────────────────────────────────────────────────
# Build
# ─────────────────────────────────────────────────────────────────────────────
FROM node:24-alpine AS build

WORKDIR /app

# pnpm fixado na MESMA versão que gerou o lockfile.
# O pnpm-workspace.yaml usa `allowBuilds`, que só existe a partir do pnpm 10.26
# (antes se chamava `onlyBuiltDependencies`). Uma versão diferente recusaria a
# chave e o esbuild não seria construído — o build falharia no meio.
RUN npm install -g pnpm@12.11.2

# Manifestos primeiro: a camada de dependências só é refeita quando eles mudam,
# não a cada alteração de código.
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# O resto do projeto. Os snapshots de build vêm versionados no repositório, então
# esta etapa NÃO acessa a rede: o build é hermético e reprodutível.
COPY . .

RUN pnpm build


# ─────────────────────────────────────────────────────────────────────────────
# Runtime — só o servidor estático
# ─────────────────────────────────────────────────────────────────────────────
# `nginx:alpine` acompanha a linha principal. Para build reprodutível, fixe a
# versão ou o digest: `nginx:1.29-alpine@sha256:...`
FROM nginx:alpine AS runtime

LABEL org.opencontainers.image.title="República" \
      org.opencontainers.image.description="Comparador de indicadores oficiais brasileiros, 1985–hoje" \
      org.opencontainers.image.source="http://git.costinha.cloud/costis/governo"

# A configuração substitui a do nginx inteira: ela mesma cuida do pid e dos
# diretórios temporários em /tmp, porque o processo roda sem privilégios.
COPY docker/nginx.conf /etc/nginx/nginx.conf

COPY --from=build /app/dist /usr/share/nginx/html

# Sem root. A porta 8080 é a que o usuário `nginx` consegue abrir.
USER nginx

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -qO- http://127.0.0.1:8080/ >/dev/null 2>&1 || exit 1

CMD ["nginx", "-g", "daemon off;"]
