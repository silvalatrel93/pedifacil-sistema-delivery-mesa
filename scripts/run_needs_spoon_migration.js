import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';

// Carregar variáveis de ambiente
dotenv.config({ path: '.env.local' });

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Configurar cliente Supabase
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl) {
  console.error('❌ Erro: NEXT_PUBLIC_SUPABASE_URL não encontrada no .env.local');
  process.exit(1);
}

if (!supabaseKey) {
  console.error('❌ Erro: SUPABASE_SERVICE_ROLE_KEY não encontrada no .env.local');
  console.log('\n📋 SOLUÇÃO MANUAL:');
  console.log('1. Acesse o Supabase Dashboard: https://app.supabase.com');
  console.log('2. Vá em SQL Editor');
  console.log('3. Execute o conteúdo do arquivo: migrations/add_needs_spoon_to_products.sql');
  
  // Mostrar o conteúdo da migração
  try {
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_needs_spoon_to_products.sql');
    const sql = fs.readFileSync(migrationPath, 'utf8');
    console.log('\n📄 Conteúdo da migração:');
    console.log('=' .repeat(60));
    console.log(sql);
    console.log('=' .repeat(60));
  } catch (error) {
    console.error('❌ Erro ao ler arquivo de migração:', error.message);
  }
  
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function runNeedsSpoonMigration() {
  try {
    console.log('🚀 Iniciando migração da coluna needs_spoon...');
    
    const migrationPath = path.join(__dirname, '..', 'migrations', 'add_needs_spoon_to_products.sql');
    
    if (!fs.existsSync(migrationPath)) {
      console.error('❌ Arquivo de migração não encontrado:', migrationPath);
      process.exit(1);
    }
    
    const sql = fs.readFileSync(migrationPath, 'utf8');
    
    console.log('📄 Executando migração...');
    
    // Dividir o SQL em comandos separados
    const commands = sql.split(';').filter(cmd => cmd.trim() !== '' && !cmd.trim().startsWith('--'));
    
    for (const command of commands) {
      const trimmedCommand = command.trim();
      if (trimmedCommand) {
        console.log('⚡ Executando:', trimmedCommand.substring(0, 50) + '...');
        
        const { data, error } = await supabase.rpc('exec_sql', { sql: trimmedCommand });
        
        if (error) {
          console.error('❌ Erro ao executar comando SQL:', error);
          console.error('📝 Comando:', trimmedCommand);
          
          // Se o erro for sobre a coluna já existir, continuar
          if (error.message && error.message.includes('already exists')) {
            console.log('ℹ️  Coluna já existe, continuando...');
            continue;
          }
          
          throw error;
        } else {
          console.log('✅ Comando executado com sucesso');
          if (data) {
            console.log('📊 Resultado:', data);
          }
        }
      }
    }
    
    console.log('\n🎉 Migração da coluna needs_spoon concluída com sucesso!');
    console.log('✅ O campo "Precisa de Colher?" agora será salvo corretamente no banco de dados.');
    
  } catch (error) {
    console.error('❌ Erro ao executar migração:', error);
    console.log('\n📋 SOLUÇÃO MANUAL:');
    console.log('1. Acesse o Supabase Dashboard: https://app.supabase.com');
    console.log('2. Vá em SQL Editor');
    console.log('3. Execute o seguinte SQL:');
    console.log('\nALTER TABLE products ADD COLUMN IF NOT EXISTS needs_spoon BOOLEAN DEFAULT false;');
    process.exit(1);
  }
}

runNeedsSpoonMigration();