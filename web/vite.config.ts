import { defineConfig } from 'vite'
import tailwindcss from '@tailwindcss/vite'

export default defineConfig({
    base: "/diff-viewer",
    plugins: [
        tailwindcss(),
    ],
    server: {
        fs: {
            allow: ['..']
        }
    },
    esbuild: {
        supported: {
            'top-level-await': true
        },
    },
    optimizeDeps: {
        esbuildOptions: {
            supported: {
                "top-level-await": true
            },
        },
    },
})
