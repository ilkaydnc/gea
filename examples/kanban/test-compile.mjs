import { createServer } from 'vite'
import { fileURLToPath } from 'url'
import { dirname } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))

async function compile() {
  const server = await createServer({
    root: __dirname,
    server: { middlewareMode: true },
  })

  const result = await server.transformRequest('/src/components/KanbanColumn.tsx')
  console.log(result?.code)
  await server.close()
}

compile()
