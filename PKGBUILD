# Maintainer: Animem.uz <info@animem.uz>
pkgname=animem-uz-bin
pkgver=1.0.0
pkgrel=1
pkgdesc="O'zbekistondagi eng yirik anime portali - Animem Uz"
arch=('x64')
url="https://animem.uz"
license=('custom')
depends=('gtk3' 'libx11' 'nss' 'alsa-lib' 'libxtst' 'libxcrypt-compat')
provides=('animem-uz')
conflicts=('animem-uz')
# Eslatma: source qismiga GitHub-dagi release linkini qo'yishingiz kerak
# Hozircha mahalliy build qilingan AppImage-dan foydalanamiz
source=("animem-uz-bin::https://github.com/foydalanuvchi/loyiha/releases/download/v${pkgver}/Animem.Uz-${pkgver}.AppImage")
sha256sums=('SKIP')

prepare() {
    chmod +x "${srcdir}/animem-uz-bin"
}

package() {
    mkdir -p "${pkgdir}/usr/bin"
    mkdir -p "${pkgdir}/opt/${pkgname}"
    
    # AppImage-ni opt papkasiga nusxalash
    cp "${srcdir}/animem-uz-bin" "${pkgdir}/opt/${pkgname}/animem-uz"
    
    # Binaries uchun symlink yaratish
    ln -s "/opt/${pkgname}/animem-uz" "${pkgdir}/usr/bin/animem-uz"
    
    # Desktop faylini yaratish (ixtiyoriy, lekin tavsiya etiladi)
    mkdir -p "${pkgdir}/usr/share/applications"
    cat > "${pkgdir}/usr/share/applications/animem-uz.desktop" <<EOF
[Desktop Entry]
Name=Animem Uz
Exec=animem-uz
Icon=animem-uz
Type=Application
Categories=Network;
EOF
}
