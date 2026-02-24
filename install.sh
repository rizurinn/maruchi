#!/bin/bash

set -e

RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

print_success() { echo -e "${GREEN}$1${NC}"; }
print_error() { echo -e "${RED}$1${NC}"; }
print_warning() { echo -e "${YELLOW}$1${NC}"; }
print_info() { echo -e "${BLUE}$1${NC}"; }
print_step() { echo -e "${BLUE}$1${NC}"; }

setup_privileges() {
  if [ "$EUID" -eq 0 ]; then
    print_success "Menjalankan script sebagai root"
    SUDO_CMD=""
    ORIGINAL_USER="${SUDO_USER:-root}"
  elif command -v sudo >/dev/null 2>&1; then
    if sudo -n true 2>/dev/null; then
      print_success "Menjalankan script dengan sudo passwordless"
      SUDO_CMD="sudo"
      ORIGINAL_USER="$USER"
    else
      print_info "Memerlukan password sudo untuk melanjutkan..."
      if sudo -v; then
        print_success "Akses sudo berhasil diverifikasi"
        SUDO_CMD="sudo"
        ORIGINAL_USER="$USER"
      else
        print_error "Gagal mendapatkan akses sudo"
        exit 1
      fi
    fi
  else
    print_error "Script harus dijalankan sebagai root atau user dengan sudo"
    exit 1
  fi
}

detect_os() {
  if [ ! -f /etc/os-release ]; then
    print_error "File /etc/os-release tidak ditemukan. Sistem tidak didukung."
    exit 1
  fi
  . /etc/os-release
  OS_NAME="$NAME"
  OS_VERSION="$VERSION_ID"
  OS_CODENAME="$VERSION_CODENAME"
  OS_ID="$ID"
  
  print_info "Sistem Operasi: $OS_NAME $OS_VERSION ($OS_CODENAME)"
  
  if [[ "$OS_ID" == "ubuntu" ]]; then
    case "$OS_VERSION" in
      20.04|22.04|24.04)
        print_success "Versi Ubuntu didukung: $OS_VERSION"
        ;;
      *)
        print_warning "Versi Ubuntu $OS_VERSION mungkin tidak sepenuhnya didukung"
        read -p "Lanjutkan? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 1; fi
        ;;
    esac
  elif [[ "$OS_ID" == "debian" ]]; then
    # Debian 13 (Trixie) detection logic
    # Kadang Debian Testing/Sid tidak memiliki VERSION_ID yang jelas, kita cek ID dan CODENAME
    if [[ "$OS_VERSION" == "11" ]] || [[ "$OS_VERSION" == "12" ]] || [[ "$OS_VERSION" == "13" ]] || [[ "$OS_CODENAME" == "trixie" ]] || [[ "$OS_CODENAME" == "sid" ]]; then
        print_success "Versi Debian didukung: $OS_VERSION ($OS_CODENAME)"
    else
        print_warning "Versi Debian $OS_VERSION mungkin tidak sepenuhnya didukung"
        read -p "Lanjutkan? (y/n): " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then exit 1; fi
    fi
  else
    print_error "Script ini hanya mendukung Ubuntu dan Debian."
    exit 1
  fi
}

check_cpu_capabilities() {
  print_step "Memeriksa CPU capabilities..."
  CPU_HAS_AVX=false
  if grep -q avx /proc/cpuinfo; then
    CPU_HAS_AVX=true
    print_success "CPU mendukung AVX"
  else
    print_warning "CPU TIDAK mendukung AVX"
  fi
}

update_system() {
  print_step "Mengupdate daftar paket..."
  $SUDO_CMD apt-get update -y
  print_step "Memeriksa broken packages..."
  if ! $SUDO_CMD apt-get check 2>/dev/null; then
    print_warning "Mendeteksi broken packages!"
    print_info "Mencoba memperbaiki broken packages..."
    $SUDO_CMD dpkg --configure -a 2>/dev/null || true
    $SUDO_CMD apt-get install -f -y 2>/dev/null || true
  fi
  print_step "Mengupgrade sistem..."
  if $SUDO_CMD env DEBIAN_FRONTEND=noninteractive apt-get upgrade -y; then
    print_success "Sistem berhasil diupgrade"
  else
    print_warning "Upgrade mengalami masalah, akan dilanjutkan setelah cleanup"
  fi
  $SUDO_CMD apt-get autoremove -y 2>/dev/null || true
  print_success "Update sistem selesai"
}

install_base_dependencies() {
  print_step "Menginstall dependencies dasar..."
  $SUDO_CMD apt-get install -y \
    curl \
    wget \
    git \
    build-essential \
    pkg-config \
    zip \
    unzip \
    tree \
    zlib1g-dev \
    libcurl4-openssl-dev \
    libnghttp2-dev \
    libssl-dev
  print_success "Dependencies dasar berhasil diinstall"
}

install_fastfetch() {
  print_step "Menginstall Fastfetch..."
  # Coba install langsung (Berhasil di Debian 13 / Ubuntu 24.10+)
  if $SUDO_CMD apt-get install -y fastfetch 2>/dev/null; then
    print_success "Fastfetch berhasil diinstall dari repository"
  else
    print_info "Fastfetch tidak ada di repo standar (umum di OS lama)."
    # Jika Ubuntu versi lama, gunakan PPA
    if [[ "$OS_ID" == "ubuntu" ]]; then
       print_info "Mencoba menambahkan PPA Fastfetch..."
       $SUDO_CMD add-apt-repository ppa:zhanghua/fastfetch -y 2>/dev/null
       $SUDO_CMD apt-get update -y
       $SUDO_CMD apt-get install -y fastfetch
    else
       # Jika Debian lama atau gagal, download binary langsung dari GitHub (Architecture Check)
       ARCH=$(dpkg --print-architecture)
       if [[ "$ARCH" == "amd64" ]]; then
           print_info "Mendownload .deb Fastfetch terbaru dari GitHub..."
           TEMP_DEB="$(mktemp).deb"
           # URL ini mengambil versi latest untuk amd64
           wget -O "$TEMP_DEB" https://github.com/fastfetch-cli/fastfetch/releases/latest/download/fastfetch-linux-amd64.deb
           $SUDO_CMD dpkg -i "$TEMP_DEB" || $SUDO_CMD apt-get install -f -y
           rm "$TEMP_DEB"
           print_success "Fastfetch berhasil diinstall manual"
       else
           print_warning "Arsitektur $ARCH tidak didukung untuk auto-install fastfetch, melewati..."
       fi
    fi
  fi
}

install_python() {
  print_step "Menginstall Python..."
  
  if [[ "$OS_ID" == "ubuntu" ]]; then
    case "$OS_VERSION" in
      20.04)
        $SUDO_CMD apt-get install -y python3-apt python3-gi
        if [ -f "/usr/lib/python3/dist-packages/apt_pkg.cpython-38-x86_64-linux-gnu.so" ]; then
          $SUDO_CMD ln -sf /usr/lib/python3/dist-packages/apt_pkg.cpython-38-x86_64-linux-gnu.so \
            /usr/lib/python3/dist-packages/apt_pkg.so
        fi
        curl -fsSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0xf23c5a6cf475977595c89f51ba6932366a755776" | \
          $SUDO_CMD gpg --dearmor -o /etc/apt/trusted.gpg.d/deadsnakes.gpg
        echo "deb http://ppa.launchpad.net/deadsnakes/ppa/ubuntu focal main" | \
          $SUDO_CMD tee /etc/apt/sources.list.d/deadsnakes-ppa.list
        ;;
      22.04)
        $SUDO_CMD apt-get install -y python3-apt python3-gi
        if [ -f "/usr/lib/python3/dist-packages/apt_pkg.cpython-310-x86_64-linux-gnu.so" ]; then
          $SUDO_CMD ln -sf /usr/lib/python3/dist-packages/apt_pkg.cpython-310-x86_64-linux-gnu.so \
            /usr/lib/python3/dist-packages/apt_pkg.so
        fi
        curl -fsSL "https://keyserver.ubuntu.com/pks/lookup?op=get&search=0xf23c5a6cf475977595c89f51ba6932366a755776" | \
          $SUDO_CMD gpg --dearmor -o /etc/apt/trusted.gpg.d/deadsnakes.gpg
        echo "deb http://ppa.launchpad.net/deadsnakes/ppa/ubuntu jammy main" | \
          $SUDO_CMD tee /etc/apt/sources.list.d/deadsnakes-ppa.list
        ;;
      24.04)
        $SUDO_CMD apt-get install -y python3-gi python3-apt
        ;;
    esac
    $SUDO_CMD apt-get update -y
    print_step "Menginstall Python development libraries..."
    $SUDO_CMD apt-get install -y python3 python3-dev
    print_step "Menginstall Python 3.12..."
    $SUDO_CMD apt-get install -y python3.12 python3.12-venv
    print_success "Python 3.12 berhasil diinstall dari PPA/APT"

  elif [[ "$OS_ID" == "debian" ]]; then
    print_info "Terdeteksi Debian. Menggunakan repo native."
    $SUDO_CMD apt-get update -y
    $SUDO_CMD apt-get install -y python3 python3-dev python3-venv python3-apt
    # Pada Debian 13 (Trixie), python3 bawaan mungkin sudah 3.11/3.12.
    # Jika tidak ada 3.12 spesifik, UV akan menghandle downloadnya nanti.
    print_success "Python base berhasil diinstall."
  fi
}

install_nodejs() {
  print_step "Menginstall Bun"
  curl -fsSL https://bun.sh/install | bash
  
  # EXPORT PATH untuk sesi script saat ini
  export BUN_INSTALL="$HOME/.bun"
  export PATH="$BUN_INSTALL/bin:$PATH"
  
  print_success "Bun $(bun --version 2>/dev/null || echo 'N/A') berhasil diinstall"
}

install_multimedia_tools() {
  print_step "Menginstall multimedia tools..."
  $SUDO_CMD apt-get install -y \
    ffmpeg \
    imagemagick \
    webp
  print_success "Multimedia tools berhasil diinstall"
}

setup_timezone() {
  print_step "Mengatur timezone ke Asia/Jakarta..."
  $SUDO_CMD ln -sf /usr/share/zoneinfo/Asia/Jakarta /etc/localtime
  echo "Asia/Jakarta" | $SUDO_CMD tee /etc/timezone
  export TZ=Asia/Jakarta
  print_success "Timezone berhasil diatur ke Asia/Jakarta"
}

setup_venv() {
  print_step "Menginstall uv manager (latest)"
  curl -LsSf https://astral.sh/uv/install.sh | sh
  
  # EXPORT PATH untuk sesi script saat ini
  export PATH="$HOME/.cargo/bin:$HOME/.local/bin:$PATH"

  print_step "Membuat Python virtual environment..."
  if [ ! -d ".venv" ]; then
    # UV akan otomatis download Python 3.12 jika tidak ada di sistem
    uv venv --python 3.12
    print_success "Virtual environment berhasil dibuat"
  else
    print_warning "Virtual environment sudah ada, melewati pembuatan"
  fi
  
  if [ -d ".venv" ]; then
    print_step "Mengupgrade pip, setuptools, dan wheel..."
    uv pip install --upgrade pip setuptools wheel
    print_step "Menginstall paket Python default..."
    uv pip install --upgrade \
      yt-dlp \
      pillow
    print_success "Paket Python berhasil diinstall"
  else
    print_error "Virtual environment tidak ditemukan"
  fi
}

install_project_dependencies() {
  if [ -f "package.json" ]; then
    print_step "Menginstall dependencies dari package.json..."
    bun install
    print_success "Dependencies berhasil diinstall"
  else
    print_warning "package.json tidak ditemukan, melewati install"
  fi
}

cleanup() {
  print_step "Membersihkan cache dan temporary files..."
  $SUDO_CMD apt-get autoremove -y
  $SUDO_CMD apt-get clean
  print_success "Cleanup selesai"
}

fix_permissions() {
  print_step "Memperbaiki permissions folder..."
  if [ "$ORIGINAL_USER" != "root" ] && [ -n "$ORIGINAL_USER" ]; then
    $SUDO_CMD chown -R "$ORIGINAL_USER:$ORIGINAL_USER" .
    print_success "Permissions berhasil diperbaiki untuk user: $ORIGINAL_USER"
  fi
}

print_summary() {
  echo ""
  echo "==============================================================="
  print_success "INSTALASI SELESAI!"
  echo "==============================================================="
  echo ""
  echo "System Info:"
  # Menjalankan fastfetch jika tersedia
  if command -v fastfetch >/dev/null 2>&1; then
      fastfetch --pipe 2>/dev/null || echo "Fastfetch installed but failed to run."
  else
      echo "Fastfetch tidak terinstall dengan benar."
  fi
  echo ""
  echo "Python:"
  echo " Versi: $(.venv/bin/python --version 2>/dev/null || python3.12 --version 2>/dev/null || echo 'tidak terinstall')"
  echo " Venv: $([ -d .venv ] && echo 'tersedia' || echo 'tidak ada')"
  echo ""
  echo "Bun:"
  echo " Versi: $(bun --version 2>/dev/null || echo 'tidak terinstall')"
  echo ""
  echo "Catatan:"
  echo " Timezone: Asia/Jakarta"
  echo " User: $ORIGINAL_USER"
  echo ""
  echo "==============================================================="
}

main() {
  clear
  echo "==============================================================="
  echo " Universal VPS Setup Script (Debian 13 Ready)"
  echo "==============================================================="
  echo ""
  setup_privileges
  detect_os
  check_cpu_capabilities
  echo ""
  print_info "Instalasi akan dimulai dalam 3 detik..."
  print_warning "Tekan Ctrl+C untuk membatalkan"
  sleep 3
  echo ""
  update_system
  echo ""
  install_base_dependencies
  install_fastfetch
  echo ""
  install_python
  echo ""
  install_nodejs
  echo ""
  install_multimedia_tools
  echo ""
  setup_timezone
  echo ""
  setup_venv
  echo ""
  install_project_dependencies
  echo ""
  cleanup
  echo ""
  fix_permissions
  echo ""
  print_summary
}

main "$@"
