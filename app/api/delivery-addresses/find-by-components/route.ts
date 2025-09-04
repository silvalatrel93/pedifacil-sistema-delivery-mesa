import { NextResponse } from "next/server";

// Endpoint descontinuado: a busca de endereço por componentes foi removida do sistema.
export async function POST() {
  return NextResponse.json(
    {
      success: false,
      error: "Endpoint removido: a busca de endereço por rua/número/bairro foi descontinuada.",
      status: 410,
    },
    { status: 410 }
  );
}
