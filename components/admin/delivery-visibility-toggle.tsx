"use client"

import { useState } from "react"
import { Eye, EyeOff } from "lucide-react"

interface DeliveryVisibilityToggleProps {
  productId: number
  isHidden: boolean
  onToggle: (productId: number, newHiddenState: boolean) => void
}

export default function DeliveryVisibilityToggle({
  productId,
  isHidden,
  onToggle
}: DeliveryVisibilityToggleProps) {
  const [isLoading, setIsLoading] = useState(false)

  const handleToggle = async () => {
    if (isLoading) return

    setIsLoading(true)
    try {
      const newHiddenState = !isHidden
      const res = await fetch(`/api/admin/products/${productId}/toggle-delivery-visibility`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hidden: newHiddenState })
      })
      if (!res.ok) {
        const payload = await res.json().catch(() => ({}))
        console.error("Erro ao alterar visibilidade do produto no delivery:", payload)
        alert("Erro ao alterar visibilidade do produto no delivery")
        return
      }

      // Chamar callback para atualizar o estado no componente pai
      onToggle(productId, newHiddenState)
    } catch (error) {
      console.error("Erro ao alterar visibilidade do produto no delivery:", error)
      alert("Erro ao alterar visibilidade do produto no delivery")
    } finally {
      setIsLoading(false)
    }
  }

  // Texto responsivo baseado no tamanho da tela
  const getButtonText = () => {
    if (isLoading) return "..."
    if (isHidden) {
      return (
        <>
          <span className="hidden xs:inline">Delivery: Oculto</span>
          <span className="xs:hidden">Del: ✗</span>
        </>
      )
    } else {
      return (
        <>
          <span className="hidden xs:inline">Delivery: Visível</span>
          <span className="xs:hidden">Del: ✓</span>
        </>
      )
    }
  }

  return (
    <button
      onClick={handleToggle}
      disabled={isLoading}
      className={`
        inline-flex items-center gap-0.5 sm:gap-1 px-1.5 sm:px-2 py-0.5 sm:py-1 rounded text-[10px] xs:text-xs font-medium transition-all duration-200
        ${isLoading ? 'opacity-50 cursor-not-allowed' : 'hover:scale-105 active:scale-95'}
        ${isHidden
          ? 'bg-red-100 text-red-700 hover:bg-red-200 border border-red-200'
          : 'bg-green-100 text-green-700 hover:bg-green-200 border border-green-200'
        }
        touch-manipulation min-w-0 flex-shrink-0
      `}
      title={isHidden ? "Produto oculto do delivery - Clique para mostrar" : "Produto visível no delivery - Clique para ocultar"}
    >
      {isLoading ? (
        <div className="w-2.5 h-2.5 sm:w-3 sm:h-3 border border-current border-t-transparent rounded-full animate-spin flex-shrink-0" />
      ) : isHidden ? (
        <EyeOff className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
      ) : (
        <Eye className="w-2.5 h-2.5 sm:w-3 sm:h-3 flex-shrink-0" />
      )}
      <span className="whitespace-nowrap truncate min-w-0">
        {getButtonText()}
      </span>
    </button>
  )
}