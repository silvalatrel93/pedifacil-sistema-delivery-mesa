"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { ArrowLeft, Trash2, Plus, Minus, Edit } from "lucide-react"
import { useCart, CartProvider } from "@/lib/cart-context"
import { formatCurrency } from "@/lib/utils"
import { getStoreConfig, type StoreConfig } from "@/lib/services/store-config-service"
import { getProductById } from "@/lib/services/product-service"
import type { Additional, Product } from "@/lib/types"
import ProductCard from "@/components/product-card"

// Função para detectar contexto de mesa
function isTableContext(): boolean {
  if (typeof window === 'undefined') return false

  const currentPath = window.location.pathname
  const mesaAtual = localStorage.getItem('mesa_atual')

  // Verificar se estamos na rota de mesa OU se há dados de mesa no localStorage
  return currentPath.startsWith('/mesa/') || !!mesaAtual
}

// Componente para exibir um item com nome à esquerda e valor à direita
function ItemRow({ name, value, className }: { name: string; value: string; className?: string }) {
  return (
    <div className={`flex items-center justify-between w-full ${className || ''}`}>
      <div className="flex-1 text-sm sm:text-base text-gray-600">{name}</div>
      <div className="flex-shrink-0 text-right tabular-nums text-sm sm:text-base md:text-lg font-bold text-gray-900" data-component-name="ItemRow">{value}</div>
    </div>
  )
}

// Componente interno que usa o hook useCart
function CartPageContent() {
  const { cart, removeFromCart, updateQuantity, updateNotes, isLoading, tableInfo, isTableOrder } = useCart()
  const router = useRouter()
  const [storeConfig, setStoreConfig] = useState<StoreConfig | null>(null)
  const [deliveryFee, setDeliveryFee] = useState(5.0)
  const [picoleDeliveryFee, setPicoleDeliveryFee] = useState(5.0)
  const [minimumPicoleOrder, setMinimumPicoleOrder] = useState(20.0)
  const [moreninhaDeliveryFee, setMoreninhaDeliveryFee] = useState(5.0)
  const [minimumMoreninhaOrder, setMinimumMoreninhaOrder] = useState(17.0)
  const [isUpdating, setIsUpdating] = useState<Record<string, boolean>>({})
  const [productCategories, setProductCategories] = useState<Record<string, string>>({})
  const [expandedNotes, setExpandedNotes] = useState<Record<string, boolean>>({})
  const [notesValues, setNotesValues] = useState<Record<string, string>>({})
  // Estado para edição inline (abrir modal do produto sem navegação)
  
  // URL de retorno estável para evitar hydration mismatch
  const [backUrl, setBackUrl] = useState<string>("/")
  useEffect(() => {
    if (isTableOrder && tableInfo) {
      setBackUrl(`/mesa/${tableInfo.number}`)
    } else {
      setBackUrl("/")
    }
  }, [isTableOrder, tableInfo])
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [editingItemId, setEditingItemId] = useState<string | null>(null)

  // Calcular subtotal e total
  const subtotal = cart.reduce((sum, item) => {
    // Usar o preço original (já com adicionais) se disponível, senão calcular
    if (item.originalPrice) {
      return sum + (item.originalPrice * item.quantity)
    }

    // Cálculo para compatibilidade com itens antigos
    const itemTotal = item.price * item.quantity
    const additionalsTotal = (item.additionals || []).reduce(
      (sum, additional) => sum + additional.price * (additional.quantity || 1),
      0
    )

    return sum + (itemTotal + additionalsTotal)
  }, 0)

  // Função para verificar se o produto é da categoria Picolé (mesma lógica do ProductCard)
  const isPicolé = (categoryName: string | null | undefined): boolean => {
    if (!categoryName) return false

    const picoléTerms = [
      "PICOLÉ",
      "PICOLÉ AO LEITE",
      "PICOLE",
      "PICOLE AO LEITE",
      "PICOLÉ AO LEITÉ",
      "PICOLE AO LEITÉ"
    ]

    return picoléTerms.some(term =>
      categoryName.toUpperCase().includes(term)
    )
  }

  // Função para verificar se o produto é da categoria Moreninha
  const isMoreninha = (categoryName: string | null | undefined): boolean => {
    if (!categoryName) return false

    return categoryName.toUpperCase().includes("MORENINHA")
  }

  // Calcular subtotal apenas para produtos da categoria PICOLE
  const picoleSubtotal = cart.reduce((sum, item) => {
    // Verificar se o item é da categoria PICOLE
    const isPicole = isPicolé(item.categoryName) || isPicolé(productCategories[item.id])
    if (!isPicole) return sum

    // Calcular valor do item
    if (item.originalPrice) {
      return sum + (item.originalPrice * item.quantity)
    }

    const itemTotal = item.price * item.quantity
    const additionalsTotal = (item.additionals || []).reduce(
      (sum, additional) => sum + additional.price * (additional.quantity || 1),
      0
    )

    return sum + (itemTotal + additionalsTotal)
  }, 0)

  // Verificar se há produtos da categoria PICOLE no carrinho
  const hasPicoleProducts = cart.some(item =>
    isPicolé(item.categoryName) || isPicolé(productCategories[item.id])
  )

  // Verificar se TODOS os produtos no carrinho são da categoria PICOLE
  const hasOnlyPicoleProducts = cart.length > 0 && cart.every(item =>
    isPicolé(item.categoryName) || isPicolé(productCategories[item.id])
  )

  // Verificar se TODOS os produtos no carrinho são da categoria MORENINHA
  const hasOnlyMoreninhaProducts = cart.length > 0 && cart.every(item =>
    isMoreninha(item.categoryName) || isMoreninha(productCategories[item.id])
  )

  // Determinar se deve aplicar taxa de entrega para PICOLE
  // Taxa só se aplica se tem SOMENTE picolés e o valor total é menor que o mínimo
  const shouldApplyPicoleFee = hasOnlyPicoleProducts && subtotal < minimumPicoleOrder

  // Determinar se deve aplicar taxa de entrega para MORENINHA
  // Taxa só se aplica se tem SOMENTE moreninha e o valor total é menor que o mínimo
  const shouldApplyMoreninhaFee = hasOnlyMoreninhaProducts && subtotal < minimumMoreninhaOrder

  // Calcular taxa de entrega final (prioridade: picolé > moreninha > normal)
  const finalDeliveryFee = shouldApplyPicoleFee
    ? picoleDeliveryFee
    : shouldApplyMoreninhaFee
      ? moreninhaDeliveryFee
      : deliveryFee

  const total = subtotal + finalDeliveryFee

  // Carregar taxa de entrega e configurações de picolés da loja
  useEffect(() => {
    const loadStoreConfig = async () => {
      try {
        const config = await getStoreConfig()
        setStoreConfig(config)
        if (config) {
          if (config.deliveryFee !== undefined) {
            setDeliveryFee(config.deliveryFee)
          }

          // Carregar configurações específicas para picolés
          if (config.picoleDeliveryFee !== undefined) {
            setPicoleDeliveryFee(config.picoleDeliveryFee)
          }

          if (config.minimumPicoleOrder !== undefined) {
            setMinimumPicoleOrder(config.minimumPicoleOrder)
          }

          // Carregar configurações específicas para moreninha
          if (config.moreninhaDeliveryFee !== undefined) {
            setMoreninhaDeliveryFee(config.moreninhaDeliveryFee)
          }

          if (config.minimumMoreninhaOrder !== undefined) {
            setMinimumMoreninhaOrder(config.minimumMoreninhaOrder)
          }
        }
      } catch (error) {
        console.error("Erro ao carregar configurações da loja:", error)
      }
    }

    loadStoreConfig()
  }, [])

  // Carregar categorias dos produtos no carrinho
  useEffect(() => {
    const loadProductCategories = async () => {
      const categories: Record<string, string> = {}

      // Processar apenas produtos que não têm categoria definida
      const productsToLoad = cart.filter(item => !item.categoryName && item.productId)

      if (productsToLoad.length === 0) return

      try {
        // Buscar informações de categoria para cada produto
        for (const item of productsToLoad) {
          if (item.productId) {
            const product = await getProductById(item.productId)
            if (product && product.categoryName) {
              categories[item.id] = product.categoryName
            }
          }
        }

        setProductCategories(categories)
      } catch (error) {
        console.error("Erro ao carregar categorias dos produtos:", error)
      }
    }

    if (cart.length > 0) {
      loadProductCategories()
    }
  }, [cart])

  // Sincronizar as notas do carrinho com o estado local
  useEffect(() => {
    const newNotesValues: Record<string, string> = {}
    cart.forEach(item => {
      newNotesValues[item.id] = item.notes || ""
    })
    setNotesValues(newNotesValues)
  }, [cart])

  const handleQuantityChange = async (id: string, newQuantity: number) => {
    if (newQuantity < 1) return

    // Marcar este item como atualizando
    setIsUpdating((prev) => ({ ...prev, [id]: true }))

    try {
      await updateQuantity(id, newQuantity)
    } finally {
      // Desmarcar este item como atualizando
      setIsUpdating((prev) => ({ ...prev, [id]: false }))
    }
  }

  const handleRemoveItem = async (id: string) => {
    if (!id || id.trim() === '') {
      console.error("Tentativa de remover item com ID inválido (vazio)")
      return
    }
    await removeFromCart(id)
  }

  const handleToggleNotes = (id: string) => {
    setExpandedNotes(prev => ({ ...prev, [id]: !prev[id] }))
  }

  const handleNotesChange = (id: string, value: string) => {
    setNotesValues(prev => ({ ...prev, [id]: value }))
  }

  const handleSaveNotes = async (id: string) => {
    try {
      await updateNotes(id, notesValues[id] || "")
      setExpandedNotes(prev => ({ ...prev, [id]: false }))
    } catch (error) {
      console.error("Erro ao salvar observações:", error)
    }
  }

  // Abrir modal de edição inline (sem trocar de rota)
  const handleOpenEditInline = async (productId?: number | null, itemId?: string) => {
    if (!productId) return
    try {
      const product = await getProductById(productId)
      if (product) {
        setEditingProduct(product)
        setEditingItemId(itemId || null)
      }
    } catch (e) {
      console.error('Falha ao carregar produto para edição inline:', e)
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <header 
          className="text-white p-4 sticky top-0 z-10" 
          style={{
            background: `linear-gradient(to right, ${storeConfig?.storeColor || '#8B5CF6'}, ${storeConfig?.storeColor || '#8B5CF6'})`,
            boxShadow: `0 10px 15px -3px ${storeConfig?.storeColor || '#8B5CF6'}40, 0 4px 6px -2px ${storeConfig?.storeColor || '#8B5CF6'}20`
          }}
          data-component-name="CartPageContent">
          <div className="container mx-auto flex items-center">
            <Link href={backUrl} className="mr-4">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold">Carrinho</h1>
          </div>
        </header>
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700"></div>
        </div>
      </div>
    )
  }

  if (cart.length === 0) {
    return (
      <div className="min-h-screen flex flex-col">
        <header 
          className="text-white p-4 sticky top-0 z-10" 
          style={{
            background: `linear-gradient(to right, ${storeConfig?.storeColor || '#8B5CF6'}, ${storeConfig?.storeColor || '#8B5CF6'})`,
            boxShadow: `0 10px 15px -3px ${storeConfig?.storeColor || '#8B5CF6'}40, 0 4px 6px -2px ${storeConfig?.storeColor || '#8B5CF6'}20`
          }}
          data-component-name="CartPageContent">
          <div className="container mx-auto flex items-center">
            <Link href={backUrl} className="mr-4">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold">Carrinho</h1>
          </div>
        </header>

        <div className="flex-1 flex flex-col items-center justify-center p-4">
          <h2 className="text-xl font-semibold text-gray-700 mb-2">Seu carrinho está vazio</h2>
          <p className="text-gray-500 mb-6 text-center">Adicione alguns produtos antes de finalizar o pedido</p>
          <Link href={backUrl}>
            <button 
              className="text-white px-6 py-2 rounded-full transition-all duration-200"
              style={{
                backgroundColor: storeConfig?.storeColor || '#8B5CF6',
                boxShadow: `0 4px 6px -1px ${storeConfig?.storeColor || '#8B5CF6'}40`
              }}
              onMouseEnter={(e) => {
                const color = storeConfig?.storeColor || '#8B5CF6';
                const darkerColor = `${color}CC`;
                (e.target as HTMLElement).style.backgroundColor = darkerColor;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = storeConfig?.storeColor || '#8B5CF6';
              }}
            >
              Ver produtos
            </button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex flex-col">
      <header 
        className="text-white p-4 sticky top-0 z-10" 
        style={{
          background: `linear-gradient(to right, ${storeConfig?.storeColor || '#8B5CF6'}, ${storeConfig?.storeColor || '#8B5CF6'})`,
          boxShadow: `0 10px 15px -3px ${storeConfig?.storeColor || '#8B5CF6'}40, 0 4px 6px -2px ${storeConfig?.storeColor || '#8B5CF6'}20`
        }}
        data-component-name="CartPageContent">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center">
            <Link href={backUrl} className="mr-4">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold">Carrinho</h1>
          </div>
          <div>
            <span 
              className="text-sm bg-white px-2 py-1 rounded-full"
              style={{ color: storeConfig?.storeColor || '#8B5CF6' }}
            >
              {cart.length} {cart.length === 1 ? "item" : "itens"}
            </span>
          </div>
        </div>
      </header>

      <div className="flex-1 container mx-auto p-3 sm:p-4 max-w-4xl">
        <div className="bg-white rounded-lg shadow-md overflow-hidden mb-4">
          <div className="p-3 sm:p-4 border-b">
            <h2 
              className="text-base sm:text-lg font-semibold"
              style={{ color: storeConfig?.storeColor || '#8B5CF6' }}
            >
              Itens do Carrinho
            </h2>
          </div>

          <ul className="divide-y divide-gray-200">
            {cart.map((item) => (
              <li key={`${item.id}`} className="p-3 sm:p-4">
                <div className="flex flex-col sm:flex-row sm:items-start">
                  {/* Primeira linha: imagem e informações principais */}
                  <div className="flex w-full mb-3 sm:mb-0">
                    {item.image && (
                      <div className="w-16 h-16 sm:w-18 sm:h-18 relative flex-shrink-0 mr-3 sm:mr-4 rounded-md overflow-hidden">
                        <Image
                          src={item.image || "/placeholder.svg"}
                          alt={item.name}
                          fill
                          sizes="(max-width: 640px) 64px, 72px"
                          className="object-cover rounded-md"
                        />
                      </div>
                    )}

                    <div className="flex-1 min-w-0">
                      <div className="space-y-1">
                        {/* Nome do produto e preço base */}
                        <div className="flex flex-col">
                          {/* Categoria do produto */}
                          {(item.categoryName || productCategories[item.id]) && (
                            <span 
                              className="text-xs font-medium mb-0.5"
                              style={{ color: storeConfig?.storeColor || '#8B5CF6' }}
                            >
                              {item.categoryName || productCategories[item.id]}
                            </span>
                          )}

                          {/* Nome, preço e controles do produto */}
                          <div className="flex justify-between items-start">
                            <div className="flex-1 min-w-0 pr-2">
                              <span className="font-medium text-sm sm:text-base md:text-lg leading-tight">
                                <span className="font-bold text-gray-800">{item.quantity}x</span> {item.name}
                                <span className="text-xs sm:text-sm text-gray-500 block sm:inline mt-0.5 sm:mt-0 ml-0 sm:ml-1">({item.size})</span>
                              </span>
                            </div>

                            <div className="flex items-center gap-2 flex-shrink-0">
                              <span className="text-base sm:text-lg md:text-xl font-bold text-green-600 whitespace-nowrap" data-component-name="CartPageContent">{formatCurrency(item.price)}</span>

                              {/* Botão de editar pedido (abrir modal inline, sem navegação) */}
                              <button
                                onClick={() => handleOpenEditInline(item.productId, item.id)}
                                className="
                                  group relative overflow-hidden flex items-center justify-center
                                  bg-white border p-1 rounded-full shadow-sm
                                  transition-all duration-300 hover:shadow-md hover:bg-gray-50
                                  active:scale-95 focus:outline-none focus:ring-2 focus:ring-opacity-50
                                  touch-manipulation w-7 h-7
                                "
                                style={{
                                  borderColor: `${storeConfig?.storeColor || '#8B5CF6'}40`,
                                  color: storeConfig?.storeColor || '#8B5CF6'
                                }}
                                onMouseEnter={(e) => {
                                  const color = storeConfig?.storeColor || '#8B5CF6';
                                  (e.target as HTMLElement).style.backgroundColor = `${color}10`;
                                  (e.target as HTMLElement).style.borderColor = `${color}60`;
                                }}
                                onMouseLeave={(e) => {
                                  const color = storeConfig?.storeColor || '#8B5CF6';
                                  (e.target as HTMLElement).style.backgroundColor = 'white';
                                  (e.target as HTMLElement).style.borderColor = `${color}40`;
                                }}
                                aria-label="Editar pedido"
                                title="Editar pedido"
                              >
                                <Edit size={12} />
                              </button>

                              {/* Botões de controle para MILK-SHAKE'S */}
                              {(() => {
                                const isMilkShake = item.categoryName?.toUpperCase().includes("MILK-SHAKE");
                                return isMilkShake ? (
                                  <div className="flex items-center gap-1">
                                    {/* Controles de quantidade */}
                                    <div 
                                      className="flex items-center bg-gray-50 border rounded-full h-7 shadow-sm transition-all duration-200 hover:shadow-md touch-manipulation"
                                      style={{ borderColor: `${storeConfig?.storeColor || '#8B5CF6'}40` }}
                                    >
                                      <button
                                        onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                                        className="px-1 py-0.5 h-full w-7 flex items-center justify-center rounded-l-full transition-colors duration-200 touch-manipulation"
                                        style={{ 
                                          color: storeConfig?.storeColor || '#8B5CF6'
                                        }}
                                        onMouseEnter={(e) => {
                          (e.target as HTMLElement).style.backgroundColor = `${storeConfig?.storeColor || '#8B5CF6'}20`;
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLElement).style.backgroundColor = 'transparent';
                        }}
                                        disabled={isUpdating[item.id]}
                                        aria-label="Diminuir quantidade"
                                      >
                                        <Minus size={12} className={`${isUpdating[item.id] ? 'opacity-50' : ''}`} />
                                      </button>
                                      <div className="relative px-1.5 min-w-[1.5rem] text-center">
                                        <span className="text-xs font-medium">{item.quantity}</span>
                                        {isUpdating[item.id] && (
                                          <div className="absolute inset-0 flex items-center justify-center">
                                            <div 
                                              className="w-2 h-2 border-2 border-t-transparent rounded-full animate-spin"
                                              style={{ borderColor: `${storeConfig?.storeColor || '#8B5CF6'} transparent transparent transparent` }}
                                            ></div>
                                          </div>
                                        )}
                                      </div>
                                      <button
                                        onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                                        className="px-1 py-0.5 h-full w-7 flex items-center justify-center rounded-r-full transition-colors duration-200 touch-manipulation"
                                        style={{ 
                                          color: storeConfig?.storeColor || '#8B5CF6'
                                        }}
                                        onMouseEnter={(e) => {
                          (e.target as HTMLElement).style.backgroundColor = `${storeConfig?.storeColor || '#8B5CF6'}20`;
                        }}
                        onMouseLeave={(e) => {
                          (e.target as HTMLElement).style.backgroundColor = 'transparent';
                        }}
                                        disabled={isUpdating[item.id]}
                                        aria-label="Aumentar quantidade"
                                      >
                                        <Plus size={12} className={`${isUpdating[item.id] ? 'opacity-50' : ''}`} />
                                      </button>
                                    </div>

                                    {/* Botão remover */}
                                    <button
                                      onClick={() => handleRemoveItem(item.id)}
                                      className={`
                                        group relative overflow-hidden text-red-500 flex items-center justify-center
                                        bg-white border border-red-200 p-1 rounded-full shadow-sm
                                        transition-all duration-300 hover:shadow-md hover:bg-red-50 hover:border-red-300
                                        active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-opacity-50
                                        touch-manipulation w-7 h-7
                                        ${isUpdating[item.id] ? 'opacity-70 cursor-not-allowed' : ''}
                                      `}
                                      disabled={isUpdating[item.id]}
                                      aria-label="Remover item"
                                      title="Remover do carrinho"
                                    >
                                      <Trash2 size={12} />
                                    </button>
                                  </div>
                                ) : null;
                              })()}
                            </div>
                          </div>
                        </div>

                        {/* Lista de adicionais */}
                        {item.additionals && item.additionals.length > 0 && (
                          <div className="ml-2 sm:ml-4 mt-2">
                            {(() => {
                              // Verificar se é produto da categoria MILK-SHAKE'S
                              const isMilkShake = item.categoryName?.toUpperCase().includes("MILK-SHAKE");

                              return (
                                <ul className={`text-xs text-gray-600 space-y-1.5 ${isMilkShake ? 'space-y-2' : ''}`} data-component-name="CartPageContent">
                                  {item.additionals.map((additional, index) => (
                                    <li
                                      key={index}
                                      className={`${isMilkShake ? 'flex flex-col sm:flex-row sm:justify-between sm:items-baseline gap-1 sm:gap-0' : 'flex justify-between items-baseline'}`}
                                      data-component-name="CartPageContent"
                                    >
                                      <span
                                        className={`${isMilkShake ? 'break-words leading-tight text-left' : 'break-words'} pr-2 leading-tight text-xs sm:text-sm max-w-full overflow-hidden`}
                                        data-component-name="CartPageContent"
                                      >
                                        + {additional.quantity}x {additional.name}
                                      </span>
                                      <span
                                        className={`whitespace-nowrap text-sm sm:text-base font-semibold text-green-600 ${isMilkShake ? 'text-right' : 'ml-1'}`}
                                      >
                                        {additional.price === 0 ? "Grátis" : `+ ${formatCurrency(additional.price * (additional.quantity || 1))}`}
                                      </span>
                                    </li>
                                  ))}
                                </ul>
                              );
                            })()}
                          </div>
                        )}

                        {/* Exibir informação de colher quando o cliente pediu colher */}
                        {item.needsSpoon === true && (
                          <div className="ml-2 sm:ml-4 mt-2">
                            <div className="bg-green-50 border-green-400 border-l-4 p-2 rounded-r-md">
                              <div className="flex items-start">
                                <span className="inline-block w-2.5 h-2.5 bg-gradient-to-r from-green-400 to-green-600 rounded-full mr-1.5 mt-0.5 flex-shrink-0"></span>
                                <div className="text-xs">
                                  <span className="font-semibold text-green-800">
                                    Precisa de colher: {
                                      item.spoonQuantity && item.spoonQuantity > 1 ?
                                        `Sim (${item.spoonQuantity} colheres)` :
                                        'Sim (1 colher)'
                                    }
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Exibir informação de colher quando o cliente NÃO quer colher (destacar em vermelho) */}
                        {item.needsSpoon === false && (
                          <div className="ml-2 sm:ml-4 mt-2">
                            <div className="bg-red-50 border-red-300 border-l-4 p-2 rounded-r-md">
                              <div className="flex items-start">
                                <span className="inline-block w-2.5 h-2.5 bg-gradient-to-r from-red-400 to-red-600 rounded-full mr-1.5 mt-0.5 flex-shrink-0"></span>
                                <div className="text-xs">
                                  <span className="font-semibold text-red-700">
                                    Não precisa de colher
                                  </span>
                                </div>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Observações do cliente */}
                        <div className="ml-2 sm:ml-4 mt-2">
                          {/* Botão para expandir/colapsar observações */}
                          <button
                            onClick={() => handleToggleNotes(item.id)}
                            className="text-xs flex items-center transition-colors duration-200"
                            style={{ 
                              color: storeConfig?.storeColor || '#8B5CF6'
                            }}
                            onMouseEnter={(e) => {
                const color = storeConfig?.storeColor || '#8B5CF6';
                (e.target as HTMLElement).style.color = `${color}CC`;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.color = storeConfig?.storeColor || '#8B5CF6';
              }}
                          >
                            <svg
                              xmlns="http://www.w3.org/2000/svg"
                              className={`h-3 w-3 mr-1 transform transition-transform ${expandedNotes[item.id] ? 'rotate-90' : ''}`}
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                            </svg>
                            {item.notes && item.notes.trim() !== ""
                              ? "Editar observações"
                              : "Adicionar observações"
                            }
                          </button>

                          {/* Exibir observações salvas se existirem */}
                          {item.notes && item.notes.trim() !== "" && !expandedNotes[item.id] && (
                            <p className="text-xs text-gray-600 mt-1 italic bg-gray-50 p-1 rounded">
                              "{item.notes}"
                            </p>
                          )}

                          {/* Campo de entrada para observações */}
                          {expandedNotes[item.id] && (
                            <div className="mt-2 space-y-2">
                              <textarea
                                value={notesValues[item.id] ?? ""}
                                onChange={(e) => handleNotesChange(item.id, e.target.value)}
                                placeholder="Ex: remover banana, sem açúcar, etc."
                                className="w-full text-xs border border-gray-300 rounded p-2 resize-none"
                                rows={2}
                                maxLength={200}
                              />
                              <div className="flex space-x-2">
                                <button
                                  onClick={() => handleSaveNotes(item.id)}
                                  className="text-xs text-white px-2 py-1 rounded transition-colors duration-200"
                                  style={{
                                    backgroundColor: storeConfig?.storeColor || '#8B5CF6'
                                  }}
                                  onMouseEnter={(e) => {
                const color = storeConfig?.storeColor || '#8B5CF6';
                (e.target as HTMLElement).style.backgroundColor = `${color}CC`;
              }}
              onMouseLeave={(e) => {
                (e.target as HTMLElement).style.backgroundColor = storeConfig?.storeColor || '#8B5CF6';
              }}
                                >
                                  Salvar
                                </button>
                                <button
                                  onClick={() => {
                                    setExpandedNotes(prev => ({ ...prev, [item.id]: false }))
                                    setNotesValues(prev => ({ ...prev, [item.id]: item.notes || "" }))
                                  }}
                                  className="text-xs bg-gray-300 text-gray-700 px-2 py-1 rounded hover:bg-gray-400"
                                >
                                  Cancelar
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        {/* Espaço para separação visual */}
                        <div className="mt-1"></div>
                      </div>
                    </div>
                  </div>

                  {/* Segunda linha: controles de quantidade e botão remover (apenas para produtos que NÃO são MILK-SHAKE'S) */}
                  {(() => {
                    const isMilkShake = item.categoryName?.toUpperCase().includes("MILK-SHAKE");
                    return !isMilkShake ? (
                      <div className="flex justify-end items-center gap-2 mt-3 w-full">
                        {/* Controles de quantidade */}
                        <div className="flex" data-component-name="CartPageContent">
                          <div className="flex items-center bg-gray-50 border border-purple-200 rounded-full h-8 shadow-sm transition-all duration-200 hover:shadow-md touch-manipulation scale-90 origin-right" data-component-name="CartPageContent">
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity - 1)}
                              className="px-1.5 py-0.5 text-purple-700 hover:bg-purple-100 h-full w-9 sm:w-8 flex items-center justify-center rounded-l-full transition-colors duration-200 active:bg-purple-200 touch-manipulation"
                              disabled={isUpdating[item.id]}
                              aria-label="Diminuir quantidade"
                              data-component-name="CartPageContent"
                            >
                              <Minus size={14} className={`${isUpdating[item.id] ? 'opacity-50' : ''}`} />
                            </button>
                            <div className="relative px-2 min-w-[2rem] text-center">
                              <span className="text-xs font-medium">{item.quantity}</span>
                              {isUpdating[item.id] && (
                                <div className="absolute inset-0 flex items-center justify-center">
                                  <div className="w-2.5 h-2.5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                                </div>
                              )}
                            </div>
                            <button
                              onClick={() => handleQuantityChange(item.id, item.quantity + 1)}
                              className="px-1.5 py-0.5 text-purple-700 hover:bg-purple-100 h-full w-9 sm:w-8 flex items-center justify-center rounded-r-full transition-colors duration-200 active:bg-purple-200 touch-manipulation"
                              disabled={isUpdating[item.id]}
                              aria-label="Aumentar quantidade"
                            >
                              <Plus size={14} className={`${isUpdating[item.id] ? 'opacity-50' : ''}`} />
                            </button>
                          </div>
                        </div>

                        {/* Botão remover */}
                        <button
                          onClick={() => handleRemoveItem(item.id)}
                          className={`
                            group relative overflow-hidden text-red-500 flex items-center justify-center
                            bg-white border border-red-200 p-1.5 rounded-full shadow-sm
                            transition-all duration-300 hover:shadow-md hover:bg-red-50 hover:border-red-300
                            active:scale-95 focus:outline-none focus:ring-2 focus:ring-red-300 focus:ring-opacity-50
                            touch-manipulation w-8 h-8 scale-90 origin-right
                            ${isUpdating[item.id] ? 'opacity-70 cursor-not-allowed' : ''}
                          `}
                          disabled={isUpdating[item.id]}
                          aria-label="Remover item"
                          data-component-name="CartPageContent"
                          title="Remover do carrinho"
                        >
                          <span className="relative z-10 flex items-center justify-center">
                            <Trash2 size={15} />
                          </span>
                          <span className="absolute inset-0 bg-gradient-to-r from-red-500 to-red-700 transform scale-x-0 origin-left transition-transform duration-300 group-hover:scale-x-100 group-hover:opacity-20" data-component-name="CartPageContent"></span>
                        </button>
                      </div>
                    ) : null;
                  })()}
                </div>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-white rounded-lg shadow-md p-4 mb-4">
          <h2 
            className="text-lg sm:text-xl md:text-2xl font-bold mb-3 sm:mb-4"
            style={{ color: storeConfig?.storeColor || '#8B5CF6' }}
          >
            Resumo do Pedido
          </h2>

          <div className="space-y-3 sm:space-y-4">
            <ItemRow name="Subtotal" value={formatCurrency(subtotal)} />

            {/* Taxa de entrega com mensagem condicional */}
            <div>
              <ItemRow
                name="Taxa de entrega"
                value={formatCurrency(finalDeliveryFee)}
              />

              {/* Mensagem de taxa especial para picolés - Versão ultra compacta para mobile */}
              {shouldApplyPicoleFee && (
                <div className="mt-1 bg-red-50 border border-red-100 rounded-sm p-1 max-w-full overflow-hidden">
                  <div className="flex items-start gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mt-0.5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[10px] leading-tight text-red-600 font-medium">
                      Taxa aplicada. Compre <span className="font-semibold">R$ {minimumPicoleOrder.toFixed(2).replace('.', ',')}</span> em picolés para frete grátis.
                    </span>
                  </div>
                </div>
              )}

              {/* Mensagem de taxa especial para moreninha */}
              {shouldApplyMoreninhaFee && (
                <div className="mt-1 bg-red-50 border border-red-100 rounded-sm p-1 max-w-full overflow-hidden">
                  <div className="flex items-start gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mt-0.5 text-red-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <span className="text-[10px] leading-tight text-red-600 font-medium">
                      Taxa aplicada. Compre <span className="font-semibold">R$ {minimumMoreninhaOrder.toFixed(2).replace('.', ',')}</span> em moreninha para frete grátis.
                    </span>
                  </div>
                </div>
              )}

              {/* Mensagem de taxa grátis para picolés - Versão ultra compacta para mobile */}
              {hasPicoleProducts && !shouldApplyPicoleFee && (
                <div className="mt-1 bg-green-50 border border-green-100 rounded-sm p-1 max-w-full overflow-hidden">
                  <div className="flex items-start gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[10px] leading-tight text-green-600 font-medium">
                      Frete grátis para picolés aplicado!
                    </span>
                  </div>
                </div>
              )}

              {/* Mensagem de taxa grátis para moreninha */}
              {hasOnlyMoreninhaProducts && !shouldApplyMoreninhaFee && (
                <div className="mt-1 bg-green-50 border border-green-100 rounded-sm p-1 max-w-full overflow-hidden">
                  <div className="flex items-start gap-1">
                    <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mt-0.5 text-green-500 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-[10px] leading-tight text-green-600 font-medium">
                      Frete grátis para moreninha aplicado!
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="pt-3 mt-1 border-t border-gray-300">
              <div className={`flex items-center justify-between w-full text-lg sm:text-xl md:text-2xl font-bold`} style={{ color: storeConfig?.storeColor || '#8B5CF6' }}>
                <div className="flex-1 text-sm sm:text-base text-gray-600">Total</div>
                <div className="flex-shrink-0 text-right tabular-nums text-sm sm:text-base md:text-lg font-bold text-gray-900" data-component-name="ItemRow">{formatCurrency(total)}</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex flex-col sm:flex-row sm:space-x-4 space-y-4 sm:space-y-0 mt-6 mb-8 sm:mb-6">
          <Link href={backUrl} className="sm:flex-1 order-2 sm:order-1">
            <button
              className="
                w-full relative overflow-hidden group
                border-2 transition-all duration-300 ease-in-out
                py-4 sm:py-3 px-4 rounded-xl sm:rounded-lg 
                font-semibold text-sm sm:text-base
                shadow-sm hover:shadow-md
                active:scale-[0.98]
                focus:outline-none focus:ring-2 focus:ring-opacity-50
                touch-manipulation"
              style={{
                 borderColor: storeConfig?.storeColor || '#8B5CF6',
                 color: storeConfig?.storeColor || '#8B5CF6'
               }}
              onMouseEnter={(e) => {
              const color = storeConfig?.storeColor || '#8B5CF6';
              (e.target as HTMLElement).style.backgroundColor = `${color}10`;
              (e.target as HTMLElement).style.boxShadow = `0 0 0 2px ${color}40`;
            }}
            onMouseLeave={(e) => {
              (e.target as HTMLElement).style.backgroundColor = 'transparent';
              (e.target as HTMLElement).style.boxShadow = 'none';
            }}
            >
              <span className="relative z-10 flex items-center justify-center">
                <ArrowLeft size={18} className="mr-2 transition-transform duration-300 group-hover:-translate-x-1" />
                Continuar Comprando
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-purple-50 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300"></span>
            </button>
          </Link>
          <Link href="/checkout" className="sm:flex-1 order-1 sm:order-2">
            <button
              className="
                w-full relative overflow-hidden group
                text-white transition-all duration-300 ease-in-out
                py-4 sm:py-3 px-4 rounded-xl sm:rounded-lg 
                font-semibold text-sm sm:text-base
                shadow-md hover:shadow-lg
                active:scale-[0.98]
                focus:outline-none focus:ring-2 focus:ring-opacity-50
                touch-manipulation"
              style={{
                background: `linear-gradient(to right, ${storeConfig?.storeColor || '#8B5CF6'}, ${storeConfig?.storeColor || '#8B5CF6'}DD)`,
                boxShadow: `0 4px 6px -1px ${storeConfig?.storeColor || '#8B5CF6'}40`
              }}
              onMouseEnter={(e) => {
              const color = storeConfig?.storeColor || '#8B5CF6';
              (e.target as HTMLElement).style.background = `linear-gradient(to right, ${color}CC, ${color}BB)`;
              (e.target as HTMLElement).style.boxShadow = `0 10px 15px -3px ${color}40, 0 4px 6px -2px ${color}20`;
            }}
            onMouseLeave={(e) => {
              const color = storeConfig?.storeColor || '#8B5CF6';
              (e.target as HTMLElement).style.background = `linear-gradient(to right, ${color}, ${color}DD)`;
              (e.target as HTMLElement).style.boxShadow = `0 4px 6px -1px ${color}40`;
            }}
            >
              <span className="relative z-10 flex items-center justify-center">
                Finalizar Pedido
                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="ml-2 transition-transform duration-300 group-hover:translate-x-1">
                  <path d="M5 12h14"></path>
                  <path d="m12 5 7 7-7 7"></path>
                </svg>
              </span>
              <span className="absolute inset-0 bg-gradient-to-r from-transparent to-purple-950 opacity-0 group-hover:opacity-30 transition-opacity duration-300" data-component-name="CartPageContent"></span>
            </button>
          </Link>
        </div>
      </div>

      {/* Modal de edição de produto inline (sem navegação) */}
      {editingProduct && (
        <ProductCard
          product={editingProduct}
          storeColor={storeConfig?.storeColor || '#8B5CF6'}
          forceOpen={true}
          editItemIdOverride={editingItemId}
          onModalClose={() => { setEditingProduct(null); setEditingItemId(null) }}
        />
      )}
    </div>
  )
}

// Componente principal que envolve o conteúdo com CartProvider
export default function CartPage() {
  return (
    <CartProvider>
      <CartPageContent />
    </CartProvider>
  )
}


