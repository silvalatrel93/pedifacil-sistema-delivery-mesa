import { createSupabaseClient } from "../supabase-client"
import { createClient } from '@supabase/supabase-js'
import { Product } from "../types"

// Tipagem básica da linha retornada pelo Supabase para a tabela products
type ProductRow = {
  id: number
  name: string
  description?: string | null
  image?: string | null
  sizes?: any[] | null
  table_sizes?: any[] | null
  category_id: number
  categories?: { name?: string | null } | null
  active: boolean
  allowed_additionals?: any[] | null
  additionals_limit?: number | null
  needs_spoon?: boolean | null
  hidden_from_table?: boolean | null
  hidden_from_delivery?: boolean | null
}

// Função utilitária para mapear ProductRow -> Product (domínio da aplicação)
function mapRowToProduct(row: ProductRow): Product {
  return {
    id: Number(row.id),
    name: String(row.name),
    description: String(row.description || ""),
    image: String(row.image || ""),
    // price não existe na tabela; manter como undefined no domínio
    price: undefined,
    sizes: Array.isArray(row.sizes ?? undefined) ? (row.sizes as any[]) : [],
    tableSizes: row.table_sizes && Array.isArray(row.table_sizes) ? (row.table_sizes as any[]) : undefined,
    categoryId: Number(row.category_id),
    categoryName: row.categories && typeof row.categories === 'object' && row.categories !== null && 'name' in row.categories
      ? String((row.categories as any).name || "")
      : "",
    active: Boolean(row.active),
    // Campos que não existem na tabela permanecem mapeados com valores padrão
    hidden: false,
    hiddenFromTable: Boolean(row.hidden_from_table ?? false),
    hiddenFromDelivery: Boolean(row.hidden_from_delivery ?? false),
    allowedAdditionals: Array.isArray(row.allowed_additionals ?? undefined) ? (row.allowed_additionals as any[]) : [],
    hasAdditionals: Array.isArray(row.allowed_additionals ?? undefined) && (row.allowed_additionals as any[]).length > 0,
    additionalsLimit: typeof row.additionals_limit === 'number' ? row.additionals_limit : undefined,
    needsSpoon: Boolean(row.needs_spoon),
  }
}

// Cliente Supabase com service_role para operações administrativas
function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas para admin')
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

export const ProductService = {
  // Obter todos os produtos
  async getAllProducts(): Promise<Product[]> {
    try {
      const supabase = createSupabaseClient()

      let { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          description,
          image,
          sizes,
          table_sizes,
          category_id,
          categories!products_category_id_fkey(name),
          active,
          allowed_additionals,
          additionals_limit,
          needs_spoon,
          hidden_from_table,
          hidden_from_delivery
        `)
        .order("id")

      // Não há necessidade de fallback pois estamos usando apenas colunas existentes

      if (error) {
        console.error("Erro ao buscar produtos:", error)
        return []
      }

      if (!data) {
        return []
      }

      const rows = (data ?? []) as ProductRow[]
      return rows.map(mapRowToProduct)
    } catch (error) {
      console.error("Erro ao buscar produtos:", error)
      return []
    }
  },

  // Obter produtos ativos
  async getActiveProducts(): Promise<Product[]> {
    try {
      const supabase = createSupabaseClient()

      let { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          description,
          image,
          sizes,
          table_sizes,
          category_id,
          categories!products_category_id_fkey(name),
          active,
          allowed_additionals,
          additionals_limit,
          needs_spoon,
          hidden_from_table,
          hidden_from_delivery
        `)
        .eq("active", true)
        .order("id")

      // Não há necessidade de fallback pois estamos usando apenas colunas existentes

      if (error) {
        console.error("Erro ao buscar produtos ativos:", error)
        return []
      }

      if (!data) {
        return []
      }

      const rows = (data ?? []) as ProductRow[]
      // Como esta query não seleciona hidden_from_delivery, ele virá como undefined e será considerado false no mapper
      return rows.map(mapRowToProduct)
    } catch (error) {
      console.error("Erro ao buscar produtos ativos:", error)
      return []
    }
  },

  // Obter produtos visíveis (ativos e não ocultos)
  async getVisibleProducts(): Promise<Product[]> {
    try {
      const supabase = createSupabaseClient()

      let { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          description,
          image,
          sizes,
          table_sizes,
          category_id,
          categories!products_category_id_fkey(name),
          active,
          allowed_additionals,
          additionals_limit,
          needs_spoon,
          hidden_from_delivery
        `)
        .eq("active", true)
        .order("id")

      // Não há necessidade de fallback pois estamos usando apenas colunas existentes

      if (error) {
        console.error("Erro ao buscar produtos visíveis:", error)
        return []
      }

      if (!data) {
        return []
      }

      const rows = (data ?? []) as ProductRow[]
      return rows.map(mapRowToProduct)
    } catch (error) {
      console.error("Erro ao buscar produtos visíveis:", error)
      return []
    }
  },

  // Obter produtos por categoria
  async getProductsByCategory(categoryId: number): Promise<Product[]> {
    try {
      const supabase = createSupabaseClient()

      let { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          description,
          image,
          sizes,
          table_sizes,
          category_id,
          categories!products_category_id_fkey(name),
          active,
          allowed_additionals,
          additionals_limit,
          needs_spoon,
          hidden_from_table,
          hidden_from_delivery
        `)
        .eq("category_id", categoryId)
        .eq("active", true)
        .order("id")

      if (error) {
        console.error(`Erro ao buscar produtos da categoria ${categoryId}:`, error)
        return []
      }

      if (!data) {
        return []
      }

      const rows = (data ?? []) as ProductRow[]
      return rows.map(mapRowToProduct)
    } catch (error) {
      console.error(`Erro ao buscar produtos da categoria ${categoryId}:`, error)
      return []
    }
  },

  // Obter produto por ID
  async getProductById(id: number): Promise<Product | null> {
    try {
      const supabase = createSupabaseClient()

      let { data, error } = await supabase
        .from("products")
        .select(`
          id,
          name,
          description,
          image,
          sizes,
          table_sizes,
          category_id,
          categories!products_category_id_fkey(name),
          active,
          allowed_additionals,
          additionals_limit,
          needs_spoon
        `)
        .eq("id", id)
        .single()

      // Não há necessidade de fallback pois estamos usando apenas colunas existentes

      if (error) {
        console.error(`Erro ao buscar produto ${id}:`, error)
        return null
      }

      if (!data) {
        return null
      }

      const row = (data ?? null) as ProductRow | null
      return row ? mapRowToProduct(row) : null
    } catch (error) {
      console.error(`Erro ao buscar produto ${id}:`, error)
      return null
    }
  },

  // Salvar produto
  async saveProduct(product: Product): Promise<{ data: Product | null; error: Error | null }> {
    try {
      const supabase = createSupabaseClient()

      // Determinar se é uma atualização (produto já existe no banco) ou criação (produto novo)
      const isUpdate = product.id && product.id > 0

      if (isUpdate) {
        // Preparar dados para atualização com validação
        const updateData = {
          name: product.name,
          description: product.description || "",
          image: product.image || "",
          sizes: product.sizes || [],
          table_sizes: product.tableSizes || null,
          category_id: product.categoryId,
          active: Boolean(product.active),
          allowed_additionals: product.allowedAdditionals || [],
          additionals_limit: product.additionalsLimit || 5,
          needs_spoon: Boolean(product.needsSpoon),
        }

        console.log("Dados para atualização:", updateData)

        // Atualizar produto existente usando cliente administrativo
        const adminSupabase = createAdminSupabaseClient()
        const { data, error } = await adminSupabase
          .from("products")
          .update(updateData)
          .eq("id", product.id)
          .select("*")
          .single()

        if (error) {
          console.error("Erro ao atualizar produto:", {
            error,
            errorMessage: error.message,
            errorCode: error.code,
            errorDetails: error.details,
            errorHint: error.hint,
            productData: {
              id: product.id,
              name: product.name,
              hidden: product.hidden
            }
          })
          return { data: null, error: new Error(error.message || 'Erro desconhecido ao atualizar produto') }
        }

        const row = data as ProductRow
        return { data: mapRowToProduct(row), error: null }
      } else {
        // Preparar dados para criação com validação
        const insertData = {
          name: product.name,
          description: product.description || "",
          image: product.image || "",
          sizes: product.sizes || [],
          table_sizes: product.tableSizes || null,
          category_id: product.categoryId,
          active: Boolean(product.active !== undefined ? product.active : true),
          allowed_additionals: product.allowedAdditionals || [],
          additionals_limit: product.additionalsLimit || 5,
          needs_spoon: Boolean(product.needsSpoon),
        }

        console.log("Dados para criação:", insertData)

        // Criar novo produto usando cliente administrativo
        const adminSupabase = createAdminSupabaseClient()
        const { data, error } = await adminSupabase
          .from("products")
          .insert(insertData)
          .select("*")
          .single()

        if (error) {
          console.error("Erro ao criar produto:", {
            error,
            errorMessage: error.message,
            errorCode: error.code,
            errorDetails: error.details,
            errorHint: error.hint,
            productData: {
              name: product.name,
              hidden: product.hidden
            }
          })
          return { data: null, error: new Error(error.message || 'Erro desconhecido ao criar produto') }
        }

        const row = data as ProductRow
        return { data: mapRowToProduct(row), error: null }
      }
    } catch (error) {
      console.error("Erro ao salvar produto:", {
        error,
        errorMessage: error instanceof Error ? error.message : String(error),
        productData: {
          id: product.id,
          name: product.name
        }
      })
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) }
    }
  },

  // Excluir produto
  async deleteProduct(id: number): Promise<boolean> {
    try {
      const adminSupabase = createAdminSupabaseClient()
      const { error } = await adminSupabase
        .from("products")
        .delete()
        .eq("id", id)

      if (error) {
        console.error(`Erro ao deletar produto ${id}:`, error)
        return false
      }

      return true
    } catch (error) {
      console.error(`Erro ao deletar produto ${id}:`, error)
      return false
    }
  },

  // Alternar visibilidade do produto (usando campo 'active' já que 'hidden' não existe)
  async toggleProductVisibility(id: number): Promise<boolean> {
    try {
      const supabase = createSupabaseClient()

      // Primeiro buscar o produto atual
      const { data: currentProduct, error: fetchError } = await supabase
        .from("products")
        .select("active")
        .eq("id", id)
        .single()

      if (fetchError) {
        console.error(`Erro ao buscar produto ${id}:`, fetchError)
        return false
      }

      // Inverter o valor de active
      const newActiveValue = !(currentProduct as { active: boolean }).active

      const adminSupabase = createAdminSupabaseClient()
      const { error } = await adminSupabase
        .from("products")
        .update({ active: newActiveValue })
        .eq("id", id)

      if (error) {
        console.error(`Erro ao alterar visibilidade do produto ${id}:`, error)
        return false
      }

      return true
    } catch (error) {
      console.error(`Erro ao alterar visibilidade do produto ${id}:`, error)
      return false
    }
  },
}

/**
 * Detecta se estamos em contexto de mesa através da URL e localStorage
 */
function isTableContext(): boolean {
  if (typeof window === 'undefined') return false

  const currentPath = window.location.pathname
  const mesaAtual = localStorage.getItem('mesa_atual')

  // Verificar se estamos na rota de mesa OU se há dados de mesa no localStorage
  return currentPath.startsWith('/mesa/') || !!mesaAtual
}

/**
 * Aplica preços de mesa automaticamente se estivermos em contexto de mesa
 */
function applyTablePricesIfNeeded(products: Product[]): Product[] {
  // Só aplicar se estivermos em contexto de mesa
  if (!isTableContext()) {
    return products
  }

  return products.map(product => {
    // Verificar se o produto tem preços de mesa configurados
    if (product.tableSizes && Array.isArray(product.tableSizes) && product.tableSizes.length > 0) {
      // Aplicar os preços de mesa substituindo os preços padrão
      return {
        ...product,
        sizes: product.tableSizes
      }
    } else {
      return product
    }
  })
}

/**
 * Buscar produtos ativos com aplicação automática de preços de mesa
 */
export async function getActiveProductsWithContext(): Promise<Product[]> {
  const products = await getActiveProducts()
  return applyTablePricesIfNeeded(products)
}

/**
 * Buscar produtos visíveis com aplicação automática de preços de mesa
 * Detecta automaticamente se está em contexto de mesa ou delivery
 */
export async function getVisibleProductsWithContext(): Promise<Product[]> {
  // Detectar contexto baseado na URL ou localStorage
  let isTableContext = false
  
  if (typeof window !== 'undefined') {
    // Verificar se está na rota de mesa
    const currentPath = window.location.pathname
    if (currentPath.startsWith('/mesa/')) {
      isTableContext = true
    } else {
      // Verificar se há dados de mesa no localStorage
      const mesaAtual = localStorage.getItem('mesa_atual')
      if (mesaAtual) {
        try {
          const mesa = JSON.parse(mesaAtual)
          if (mesa && mesa.id) {
            isTableContext = true
          }
        } catch (e) {
          // Ignorar erro de parsing
        }
      }
    }
  }

  // Usar a função apropriada baseada no contexto
  let products: Product[]
  if (isTableContext) {
    console.log('ProductService: Carregando produtos para contexto de mesa')
    products = await getVisibleProductsForTable()
    // Aplicar preços de mesa se disponíveis
    return applyTablePricesIfNeeded(products)
  } else {
    console.log('ProductService: Carregando produtos para contexto de delivery')
    products = await getVisibleProductsForDelivery()
    // Para delivery, não aplicar preços de mesa
    return products
  }
}

/**
 * Obter produtos visíveis no delivery (apenas produtos ativos)
 */
export async function getVisibleProductsForDelivery(): Promise<Product[]> {
  try {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase
      .from("products")
      .select(`
          id,
          name,
          description,
          image,
          sizes,
          category_id,
          categories!products_category_id_fkey(name),
          active,
          hidden_from_delivery,
          allowed_additionals,
          additionals_limit,
          needs_spoon
        `)
      .eq("active", true)
      .eq("hidden_from_delivery", false)
      .order("id")

    if (error) {
      console.error("Erro ao buscar produtos visíveis no delivery:", error)
      return []
    }

    const rows = (data ?? []) as ProductRow[]
    return rows.map(mapRowToProduct)
  } catch (error) {
    console.error("Erro ao buscar produtos visíveis no delivery:", error)
    return []
  }
}

/**
 * Obter produtos visíveis em mesa (apenas produtos ativos)
 */
export async function getVisibleProductsForTable(): Promise<Product[]> {
  try {
    const supabase = createSupabaseClient()
    console.log('🔍 Buscando produtos visíveis para mesa...')
    
    const { data, error } = await supabase
      .from("products")
      .select(`
          id,
          name,
          description,
          image,
          sizes,
          table_sizes,
          category_id,
          categories!products_category_id_fkey(name),
          active,
          hidden_from_table,
          allowed_additionals,
          additionals_limit,
          needs_spoon
        `)
      .eq("active", true)
      .eq("hidden_from_table", false)
      .order("id")

    console.log('📊 Produtos encontrados para mesa:', data?.length || 0)
    if (data) {
      data.forEach((product: any) => {
        console.log(`📦 Produto: ${product.name} - active: ${product.active}, hidden_from_table: ${product.hidden_from_table}`)
      })
    }

    if (error) {
      console.error("Erro ao buscar produtos visíveis em mesa:", error)
      return []
    }

    const rows = (data ?? []) as ProductRow[]
    return rows.map(mapRowToProduct)
  } catch (error) {
    console.error("Erro ao buscar produtos visíveis em mesa:", error)
    return []
  }
}

/**
 * Alternar visibilidade do produto no delivery (usando campo 'hidden_from_delivery')
 */
export async function toggleDeliveryVisibility(productId: number): Promise<boolean> {
  try {
    const supabase = createSupabaseClient()

    // Primeiro, obter o estado atual
    const { data: currentProduct, error: fetchError } = await supabase
      .from("products")
      .select("hidden_from_delivery")
      .eq("id", productId)
      .single()

    if (fetchError) {
      console.error("Erro ao buscar produto para alternar visibilidade no delivery:", fetchError)
      return false
    }

    // Alternar o estado (inverter hidden_from_delivery)
    const newHiddenValue = !(currentProduct as { hidden_from_delivery: boolean }).hidden_from_delivery

    const adminSupabase = createAdminSupabaseClient()
    const { error } = await adminSupabase
      .from("products")
      .update({ hidden_from_delivery: newHiddenValue })
      .eq("id", productId)

    if (error) {
      console.error("Erro ao alternar visibilidade do produto no delivery:", error)
      return false
    }

    console.log(`Produto ${productId} ${newHiddenValue ? 'oculto do' : 'visível no'} delivery`)
    return true
  } catch (error) {
    console.error("Erro ao alternar visibilidade do produto no delivery:", error)
    return false
  }
}

// Exportar funções individuais para facilitar o uso
export const getAllProducts = ProductService.getAllProducts.bind(ProductService)
export const getActiveProducts = ProductService.getActiveProducts.bind(ProductService)
export const getVisibleProducts = ProductService.getVisibleProducts.bind(ProductService)
export const getProductsByCategory = ProductService.getProductsByCategory.bind(ProductService)
export const getProductById = ProductService.getProductById.bind(ProductService)
export const saveProduct = ProductService.saveProduct.bind(ProductService)
export const deleteProduct = ProductService.deleteProduct.bind(ProductService)
export const toggleProductVisibility = ProductService.toggleProductVisibility.bind(ProductService)
// getVisibleProductsForTable e getVisibleProductsForDelivery são exportadas como funções standalone acima

// Exportar tipos
export type { Product } from "../types"
