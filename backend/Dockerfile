FROM python:3.13-slim-bookworm

ENV PYTHONUNBUFFERED=1
ENV UV_PROJECT_ENVIRONMENT=/.venv
# uv 使用阿里云源
ENV UV_DEFAULT_INDEX=https://mirrors.aliyun.com/pypi/simple/

WORKDIR /app

COPY pyproject.toml uv.lock ./

# pip 使用阿里云源
RUN pip install -i https://mirrors.aliyun.com/pypi/simple/ uv && \
    uv venv && \
    uv sync

EXPOSE 8000
