FROM python:3.8-slim-bullseye
RUN apt-get update && apt-get install gcc libffi-dev libpq-dev -y && apt-get clean
WORKDIR /
RUN mkdir -p /users
COPY ./requirements.txt /app/requirements.txt
RUN pip install --no-cache-dir --upgrade -r /app/requirements.txt
COPY . /app
ENTRYPOINT uvicorn wsgi:app --workers 1 --app-dir /app --port 5000 --host 0.0.0.0 --proxy-headers
