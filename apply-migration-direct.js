require('dotenv').config({ path: '.env.local' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseKey) {
  console.error('❌ Variáveis de ambiente não encontradas');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function applyMigration() {
  try {
    console.log('🚀 Aplicando migração da coluna needs_spoon...');
    
    // Tentar executar a migração diretamente
    console.log('📄 Executando ALTER TABLE...');
    
    const { data, error } = await supabase.rpc('exec_sql', {
      sql: 'ALTER TABLE products ADD COLUMN needs_spoon BOOLEAN DEFAULT false;'
    });
    
    if (error) {
      console.error('❌ Erro ao executar migração via exec_sql:', error);
      
      // Se exec_sql não funcionar, mostrar instruções manuais
      console.log('\n📋 A migração deve ser feita manualmente no Supabase Dashboard.');
      console.log('\n🔗 Passos:');
      console.log('1. Acesse: https://app.supabase.com');
      console.log('2. Selecione seu projeto');
      console.log('3. Vá em "SQL Editor"');
      console.log('4. Execute o seguinte comando:');
      console.log('\n📝 SQL:');
      console.log('ALTER TABLE products ADD COLUMN IF NOT EXISTS needs_spoon BOOLEAN DEFAULT false;');
      
    } else {
      console.log('✅ Migração executada com sucesso!');
      console.log('📊 Resultado:', data);
      
      // Testar se a coluna foi criada
      console.log('\n🔍 Testando a nova coluna...');
      const { data: testData, error: testError } = await supabase
        .from('products')
        .select('id, needs_spoon')
        .limit(1);
      
      if (testError) {
        console.error('❌ Erro ao testar coluna:', testError);
      } else {
        console.log('✅ Coluna needs_spoon funcionando corretamente!');
      }
    }
    
  } catch (err) {
    console.error('❌ Erro inesperado:', err);
    console.log('\n📋 Execute manualmente no Supabase Dashboard:');
    console.log('ALTER TABLE products ADD COLUMN IF NOT EXISTS needs_spoon BOOLEAN DEFAULT false;');
  }
}

applyMigration();