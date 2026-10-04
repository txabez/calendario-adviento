// Estados de una prueba: valor que guarda el backend -> textos de la web
export const STATUSES = [
  { value: 'success', button: 'Superada', label: 'Superada', icon: '✓' },
  { value: 'fail', button: 'Fallida', label: 'Fallida', icon: '✗' },
  { value: 'ignore', button: 'Ignorar', label: 'Ignorada', icon: '–' },
]

export function statusInfo(value) {
  return STATUSES.find((s) => s.value === value)
}

export function fetchJson(url, options) {
  return fetch(url, options).then((r) => {
    if (r.status === 404) throw new Error('No se ha encontrado.')
    if (!r.ok) throw new Error('Error al hablar con el servidor.')
    return r.json()
  })
}
