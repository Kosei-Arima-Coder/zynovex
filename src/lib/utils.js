export function need(e) {
  if (!e || !e.roles) return 0
  return e.roles.reduce((a, r) => a + (Number(r[1]) || 0), 0)
}

export function to12(t) {
  if (!t) return ''
  const p = String(t).split(':').map(Number)
  if (isNaN(p[0])) return t
  const h = p[0] % 12 || 12
  const m = String(p[1] || 0).padStart(2, '0')
  const ampm = p[0] < 12 ? 'AM' : 'PM'
  return `${h}:${m} ${ampm}`
}

export function to24(t) {
  if (!t) return ''
  const m = /^(\d+):(\d+)\s*(AM|PM)$/i.exec(t.trim())
  if (!m) return t
  let h = +m[1] % 12
  if (m[3].toUpperCase() === 'PM') h += 12
  return String(h).padStart(2, '0') + ':' + m[2]
}

export function fmtDT(dt) {
  if (!dt) return '-'
  try {
    const d = new Date(dt)
    return d.toLocaleString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    })
  } catch {
    return String(dt)
  }
}

export function safeCell(c) {
  let val = String(c == null ? '' : c)
  if (/^[=+\-@\t\r]/.test(val)) val = "'" + val
  return '"' + val.replace(/"/g, '""') + '"'
}

export function exportCsv(filename, rows) {
  const content = rows.map((r) => r.map(safeCell).join(',')).join('\n')
  const blob = new Blob([content], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename.endsWith('.csv') ? filename : `${filename}.csv`
  document.body.appendChild(a)
  a.click()
  a.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function parseRoles(txt) {
  if (!txt) return []
  const out = []
  for (const line of txt.split('\n').map((x) => x.trim()).filter(Boolean)) {
    const m = /^(.+?)\s*[:-]\s*(\d+)$/.exec(line)
    if (!m || +m[2] < 1) return null
    out.push({ name: m[1].trim().slice(0, 60), needed: +m[2] })
  }
  return out
}

export async function compressImage(file, maxDimension = 1200, quality = 0.82) {
  try {
    if (!/^image\/(jpeg|png|webp)$/.test(file.type) || file.size > 8e6) {
      return null
    }

    if (typeof createImageBitmap === 'function') {
      const bmp = await createImageBitmap(file)
      const scale = Math.min(1, maxDimension / bmp.width)
      const canvas = document.createElement('canvas')
      canvas.width = Math.round(bmp.width * scale)
      canvas.height = Math.round(bmp.height * scale)
      const ctx = canvas.getContext('2d')
      ctx.drawImage(bmp, 0, 0, canvas.width, canvas.height)
      return await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', quality))
    } else {
      // Fallback for environments where createImageBitmap is unsupported
      return await new Promise((resolve) => {
        const reader = new FileReader()
        reader.onload = (e) => {
          const img = new Image()
          img.onload = () => {
            const scale = Math.min(1, maxDimension / img.width)
            const canvas = document.createElement('canvas')
            canvas.width = Math.round(img.width * scale)
            canvas.height = Math.round(img.height * scale)
            const ctx = canvas.getContext('2d')
            ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
            canvas.toBlob(resolve, 'image/jpeg', quality)
          }
          img.onerror = () => resolve(null)
          img.src = e.target.result
        }
        reader.onerror = () => resolve(null)
        reader.readAsDataURL(file)
      })
    }
  } catch {
    return null
  }
}
