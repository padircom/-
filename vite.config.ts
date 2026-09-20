import path from "path";
import { fileURLToPath } from "url";
import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export default defineConfig(({ command }) => ({
  plugins: [react(), tailwindcss(), ...(command === "build" ? [viteSingleFile()] : [])],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "src"),
    },
  },
  server: {
    host: true,
    allowedHosts: true,
    hmr: false,
    /* رابط کاربری `/api/...` را با مسیر نسبی صدا می‌زند، ولی سرور API
     * فرایند جدایی روی ۴۰۰۰ است. بدون این پروکسی، Vite هر مسیر ناشناخته
     * را به `index.html` می‌فرستد و کلاینت به‌جای JSON، HTML می‌گیرد —
     * پس هر پنل خالی می‌ماند بی‌آنکه خطایی دیده شود.
     *
     * مرورگرِ کاربر داخل سندباکس نیست، پس آدرس مطلق `localhost:4000`
     * در کد کلاینت کار نمی‌کند؛ مسیر نسبی + پروکسی تنها راه درست است. */
    proxy: {
      "/api": {
        target: `http://127.0.0.1:${process.env.API_PORT || 4000}`,
        changeOrigin: true,
      },
    },
    watch: {
      ignored: ["**/docs/**", "**/db/**", "**/pex/**"],
    },
  },
}));
