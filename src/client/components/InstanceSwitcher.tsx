import type { WireMockInstance } from '../types.ts'

interface Props {
  instances: WireMockInstance[]
  selectedId: string | null
  onChange: (id: string) => void
}

export default function InstanceSwitcher({ instances, selectedId, onChange }: Props) {
  return (
    <div className="instance-switcher">
      <label htmlFor="instance-select">Instance:</label>
      <select
        id="instance-select"
        value={selectedId ?? ''}
        onChange={(e) => onChange(e.target.value)}
      >
        {instances.map((instance) => (
          <option key={instance.id} value={instance.id}>
            {instance.label}
          </option>
        ))}
      </select>
    </div>
  )
}
