import { geaPlugin } from '../index.ts'
import { fileURLToPath } from 'url'
import { dirname, join } from 'path'

const __dirname = dirname(fileURLToPath(import.meta.url))
const fixturePath = join(__dirname, 'fixtures/benchmark-table.jsx')

const source = `import { Component } from 'gea'
import store from './benchmark-store.ts'
export default class T extends Component {
  template() {
    return (
      <table><tbody id="tbody">
        {store.state.data.map(item => (
          <tr key={item.id}><td>{item.id}</td><td>{item.label}</td></tr>
        ))}
      </tbody></table>
    )
  }
}`

const plugin = geaPlugin()
const transform = typeof plugin.transform === 'function' ? plugin.transform : plugin.transform?.handler
const result = await transform?.call({}, source, fixturePath)
console.log(result?.code || result)
console.log('---')
console.log('Has __observe_data:', result?.code?.includes('__observe_data'))
console.log('Has __observe_data_data:', result?.code?.includes('__observe_data_data'))
console.log('Has createdHooks:', result?.code?.includes('createdHooks'))
console.log('Has state.__store:', result?.code?.includes('__store'))
