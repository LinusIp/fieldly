/** `npm run dev`: content:build in watch mode + the Vite dev server. */
import { fileURLToPath } from 'node:url';
import { createServer } from 'vite';
import { buildContent, watchContent } from './build-content';

buildContent({ failOnError: false });
watchContent();

const server = await createServer({
  configFile: fileURLToPath(new URL('../vite.config.ts', import.meta.url)),
});
await server.listen();
server.printUrls();
