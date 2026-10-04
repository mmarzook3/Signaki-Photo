FROM node:24.15.0-bookworm-slim AS frontend
WORKDIR /build
COPY frontend/package.json frontend/package-lock.json ./
RUN npm ci --ignore-scripts
COPY frontend/ ./
RUN npm run build

FROM python:3.12-slim-bookworm@sha256:54c85f3c47607a77f32adec749d3c81d1348bf25833671f512b26a9b6d778cb3
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1 PIP_NO_CACHE_DIR=1
RUN apt-get update && apt-get install -y --no-install-recommends fonts-dejavu-core && rm -rf /var/lib/apt/lists/* && groupadd -g 10001 app && useradd -u 10001 -g app -M app
WORKDIR /app
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt
COPY . .
COPY --from=frontend /build/dist /app/frontend/dist
RUN DJANGO_SECRET_KEY=build-only-not-runtime DATA_DIR=/tmp/builddata COOKIE_SECURE=0 SSL_REDIRECT=0 python manage.py collectstatic --noinput && mkdir -p /data && chown app:app /data
USER 10001:10001
EXPOSE 8000
CMD ["gunicorn","config.wsgi:application","--bind","0.0.0.0:8000","--workers","2","--threads","1","--timeout","120","--access-logfile","-","--error-logfile","-","--max-requests","500","--max-requests-jitter","50"]
