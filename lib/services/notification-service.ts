import { createSupabaseClient } from "../supabase-client"
import { createClient } from '@supabase/supabase-js'
import type { Notification } from "../types"

// Função para criar cliente administrativo do Supabase
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

export const NotificationService = {
  // Obter todas as notificações
  async getAllNotifications(): Promise<Notification[]> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Erro ao buscar notificações:", error)
        return []
      }

      return (data || []).map((notification: any) => ({
        id: Number(notification.id),
        title: String(notification.title),
        message: String(notification.message),
        type: String(notification.type),
        active: Boolean(notification.active),
        startDate: new Date(String(notification.start_date)),
        endDate: new Date(String(notification.end_date)),
        priority: Number(notification.priority),
        read: Boolean(notification.read),
        createdAt: notification.created_at ? new Date(String(notification.created_at)) : undefined,
      }))
    } catch (error) {
      console.error("Erro ao buscar notificações:", error)
      return []
    }
  },

  // Obter notificações ativas
  async getActiveNotifications(): Promise<Notification[]> {
    try {
      const supabase = createSupabaseClient()
      const now = new Date().toISOString()

      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("active", true)
        .lte("start_date", now)
        .gte("end_date", now)
        .order("priority", { ascending: false })
        .order("created_at", { ascending: false })

      if (error) {
        console.error("Erro ao buscar notificações ativas:", error)
        return []
      }

      return (data || []).map((notification: any) => ({
        id: Number(notification.id),
        title: String(notification.title),
        message: String(notification.message),
        type: String(notification.type),
        active: Boolean(notification.active),
        startDate: new Date(String(notification.start_date)),
        endDate: new Date(String(notification.end_date)),
        priority: Number(notification.priority),
        read: Boolean(notification.read),
        createdAt: notification.created_at ? new Date(String(notification.created_at)) : undefined,
      }))
    } catch (error) {
      console.error("Erro ao buscar notificações ativas:", error)
      return []
    }
  },

  // Obter notificação por ID
  async getNotificationById(id: number): Promise<Notification | null> {
    try {
      const supabase = createSupabaseClient()
      const { data, error } = await supabase
        .from("notifications")
        .select("*")
        .eq("id", id)
        .single()

      if (error) {
        console.error(`Erro ao buscar notificação ${id}:`, error)
        return null
      }

      if (!data) {
        return null
      }

      return {
        id: Number(data.id),
        title: String(data.title),
        message: String(data.message),
        type: String(data.type),
        active: Boolean(data.active),
        startDate: new Date(String(data.start_date)),
        endDate: new Date(String(data.end_date)),
        priority: Number(data.priority),
        read: Boolean(data.read),
        createdAt: data.created_at ? new Date(String(data.created_at)) : undefined,
      }
    } catch (error) {
      console.error(`Erro ao buscar notificação ${id}:`, error)
      return null
    }
  },

  // Salvar notificação
  async saveNotification(notification: Notification): Promise<{ data: Notification | null; error: Error | null }> {
    try {
      const supabase = createAdminSupabaseClient()

      if (notification.id && notification.id > 0) {
        // Atualizar notificação existente
        const { data, error } = await supabase
          .from("notifications")
          .update({
            title: notification.title,
            message: notification.message,
            type: notification.type,
            active: notification.active,
            start_date: notification.startDate.toISOString(),
            end_date: notification.endDate.toISOString(),
            priority: notification.priority,
            read: notification.read,
          })
          .eq("id", notification.id)
          .select()
          .single()

        if (error) {
          console.error("Erro ao atualizar notificação:", error)
          return { data: null, error: new Error(error.message) }
        }

        const result: Notification = {
          id: Number(data.id),
          title: String(data.title),
          message: String(data.message),
          type: String(data.type),
          active: Boolean(data.active),
          startDate: new Date(String(data.start_date)),
          endDate: new Date(String(data.end_date)),
          priority: Number(data.priority),
          read: Boolean(data.read),
          createdAt: data.created_at ? new Date(String(data.created_at)) : undefined,
        }

        return { data: result, error: null }
      } else {
        // Criar nova notificação
        const { data, error } = await supabase
          .from("notifications")
          .insert({
            title: notification.title,
            message: notification.message,
            type: notification.type,
            active: notification.active !== undefined ? notification.active : true,
            start_date: notification.startDate.toISOString(),
            end_date: notification.endDate.toISOString(),
            priority: notification.priority || 1,
            read: notification.read || false,
            created_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (error) {
          console.error("Erro ao criar notificação:", error)
          return { data: null, error: new Error(error.message) }
        }

        const result: Notification = {
          id: Number(data.id),
          title: String(data.title),
          message: String(data.message),
          type: String(data.type),
          active: Boolean(data.active),
          startDate: new Date(String(data.start_date)),
          endDate: new Date(String(data.end_date)),
          priority: Number(data.priority),
          read: Boolean(data.read),
          createdAt: data.created_at ? new Date(String(data.created_at)) : undefined,
        }

        return { data: result, error: null }
      }
    } catch (error) {
      console.error("Erro ao salvar notificação:", error)
      return { data: null, error: error instanceof Error ? error : new Error(String(error)) }
    }
  },

  // Marcar notificação como lida
  async markAsRead(id: number): Promise<boolean> {
    try {
      const supabase = createAdminSupabaseClient()
      const { error } = await supabase
        .from("notifications")
        .update({ read: true })
        .eq("id", id)

      if (error) {
        console.error(`Erro ao marcar notificação ${id} como lida:`, error)
        return false
      }

      return true
    } catch (error) {
      console.error(`Erro ao marcar notificação ${id} como lida:`, error)
      return false
    }
  },

  // Excluir notificação
  async deleteNotification(id: number): Promise<boolean> {
    try {
      const supabase = createAdminSupabaseClient()
      const { error } = await supabase
        .from("notifications")
        .delete()
        .eq("id", id)

      if (error) {
        console.error(`Erro ao deletar notificação ${id}:`, error)
        return false
      }

      return true
    } catch (error) {
      console.error(`Erro ao deletar notificação ${id}:`, error)
      return false
    }
  },
}
