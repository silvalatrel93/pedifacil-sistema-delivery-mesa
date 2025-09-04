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
    const { id } = await req.json();

    if (!id) {
      return NextResponse.json(
        { success: false, error: "Parâmetro obrigatório: id" },
        { status: 400 }
      );
    }

    const supabase = createAdminSupabaseClient();

    const { error } = await supabase
      .from("orders")
      .update({ notified: true })
      .eq("id", id);

    if (error) {
      return NextResponse.json(
        { success: false, error: error.message },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { success: false, error: err instanceof Error ? err.message : String(err) },
      { status: 500 }
    );
  }
}
