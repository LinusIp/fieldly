import { createServer } from 'vite';

const server = await createServer({ configFile: new URL('../vite.config.ts', import.meta.url).pathname });
await server.listen();
server.printUrls();
