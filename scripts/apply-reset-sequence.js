// Script para aplicar a função de reset da sequência no Supabase
import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });

// Obter credenciais do Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('Erro: Variáveis de ambiente do Supabase não estão definidas');
  process.exit(1);
}

// Criar cliente Supabase
const supabase = createClient(supabaseUrl, supabaseKey);

// Função principal para aplicar a função SQL
async function applyResetSequenceFunction() {
  console.log('Aplicando função de reset de sequência...');
  
  try {
    // Ler o arquivo SQL
    const sqlFilePath = path.join(process.cwd(), 'migrations', 'reset_order_sequence.sql');
    const sqlContent = fs.readFileSync(sqlFilePath, 'utf8');
    
    console.log('Conteúdo SQL carregado, aplicando ao banco de dados...');
    
    // Executar o SQL no Supabase
    const { error } = await supabase.rpc('exec_sql', { 
      sql: sqlContent 
    });
    
    if (error) {
      console.error('Erro ao aplicar função SQL:', error);
      
      // Tentar método alternativo
      console.log('Tentando método alternativo...');
      
      // Método direto para redefinir a sequência
      const resetQuery = `
        DO $$
        DECLARE
          seq_name text;
        BEGIN
          -- Encontrar o nome da sequência
          SELECT pg_get_serial_sequence('public.orders', 'id') INTO seq_name;
          
          IF seq_name IS NOT NULL THEN
            -- Redefinir a sequência para 1
            EXECUTE 'ALTER SEQUENCE ' || seq_name || ' RESTART WITH 1';
            RAISE NOTICE 'Sequência % redefinida com sucesso', seq_name;
          ELSE
            RAISE NOTICE 'Não foi possível encontrar a sequência da tabela orders';
          END IF;
        END;
        $$;
      `;
      
      const { error: altError } = await supabase.rpc('exec_sql', {
        sql: resetQuery
      });
      
      if (resetError) {
        console.error('Erro ao aplicar método alternativo:', resetError);
        process.exit(1);
      } else {
        console.log('Método alternativo aplicado com sucesso!');
      }
    } else {
      console.log('Função SQL aplicada com sucesso!');
    }
    
    // Testar a função
    console.log('Testando a função reset_order_sequence...');
    const { data, error: testError } = await supabase.rpc('reset_order_sequence');
    
    if (testError) {
      console.error('Erro ao testar a função:', testError);
      process.exit(1);
    } else {
      console.log('Função testada com sucesso! Resultado:', data);
      console.log('O contador de pedidos foi zerado. O próximo pedido começará com o ID #1');
    }
    
  } catch (error) {
    console.error('Erro inesperado:', error);
    process.exit(1);
  }
}

// Executar a função
applyResetSequenceFunction();
