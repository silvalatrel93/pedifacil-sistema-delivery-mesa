-- ========================================
-- MIGRAÇÃO: Corrigir estrutura da tabela cart
-- Data: 2025-01-20
-- Descrição: Adiciona campos que estão sendo usados no código mas não existem na tabela
-- ========================================

-- Problema identificado: O código está tentando acessar campos que não existem na tabela cart:
-- - size_name: usado para armazenar o nome do tamanho
-- - size_price: usado para armazenar o preço específico do tamanho
-- - size_base: usado para armazenar o tamanho base (sem sufixos únicos)

-- Adicionar campos que estão faltando na tabela cart
ALTER TABLE cart 
ADD COLUMN IF NOT EXISTS size_name VARCHAR(100);

ALTER TABLE cart 
ADD COLUMN IF NOT EXISTS size_price DECIMAL(10, 2);

ALTER TABLE cart 
ADD COLUMN IF NOT EXISTS size_base VARCHAR(50);

-- Atualizar registros existentes com valores baseados nos campos atuais
UPDATE cart 
SET 
  size_name = size,
  size_price = price,
  size_base = size
WHERE size_name IS NULL OR size_price IS NULL OR size_base IS NULL;

-- Adicionar comentários para documentação
COMMENT ON COLUMN cart.size_name IS 'Nome do tamanho selecionado (pode incluir sufixos únicos)';
COMMENT ON COLUMN cart.size_price IS 'Preço específico do tamanho selecionado';
COMMENT ON COLUMN cart.size_base IS 'Tamanho base sem sufixos únicos';

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_cart_size_name ON cart(size_name);
CREATE INDEX IF NOT EXISTS idx_cart_size_base ON cart(size_base);

-- Verificar se as colunas foram criadas corretamente
SELECT 
    column_name,
    data_type,
    column_default,
    is_nullable
FROM information_schema.columns 
WHERE table_name = 'cart' 
AND column_name IN ('size_name', 'size_price', 'size_base')
ORDER BY ordinal_position;

-- Atualizar schema cache do PostgREST
NOTIFY pgrst, 'reload schema';

-- ========================================
-- RESULTADO ESPERADO:
-- ✅ Campos size_name, size_price e size_base adicionados à tabela cart
-- ✅ Registros existentes atualizados com valores padrão
-- ✅ Código funcionará sem erros de campos inexistentes
-- ✅ Valores undefined/NaN serão resolvidos
-- ========================================