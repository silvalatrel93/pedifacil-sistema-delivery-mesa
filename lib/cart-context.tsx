"use client"

import type React from "react"

import { createContext, useContext, useState, useEffect, useCallback } from "react"
import { getCartItems, addToCart, updateCartItemQuantity, removeFromCart, clearCart } from "@/lib/services/cart-service"
import type { CartItem } from "@/lib/types"

interface TableInfo {
  id: number
  number: number
  name: string
}

interface CartContextType {
  cart: CartItem[]
  addToCart: (item: Omit<CartItem, "id">) => Promise<void>
  updateQuantity: (id: string, quantity: number, updatedFields?: Partial<CartItem>) => Promise<void>
  updateNotes: (id: string, notes: string) => Promise<void>
  removeFromCart: (id: string) => Promise<void>
  clearCart: () => Promise<void>
  isLoading: boolean
  itemCount: number
  tableInfo: TableInfo | null
  isTableOrder: boolean
}

const CartContext = createContext<CartContextType | undefined>(undefined)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [cart, setCart] = useState<CartItem[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [itemCount, setItemCount] = useState(0)
  const [tableInfo, setTableInfo] = useState<TableInfo | null>(() => {
    if (typeof window !== 'undefined') {
      try {
        const mesaAtual = localStorage.getItem('mesa_atual')
        if (mesaAtual) {
          return JSON.parse(mesaAtual) as TableInfo
        }
      } catch {
        // ignore parse errors
      }
    }
    return null
  })
  const [isTableOrder, setIsTableOrder] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const currentPath = window.location.pathname
      const mesaAtual = localStorage.getItem('mesa_atual')
      return !!mesaAtual && (
        currentPath.startsWith('/mesa/') ||
        currentPath === '/checkout' ||
        currentPath === '/carrinho'
      )
    }
    return false
  })

  // Carregar itens do carrinho
  const loadCart = useCallback(async () => {
    try {
      setIsLoading(true)
      const items = await getCartItems()
      setCart(items)
      setItemCount(items.reduce((count, item) => count + item.quantity, 0))
    } catch (error) {
      console.error("Erro ao carregar carrinho:", {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
    } finally {
      setIsLoading(false)
    }
  }, [])

  // Verificar se estamos em uma mesa (função estável)
  const checkTableContext = useCallback(() => {
    if (typeof window === 'undefined') return
    const currentPath = window.location.pathname
    const mesaAtual = localStorage.getItem('mesa_atual')

    try {
      if (mesaAtual) {
        const mesa = JSON.parse(mesaAtual) as TableInfo
        const isMesaPath = (
          currentPath.startsWith('/mesa/') ||
          currentPath === '/checkout' ||
          currentPath === '/carrinho'
        )

        if (isMesaPath) {
          // Atualiza somente se necessário
          setTableInfo((prev) => {
            const equal = !!prev && prev.id === mesa.id && prev.number === mesa.number && prev.name === mesa.name
            return equal ? prev : mesa
          })
          setIsTableOrder(() => true)
        } else {
          // Rota não relacionada: limpar somente se necessário
          if (localStorage.getItem('mesa_atual')) {
            localStorage.removeItem('mesa_atual')
          }
          setTableInfo((prev) => (prev === null ? prev : null))
          setIsTableOrder((prev) => (prev ? false : prev))
        }
      } else {
        // Sem dados de mesa
        if (!currentPath.startsWith('/mesa/')) {
          setTableInfo((prev) => (prev === null ? prev : null))
          setIsTableOrder((prev) => (prev ? false : prev))
        }
        // Se estiver em /mesa/ sem mesa_atual, não força atualização para evitar loop; aguardamos evento.
      }
    } catch (error) {
      console.error('Erro ao ler informações da mesa:', error)
      if (localStorage.getItem('mesa_atual')) {
        localStorage.removeItem('mesa_atual')
      }
      setTableInfo((prev) => (prev === null ? prev : null))
      setIsTableOrder((prev) => (prev ? false : prev))
    }
  }, [])

  useEffect(() => {
    // Verificar imediatamente no primeiro render para evitar piscar o fluxo de delivery
    checkTableContext()

    // Listener para mudanças de rota
    const handleRouteChange = () => {
      setTimeout(checkTableContext, 100) // Pequeno delay para dar tempo da nova página configurar
    }

    // Listener para evento customizado de mesa configurada
    const handleMesaConfigurada = () => {
      checkTableContext()
    }

    // Escutar mudanças na URL
    window.addEventListener('popstate', handleRouteChange)

    // Escutar evento customizado de mesa configurada
    window.addEventListener('mesa-configurada', handleMesaConfigurada)

    // Verificar periodicamente mudanças na URL (para navegação SPA)
    // Intervalo de 5 segundos para ser menos agressivo
    const intervalId = setInterval(checkTableContext, 5000)

    return () => {
      window.removeEventListener('popstate', handleRouteChange)
      window.removeEventListener('mesa-configurada', handleMesaConfigurada)
      clearInterval(intervalId)
    }
  }, [])

  // Carregar carrinho ao iniciar
  useEffect(() => {
    loadCart()
  }, [loadCart])

  // Adicionar item ao carrinho
  const handleAddToCart = useCallback(
    async (item: Omit<CartItem, "id">) => {
      try {
        const result = await addToCart(item)
        if (!result) {
          throw new Error("Falha ao adicionar item ao carrinho")
        }
        await loadCart()
      } catch (error) {
        console.error("Erro ao adicionar item ao carrinho:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          item
        })
        throw error // Re-lançar o erro para que seja capturado pelo componente que chama
      }
    },
    [loadCart],
  )

  // Atualizar quantidade e outros campos de um item (com atualização otimista da UI)
  const handleUpdateQuantity = useCallback(
    async (id: string, quantity: number, updatedFields?: Partial<CartItem>) => {
      try {
        // Atualização otimista da UI
        setCart((prevCart) => {
          const newCart = prevCart.map((item) => {
            if (item.id === id) {
              // Aplicar atualizações adicionais se fornecidas
              if (updatedFields) {
                return { ...item, quantity, ...updatedFields }
              }
              return { ...item, quantity }
            }
            return item
          })

          // Atualizar contagem de itens
          const newItemCount = newCart.reduce((count, item) => count + item.quantity, 0)
          setItemCount(newItemCount)

          return newCart
        })

        // Atualizar no banco de dados
        await updateCartItemQuantity(id, quantity, updatedFields)
      } catch (error) {
        console.error("Erro ao atualizar item do carrinho:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          itemId: id,
          quantity
        })
        // Em caso de erro, recarregar o carrinho para garantir consistência
        await loadCart()
      }
    },
    [loadCart],
  )

  // Remover item do carrinho (com atualização otimista da UI)
  const handleRemoveFromCart = useCallback(
    async (id: string) => {
      if (!id || id.trim() === '') {
        console.error("Tentativa de remover item com ID inválido (vazio) no contexto do carrinho.")
        return
      }
      try {
        // Atualização otimista da UI
        setCart((prevCart) => {
          const newCart = prevCart.filter((item) => item.id !== id)

          // Atualizar contagem de itens
          const newItemCount = newCart.reduce((count, item) => count + item.quantity, 0)
          setItemCount(newItemCount)

          return newCart
        })

        // Remover do banco de dados
        await removeFromCart(id)
      } catch (error) {
        console.error("Erro ao remover item:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          itemId: id
        })
        // Em caso de erro, recarregar o carrinho para garantir consistência
        await loadCart()
      }
    },
    [loadCart],
  )

  // Atualizar observações de um item
  const handleUpdateNotes = useCallback(
    async (id: string, notes: string) => {
      try {
        // Atualização otimista da UI
        setCart((prevCart) => {
          return prevCart.map((item) => {
            if (item.id === id) {
              return { ...item, notes }
            }
            return item
          })
        })

        // Atualizar no banco de dados - passar a quantidade atual do item
        const currentItem = cart.find(item => item.id === id)
        if (currentItem) {
          await updateCartItemQuantity(id, currentItem.quantity, { notes })
        }
      } catch (error) {
        console.error("Erro ao atualizar observações do item:", {
          error,
          errorMessage: error instanceof Error ? error.message : String(error),
          itemId: id,
          notes
        })
        // Em caso de erro, recarregar o carrinho para garantir consistência
        await loadCart()
      }
    },
    [loadCart, cart],
  )

  // Limpar carrinho
  const handleClearCart = useCallback(async () => {
    try {
      setCart([])
      setItemCount(0)
      await clearCart()
    } catch (error) {
      console.error("Erro ao limpar carrinho:", {
        error,
        errorMessage: error instanceof Error ? error.message : String(error)
      })
      await loadCart()
    }
  }, [loadCart])

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart: handleAddToCart,
        updateQuantity: handleUpdateQuantity,
        updateNotes: handleUpdateNotes,
        removeFromCart: handleRemoveFromCart,
        clearCart: handleClearCart,
        isLoading,
        itemCount,
        tableInfo,
        isTableOrder,
      }}
    >
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  const context = useContext(CartContext)
  if (context === undefined) {
    throw new Error("useCart deve ser usado dentro de um CartProvider")
  }
  return context
}
