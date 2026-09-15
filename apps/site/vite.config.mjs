import { defineConfig } from 'vite';
import { resolve, dirname, relative } from 'node:path';
import { readFile, copyFile } from 'node:fs/promises';
import { generatePages, generatedRoot, generatedPublic } from './generate-pages.mjs';
import { RELEASE_VERSION } from '../../scripts/release/metadata.mjs';
const root = dirname(new URL(import.meta.url).pathname);
export default defineConfig(async () => {
  const inputs = await generatePages();
  const routes = new Set(inputs.map((path) => '/' + relative(generatedRoot, path).replace(/index\.html$/, '')));
  let outputDirectory = '';
  return {
    root: generatedRoot,
    publicDir: generatedPublic,
    define: { __AELIQO_RELEASE_VERSION__: JSON.stringify(RELEASE_VERSION) },
    resolve: {
      dedupe: ['@aeliqo/agent', '@aeliqo/core', '@aeliqo/runtime', '@aeliqo/web'],
      alias: {
        '/src': resolve(root, '../web/src'),
        '/docs-src': resolve(root, '../docs/src'),
        '/playground-src': resolve(root, '../playground/src'),
        '@aeliqo/catalog-examples': resolve(root, '../../examples/catalog/index.ts'),
      },
    },
    plugins: [
      {
        name: 'aeliqo-static-routes',
        configResolved(config) {
          outputDirectory = config.build.outDir;
        },
        configureServer(server) {
          server.middlewares.use(async (req, res, next) => {
            const url = new URL(req.url ?? '/', 'http://localhost');
            const path = url.pathname;
            const docsPath = `/docs${path}`;
            if (
              path !== '/' &&
              !routes.has(path) &&
              !routes.has(path + '/') &&
              (routes.has(docsPath) || routes.has(docsPath + '/'))
            ) {
              req.url = `${docsPath}${url.search}`;
              next();
              return;
            }
            if (!path.includes('.') && !path.startsWith('/@') && !routes.has(path) && !routes.has(path + '/')) {
              res.statusCode = 404;
              res.setHeader('Content-Type', 'text/html; charset=utf-8');
              res.end(
                await server.transformIndexHtml(
                  '/404/',
                  await readFile(resolve(generatedRoot, '404/index.html'), 'utf8'),
                ),
              );
              return;
            }
            next();
          });
        },
        async closeBundle() {
          if (outputDirectory === '') throw Error('Vite output directory was not resolved.');
          await copyFile(resolve(outputDirectory, '404/index.html'), resolve(outputDirectory, '404.html'));
        },
      },
    ],
    build: { outDir: resolve(root, 'dist'), emptyOutDir: true, rollupOptions: { input: inputs } },
    server: { host: '127.0.0.1', fs: { allow: [resolve(root, '../..')] } },
  };
});
