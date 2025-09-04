import { createSupabaseClient } from "../supabase-client"
import { createClient } from '@supabase/supabase-js'
import type { Order, OrderStatus, OrderType, Address, OrderItem } from "../types"
import type { Database } from "../database.types"
import { DEFAULT_STORE_ID } from "../constants"
import { DeliveryAddressService } from "./delivery-address-service"

// Função para criar cliente administrativo do Supabase
function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || ''
  const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ''
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas para admin')
  }
  
  return createClient<Database>(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  })
}

// Função utilitária para fazer o parsing correto dos items
const parseItems = (items: any): any[] => {
  if (typeof items === 'string') {
    try {
      return JSON.parse(items)
    } catch {
      return []
    }
  }
  return Array.isArray(items) ? items : []
}

export const OrderService = {
  // Obter todos os pedidos
  async getAllOrders(): Promise<Order[]> {
    try {
      const supabase = createSupabaseClient()
      let query = supabase
        .from("orders")
        .select("*")
        .order("date", { ascending: false })

      const { data, error } = await query

      if (error) {
        console.error("Erro ao buscar pedidos:", error)
        return []
      }

      return (data || []).map((order: any) => ({
        id: Number(order.id),
        customerName: String(order.customer_name),
        customerPhone: String(order.customer_phone),
        address: order.address as Address,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : (Array.isArray(order.items) ? order.items : []) as OrderItem[],
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.delivery_fee),
        total: Number(order.total),
        paymentMethod: String(order.payment_method),
        paymentChange: order.payment_change ? String(order.payment_change) : undefined,
        status: order.status as OrderStatus,
        date: new Date(String(order.date)),
        printed: Boolean(order.printed),
        notified: Boolean(order.notified),
        orderType: (order.order_type as OrderType) || 'delivery',
        tableId: order.table_id ? Number(order.table_id) : undefined,
        tableName: order.table_name ? String(order.table_name) : undefined,
      }))
    } catch (error) {
      console.error("Erro ao buscar pedidos:", error)
      return []
    }
  },

  // Obter pedidos por status
  async getOrdersByStatus(status: OrderStatus): Promise<Order[]> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("status", status)
        .order("date", { ascending: false })

      if (error) {
        console.error(`Erro ao buscar pedidos com status ${status}:`, error)
        return []
      }

      return (data || []).map((order: any) => ({
        id: Number(order.id),
        customerName: String(order.customer_name),
        customerPhone: String(order.customer_phone),
        address: order.address as any,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : (Array.isArray(order.items) ? order.items : []),
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.delivery_fee),
        total: Number(order.total),
        paymentMethod: String(order.payment_method),
        paymentChange: order.payment_change ? String(order.payment_change) : undefined,
        status: order.status as OrderStatus,
        date: new Date(String(order.date)),
        printed: Boolean(order.printed),
        notified: Boolean(order.notified),
        orderType: (order.order_type as OrderType) || 'delivery',
        tableId: order.table_id ? Number(order.table_id) : undefined,
        tableName: order.table_name ? String(order.table_name) : undefined,
      }))
    } catch (error) {
      console.error(`Erro ao buscar pedidos com status ${status}:`, error)
      return []
    }
  },

  // Obter pedido por ID
  async getOrderById(id: number): Promise<Order | null> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("id", id)
        .single()

      if (error) {
        console.error(`Erro ao buscar pedido ${id}:`, error)
        return null
      }

      if (!data) {
        return null
      }

      // Tipagem explícita para evitar erro de TypeScript
      const orderData = data as any

      return {
        id: Number(orderData.id),
        customerName: String(orderData.customer_name),
        customerPhone: String(orderData.customer_phone),
        address: orderData.address as Address,
        items: orderData.items as OrderItem[],
        subtotal: Number(orderData.subtotal),
        deliveryFee: Number(orderData.delivery_fee),
        total: Number(orderData.total),
        paymentMethod: String(orderData.payment_method),
        paymentChange: orderData.payment_change ? String(orderData.payment_change) : undefined,
        status: orderData.status as OrderStatus,
        date: new Date(String(orderData.date)),
        printed: Boolean(orderData.printed),
        notified: Boolean(orderData.notified),
        orderType: (orderData.order_type as OrderType) || 'delivery',
        tableId: orderData.table_id ? Number(orderData.table_id) : undefined,
        tableName: orderData.table_name ? String(orderData.table_name) : undefined,
      }
    } catch (error) {
      console.error(`Erro ao buscar pedido ${id}:`, error)
      return null
    }
  },

  // Criar novo pedido
  async createOrder(order: Omit<Order, "id">): Promise<{ data: Order | null; error: Error | null }> {
    try {
      const supabase = createSupabaseClient()

      // Se for um pedido de entrega, criar endereço automaticamente (best-effort, sem busca)
      if (order.orderType === 'delivery' && order.address) {
        try {
          const newAddressData = {
            address: order.address.street || '',
            number: order.address.number || '',
            neighborhood: order.address.neighborhood || '',
            city: order.address.city || 'Maringá',
            delivery_fee: order.deliveryFee || 0,
            is_active: true,
            notes: ''
          }
          await DeliveryAddressService.createDeliveryAddress(newAddressData)
          const addressKey = `${order.address.street}, ${order.address.number || ''}, ${order.address.neighborhood}, ${order.address.city}`.trim()
          console.log('Endereço de entrega criado automaticamente (best-effort):', addressKey)
        } catch (addressError) {
          // Se já existir (409) ou qualquer erro, não bloquear criação do pedido
          console.warn('Aviso ao criar endereço automaticamente (ignorado):', addressError)
        }
      }

      const orderData = {
        customer_name: order.customerName,
        customer_phone: order.customerPhone,
        address: order.address,
        items: order.items,
        subtotal: order.subtotal,
        delivery_fee: order.deliveryFee,
        total: order.total,
        payment_method: order.paymentMethod,
        payment_change: order.paymentChange ? parseFloat(order.paymentChange) : null,
        status: order.status,
        date: order.date.toISOString(),
        printed: order.printed || false,
        notified: order.notified || false,
        store_id: DEFAULT_STORE_ID, // Store ID padrão obrigatório
        order_type: order.orderType || 'delivery', // Incluir tipo do pedido
        table_id: order.tableId || null, // Incluir ID da mesa se for pedido de mesa
        table_name: order.tableName || null, // Incluir nome da mesa se for pedido de mesa
      }

      const { data, error } = await (supabase as any)
        .from("orders")
        .insert([orderData])
        .select()
        .single()

      if (error) {
        console.error("Erro ao criar pedido:", {
          error,
          errorMessage: error.message,
          errorCode: error.code,
          errorDetails: error.details,
          errorHint: error.hint,
          orderData: {
            customer_name: order.customerName,
            payment_method: order.paymentMethod,
            total: order.total,
            store_id: DEFAULT_STORE_ID
          }
        })
        return { data: null, error: new Error(error.message || 'Erro desconhecido ao criar pedido') }
      }

      const result: Order = {
        id: Number((data as any).id),
        customerName: String((data as any).customer_name),
        customerPhone: String((data as any).customer_phone),
        address: (data as any).address as Address,
        items: (data as any).items as OrderItem[],
        subtotal: Number((data as any).subtotal),
        deliveryFee: Number((data as any).delivery_fee),
        total: Number((data as any).total),
        paymentMethod: String((data as any).payment_method),
        paymentChange: (data as any).payment_change ? String((data as any).payment_change) : undefined,
        status: (data as any).status as OrderStatus,
        date: new Date(String((data as any).date)),
        printed: Boolean((data as any).printed),
        notified: Boolean((data as any).notified),
        orderType: ((data as any)?.order_type as OrderType) || 'delivery',
        tableId: (data as any)?.table_id ? Number((data as any)?.table_id) : undefined,
        tableName: (data as any)?.table_name ? String((data as any)?.table_name) : undefined,
      }

      return { data: result, error: null }
    } catch (error) {
      console.error("Erro ao criar pedido:", {
        error,
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        orderData: {
          customer_name: order.customerName,
          payment_method: order.paymentMethod,
          total: order.total,
          store_id: DEFAULT_STORE_ID
        }
      })
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) }
    }
  },

  // Atualizar status do pedido
  async updateOrderStatus(id: number | string, status: OrderStatus): Promise<boolean> {
    try {
      const res = await fetch('/api/orders/update-status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status })
      })
      if (!res.ok) {
        const details = await res.json().catch(() => ({}))
        console.error(`Erro ao atualizar status do pedido ${id}:`, details)
        return false
      }
      const data = await res.json()
      return Boolean(data?.success)
    } catch (error) {
      console.error(`Erro ao atualizar status do pedido ${id}:`, error)
      return false
    }
  },

  // Marcar pedido como impresso
  async markOrderAsPrinted(id: number): Promise<boolean> {
    try {
      const res = await fetch('/api/orders/mark-printed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (!res.ok) {
        const details = await res.json().catch(() => ({}))
        console.error(`Erro ao marcar pedido ${id} como impresso:`, details)
        return false
      }
      const data = await res.json()
      return Boolean(data?.success)
    } catch (error) {
      console.error(`Erro ao marcar pedido ${id} como impresso:`, error)
      return false
    }
  },

  // Marcar pedido como notificado
  async markOrderAsNotified(id: number): Promise<boolean> {
    try {
      const res = await fetch('/api/orders/mark-notified', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id })
      })
      if (!res.ok) {
        const details = await res.json().catch(() => ({}))
        console.error(`Erro ao marcar pedido ${id} como notificado:`, details)
        return false
      }
      const data = await res.json()
      return Boolean(data?.success)
    } catch (error) {
      console.error(`Erro ao marcar pedido ${id} como notificado:`, error)
      return false
    }
  },

  // Excluir pedido
  async deleteOrder(id: number): Promise<boolean> {
    try {
      const supabase = createSupabaseClient();

      // Excluir o pedido da tabela 'orders'
      // Os itens são armazenados como JSONB na coluna 'items', então são excluídos automaticamente
      const { error: deleteOrderError } = await supabase
        .from('orders')
        .delete()
        .eq('id', id);

      if (deleteOrderError) {
        console.error(`Erro ao excluir o pedido ${id}:`, deleteOrderError);
        return false;
      }

      console.log(`Pedido ${id} foi excluído com sucesso.`);
      return true;
    } catch (error) {
      console.error(`Erro inesperado ao excluir o pedido ${id}:`, error);
      return false;
    }
  },

  // Obter estatísticas de pedidos
  async getOrderStats(): Promise<{
    total: number
    today: number
    thisWeek: number
    thisMonth: number
    byStatus: Record<OrderStatus, number>
  }> {
    try {
      const supabase = createSupabaseClient()

      // Total de pedidos
      const { count: total } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })

      // Pedidos de hoje
      const today = new Date()
      today.setHours(0, 0, 0, 0)
      const { count: todayCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("date", today.toISOString())

      // Pedidos da semana
      const weekStart = new Date(today)
      weekStart.setDate(today.getDate() - today.getDay())
      const { count: weekCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("date", weekStart.toISOString())

      // Pedidos do mês
      const monthStart = new Date(today.getFullYear(), today.getMonth(), 1)
      const { count: monthCount } = await supabase
        .from("orders")
        .select("*", { count: "exact", head: true })
        .gte("date", monthStart.toISOString())

      // Pedidos por status
      const statusResult = await supabase
        .from("orders")
        .select("status")
      const statusData = statusResult.data as { status: string }[] | null

      const byStatus: Record<OrderStatus, number> = {
        new: 0,
        pending: 0,
        pending_payment: 0,
        preparing: 0,
        ready: 0,
        delivering: 0,
        delivered: 0,
        completed: 0,
        cancelled: 0,
        canceled: 0,
      }

      statusData?.forEach((order) => {
        if (order.status && typeof order.status === 'string' && order.status in byStatus) {
          byStatus[order.status as OrderStatus]++
        }
      })

      return {
        total: total || 0,
        today: todayCount || 0,
        thisWeek: weekCount || 0,
        thisMonth: monthCount || 0,
        byStatus,
      }
    } catch (error) {
      console.error("Erro ao obter estatísticas de pedidos:", error)
      return {
        total: 0,
        today: 0,
        thisWeek: 0,
        thisMonth: 0,
        byStatus: {
          new: 0,
          pending: 0,
          pending_payment: 0,
          preparing: 0,
          ready: 0,
          delivering: 0,
          delivered: 0,
          completed: 0,
          cancelled: 0,
          canceled: 0,
        },
      }
    }
  },

  // Obter pedidos por tipo (delivery ou table)
  async getOrdersByType(orderType: OrderType): Promise<Order[]> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("order_type", orderType)
        .order("date", { ascending: false })

      if (error) {
        console.error(`Erro ao buscar pedidos do tipo ${orderType}:`, error)
        return []
      }

      return (data || []).map((order: any) => ({
        id: Number(order.id),
        customerName: String(order.customer_name),
        customerPhone: String(order.customer_phone),
        address: order.address as any,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : (Array.isArray(order.items) ? order.items : []),
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.delivery_fee),
        total: Number(order.total),
        paymentMethod: String(order.payment_method),
        paymentChange: order.payment_change ? String(order.payment_change) : undefined,
        status: order.status as OrderStatus,
        date: new Date(String(order.date)),
        printed: Boolean(order.printed),
        notified: Boolean(order.notified),
        orderType: (order.order_type as OrderType) || 'delivery',
        tableId: order.table_id ? Number(order.table_id) : undefined,
        tableName: order.table_name ? String(order.table_name) : undefined,
      }))
    } catch (error) {
      console.error(`Erro ao buscar pedidos do tipo ${orderType}:`, error)
      return []
    }
  },

  // Obter pedidos de mesa (excluindo pedidos com pagamento pendente)
  async getTableOrders(): Promise<Order[]> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("order_type", 'table')
        .neq("status", 'pending_payment') // Excluir pedidos com pagamento pendente
        .order("date", { ascending: false })

      if (error) {
        console.error(`Erro ao buscar pedidos de mesa:`, error)
        return []
      }

      return (data || []).map((order: any) => ({
        id: Number(order.id),
        customerName: String(order.customer_name),
        customerPhone: String(order.customer_phone),
        address: order.address as any,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : (Array.isArray(order.items) ? order.items : []),
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.delivery_fee),
        total: Number(order.total),
        paymentMethod: String(order.payment_method),
        paymentChange: order.payment_change ? String(order.payment_change) : undefined,
        status: order.status as OrderStatus,
        date: new Date(String(order.date)),
        printed: Boolean(order.printed),
        notified: Boolean(order.notified),
        orderType: (order.order_type as OrderType) || 'table',
        tableId: order.table_id ? Number(order.table_id) : undefined,
        tableName: order.table_name ? String(order.table_name) : undefined,
      }))
    } catch (error) {
      console.error(`Erro ao buscar pedidos de mesa:`, error)
      return []
    }
  },

  // Obter pedidos de delivery (excluindo pedidos com pagamento pendente)
  async getDeliveryOrders(): Promise<Order[]> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("order_type", 'delivery')
        .neq("status", 'pending_payment') // Excluir pedidos com pagamento pendente
        .order("date", { ascending: false })

      if (error) {
        console.error(`Erro ao buscar pedidos de delivery:`, error)
        return []
      }

      return (data || []).map((order: any) => ({
        id: Number(order.id),
        customerName: String(order.customer_name),
        customerPhone: String(order.customer_phone),
        address: order.address as any,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : (Array.isArray(order.items) ? order.items : []),
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.delivery_fee),
        total: Number(order.total),
        paymentMethod: String(order.payment_method),
        paymentChange: order.payment_change ? String(order.payment_change) : undefined,
        status: order.status as OrderStatus,
        date: new Date(String(order.date)),
        printed: Boolean(order.printed),
        notified: Boolean(order.notified),
        orderType: (order.order_type as OrderType) || 'delivery',
        tableId: order.table_id ? Number(order.table_id) : undefined,
        tableName: order.table_name ? String(order.table_name) : undefined,
      }))
    } catch (error) {
      console.error(`Erro ao buscar pedidos de delivery:`, error)
      throw error
    }
  },

  // Obter pedidos de uma mesa específica
  async getOrdersByTable(tableId: number): Promise<Order[]> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .eq("table_id", tableId)
        .eq("order_type", "table")
        .order("date", { ascending: false })

      if (error) {
        console.error(`Erro ao buscar pedidos da mesa ${tableId}:`, error)
        return []
      }

      return (data || []).map((order: any) => ({
        id: Number(order.id),
        customerName: String(order.customer_name),
        customerPhone: String(order.customer_phone),
        address: order.address as any,
        items: typeof order.items === 'string' ? JSON.parse(order.items) : (Array.isArray(order.items) ? order.items : []),
        subtotal: Number(order.subtotal),
        deliveryFee: Number(order.delivery_fee),
        total: Number(order.total),
        paymentMethod: String(order.payment_method),
        paymentChange: order.payment_change ? String(order.payment_change) : undefined,
        status: order.status as OrderStatus,
        date: new Date(String(order.date)),
        printed: Boolean(order.printed),
        notified: Boolean(order.notified),
        orderType: (order.order_type as OrderType) || 'delivery',
        tableId: order.table_id ? Number(order.table_id) : undefined,
        tableName: order.table_name ? String(order.table_name) : undefined,
      }))
    } catch (error) {
      console.error(`Erro ao buscar pedidos da mesa ${tableId}:`, error)
      return []
    }
  },

  // Subscrever a mudanças em tempo real na tabela de pedidos
  subscribeToOrderChanges(
    onOrderChange: (payload: any) => void,
    onError?: (error: Error) => void
  ) {
    try {
      const supabase = createSupabaseClient()

      // Configurar o canal para escutar mudanças nos pedidos
      const channel = supabase.channel('orders_changes')

      // Configurar o handler para inserções de novos pedidos
      channel.on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'orders'
        },
        (payload: any) => {
          console.log('Novo pedido recebido via real-time:', payload)
          onOrderChange({ type: 'INSERT', ...payload })
        }
      )

      // Configurar o handler para atualizações de pedidos
      channel.on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'orders'
        },
        (payload: any) => {
          console.log('Pedido atualizado via real-time:', payload)
          onOrderChange({ type: 'UPDATE', ...payload })
        }
      )

      // Configurar o handler para exclusões de pedidos
      channel.on(
        'postgres_changes',
        {
          event: 'DELETE',
          schema: 'public',
          table: 'orders'
        },
        (payload: any) => {
          console.log('Pedido excluído via real-time:', payload)
          onOrderChange({ type: 'DELETE', ...payload })
        }
      )

      // Handler de erro removido - eventos normais não devem ser tratados como erros

      // Subscrever ao canal
      channel.subscribe((status, err) => {
        console.log('Status da subscrição real-time de pedidos:', status)
        if (status === 'SUBSCRIBED') {
          console.log('✅ Subscrição real-time de pedidos ativa')
        } else if (status === 'CHANNEL_ERROR') {
          console.warn('⚠️ Erro na subscrição real-time de pedidos - funcionando em modo offline')
          // Não chamar onError para evitar erros intrusivos no console
          // A aplicação continuará funcionando normalmente sem real-time
        }
        if (err && onError) {
          onError(err)
        }
      })

      return channel
    } catch (error) {
      console.error('Erro ao configurar subscrição real-time de pedidos:', error)
      if (onError) {
        onError(error as Error)
      }
      return null
    }
  },
}

// Exportar funções individuais para facilitar o uso
export const getAllOrders = OrderService.getAllOrders.bind(OrderService)
export const getOrdersByStatus = OrderService.getOrdersByStatus.bind(OrderService)
export const getOrderById = OrderService.getOrderById.bind(OrderService)
export const createOrder = OrderService.createOrder.bind(OrderService)
export const updateOrderStatus = OrderService.updateOrderStatus.bind(OrderService)
export const markOrderAsPrinted = OrderService.markOrderAsPrinted.bind(OrderService)
export const markOrderAsNotified = OrderService.markOrderAsNotified.bind(OrderService)
export const deleteOrder = OrderService.deleteOrder.bind(OrderService)
export const getOrderStats = OrderService.getOrderStats.bind(OrderService)
export const getOrdersByType = OrderService.getOrdersByType.bind(OrderService)
export const getTableOrders = OrderService.getTableOrders.bind(OrderService)
export const getDeliveryOrders = OrderService.getDeliveryOrders.bind(OrderService)
export const getOrdersByTable = OrderService.getOrdersByTable.bind(OrderService)
export const subscribeToOrderChanges = OrderService.subscribeToOrderChanges.bind(OrderService)
