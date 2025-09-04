import { createSupabaseClient } from "../supabase-client"
import { createClient } from "@supabase/supabase-js"
import type { CartItem } from "../types"
import type { Database } from "../database.types"
import { v4 as uuidv4 } from "uuid"
import { cleanSizeDisplay } from "@/lib/utils"
import { DEFAULT_STORE_ID } from "../constants"

// Função para criar cliente administrativo do Supabase
function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
  const supabaseServiceKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!
  
  return createClient(supabaseUrl, supabaseServiceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Função para obter o ID da sessão do carrinho
export function getCartSessionId(): string {
  // Debug removido para limpar console

  if (typeof window === "undefined") {
    return ""
  }

  let sessionId = localStorage.getItem("cartSessionId")

  if (!sessionId) {
    sessionId = uuidv4()
    localStorage.setItem("cartSessionId", sessionId)
  }

  return sessionId
}

// Função para obter o ID da loja atual
export function getCurrentStoreId(): string {
  // Verificar se DEFAULT_STORE_ID é válido (não precisa ser UUID)
  if (!DEFAULT_STORE_ID || typeof DEFAULT_STORE_ID !== 'string' || DEFAULT_STORE_ID.trim() === '') {
    console.error("ERRO CRÍTICO: DEFAULT_STORE_ID inválido!", DEFAULT_STORE_ID)
    throw new Error("DEFAULT_STORE_ID inválido: " + DEFAULT_STORE_ID)
  }

  if (typeof window === "undefined") {
    return DEFAULT_STORE_ID
  }

  // CORREÇÃO: Sempre usar o store_id padrão para evitar problemas de FK
  // Limpar qualquer store_id incorreto do localStorage
  const storedStoreId = localStorage.getItem("currentStoreId")
  if (storedStoreId && storedStoreId !== DEFAULT_STORE_ID) {
    console.warn("Store ID incorreto encontrado no localStorage:", storedStoreId)
    console.warn("Corrigindo para o store_id padrão:", DEFAULT_STORE_ID)
    localStorage.setItem("currentStoreId", DEFAULT_STORE_ID)
  }

  // Sempre garantir que o localStorage tenha o ID correto
  localStorage.setItem("currentStoreId", DEFAULT_STORE_ID)
  return DEFAULT_STORE_ID
}

// Função para validar se uma string é um UUID válido
function isValidUUID(uuid: string): boolean {
  // Regex mais flexível que aceita qualquer UUID válido, incluindo nil UUID
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  return uuidRegex.test(uuid)
}

// Função para obter itens do carrinho
export async function getCartItems(): Promise<CartItem[]> {
  const sessionId = getCartSessionId()
  if (!sessionId) return []

  const supabase = createSupabaseClient()
  const storeId = getCurrentStoreId()

  const { data, error } = await supabase.from("cart").select("*").eq("session_id", sessionId).eq("store_id", storeId)

  if (error) {
    console.error("Erro ao buscar itens do carrinho:", {
      error,
      errorMessage: error.message,
      errorCode: error.code,
      errorDetails: error.details,
      sessionId,
      storeId
    })
    return []
  }

  return data.map((item: any): CartItem => {
    // Criar uma cópia do item com o tamanho modificado para exibição
    const displayItem: CartItem = {
      id: String(item.id),
      productId: Number(item.product_id),
      name: String(item.name || ""),
      price: Number(item.size_price || item.price || 0), // Usar size_price se disponível
      quantity: Number(item.quantity),
      image: String(item.image || ""),
      // Armazenar o tamanho original para uso interno
      originalSize: String(item.size_name || item.size || ""),
      // Limpar o tamanho para exibição
      size: cleanSizeDisplay(String(item.size_name || item.size || "")),
      additionals: Array.isArray(item.additionals) ? item.additionals : [],
      // Incluir informação sobre colheres
      needsSpoon: Boolean(item.needs_spoon),
      spoonQuantity: typeof item.spoon_quantity === 'number' ? item.spoon_quantity : undefined,
      notes: item.notes || "",
    }

    return displayItem
  })
}

// Função para verificar se dois arrays de adicionais são iguais
function areAdditionalsEqual(additionals1: any[] = [], additionals2: any[] = []): boolean {
  // Garantir que estamos trabalhando com arrays
  if (!Array.isArray(additionals1)) additionals1 = []
  if (!Array.isArray(additionals2)) additionals2 = []

  // Se ambos estiverem vazios, são iguais
  if (additionals1.length === 0 && additionals2.length === 0) return true

  // Se apenas um estiver vazio, são diferentes
  if (additionals1.length !== additionals2.length) return false

  // Ordenar os arrays para garantir comparação consistente
  const sorted1 = [...additionals1].sort((a, b) => {
    // Verificar se os objetos têm a propriedade id
    const idA = a && typeof a === 'object' && 'id' in a ? a.id : 0
    const idB = b && typeof b === 'object' && 'id' in b ? b.id : 0
    return Number(idA) - Number(idB)
  })

  const sorted2 = [...additionals2].sort((a, b) => {
    const idA = a && typeof a === 'object' && 'id' in a ? a.id : 0
    const idB = b && typeof b === 'object' && 'id' in b ? b.id : 0
    return Number(idA) - Number(idB)
  })

  // Comparar cada adicional
  for (let i = 0; i < sorted1.length; i++) {
    const a1 = sorted1[i]
    const a2 = sorted2[i]

    // Verificar se os objetos são válidos e têm as propriedades necessárias
    if (!a1 || !a2 || typeof a1 !== 'object' || typeof a2 !== 'object') return false

    const id1 = 'id' in a1 ? Number(a1.id) : 0
    const id2 = 'id' in a2 ? Number(a2.id) : 0
    const qty1 = 'quantity' in a1 ? Number(a1.quantity) : 0
    const qty2 = 'quantity' in a2 ? Number(a2.quantity) : 0

    if (id1 !== id2 || qty1 !== qty2) {
      return false
    }
  }

  return true
}

// Função para adicionar item ao carrinho
export async function addToCart(item: Omit<CartItem, "id">): Promise<CartItem | null> {
  // Log detalhado do item recebido
  // Debug removido para limpar console

  // Verificação específica para objeto vazio
  if (Object.keys(item || {}).length === 0) {
    console.error("ERRO CRÍTICO: Item recebido está vazio!")
    console.error("Dados tentando inserir:", JSON.stringify(item))
    return null
  }

  const sessionId = getCartSessionId()
  if (!sessionId) {
    console.error("Erro: sessionId não encontrado")
    return null
  }

  // Verificar se o item é válido
  if (!item || typeof item !== 'object') {
    console.error("Erro: item inválido ou não é um objeto", item)
    return null
  }

  // Verificar se productId está definido
  if (!item.productId) {
    console.error("Erro: productId não definido ao adicionar item ao carrinho", item)
    return null
  }

  // Verificar se campos obrigatórios estão presentes
  if (!item.name || item.price === undefined || !item.size || item.quantity === undefined) {
    console.error("Erro: campos obrigatórios ausentes", {
      name: item.name,
      price: item.price,
      size: item.size,
      quantity: item.quantity
    })
    return null
  }

  const supabase = createSupabaseClient()
  const storeId = getCurrentStoreId()

  try {
    // Primeiro, vamos buscar todos os itens do carrinho com o mesmo produto
    const { data: existingItems, error: selectError } = await supabase
      .from("cart")
      .select("*")
      .eq("session_id", sessionId)
      .eq("store_id", storeId)
      .eq("product_id", item.productId)

    if (selectError) {
      console.error("Erro ao verificar itens existentes no carrinho:", selectError)
      return null
    }

    // Verificar se existe um item com o mesmo tamanho e adicionais

    // Verificar se existe um item com os mesmos adicionais, tamanho e escolha de colher
    // Ignoramos os sufixos únicos que podem ter sido adicionados ao tamanho
    const matchingItem = existingItems && existingItems.length > 0 ? existingItems.find((existingItem: any) => {
      // Verificar se o tamanho base (sem o sufixo único) é o mesmo
      const existingSizeBase = String(existingItem.size_name || existingItem.size).split('#')[0]
      const newSizeBase = String(item.size).split('#')[0]
      const isSameSizeBase = existingSizeBase === newSizeBase

      // Verificar se os adicionais são os mesmos
      const areAdditionalsEquivalent = areAdditionalsEqual(existingItem.additionals, item.additionals)

      // Comparação de itens removida para limpar console

      // O item é considerado o mesmo se tamanho base e adicionais forem iguais
      return isSameSizeBase && areAdditionalsEquivalent
    }) : null

    if (matchingItem) {
      // Item encontrado no carrinho, atualizando quantidade

      // Item com mesmos adicionais existe, atualizar quantidade
      const updatePayload: Database['public']['Tables']['cart']['Update'] = {
        quantity: Number((matchingItem as any).quantity) + Number(item.quantity),
        // Garantir que store_id esteja presente mesmo em atualizações
        store_id: storeId,
      }
      const { data, error: updateError } = await supabase
        .from("cart")
        .update(updatePayload as any)
        .eq("id", Number((matchingItem as any).id))
        .select()
        .single()

      if (updateError) {
        console.error("Erro ao atualizar item do carrinho:", updateError)
        return null
      }

      const typedData = data as any
      return {
        id: String(typedData.id),
        productId: Number(typedData.product_id),
        name: String(item.name || ""), // Usar valor original do item
        price: Number(typedData.size_price || item.price || 0),
        quantity: Number(typedData.quantity),
        image: String(item.image || ""), // Usar valor original do item
        size: cleanSizeDisplay(String(typedData.size_name || item.size)),
        originalSize: String(typedData.size_name || item.size),
        additionals: Array.isArray(typedData.additionals) ? typedData.additionals : [],
        notes: item.notes || "", // Buscar notes do item se existir
        needsSpoon: Boolean(item.needsSpoon), // Manter valor original do frontend
        spoonQuantity: item.spoonQuantity || undefined, // Manter valor original do frontend
      }
    } else {
      // Não encontramos um item com os mesmos adicionais
      // Vamos gerar um ID único para este item
      const itemId = uuidv4()

      // Garantir que o tamanho não ultrapasse o limite do campo no banco de dados
      // e que o sufixo único seja sempre preservado
      const maxSizeLength = 20; // Tamanho máximo do campo no banco de dados
      const suffix = `#${itemId.substring(0, 8)}`; // Sufixo único para o tamanho

      // Calcular quanto espaço temos para o tamanho original
      const availableSpace = maxSizeLength - suffix.length;

      // Truncar o tamanho original se necessário e adicionar o sufixo
      const originalSize = String(item.size).trim();
      const truncatedSize = originalSize.substring(0, availableSpace);
      const uniqueSize = truncatedSize + suffix;

      // Gerando tamanho único para o item

      // Validar dados antes da inserção
      // Permitir DEFAULT_STORE_ID mesmo que não seja UUID
      if (!isValidUUID(storeId) && storeId !== DEFAULT_STORE_ID) {
        throw new Error(`store_id inválido: ${storeId}`)
      }

      if (!sessionId || typeof sessionId !== 'string') {
        throw new Error(`session_id inválido: ${sessionId}`)
      }

      if (!item.productId || typeof item.productId !== 'number') {
        throw new Error(`product_id inválido: ${item.productId}`)
      }

      // Inserir novo item com o tamanho único
      const insertData: any = {
        session_id: sessionId,
        store_id: storeId,
        product_id: Number(item.productId),
        name: String(item.name || ""), // Campo obrigatório
        price: Number(item.price) || 0, // Campo obrigatório
        image: String(item.image || ""),
        size: uniqueSize, // Campo size original
        size_name: uniqueSize, // Usar o tamanho único gerado com sufixo garantido
        size_price: Number(item.price) || 0,
        quantity: Number(item.quantity) || 1,
        additionals: Array.isArray(item.additionals) ? item.additionals : [],
      }

      // Incluir campos de colher se existirem no item
      if (item.needsSpoon !== undefined) {
        insertData.needs_spoon = Boolean(item.needsSpoon);
      }

      if (item.spoonQuantity !== undefined) {
        insertData.spoon_quantity = Number(item.spoonQuantity) || 1;
      }





      const { data, error: insertError } = await supabase
        .from("cart")
        .insert(insertData)
        .select()
        .single()



      if (insertError) {
        console.error("Erro ao inserir no carrinho:", insertError)
        throw new Error(`Erro ao adicionar item ao carrinho: ${insertError.message}`)
      }

      // Usar os dados inseridos
      const typedData = data as any
      return {
        id: String(typedData.id),
        productId: Number(typedData.product_id),
        name: String(item.name || ""), // Usar valor original do item
        price: Number(typedData.size_price || item.price || 0),
        quantity: Number(typedData.quantity),
        image: String(item.image || ""), // Usar valor original do item
        size: cleanSizeDisplay(String(typedData.size_name || originalSize)),
        originalSize: String(typedData.size_name || originalSize),
        additionals: Array.isArray(typedData.additionals) ? typedData.additionals : [],
        notes: item.notes || "", // Buscar notes do item se existir
        needsSpoon: Boolean(item.needsSpoon), // Manter valor original do frontend
        spoonQuantity: item.spoonQuantity || undefined, // Manter valor original do frontend
      }
    }
  } catch (error) {
    console.error("Erro ao adicionar item ao carrinho:", error)
    if (error instanceof Error) {
      throw error
    }
    throw new Error(`Erro inesperado ao adicionar item ao carrinho: ${String(error)}`)
  }
}

// Alias para addToCart para compatibilidade
export const addCartItem = addToCart

// Função para atualizar quantidade de um item e outros campos opcionais
export async function updateCartItemQuantity(id: string, quantity: number, updatedFields?: Partial<CartItem>): Promise<boolean> {
  // Verificar se id é uma string válida
  if (!id || id.trim() === '') {
    console.error(`Erro: ID inválido ao atualizar quantidade: ${id}`)
    return false
  }

  const supabase = createSupabaseClient()
  const storeId = getCurrentStoreId()

  // Criar objeto de atualização com os campos básicos
  const updateData: Database['public']['Tables']['cart']['Update'] = {
    quantity,
    store_id: storeId, // Garantir que store_id esteja presente mesmo em atualizações
  }

  // Incluir campos de colher se fornecidos
  if (updatedFields?.needsSpoon !== undefined) {
    (updateData as any).needs_spoon = updatedFields.needsSpoon;
  }
  if (updatedFields?.spoonQuantity !== undefined) {
    updateData.spoon_quantity = updatedFields.spoonQuantity;
  }
  
  // Incluir campo notes se fornecido
  if (updatedFields?.notes !== undefined) {
    (updateData as any).notes = updatedFields.notes;
  }

  const { error } = await supabase
    .from("cart")
    .update(updateData as Database['public']['Tables']['cart']['Update'])
    .eq("id", id)

  if (error) {

    // Para outros erros, logar normalmente
    console.error(`Erro ao atualizar item ${id}:`, error.message)
    return false
  }

  return true
}

// Função para remover item do carrinho
export async function removeFromCart(id: string): Promise<boolean> {
  if (!id || id.trim() === '') {
    console.error("Tentativa de remover item com ID inválido (vazio) na função de serviço.")
    return false
  }
  const supabase = createSupabaseClient()

  const { error } = await supabase.from("cart").delete().eq("id", id)

  if (error) {
    console.error(`Erro ao remover item ${id} do carrinho:`, error)
    return false
  }

  return true
}

// Função para limpar carrinho
export async function clearCart(): Promise<boolean> {
  const sessionId = getCartSessionId()
  if (!sessionId) return false

  const supabase = createSupabaseClient()
  const storeId = getCurrentStoreId()

  const { error } = await supabase.from("cart").delete().eq("session_id", sessionId).eq("store_id", storeId)

  if (error) {
    console.error("Erro ao limpar carrinho:", error)
    return false
  }

  return true
}

// Função para obter total do carrinho
export async function getCartTotal(): Promise<number> {
  const items = await getCartItems()

  return items.reduce((total, item) => {
    const itemTotal = item.price * item.quantity
    const additionalsTotal =
      (item.additionals || []).reduce((sum, additional) => sum + additional.price * (additional.quantity || 1), 0) *
      item.quantity

    return total + itemTotal + additionalsTotal
  }, 0)
}

// Função para obter quantidade total de itens no carrinho
export async function getCartItemCount(): Promise<number> {
  const items = await getCartItems()

  return items.reduce((count, item) => count + item.quantity, 0)
}

// Função para obter as lojas disponíveis
export async function getAvailableStores() {
  const supabase = createSupabaseClient()

  const { data, error } = await supabase.from("stores").select("id, name, logo_url").eq("is_active", true)

  if (error) {
    console.error("Erro ao buscar lojas disponíveis:", error)
    return []
  }

  return data
}

// Função para definir a loja atual
export function setCurrentStore(storeId: string) {
  if (typeof window === "undefined") return

  // Permitir DEFAULT_STORE_ID mesmo que não seja UUID
  if (isValidUUID(storeId) || storeId === DEFAULT_STORE_ID) {
    localStorage.setItem("currentStoreId", storeId)
  }
}
