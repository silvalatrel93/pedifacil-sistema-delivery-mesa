import { createClient } from '@supabase/supabase-js';
import { NextRequest, NextResponse } from "next/server";

// Cliente Supabase com service_role para operações administrativas
function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || '';
  
  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Variáveis de ambiente do Supabase não configuradas para admin');
  }
  
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  });
}

export async function POST() {
  try {
    const supabase = createAdminSupabaseClient();
    
    // Passo 1: Excluir todos os pedidos existentes
    console.log("Excluindo todos os pedidos existentes...");
    const { error: deleteError } = await supabase
      .from('orders')
      .delete()
      .gte('id', 0);
    
    if (deleteError) {
      console.error("Erro ao excluir pedidos:", deleteError);
      return NextResponse.json(
        { success: false, error: "Erro ao excluir pedidos existentes" },
        { status: 500 }
      );
    }
    
    // Usar setval para resetar a sequência do PostgreSQL
    // setval('sequence_name', value, is_called)
    // is_called = false significa que o próximo valor será o valor especificado
    const { data: resetData, error: resetError } = await supabase.rpc('exec_sql', {
      query: "SELECT setval('orders_id_seq', 1, false)"
    });
    
    if (resetError) {
      // Fallback: método manual se exec_sql não estiver disponível
      console.log('exec_sql não disponível, usando método manual...');
      
      const tempOrder = {
        customer_name: 'TEMP_ORDER_FOR_RESET',
        customer_phone: '00000000000',
        address: {
          street: 'TEMP',
          number: '0',
          neighborhood: 'TEMP'
        },
        items: [],
        subtotal: 0,
        delivery_fee: 0,
        total: 0,
        payment_method: 'dinheiro',
        status: 'pending',
        date: new Date().toISOString(),
        printed: false,
        notified: false,
        store_id: '00000000-0000-0000-0000-000000000000'
      };

      // Inserir pedido temporário
      const { data: insertData, error: insertError } = await supabase
        .from('orders')
        .insert(tempOrder)
        .select('id');

      if (insertError) {
        throw new Error(`Erro ao inserir pedido temporário: ${insertError.message}`);
      }

      const tempId = insertData[0].id;

      // Deletar o pedido temporário
      const { error: deleteError } = await supabase
        .from('orders')
        .delete()
        .eq('id', tempId);

      if (deleteError) {
        throw new Error(`Erro ao deletar pedido temporário: ${deleteError.message}`);
      }

      return NextResponse.json({
        success: true,
        message: 'Contador de pedidos zerado com sucesso (método manual)',
        method: 'manual',
        resetToId1: true,
        nextOrderId: 1
      });
    }

    return NextResponse.json({
      success: true,
      message: 'Contador de pedidos zerado com sucesso',
      method: 'setval',
      resetToId1: true,
      nextOrderId: 1
    });

  } catch (error) {
    console.error('Erro ao resetar contador:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Erro interno do servidor',
        details: error instanceof Error ? error.message : 'Erro desconhecido'
      },
      { status: 500 }
    );
  }
}
