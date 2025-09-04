import { createSupabaseClient } from "../supabase-client"
import type { Table } from "../types"

export const TableService = {
  // Obter todas as mesas
  async getAllTables(): Promise<Table[]> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .order("number", { ascending: true })

      if (error) {
        console.error("Erro ao buscar mesas:", error)
        return []
      }

      return (data || []).map((table: any) => ({
        id: Number(table.id),
        number: Number(table.number),
        name: String(table.name),
        active: Boolean(table.is_active),
        qrCode: String(table.qr_code),
        createdAt: new Date(String(table.created_at)),
        updatedAt: new Date(String(table.updated_at)),
      }))
    } catch (error) {
      console.error("Erro ao buscar mesas:", error)
      return []
    }
  },

  // Obter mesas ativas
  async getActiveTables(): Promise<Table[]> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("active", true)
        .order("number", { ascending: true })

      if (error) {
        console.error("Erro ao buscar mesas ativas:", error)
        return []
      }

      return (data || []).map((table: any) => ({
        id: Number(table.id),
        number: Number(table.number),
        name: String(table.name),
        active: Boolean(table.is_active),
        qrCode: String(table.qr_code),
        createdAt: new Date(String(table.created_at)),
        updatedAt: new Date(String(table.updated_at)),
      }))
    } catch (error) {
      console.error("Erro ao buscar mesas ativas:", error)
      return []
    }
  },

  // Obter mesa por ID
  async getTableById(id: number): Promise<Table | null> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("id", id)
        .single()

      if (error) {
        console.error(`Erro ao buscar mesa ${id}:`, error)
        return null
      }

      if (!data) {
        return null
      }

      return {
        id: Number(data.id),
        number: Number(data.number),
        name: String(data.name),
        active: Boolean(data.is_active),
        qrCode: String(data.qr_code),
        createdAt: new Date(String(data.created_at)),
        updatedAt: new Date(String(data.updated_at)),
      }
    } catch (error) {
      console.error(`Erro ao buscar mesa ${id}:`, error)
      return null
    }
  },

  // Obter mesa por número
  async getTableByNumber(number: number): Promise<Table | null> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("tables")
        .select("*")
        .eq("number", number)
        .eq("is_active", true)
        .single()

      if (error) {
        console.error(`Erro ao buscar mesa ${number}:`, error)
        return null
      }

      if (!data) {
        return null
      }

      return {
        id: Number(data.id),
        number: Number(data.number),
        name: String(data.name),
        active: Boolean(data.is_active),
        qrCode: String(data.qr_code),
        createdAt: new Date(String(data.created_at)),
        updatedAt: new Date(String(data.updated_at)),
      }
    } catch (error) {
      console.error(`Erro ao buscar mesa ${number}:`, error)
      return null
    }
  },

  // Criar nova mesa
  async createTable(tableData: Omit<Table, "id" | "createdAt" | "updatedAt">): Promise<{ data: Table | null; error: Error | null }> {
    try {
      const supabase = createSupabaseClient()

      // Gerar QR code único
      const qrCode = `mesa-${tableData.number}-${Date.now()}`

      const { data, error } = await supabase
        .from("tables")
        .insert({
          number: tableData.number,
          name: tableData.name,
          is_active: tableData.active,
          qr_code: qrCode,
        })
        .select()
        .single()

      if (error) {
        console.error("Erro ao criar mesa:", error)
        return { data: null, error: new Error(error.message || 'Erro desconhecido ao criar mesa') }
      }

      const result: Table = {
        id: Number(data.id),
        number: Number(data.number),
        name: String(data.name),
        active: Boolean(data.is_active),
        qrCode: String(data.qr_code),
        createdAt: new Date(String(data.created_at)),
        updatedAt: new Date(String(data.updated_at)),
      }

      return { data: result, error: null }
    } catch (error) {
      console.error("Erro ao criar mesa:", error)
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) }
    }
  },

  // Atualizar mesa
  async updateTable(id: number, tableData: Partial<Omit<Table, "id" | "createdAt" | "updatedAt" | "qrCode">>): Promise<{ data: Table | null; error: Error | null }> {
    try {
      const supabase = createSupabaseClient()

      const updateData: any = {}
      if (tableData.number !== undefined) updateData.number = tableData.number
      if (tableData.name !== undefined) updateData.name = tableData.name
      if (tableData.active !== undefined) updateData.is_active = tableData.active

      console.log('🔧 Dados sendo enviados para o banco:', updateData)
      console.log('🔧 ID da mesa sendo atualizada:', id)
      
      const { data, error } = await supabase
        .from("tables")
        .update(updateData)
        .eq("id", id)
        .select()
        .single()

      console.log('🔧 Dados retornados do banco:', data)
      console.log('🔧 Erro do Supabase (se houver):', error)

      if (error) {
        console.error("Erro ao atualizar mesa:", error)
        return { data: null, error: new Error(error.message || 'Erro desconhecido ao atualizar mesa') }
      }

      const result: Table = {
        id: Number(data.id),
        number: Number(data.number),
        name: String(data.name),
        active: Boolean(data.is_active),
        qrCode: String(data.qr_code),
        createdAt: new Date(String(data.created_at)),
        updatedAt: new Date(String(data.updated_at)),
      }

      return { data: result, error: null }
    } catch (error) {
      console.error("Erro ao atualizar mesa:", error)
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) }
    }
  },

  // Deletar mesa
  async deleteTable(id: number): Promise<{ success: boolean; error: Error | null }> {
    try {
      const supabase = createSupabaseClient()

      // Verificar se há pedidos associados à mesa
      const { data: orders, error: ordersError } = await supabase
        .from("orders")
        .select("id")
        .eq("table_id", id)
        .limit(1)

      if (ordersError) {
        console.error("Erro ao verificar pedidos da mesa:", ordersError)
        return { success: false, error: new Error("Erro ao verificar pedidos da mesa") }
      }

      if (orders && orders.length > 0) {
        return { success: false, error: new Error("Não é possível excluir mesa com pedidos associados") }
      }

      const { error } = await supabase
        .from("tables")
        .delete()
        .eq("id", id)

      if (error) {
        console.error("Erro ao deletar mesa:", error)
        return { success: false, error: new Error(error.message || 'Erro desconhecido ao deletar mesa') }
      }

      return { success: true, error: null }
    } catch (error) {
      console.error("Erro ao deletar mesa:", error)
      return { success: false, error: error instanceof Error ? error : new Error(String(error)) }
    }
  },

  // Regenerar QR code
  async regenerateQRCode(id: number): Promise<{ data: Table | null; error: Error | null }> {
    try {
      const supabase = createSupabaseClient()

      // Buscar mesa atual
      const table = await this.getTableById(id)
      if (!table) {
        return { data: null, error: new Error("Mesa não encontrada") }
      }

      // Gerar novo QR code
      const newQrCode = `mesa-${table.number}-${Date.now()}`

      const { data, error } = await supabase
        .from("tables")
        .update({ qr_code: newQrCode })
        .eq("id", id)
        .select()
        .single()

      if (error) {
        console.error("Erro ao regenerar QR code:", error)
        return { data: null, error: new Error(error.message || 'Erro desconhecido ao regenerar QR code') }
      }

      const result: Table = {
        id: Number(data.id),
        number: Number(data.number),
        name: String(data.name),
        active: Boolean(data.is_active),
        qrCode: String(data.qr_code),
        createdAt: new Date(String(data.created_at)),
        updatedAt: new Date(String(data.updated_at)),
      }

      return { data: result, error: null }
    } catch (error) {
      console.error("Erro ao regenerar QR code:", error)
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) }
    }
  },

  // Obter estatísticas das mesas
  async getTableStats(): Promise<{
    total: number
    active: number
    inactive: number
    withOrders: number
  }> {
    try {
      const supabase = createSupabaseClient()

      // Contar total de mesas
      const { count: totalCount } = await supabase
        .from("tables")
        .select("*", { count: "exact", head: true })

      // Contar mesas ativas
      const { count: activeCount } = await supabase
        .from("tables")
        .select("*", { count: "exact", head: true })
        .eq("active", true)

      // Contar mesas com pedidos
      const { data: tablesWithOrders } = await supabase
        .from("orders")
        .select("table_id")
        .not("table_id", "is", null)
        .eq("order_type", "table")

      const uniqueTablesWithOrders = new Set(tablesWithOrders?.map((order: any) => order.table_id) || [])

      return {
        total: totalCount || 0,
        active: activeCount || 0,
        inactive: (totalCount || 0) - (activeCount || 0),
        withOrders: uniqueTablesWithOrders.size,
      }
    } catch (error) {
      console.error("Erro ao obter estatísticas das mesas:", error)
      return {
        total: 0,
        active: 0,
        inactive: 0,
        withOrders: 0,
      }
    }
  },

      // Gerar URL do QR code para mesa
    generateQRCodeUrl(tableNumber: number): string {
      let baseUrl: string
      
      if (typeof window !== 'undefined') {
        // No browser - usar a URL atual
        baseUrl = window.location.origin
      } else {
        // No servidor - usar variável de ambiente ou detectar automaticamente
        baseUrl = process.env.NEXT_PUBLIC_APP_URL || process.env.VERCEL_URL || 'http://localhost:3000'
        
        // Se estivermos no Vercel, adicionar https://
        if (process.env.VERCEL_URL && !baseUrl.startsWith('http')) {
          baseUrl = `https://${baseUrl}`
        }
      }
      
      return `${baseUrl}/mesa/${tableNumber}`
    },
} 