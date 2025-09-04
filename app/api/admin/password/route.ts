import { NextResponse } from 'next/server';
import { createHash } from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Cliente Supabase com service_role para operações administrativas
const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY!,
  {
    auth: {
      autoRefreshToken: false,
      persistSession: false
    }
  }
);

// Função para gerar hash de senha, movida para o lado do servidor
function generatePasswordHash(password: string): string {
  const salt = process.env.NEXT_PUBLIC_PASSWORD_SALT || 'heai-acai-salt-default';
  return createHash('sha256').update(password + salt).digest('hex');
}

// Endpoint para salvar/atualizar a senha do administrador
export async function POST(request: Request) {
  try {
    const { password, currentPassword } = await request.json();

    if (currentPassword !== undefined) { // Se currentPassword for passado, estamos atualizando
        const { data } = await supabaseAdmin
            .from('admin_settings')
            .select('value')
            .eq('key', 'admin_password')
            .single();

        if (!data || !data.value) {
            return NextResponse.json({ success: false, error: 'Nenhuma senha de administrador encontrada.' }, { status: 404 });
        }

        const isPasswordCorrect = generatePasswordHash(currentPassword) === data.value;
        if (!isPasswordCorrect) {
            return NextResponse.json({ success: false, error: 'Senha atual incorreta.' }, { status: 401 });
        }
    }

    const hashedPassword = generatePasswordHash(password);

    const { data: existingConfig, error: fetchError } = await supabaseAdmin
      .from('admin_settings')
      .select('*')
      .eq('key', 'admin_password')
      .single();

    if (fetchError && fetchError.code !== 'PGRST116') {
      return NextResponse.json({ success: false, error: fetchError.message }, { status: 500 });
    }

    let result;
    if (existingConfig) {
      result = await supabaseAdmin
        .from('admin_settings')
        .update({ value: hashedPassword, updated_at: new Date().toISOString() })
        .eq('key', 'admin_password');
    } else {
      result = await supabaseAdmin
        .from('admin_settings')
        .insert([{ key: 'admin_password', value: hashedPassword }]);
    }

    if (result.error) {
      return NextResponse.json({ success: false, error: result.error.message }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, error: error.message }, { status: 500 });
  }
}

// Endpoint para verificar a senha do administrador
export async function GET(request: Request) {
    try {
        const { searchParams } = new URL(request.url);
        const password = searchParams.get('password');

        if (password) { // Verificar uma senha específica
            const { data } = await supabaseAdmin
                .from('admin_settings')
                .select('value')
                .eq('key', 'admin_password')
                .single();

            if (!data || !data.value) {
                return NextResponse.json({ isValid: false });
            }

            const isValid = generatePasswordHash(password) === data.value;
            return NextResponse.json({ isValid });
        } else { // Verificar se alguma senha existe
            const { data, error } = await supabaseAdmin
                .from('admin_settings')
                .select('value')
                .eq('key', 'admin_password')
                .single();

            if (error && error.code !== 'PGRST116') {
                return NextResponse.json({ success: false, error: error.message }, { status: 500 });
            }

            const hasPassword = !!data && !!data.value;
            return NextResponse.json({ hasPassword });
        }
    } catch (error: any) {
        return NextResponse.json({ success: false, error: error.message }, { status: 500 });
    }
}