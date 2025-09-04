import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"

export async function POST(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || ""
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_SERVICE_ROLE_KEY || ""

    if (!supabaseUrl || !serviceRoleKey) {
      return NextResponse.json({ error: "Supabase credentials not configured" }, { status: 500 })
    }

    const productId = Number(params.id)
    if (!Number.isFinite(productId)) {
      return NextResponse.json({ error: "Invalid product id" }, { status: 400 })
    }

    const body = await req.json().catch(() => ({}))
    const { hidden } = body as { hidden?: boolean }

    const admin = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    })

    let newHidden: boolean

    if (typeof hidden === "boolean") {
      newHidden = hidden
    } else {
      // Se não veio explicitamente, buscar e alternar
      const { data: current, error: fetchError } = await admin
        .from("products")
        .select("hidden_from_table")
        .eq("id", productId)
        .single()

      if (fetchError) {
        return NextResponse.json({ error: fetchError.message }, { status: 500 })
      }
      newHidden = !(current as { hidden_from_table: boolean }).hidden_from_table
    }

    const { error } = await admin
      .from("products")
      .update({ hidden_from_table: newHidden })
      .eq("id", productId)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, hidden: newHidden })
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || String(e) }, { status: 500 })
  }
}
