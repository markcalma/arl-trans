'use client'

import { useRef, useState, useEffect } from 'react'

interface Box {
  x: number
  y: number
  w: number
  h: number
}

interface DrawState {
  startX: number
  startY: number
  currentX: number
  currentY: number
}

export function WFDORedactEditor({
  orderId,
  containerNumber,
}: {
  orderId: string
  containerNumber: string
}) {
  const [boxes, setBoxes] = useState<Box[]>([])
  const [drawing, setDrawing] = useState<DrawState | null>(null)
  const [imageSize, setImageSize] = useState<{ w: number; h: number } | null>(null)
  const [applying, setApplying] = useState(false)
  const [appliedTs, setAppliedTs] = useState<number | null>(null)

  const imgRef = useRef<HTMLImageElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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

  function handleMouseDown(e: React.MouseEvent<HTMLCanvasElement>) {
    const { x, y } = toImageCoords(e)
    setDrawing({ startX: x, startY: y, currentX: x, currentY: y })
  }

  function handleMouseMove(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const { x, y } = toImageCoords(e)
    setDrawing((prev) => (prev ? { ...prev, currentX: x, currentY: y } : null))
  }

  function handleMouseUp(e: React.MouseEvent<HTMLCanvasElement>) {
    if (!drawing) return
    const { x, y } = toImageCoords(e)
    const x0 = Math.min(drawing.startX, x)
    const y0 = Math.min(drawing.startY, y)
    const w = Math.abs(x - drawing.startX)
    const h = Math.abs(y - drawing.startY)
    if (w > 2 && h > 2) {
      setBoxes((prev) => [
        ...prev,
        { x: Math.round(x0), y: Math.round(y0), w: Math.round(w), h: Math.round(h) },
      ])
    }
    setDrawing(null)
  }

  useEffect(() => {
    const canvas = canvasRef.current
    const img = imgRef.current
    if (!canvas || !img || !imageSize) return

    canvas.width = img.clientWidth
    canvas.height = img.clientHeight

    const ctx = canvas.getContext('2d')!
    const scaleX = img.clientWidth / imageSize.w
    const scaleY = img.clientHeight / imageSize.h

    ctx.clearRect(0, 0, canvas.width, canvas.height)

    ctx.fillStyle = 'rgba(255, 255, 255, 0.7)'
    ctx.strokeStyle = 'rgba(220, 38, 38, 0.8)'
    ctx.lineWidth = 1.5
    for (const box of boxes) {
      ctx.fillRect(box.x * scaleX, box.y * scaleY, box.w * scaleX, box.h * scaleY)
      ctx.strokeRect(box.x * scaleX, box.y * scaleY, box.w * scaleX, box.h * scaleY)
    }

    if (drawing) {
      const x0 = Math.min(drawing.startX, drawing.currentX) * scaleX
      const y0 = Math.min(drawing.startY, drawing.currentY) * scaleY
      const dw = Math.abs(drawing.currentX - drawing.startX) * scaleX
      const dh = Math.abs(drawing.currentY - drawing.startY) * scaleY
      ctx.fillStyle = 'rgba(255, 255, 255, 0.4)'
      ctx.strokeStyle = 'rgba(220, 38, 38, 0.9)'
      ctx.fillRect(x0, y0, dw, dh)
      ctx.strokeRect(x0, y0, dw, dh)
    }
  }, [boxes, drawing, imageSize])

  async function handleApply() {
    setApplying(true)
    await fetch(`/api/wfdo-manual-redact/${encodeURIComponent(orderId)}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ boxes }),
    })
    setApplying(false)
    setBoxes([])
    setAppliedTs(Date.now())
  }

  if (appliedTs) {
    return (
      <div className="space-y-2">
        <div className="text-xs text-green-700 bg-green-50 rounded px-3 py-1.5">
          Redactions applied. Review the PDF below, then approve and send.
        </div>
        <div className="rounded overflow-hidden border border-gray-100" style={{ height: 480 }}>
          <iframe
            src={`/api/wfdo-pdf/${encodeURIComponent(orderId)}?t=${appliedTs}`}
            className="w-full h-full"
            title={`Redacted DO for ${containerNumber}`}
          />
        </div>
        <button
          onClick={() => setAppliedTs(null)}
          className="text-xs text-gray-400 underline"
        >
          Draw more boxes
        </button>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-gray-500">
        Draw boxes over NVO info to redact. Drag to select, then click &ldquo;Apply
        Redactions&rdquo;.
      </p>
      <div className="relative rounded overflow-hidden border border-gray-100 select-none">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          ref={imgRef}
          src={`/api/wfdo-render-page/${encodeURIComponent(orderId)}`}
          alt={`DO for ${containerNumber}`}
          className="w-full block"
          onLoad={handleImageLoad}
          draggable={false}
        />
        <canvas
          ref={canvasRef}
          className="absolute inset-0 w-full h-full"
          style={{ cursor: 'crosshair' }}
          onMouseDown={handleMouseDown}
          onMouseMove={handleMouseMove}
          onMouseUp={handleMouseUp}
          onMouseLeave={() => setDrawing(null)}
        />
      </div>
      <div className="flex items-center gap-2">
        <button
          onClick={() => setBoxes((prev) => prev.slice(0, -1))}
          disabled={boxes.length === 0}
          className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Undo
        </button>
        <button
          onClick={() => setBoxes([])}
          disabled={boxes.length === 0}
          className="text-xs text-gray-500 bg-gray-50 border border-gray-200 rounded-full px-3 py-1.5 hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          Clear All
        </button>
        <button
          onClick={handleApply}
          disabled={boxes.length === 0 || applying}
          className="text-xs font-medium text-white bg-blue-600 rounded-full px-4 py-1.5 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {applying
            ? 'Applying…'
            : `Apply Redactions (${boxes.length} box${boxes.length !== 1 ? 'es' : ''})`}
        </button>
      </div>
    </div>
  )
}
