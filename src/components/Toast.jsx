export default function Toast({ message, isVisible }) {
  return (
    <div
      id="toast"
      className={isVisible ? 'on' : ''}
      role="status"
      aria-live="polite"
    >
      {message}
    </div>
  )
}
