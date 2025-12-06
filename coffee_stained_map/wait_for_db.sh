#!/bin/sh

HOST="${DB_HOST}"
PORT="${DB_PORT:-5432}"

echo "Waiting for PostgreSQL at $HOST:$PORT..."

until nc -z "$HOST" "$PORT"; do
  echo "PostgreSQL is unavailable - sleeping"
  sleep 1
done

echo "PostgreSQL is up!"
exec "$@"