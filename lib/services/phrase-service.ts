import { createSupabaseClient, withRetry } from "../supabase-client"
import { createClient } from '@supabase/supabase-js'
import type { Phrase } from "../types"

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

// Serviço para gerenciar frases
export const PhraseService = {
  // Obter todas as frases
  async getAllPhrases(): Promise<Phrase[]> {
    const supabase = createSupabaseClient()

    // Adicionar um pequeno delay para evitar requisições muito rápidas
    await new Promise(resolve => setTimeout(resolve, 50))

    const { data, error } = await withRetry(async () => {
      const result = await supabase.from("phrases").select("*").order("order")

      if (result.error) {
        throw result.error
      }

      return result
    })

    if (error) {
      console.error("Erro ao buscar frases:", error)
      return []
    }

    return data.map((item: any) => ({
      id: Number(item.id),
      text: String(item.text),
      order: Number(item.order),
      active: Boolean(item.active),
    }))
  },

  // Obter frases ativas
  async getActivePhrases(): Promise<Phrase[]> {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.from("phrases").select("*").eq("active", true).order("order")

    if (error) {
      console.error("Erro ao buscar frases ativas:", error)
      return []
    }

    return data.map((item: any) => ({
      id: Number(item.id),
      text: String(item.text),
      order: Number(item.order),
      active: Boolean(item.active),
    }))
  },

  // Obter frase por ID
  async getPhraseById(id: number): Promise<Phrase | null> {
    const supabase = createSupabaseClient()
    const { data, error } = await supabase.from("phrases").select("*").eq("id", id).single()

    if (error) {
      console.error(`Erro ao buscar frase ${id}:`, error)
      return null
    }

    const typedData = data as any

    return {
      id: Number(typedData.id),
      text: String(typedData.text),
      order: Number(typedData.order),
      active: Boolean(typedData.active),
    }
  },

  // Salvar frase
  async savePhrase(phrase: Phrase): Promise<Phrase | null> {
    const supabase = createAdminSupabaseClient()

    try {
      // Remover o ID se for 0 para permitir que o Supabase gere um novo ID
      const phraseData = {
        text: phrase.text,
        order: phrase.order,
        active: phrase.active,
        // Nota: phrases não usa store_id
      }

      let result

      if (phrase.id && phrase.id > 0) {
        // Atualizar frase existente
        result = await supabase.from("phrases").update(phraseData).eq("id", phrase.id).select()
      } else {
        // Criar nova frase - sem especificar ID
        result = await supabase.from("phrases").insert(phraseData).select()
      }

      if (result.error) {
        console.error("Erro ao salvar frase:", result.error)
        return null
      }

      // Verificar se temos dados retornados
      if (!result.data || result.data.length === 0) {
        console.error("Nenhum dado retornado após salvar frase")
        return null
      }

      // Usar o primeiro item do array de resultados
      const data = result.data[0] as any

      return {
        id: Number(data.id),
        text: String(data.text),
        order: Number(data.order),
        active: Boolean(data.active),
      }
    } catch (error) {
      console.error("Erro ao salvar frase:", error)
      return null
    }
  },

  // Excluir frase
  async deletePhrase(id: number): Promise<boolean> {
    const supabase = createAdminSupabaseClient()
    const { error } = await supabase.from("phrases").delete().eq("id", id)

    if (error) {
      console.error(`Erro ao excluir frase ${id}:`, error)
      return false
    }

    return true
  },

  // Verificar se já existem frases
  async phraseExists(): Promise<boolean> {
    const supabase = createSupabaseClient()
    const { count, error } = await supabase.from("phrases").select("*", { count: "exact", head: true })

    if (error) {
      console.error("Erro ao verificar existência de frases:", error)
      return false
    }

    return count !== null && count > 0
  },
}

// Exportar funções individuais para facilitar o uso
export const getAllPhrases = PhraseService.getAllPhrases.bind(PhraseService)
export const getActivePhrases = PhraseService.getActivePhrases.bind(PhraseService)
export const getPhraseById = PhraseService.getPhraseById.bind(PhraseService)
export const savePhrase = PhraseService.savePhrase.bind(PhraseService)
export const deletePhrase = PhraseService.deletePhrase.bind(PhraseService)
export const phraseExists = PhraseService.phraseExists.bind(PhraseService)

// Exportar tipos
export type { Phrase } from "../types"
