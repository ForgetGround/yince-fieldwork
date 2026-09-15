#!/bin/sh
set -eu
# Certbot invokes deploy hooks for every renewed certificate; only handle our own.
if [ "${RENEWED_LINEAGE:-}" = /etc/letsencrypt/live/yince.xcoria.cn ]; then
    /usr/sbin/nginx -t -q
    /bin/systemctl reload nginx
fi
