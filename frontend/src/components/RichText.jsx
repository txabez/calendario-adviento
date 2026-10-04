// Convierte **texto** en negrita
export default function RichText({ text }) {
  return text
    .trim()
    .split(/\*\*(.+?)\*\*/g)
    .map((part, i) => (i % 2 ? <strong key={i}>{part}</strong> : part))
}
