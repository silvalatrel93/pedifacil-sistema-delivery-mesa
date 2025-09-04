import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

function createAdminSupabaseClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const serviceRoleKey = process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || "";

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error("Variáveis de ambiente do Supabase não configuradas para admin");
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();

    // Validação explícita dos obrigatórios
    const missing: string[] = []
    if (typeof body.address !== 'string' || body.address.trim() === '') missing.push('address')
    if (typeof body.city !== 'string' || body.city.trim() === '') missing.push('city')
    if (body.delivery_fee === undefined || body.delivery_fee === null || Number.isNaN(Number(body.delivery_fee))) missing.push('delivery_fee')

    if (missing.length > 0) {
      return NextResponse.json(
        { success: false, error: `Parâmetro obrigatório ausente ou inválido: ${missing.join(', ')}` },
        { status: 400 }
      )
    }

    const payload = {
      address: String(body.address).trim(),
      number: body.number ? String(body.number).trim() : null,
      neighborhood: body.neighborhood ? String(body.neighborhood).trim() : null,
      city: String(body.city).trim(),
      delivery_fee: Number(body.delivery_fee),
      is_active: body.is_active ?? true,
      notes: body.notes ? String(body.notes).trim() : null,
    };

    const supabase = createAdminSupabaseClient();

    const { data, error } = await supabase
      .from("delivery_addresses")
      .insert([payload])
      .select()
      .single();

    if (error) {
      if ((error as any).code === "23505") {
        return NextResponse.json(
          { success: false, error: "Este endereço já existe" },
          { status: 409 }
        );
      }
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true, data });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
