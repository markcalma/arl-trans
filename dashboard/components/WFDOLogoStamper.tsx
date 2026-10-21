'use client'

import { useRef, useState, useEffect, useCallback } from 'react'

interface Box { x: number; y: number; w: number; h: number }

// Fixed logo size in image-pixel coordinates (canvas is 2× PDF points)
// 200px image pixels = 100 PDF points ≈ 1.4 inches on a standard DO page
const LOGO_SIZE = 200

export function WFDOLogoStamper({
  orderId,
  onStamped,
}: {
  orderId: string
  onStamped?: () => void
}) {
  const [box, setBox] = useState<Box | null>(null)
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null)
  const [stamping, setStamping] = useState(false)
  const [stampedTs, setStampedTs] = useState<number | null>(null)
  const [error, setError] = useState<string | null>(null)

  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const logoImgRef = useRef<HTMLImageElement | null>(null)

  useEffect(() => {
    const logo = new Image()
    logo.src = '/arltrans-no-bg.png'
    logo.onload = () => { logoImgRef.current = logo }
  }, [])

  function handleImageLoad() {
    if (imgRef.current) {
      setImageSize({ w: imgRef.current.naturalWidth, h: imgRef.current.naturalHeight })
    }
  }

  function toImageCoords(e: React.MouseEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current!
    const rect = canvas.getBoundingClientRect()
    const scaleX = (imageSize?.w ?? 1) / rect.width
    const scaleY = (imageSize?.h ?? 1) / rect.height
    return {
      x: (e.clientX - rect.left) * scaleX,
      y: (e.clientY - rect.top) * scaleY,
    }
  }

  function handleClick(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!imageSize) return
    const { x, y } = toImageCoords(e)
    // Center the fixed square on the click point, clamped within image bounds
    const half = LOGO_SIZE / 2
    setBox({
      x: Math.round(Math.max(0, Math.min(x - half, imageSize.w - LOGO_SIZE))),
      y: Math.round(Math.max(0, Math.min(y - half, imageSize.h - LOGO_SIZE))),
      w: LOGO_SIZE,
      h: LOGO_SIZE,
    })
  }

  const drawCanvas = useCallback(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imageSize) return

    canvas.width = img.clientWidth
    canvas.height = img.clientHeight

    const ctx = canvas.getContext('2d')!
    const scaleX = img.clientWidth / imageSize.w
    const scaleY = img.clientHeight / imageSize.h

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    if (box) {
      const rx = box.x * scaleX
      const ry = box.y * scaleY
      const rw = box.w * scaleX
      const rh = box.h * scaleY

      if (logoImgRef.current) {
        ctx.drawImage(logoImgRef.current, rx, ry, rw, rh)
      } else {
        ctx.fillStyle = 'rgba(59,130,246,0.15)'
        ctx.fillRect(rx, ry, rw, rh)
      }
      ctx.strokeStyle = 'rgba(59,130,246,0.7)'
      ctx.lineWidth = 1.5
      ctx.setLineDash([4, 3])
      ctx.strokeRect(rx, ry, rw, rh)
      ctx.setLineDash([])
    }
  }, [box, imageSize])

  useEffect(() => { drawCanvas() }, [drawCanvas])

  async function handleApplyLogo() {
    if (!box) return
    setStamping(true)
    setError(null)
    try {
      const res = await fetch(`/api/wfdo-stamp-logo/${encodeURIComponent(orderId)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ box }),
      })
      if (!res.ok) throw new Error(`Server error ${res.status}`)
      setStampedTs(Date.now())
      setBox(null)
      onStamped?.()
    } catch (err) {
      setError(String(err))
    } finally {
      setStamping(false)
    }
  }

  const imgSrc = `/api/wfdo-render-page/${encodeURIComponent(orderId)}${stampedTs ? `?t=${stampedTs}` : ''}`

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Click anywhere on the PDF to place the logo. Click again to reposition.
      </p>
      <div className="relative rounded overflow-hidden border border-blue-100 select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={imgSrc}
          alt="PDF page for logo placement"
          className="w-full block"
          onLoad={handleImageLoad}
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: 'crosshair' }}
          onClick={handleClick}
        />
      </div>

      <div className="flex items-center gap-2">
        <button
          onClick={() => setBox(null)}
          disabled={!box}
          className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear
        </button>
        <button
          onClick={handleApplyLogo}
          disabled={!box || stamping}
          className="text-xs font-medium text-white bg-blue-600 rounded-full px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {stamping ? 'Stamping…' : 'Apply Logo'}
        </button>
        {stampedTs && (
          <span className="text-xs text-green-700">Logo applied — click to reposition.</span>
        )}
      </div>
      {error && <p className="text-xs text-red-600">{error}</p>}
    </div>
  )
}
