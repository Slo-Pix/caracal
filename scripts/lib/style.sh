# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Shared terminal style library sourced by every Caracal shell script.

__caracal_color_enabled() {
  if [ -n "${NO_COLOR-}" ] || [ -n "${CARACAL_NO_COLOR-}" ]; then return 1; fi
  if [ -n "${FORCE_COLOR-}" ] || [ -n "${CARACAL_COLOR-}" ]; then return 0; fi
  if [ -t 1 ]; then return 0; fi
  return 1
}

if __caracal_color_enabled; then
  C_RESET=$'\033[0m'
  C_SUCCESS=$'\033[1;32m'
  C_WARN=$'\033[1;33m'
  C_ERROR=$'\033[1;31m'
  C_INFO=$'\033[36m'
  C_PROGRESS=$'\033[1;36m'
  C_PROMPT=$'\033[1;35m'
  C_HEADER=$'\033[1;4m'
  C_TITLE=$'\033[1m'
  C_LABEL=$'\033[2m'
  C_CODE=$'\033[35m'
  C_DEBUG=$'\033[2;3m'
else
  C_RESET=''
  C_SUCCESS=''
  C_WARN=''
  C_ERROR=''
  C_INFO=''
  C_PROGRESS=''
  C_PROMPT=''
  C_HEADER=''
  C_TITLE=''
  C_LABEL=''
  C_CODE=''
  C_DEBUG=''
fi

case "${LANG:-${LC_ALL:-}}" in
  *[Uu][Tt][Ff]*) S_OK='✓'; S_FAIL='✗'; S_WARN='⚠'; S_INFO='ℹ'; S_STEP='→'; S_BULLET='•' ;;
  *)              S_OK='+'; S_FAIL='x'; S_WARN='!'; S_INFO='i'; S_STEP='>'; S_BULLET='*' ;;
esac

say_success() { printf '%s%s %s%s\n' "${C_SUCCESS}" "${S_OK}" "$*" "${C_RESET}"; }
say_warn()    { printf '%s%s %s%s\n' "${C_WARN}"    "${S_WARN}" "$*" "${C_RESET}"; }
say_error()   { printf '%s%s %s%s\n' "${C_ERROR}"   "${S_FAIL}" "$*" "${C_RESET}" >&2; }
say_info()    { printf '%s%s %s%s\n' "${C_INFO}"    "${S_INFO}" "$*" "${C_RESET}"; }
say_step()    { printf '%s%s %s%s\n' "${C_PROGRESS}" "${S_STEP}" "$*" "${C_RESET}"; }
say_header()  { printf '\n%s%s%s\n' "${C_HEADER}" "$*" "${C_RESET}"; }
say_label()   { printf '%s%s%s\n' "${C_LABEL}" "$*" "${C_RESET}"; }
say_debug()   { [ -n "${CARACAL_DEBUG-}" ] || return 0; printf '%s[debug] %s%s\n' "${C_DEBUG}" "$*" "${C_RESET}" >&2; }
