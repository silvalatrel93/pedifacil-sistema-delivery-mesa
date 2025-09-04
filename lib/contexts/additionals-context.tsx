"use client"

import { createContext, useContext, useState, ReactNode, useEffect } from "react"
import type { Additional } from "@/lib/services/additional-service"
import type { AdditionalCategory } from "@/lib/services/additional-category-service"
import type { ProductSize } from "@/lib/types"

// Constantes padrão
const DEFAULT_MAX_ADDITIONALS_PER_SIZE = 5
const FREE_ADDITIONALS_LIMIT = 5
const SIZES_WITH_FREE_ADDITIONALS = ["1 Litro", "2 Litros", "2 Litro"]

// Tipos
type AdditionalsContextType = {
  // Estado
  additionals: Additional[]
  additionalsByCategory: { category: AdditionalCategory, additionals: Additional[] }[]
  additionalsBySize: {
    [size: string]: {
      [additionalId: number]: { additional: Additional; quantity: number }
    }
  }
  selectedSize: string
  selectedCategoryId: number | null
  selectedAdditionals: Record<number, { additional: Additional; quantity: number }>
  isDataLoaded: boolean

  // Constantes
  maxAdditionalsPerSize: number // Limite dinâmico baseado no tamanho selecionado
  FREE_ADDITIONALS_LIMIT: number
  SIZES_WITH_FREE_ADDITIONALS: string[]

  // Valores calculados
  hasFreeAdditionals: boolean
  selectedAdditionalsCount: number
  reachedFreeAdditionalsLimit: boolean
  reachedMaxAdditionalsLimit: boolean
  selectedAdditionalsByCategory: Record<number, number> // Contagem de adicionais selecionados por categoria
  reachedCategoryLimit: (categoryId: number) => boolean // Verifica se atingiu o limite da categoria

  // Métodos
  setAdditionals: (additionals: Additional[]) => void
  setAdditionalsByCategory: (additionalsByCategory: { category: AdditionalCategory, additionals: Additional[] }[]) => void
  setSelectedSize: (size: string) => void
  setSelectedCategoryId: (categoryId: number | null) => void
  toggleAdditional: (additional: Additional) => void
  removeAdditional: (additionalId: number) => void
  setIsDataLoaded: (isLoaded: boolean) => void
  resetAdditionalsBySize: () => void
  setMaxAdditionalsPerSize: (limit: number) => void
  updateSizeLimits: (sizes: ProductSize[]) => void // Novo método para atualizar limites por tamanho
  bulkSelectAdditionals: (items: { additional: Additional; quantity?: number }[]) => void // Seleciona em massa (ignora limites)
}

// Valor padrão do contexto
const defaultContext: AdditionalsContextType = {
  additionals: [],
  additionalsByCategory: [],
  additionalsBySize: {},
  selectedSize: "",
  selectedCategoryId: null,
  selectedAdditionals: {},
  isDataLoaded: false,

  maxAdditionalsPerSize: DEFAULT_MAX_ADDITIONALS_PER_SIZE,
  FREE_ADDITIONALS_LIMIT,
  SIZES_WITH_FREE_ADDITIONALS,

  hasFreeAdditionals: false,
  selectedAdditionalsCount: 0,
  reachedFreeAdditionalsLimit: false,
  reachedMaxAdditionalsLimit: false,
  selectedAdditionalsByCategory: {},
  reachedCategoryLimit: () => false,

  setAdditionals: () => { },
  setAdditionalsByCategory: () => { },
  setSelectedSize: () => { },
  setSelectedCategoryId: () => { },
  toggleAdditional: () => { },
  removeAdditional: () => { },
  setIsDataLoaded: () => { },
  resetAdditionalsBySize: () => { },
  setMaxAdditionalsPerSize: () => { },
  updateSizeLimits: () => { },
  bulkSelectAdditionals: () => { }
}

// Criação do contexto
const AdditionalsContext = createContext<AdditionalsContextType>(defaultContext)

// Hook para usar o contexto
export const useAdditionals = () => useContext(AdditionalsContext)

// Provedor do contexto
export function AdditionalsProvider({
  children,
  initialSize = "",
  maxAdditionalsLimit = DEFAULT_MAX_ADDITIONALS_PER_SIZE,
  productSizes = []
}: {
  children: ReactNode,
  initialSize?: string,
  maxAdditionalsLimit?: number,
  productSizes?: ProductSize[]
}) {
  // Estados
  const [additionals, setAdditionals] = useState<Additional[]>([])
  const [additionalsByCategory, setAdditionalsByCategory] = useState<{ category: AdditionalCategory, additionals: Additional[] }[]>([])
  const [additionalsBySize, setAdditionalsBySize] = useState<{
    [size: string]: {
      [additionalId: number]: { additional: Additional; quantity: number }
    }
  }>({})
  const [selectedSize, setSelectedSize] = useState(initialSize)
  const [selectedCategoryId, setSelectedCategoryId] = useState<number | null>(null)
  const [isDataLoaded, setIsDataLoaded] = useState(false)
  const [maxAdditionalsPerSize, setMaxAdditionalsPerSize] = useState(maxAdditionalsLimit)
  const [sizeLimits, setSizeLimits] = useState<ProductSize[]>(productSizes)

  // Função para obter o limite específico do tamanho selecionado
  const getCurrentSizeLimit = () => {
    const currentSizeInfo = sizeLimits.find(size => size.size === selectedSize)
    const limit = currentSizeInfo?.additionalsLimit ?? 999

    // APENAS usar o limite específico do tamanho se estiver definido
    // Se não estiver definido, usar um limite alto (sem limite efetivo)
    return limit // 999 = sem limite prático
  }

  // Atualizar maxAdditionalsPerSize quando o selectedSize mudar
  useEffect(() => {
    if (selectedSize && sizeLimits.length > 0) {
      const currentSizeInfo = sizeLimits.find(size => size.size === selectedSize)
      if (currentSizeInfo?.additionalsLimit) {
        setMaxAdditionalsPerSize(currentSizeInfo.additionalsLimit)
      } else {
        // Se não houver limite definido para o tamanho, usar um valor alto (sem limite prático)
        setMaxAdditionalsPerSize(999)
      }
    }
  }, [selectedSize, sizeLimits])

  // Valores calculados
  const selectedAdditionals = additionalsBySize[selectedSize] || {}
  const selectedAdditionalsCount = Object.keys(selectedAdditionals).length
  const hasFreeAdditionals = SIZES_WITH_FREE_ADDITIONALS.includes(selectedSize)
  const reachedFreeAdditionalsLimit = hasFreeAdditionals && selectedAdditionalsCount >= FREE_ADDITIONALS_LIMIT
  const currentLimit = getCurrentSizeLimit()
  const reachedMaxAdditionalsLimit = selectedAdditionalsCount >= currentLimit

  // Calcular contagem de adicionais por categoria
  const calculateSelectedAdditionalsByCategory = () => {
    const countByCategory: Record<number, number> = {}

    // Inicializar contagem para todas as categorias como 0
    additionalsByCategory.forEach(({ category }) => {
      countByCategory[category.id] = 0
    })

    // Contar adicionais selecionados por categoria
    Object.values(selectedAdditionals).forEach(({ additional }) => {
      const categoryId = additional.categoryId
      if (categoryId) {
        countByCategory[categoryId] = (countByCategory[categoryId] || 0) + 1
      }
    })

    return countByCategory
  }

  const selectedAdditionalsByCategory = calculateSelectedAdditionalsByCategory()

  // Verificar se atingiu o limite da categoria
  const reachedCategoryLimit = (categoryId: number) => {
    const category = additionalsByCategory.find(item => item.category.id === categoryId)?.category
    if (!category || !category.selectionLimit) return false

    const count = selectedAdditionalsByCategory[categoryId] || 0
    return count >= category.selectionLimit
  }

  // Métodos
  const toggleAdditional = (additional: Additional) => {
    // Verificar se este adicional já está selecionado para o tamanho atual
    const isSelected = !!selectedAdditionals[additional.id]

    // Se estiver selecionado, remover
    if (isSelected) {
      setAdditionalsBySize(prev => {
        const newState = { ...prev }
        const newSizeAdditionals = { ...newState[selectedSize] }
        delete newSizeAdditionals[additional.id]

        // Se não houver mais complementos premium para este tamanho, remover o tamanho
        if (Object.keys(newSizeAdditionals).length === 0) {
          delete newState[selectedSize]
        } else {
          newState[selectedSize] = newSizeAdditionals
        }

        return newState
      })
    }
    // Se não estiver selecionado e não atingiu o limite máximo de adicionais ou da categoria, adicionar
    else if (!reachedMaxAdditionalsLimit && !reachedCategoryLimit(additional.categoryId)) {
      setAdditionalsBySize(prev => {
        const newState = { ...prev }
        if (!newState[selectedSize]) {
          newState[selectedSize] = {}
        }

        newState[selectedSize][additional.id] = {
          additional,
          quantity: 1
        }

        return newState
      })
    }
  }

  const removeAdditional = (additionalId: number) => {
    setAdditionalsBySize(prev => {
      const newState = { ...prev }
      const newSizeAdditionals = { ...newState[selectedSize] }
      delete newSizeAdditionals[additionalId]

      // Se não houver mais complementos premium para este tamanho, remover o tamanho
      if (Object.keys(newSizeAdditionals).length === 0) {
        delete newState[selectedSize]
      } else {
        newState[selectedSize] = newSizeAdditionals
      }

      return newState
    })
  }

  // Função para limpar todos os adicionais do tamanho selecionado
  const resetAdditionalsBySize = () => {
    setAdditionalsBySize(prev => {
      const newState = { ...prev }

      // Remove os adicionais do tamanho atual
      if (newState[selectedSize]) {
        delete newState[selectedSize]
      }

      return newState
    })
  }

  // Seleciona vários adicionais de uma vez para o tamanho atual, ignorando limites
  const bulkSelectAdditionals = (items: { additional: Additional; quantity?: number }[]) => {
    if (!items || items.length === 0) return
    setAdditionalsBySize(prev => {
      const newState = { ...prev }
      const current = { ...(newState[selectedSize] || {}) }
      for (const { additional, quantity } of items) {
        if (!additional || typeof additional.id !== 'number') continue
        current[additional.id] = {
          additional,
          quantity: Math.max(1, quantity ?? 1)
        }
      }
      newState[selectedSize] = current
      return newState
    })
  }

  const updateSizeLimits = (sizes: ProductSize[]) => {
    setSizeLimits(sizes)

    // Atualiza o maxAdditionalsPerSize com base no tamanho atualmente selecionado
    if (selectedSize) {
      const currentSizeInfo = sizes.find(size => size.size === selectedSize)
      if (currentSizeInfo?.additionalsLimit) {
        setMaxAdditionalsPerSize(currentSizeInfo.additionalsLimit)
      }
    }
  }

  // Valor do contexto
  const contextValue: AdditionalsContextType = {
    additionals,
    additionalsByCategory,
    additionalsBySize,
    selectedSize,
    selectedCategoryId,
    selectedAdditionals,
    isDataLoaded,

    maxAdditionalsPerSize: currentLimit, // Retorna o limite atual baseado no tamanho
    FREE_ADDITIONALS_LIMIT,
    SIZES_WITH_FREE_ADDITIONALS,

    hasFreeAdditionals,
    selectedAdditionalsCount,
    reachedFreeAdditionalsLimit,
    reachedMaxAdditionalsLimit,
    selectedAdditionalsByCategory,
    reachedCategoryLimit,

    setAdditionals,
    setAdditionalsByCategory,
    setSelectedSize,
    setSelectedCategoryId,
    toggleAdditional,
    removeAdditional,
    setIsDataLoaded,
    resetAdditionalsBySize,
    setMaxAdditionalsPerSize,
    updateSizeLimits,
    bulkSelectAdditionals
  }

  return (
    <AdditionalsContext.Provider value={contextValue}>
      {children}
    </AdditionalsContext.Provider>
  )
}
