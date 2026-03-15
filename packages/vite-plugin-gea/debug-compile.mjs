import { geaPlugin } from './dist/index.js'

const plugin = geaPlugin()
const transform = typeof plugin.transform === 'function' ? plugin.transform : plugin.transform?.handler

const OptionStepSource = `
import OptionItem from './OptionItem.jsx'
export default class OptionStep extends Component {
  template({ options, selectedId, onSelect }) {
    return (
      <div class="option-step">
        {options.map(opt => (
          <OptionItem
            key={opt.id}
            label={opt.label}
            selected={selectedId === opt.id}
            onSelect={() => onSelect(opt.id)}
          />
        ))}
      </div>
    )
  }
}
`

const result = await transform?.call({}, OptionStepSource, '/virtual/OptionStep.jsx')
const code = typeof result === 'string' ? result : result?.code
console.log(code)
