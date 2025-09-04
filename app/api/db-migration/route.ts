import { NextResponse } from 'next/server'
import { createSupabaseClient } from '@/lib/supabase-client'

export async function POST(request: Request) {
  try {
    const { sql } = await request.json()
    
    if (!sql) {
      return NextResponse.json({ error: 'SQL query is required' }, { status: 400 })
    }
    
    const supabase = createSupabaseClient()
    
    // Executar SQL diretamente usando o cliente Supabase
    // Cast para any para evitar erro de tipagem quando a função RPC não está nos tipos gerados
    const { data, error } = await (supabase as any).rpc('exec_sql', { query: sql })
    
    if (error) {
      console.error('Erro ao executar SQL:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    
    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Erro na API de migração:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
