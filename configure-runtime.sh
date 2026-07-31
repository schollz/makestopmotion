#!/bin/sh
set -eu

default_site_url='https://makestopmotion.com'
static_root='/usr/share/nginx/html'

normalize_origin() {
  configured_value=${1%/}
  variable_name=$2

  if ! printf '%s' "$configured_value" | grep -Eq '^https?://[A-Za-z0-9.-]+(:[0-9]{1,5})?$'; then
    printf '%s\n' "$variable_name must be an HTTP(S) origin without a path, query, or fragment" >&2
    return 1
  fi

  printf '%s' "$configured_value"
}

site_url=$(normalize_origin "${SITE_URL:-$default_site_url}" 'SITE_URL')
umami_url=''
umami_website_id=''

if [ -n "${UMAMI_URL:-}" ] && [ -n "${UMAMI_WEBSITE_ID:-}" ]; then
  umami_url=$(normalize_origin "$UMAMI_URL" 'UMAMI_URL')
  if ! printf '%s' "$UMAMI_WEBSITE_ID" | grep -Eq '^[A-Za-z0-9_-]+$'; then
    printf '%s\n' 'UMAMI_WEBSITE_ID may only contain letters, numbers, underscores, and hyphens' >&2
    exit 1
  fi
  umami_website_id=$UMAMI_WEBSITE_ID
elif [ -n "${UMAMI_URL:-}${UMAMI_WEBSITE_ID:-}" ]; then
  printf '%s\n' 'Umami tracking is disabled because both UMAMI_URL and UMAMI_WEBSITE_ID are required' >&2
fi

if [ "$site_url" != "$default_site_url" ]; then
  find "$static_root" -type f \( -name '*.html' -o -name '*.xml' -o -name '*.txt' \) \
    -print | while IFS= read -r static_file; do
      replacement_file="${static_file}.runtime"
      sed "s|$default_site_url|$site_url|g" "$static_file" > "$replacement_file"
      mv "$replacement_file" "$static_file"
    done
fi

runtime_config="$static_root/runtime-config.js"
replacement_config="${runtime_config}.runtime"
sed \
  -e "s|siteUrl: '$default_site_url'|siteUrl: '$site_url'|" \
  -e "s|umamiUrl: ''|umamiUrl: '$umami_url'|" \
  -e "s|umamiWebsiteId: ''|umamiWebsiteId: '$umami_website_id'|" \
  "$runtime_config" > "$replacement_config"
mv "$replacement_config" "$runtime_config"

exec /docker-entrypoint.sh "$@"
