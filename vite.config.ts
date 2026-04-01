/// <reference types="vitest" />

import path from "path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
	plugins: [
		react(),
		mode === 'development' && componentTagger(),
	].filter(Boolean),
	server: {
		host: "::",
		port: 8080,
	},
	resolve: {
		dedupe: ['react', 'react-dom'],
		alias: {
			"@": path.resolve(__dirname, "./src"),
			"react": path.resolve(process.cwd(), "./node_modules/react"),
			"react-dom": path.resolve(process.cwd(), "./node_modules/react-dom"),
		},
	},
	// resolve removed

	build: {
		outDir: "dist",
		assetsDir: "assets",
		rollupOptions: {
			output: {
				manualChunks: {
					// Separar vendor chunks para melhor cache
					vendor: ['react', 'react-dom'],
					ui: ['@radix-ui/react-dialog', '@radix-ui/react-dropdown-menu', '@radix-ui/react-select'],
					utils: ['lucide-react', 'clsx', 'tailwind-merge']
				},
			},
		},
		// Otimizações para PWA
		minify: 'terser',
		terserOptions: {
			compress: {
				drop_console: mode === 'production',
				drop_debugger: true,
			},
		},
		reportCompressedSize: false,
		chunkSizeWarningLimit: 1600,
	},
	// PWA otimizations
	define: {
		__APP_VERSION__: JSON.stringify(process.env.npm_package_version || '1.0.0'),
	},
	// Preload critical resources
	optimizeDeps: {
		include: ['react', 'react-dom', '@supabase/supabase-js'],
	},
	base: "/",
}));
