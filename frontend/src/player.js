// Token de la sesión de jugador. Se guarda en el navegador para que los días
// ya abiertos no vuelvan a pedir la contraseña.
const KEY = 'playerToken'

export function getPlayerToken() {
  try {
    return localStorage.getItem(KEY) || ''
  } catch {
    return ''
  }
}

export function setPlayerToken(token) {
  try {
    localStorage.setItem(KEY, token)
  } catch {
    // Sin almacenamiento: los días se recuerdan solo mientras la página esté abierta
  }
}
