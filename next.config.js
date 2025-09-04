/** @type {import('next').NextConfig} */
const nextConfig = {
  // Configuração de imagens para permitir hostnames externos
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'i.postimg.cc',
        port: '',
        pathname: '/**',
      },
    ],
  },
  // Configuração para evitar problemas de prerendering
  // output: 'standalone' // Comentado para resolver problemas de compatibilidade
}

module.exports = nextConfig