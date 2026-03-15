import { createServer } from 'vite'
import { writeFileSync } from 'fs'

const server = await createServer({
  root: import.meta.dirname,
  server: { middlewareMode: true },
})

const result = await server.transformRequest('/src/kanban-app.tsx')
writeFileSync('/tmp/kanban-app-v3.js', result?.code || '')
await server.close()
process.exit(0)
