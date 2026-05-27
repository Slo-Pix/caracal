#!/usr/bin/env sh
# Copyright (C) 2026 Garudex Labs.  All Rights Reserved.
# Caracal, a product of Garudex Labs
#
# Standalone Console installer that downloads, verifies, and extracts Caracal release archives.

set -eu

REPO="Garudex-Labs/caracal"
INSTALL_DIR="${CARACAL_INSTALL_DIR:-${HOME}/.local/bin}"
VERSION="${CARACAL_VERSION:-latest}"
VERIFY_PROVENANCE="${CARACAL_VERIFY_PROVENANCE:-0}"
REQUIRE_PROVENANCE="${CARACAL_REQUIRE_PROVENANCE:-0}"

err() {
    printf 'caracal-install: %s\n' "$1" >&2
    exit 1
}

usage() {
    cat <<EOF
caracal-install: download the Caracal Console binaries from GitHub Releases.

Usage:
  install-console.sh [--version vYYYY.MM.DD[.N][-rc.N]] [--install-dir PATH] [--verify-provenance] [--require-provenance]

Installs the thin 'caracal' shell and the 'caracal-console' Console binary.

Environment overrides:
  CARACAL_VERSION       same as --version
  CARACAL_INSTALL_DIR   same as --install-dir
  CARACAL_VERIFY_PROVENANCE   same as --verify-provenance
  CARACAL_REQUIRE_PROVENANCE  same as --require-provenance
EOF
}

while [ $# -gt 0 ]; do
    case "$1" in
        --version) [ $# -ge 2 ] || err "--version requires a value"; VERSION="$2"; shift ;;
        --install-dir) [ $# -ge 2 ] || err "--install-dir requires a value"; INSTALL_DIR="$2"; shift ;;
        --verify-provenance) VERIFY_PROVENANCE=1 ;;
        --require-provenance) VERIFY_PROVENANCE=1; REQUIRE_PROVENANCE=1 ;;
        --help|-h) usage; exit 0 ;;
        *) err "unknown argument: $1 (use --help for usage)" ;;
    esac
    shift
done

require() {
    command -v "$1" >/dev/null 2>&1 || err "missing required command: $1"
}

require uname
require mkdir
require chmod
require tar

if command -v curl >/dev/null 2>&1; then
    fetch() { curl -fsSL "$1" -o "$2"; }
elif command -v wget >/dev/null 2>&1; then
    fetch() { wget -qO "$2" "$1"; }
else
    err "neither curl nor wget is installed"
fi

verifyProvenance() {
    file="$1"
    [ "${VERIFY_PROVENANCE}" = "1" ] || return 0
    if ! command -v gh >/dev/null 2>&1; then
        [ "${REQUIRE_PROVENANCE}" = "1" ] && err "gh is required for provenance verification"
        printf 'caracal-install: warning: gh not found; skipping provenance verification for %s\n' "${file}" >&2
        return 0
    fi
    gh attestation verify "${file}" --repo "${REPO}" >/dev/null \
        || err "provenance verification failed for ${file}"
    printf 'caracal-install: provenance verified for %s\n' "$(basename "${file}")"
}

if command -v sha256sum >/dev/null 2>&1; then
    sha() { sha256sum "$1" | awk '{print $1}'; }
elif command -v shasum >/dev/null 2>&1; then
    sha() { shasum -a 256 "$1" | awk '{print $1}'; }
else
    err "neither sha256sum nor shasum installed; refusing without integrity check"
fi

os="$(uname -s | tr '[:upper:]' '[:lower:]')"
machine="$(uname -m)"
case "${machine}" in
    x86_64|amd64) arch=amd64 ;;
    aarch64|arm64) arch=arm64 ;;
    *) err "unsupported architecture: ${machine}" ;;
esac
case "${os}" in
    linux) ext=tar.gz ;;
    darwin) ext=tar.gz ;;
    msys*|mingw*|cygwin*|windowsnt)
        os=windows
        ext=zip
        [ "${arch}" = arm64 ] && err "Windows arm64 binaries are not published; use install-console.ps1 on Windows"
        require unzip
        ;;
    *) err "unsupported OS: ${os}" ;;
esac

tmp="$(mktemp -d)"
backup="${tmp}/backup"
stage="${tmp}/stage"
committed=0
installedFiles=" "
mkdir -p "${backup}" "${stage}"
cleanup() {
    if [ "${committed}" != "1" ]; then
        for binFile in caracal caracal.exe caracal-console caracal-console.exe; do
            if [ -e "${backup}/${binFile}" ] || [ -L "${backup}/${binFile}" ]; then
                mv -f "${backup}/${binFile}" "${INSTALL_DIR}/${binFile}" 2>/dev/null || true
            elif [ "${installedFiles#* ${binFile} }" != "${installedFiles}" ]; then
                rm -f "${INSTALL_DIR}/${binFile}" 2>/dev/null || true
            fi
        done
    fi
    rm -rf "${tmp}"
}
trap cleanup EXIT

if [ "${VERSION}" = "latest" ]; then
    fetch "https://api.github.com/repos/${REPO}/releases/latest" "${tmp}/_latest.json" \
        || err "failed to resolve latest release from GitHub API"
    tag="$(awk -F'"' '/"tag_name":/ {print $4; exit}' "${tmp}/_latest.json")"
    [ -n "${tag}" ] || err "could not parse tag_name from GitHub API response"
else
    tag="${VERSION}"
fi
case "${tag}" in
    v[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9]|v[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9].[0-9]*|v[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9]-rc.*|v[0-9][0-9][0-9][0-9].[0-9][0-9].[0-9][0-9].[0-9]*-rc.*) ;;
    *) err "release tag ${tag} is not a supported Caracal release tag" ;;
esac
base="https://github.com/${REPO}/releases/download/${tag}"

printf 'caracal-install: target release %s (%s-%s)\n' "${tag}" "${os}" "${arch}"
printf 'caracal-install: downloading SHA256SUMS\n'
fetch "${base}/SHA256SUMS" "${tmp}/SHA256SUMS" || err "failed to download SHA256SUMS"

stageArchive() {
    kind="$1"
    binName="$2"
    archive="caracal-${kind}-${os}-${arch}-${tag}.${ext}"
    expected="$(awk -v n="${archive}" '$2 == n || $2 == "*"n {print $1}' "${tmp}/SHA256SUMS")"
    [ -n "${expected}" ] || err "no checksum for ${archive} in SHA256SUMS"

    printf 'caracal-install: downloading %s\n' "${archive}"
    fetch "${base}/${archive}" "${tmp}/${archive}" || err "failed to download ${archive}"
    actual="$(sha "${tmp}/${archive}")"
    [ "${expected}" = "${actual}" ] || err "checksum mismatch for ${archive}: expected ${expected}, got ${actual}"
    verifyProvenance "${tmp}/${archive}"

    extractDir="${tmp}/extract-${kind}"
    mkdir -p "${extractDir}"
    case "${ext}" in
        tar.gz) tar -xzf "${tmp}/${archive}" -C "${extractDir}" ;;
        zip) unzip -q -o "${tmp}/${archive}" -d "${extractDir}" ;;
    esac

    binFile="${binName}"
    [ "${os}" = windows ] && binFile="${binName}.exe"
    [ -f "${extractDir}/${binFile}" ] || err "expected ${binFile} inside ${archive}, not found"

    mv "${extractDir}/${binFile}" "${stage}/${binFile}"
    chmod +x "${stage}/${binFile}"
}

hasArchive() {
    archive="caracal-${1}-${os}-${arch}-${tag}.${ext}"
    awk -v n="${archive}" '$2 == n || $2 == "*"n {found=1} END {exit found ? 0 : 1}' "${tmp}/SHA256SUMS"
}

mkdir -p "${INSTALL_DIR}"
installedShell=0
if hasArchive shell; then
    installedShell=1
    stageArchive shell caracal
fi
stageArchive console caracal-console

installStaged() {
    binFile="$1"
    src="${stage}/${binFile}"
    dest="${INSTALL_DIR}/${binFile}"
    [ -f "${src}" ] || err "staged binary missing: ${binFile}"
    if [ -e "${dest}" ] || [ -L "${dest}" ]; then
        mv -f "${dest}" "${backup}/${binFile}"
    fi
    mv "${src}" "${dest}"
    installedFiles="${installedFiles}${binFile} "
    chmod +x "${dest}"
    printf 'caracal-install: installed %s\n' "${dest}"
}

[ "${installedShell}" = "1" ] && installStaged "$([ "${os}" = windows ] && printf 'caracal.exe' || printf 'caracal')"
installStaged "$([ "${os}" = windows ] && printf 'caracal-console.exe' || printf 'caracal-console')"
committed=1

case ":${PATH}:" in
    *":${INSTALL_DIR}:"*) ;;
    *) printf 'caracal-install: add %s to PATH (e.g. export PATH="%s:$PATH")\n' "${INSTALL_DIR}" "${INSTALL_DIR}" ;;
esac

checkShadow() {
    binName="$1"
    shadow=""
    IFS=":"
    for dir in ${PATH}; do
        [ -z "${dir}" ] && continue
        [ "${dir}" = "${INSTALL_DIR}" ] && break
        if [ -e "${dir}/${binName}" ] || [ -L "${dir}/${binName}" ]; then
            shadow="${dir}/${binName}"
            break
        fi
    done
    unset IFS
    if [ -n "${shadow}" ]; then
        printf 'caracal-install: warning: %s appears earlier in PATH than %s.\n' "${shadow}" "${INSTALL_DIR}" >&2
        printf 'caracal-install: remove it to use the installed binary: rm "%s"\n' "${shadow}" >&2
    fi
}

[ "${installedShell}" = "1" ] && checkShadow caracal
checkShadow caracal-console

printf 'caracal-install: done. Next steps:\n'
case "${tag}" in
    *-rc.*) mode=rc ;;
    *) mode=stable ;;
esac
printf '  installed release %s (mode: %s)\n' "${tag}" "${mode}"
printf '  hash -r            # refresh your shell command cache\n'
[ "${installedShell}" = "1" ] && printf '  caracal console        # launch the Console through the shell\n'
printf '  caracal-console        # launch the Console directly\n'
printf 'caracal-install: to uninstall, remove'
[ "${installedShell}" = "1" ] && printf ' %s/caracal' "${INSTALL_DIR}"
printf ' %s/caracal-console\n' "${INSTALL_DIR}"
