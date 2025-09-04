import { createClient } from "@supabase/supabase-js"
import { Database } from "./database.types"

// Singleton para o cliente Supabase
let supabaseInstance: ReturnType<typeof createClient<Database>> | null = null

export function createSupabaseClient() {
  if (supabaseInstance) {
    return supabaseInstance;
  }

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  // Valores de fallback para desenvolvimento local
  const fallbackUrl = 'https://xyzcompany.supabase.co';
  const fallbackKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhtdGt4cXBrYnp3YnZpaWZwcXRsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTU2MjA3MDMsImV4cCI6MjAzMTE5NjcwM30.dummy-key-for-development';

  // Usar valores de fallback apenas em desenvolvimento
  const isDevelopment = process.env.NODE_ENV === 'development';
  const usingFallback = !supabaseUrl || !supabaseAnonKey;

  const finalUrl = supabaseUrl || (isDevelopment ? fallbackUrl : undefined);
  const finalKey = supabaseAnonKey || (isDevelopment ? fallbackKey : undefined);

  if (!finalUrl || !finalKey) {
    console.error("Erro: Supabase URL e Anon Key são necessários. Verifique as variáveis de ambiente.")
    throw new Error("Supabase URL e Anon Key são necessários. Verifique as variáveis de ambiente.")
  }

  try {
    supabaseInstance = createClient<Database>(finalUrl, finalKey)
    return supabaseInstance
  } catch (error) {
    console.error('Erro ao criar cliente Supabase:', error)
    throw error
  }
}

// Função para testar a conectividade com o Supabase
export async function testSupabaseConnection(maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const supabase = createSupabaseClient()

      // Adicionar um pequeno delay para evitar requisições muito rápidas
      await new Promise(resolve => setTimeout(resolve, 50 * attempt))

      // Tentar uma consulta simples para verificar a conectividade
      const { data, error } = await supabase
        .from('store_config')
        .select('count', { count: 'exact', head: true })

      if (error) {
        console.warn(`Tentativa ${attempt} de conexão falhou:`, {
          message: error.message,
          code: error.code,
          details: error.details,
          hint: error.hint
        })

        if (attempt === maxRetries) {
          return false
        }
        continue
      }

      return true
    } catch (error) {
      console.warn(`Tentativa ${attempt} falhou com erro inesperado:`, error)

      if (attempt === maxRetries) {
        return false
      }

      // Aguardar antes da próxima tentativa
      await new Promise(resolve => setTimeout(resolve, 1000 * attempt))
    }
  }
  return false
}

// Função helper para executar operações com retry
export async function withRetry<T>(
  operation: () => Promise<T>,
  maxRetries = 3,
  baseDelay = 500
): Promise<T> {
  let lastError: any

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await operation()
    } catch (error) {
      lastError = error
      console.warn(`Tentativa ${attempt} falhou:`, error)

      // Se não é a última tentativa, aguardar antes de tentar novamente
      if (attempt < maxRetries) {
        const delay = baseDelay * Math.pow(2, attempt - 1) // Backoff exponencial
        await new Promise(resolve => setTimeout(resolve, delay))
      }
    }
  }

  throw lastError
}
