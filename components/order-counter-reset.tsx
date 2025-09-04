"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { toast } from "sonner"
import { RefreshCw } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog"

export default function OrderCounterReset() {
  const [isResetting, setIsResetting] = useState(false)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)
  const [showInfoMessage, setShowInfoMessage] = useState(false)

  // Função para abrir o diálogo de confirmação
  const openConfirmDialog = () => {
    setShowConfirmDialog(true)
  }

  // Função para fechar o diálogo de confirmação
  const closeConfirmDialog = () => {
    setShowConfirmDialog(false)
  }

  // Função para redefinir o contador de pedidos usando a API
  const resetOrderCounter = async () => {
    setIsResetting(true)
    closeConfirmDialog()

    try {
      toast.loading("Zerando contador de pedidos...")
      console.log("Iniciando processo de zerar contador de pedidos...")

      // Chamar a API que exclui todos os pedidos e reseta o contador
      console.log("Chamando API /api/admin/reset-order-counter...")
      const response = await fetch('/api/admin/reset-order-counter', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      })

      const result = await response.json()

      if (!response.ok || !result.success) {
        console.error("Erro na API de reset:", result)
        toast.dismiss()
        toast.error(`Erro ao zerar contador: ${result.error || 'Erro desconhecido'}`)
        setIsResetting(false)
        return
      }

      console.log("Reset executado com sucesso:", result)
      toast.dismiss()

      toast.success("Contador de pedidos zerado com sucesso!")
      toast.info("Todos os pedidos foram excluídos e o próximo pedido começará com o ID #1")

      // Resetar contador de novos pedidos antes de recarregar
      if (typeof window !== 'undefined') {
        // Disparar evento customizado para resetar o contador
        window.dispatchEvent(new CustomEvent('resetNewOrdersCount'));
      }
      
      // Recarregar a página após um breve intervalo
      setTimeout(() => {
        window.location.reload()
      }, 2000)
    } catch (error) {
      console.error("Erro inesperado:", {
        message: error instanceof Error ? error.message : 'Erro desconhecido',
        stack: error instanceof Error ? error.stack : undefined,
        fullError: error
      })
      toast.dismiss()
      toast.error(`Erro inesperado: ${error instanceof Error ? error.message : 'Erro desconhecido'}`)
    } finally {
      setIsResetting(false)
    }
  }

  return (
    <>
      <div className="w-full">
        <div className="flex flex-col items-end">
          <Button
            onClick={openConfirmDialog}
            disabled={isResetting}
            variant="destructive"
            className="flex items-center gap-2 bg-red-600 text-white hover:bg-red-700 w-full sm:w-auto justify-center sm:justify-start px-3 sm:px-4"
          >
            {isResetting ? (
              <>
                <RefreshCw className="h-4 w-4 animate-spin" />
                <span>Limpando histórico...</span>
              </>
            ) : (
              <>
                <RefreshCw className="h-4 w-4 flex-shrink-0" />
                <span className="whitespace-nowrap">
                  <span className="hidden sm:inline">Limpar Histórico de Pedidos</span>
                  <span className="sm:hidden">Limpar Histórico</span>
                </span>
              </>
            )}
          </Button>
          {showInfoMessage && (
            <p className="text-xs text-gray-500 mt-1 text-right w-full animate-fade-in">
              Isso redefinirá o contador para que o próximo pedido comece com o ID #1
            </p>
          )}
        </div>
      </div>

      {/* Diálogo de confirmação */}
      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="border-red-500 bg-red-50">
          <DialogHeader>
            <DialogTitle className="text-red-700">Atenção: Ação Irreversível!</DialogTitle>
            <DialogDescription className="text-gray-700">
              <span className="font-bold text-lg block mb-2">Você está prestes a excluir PERMANENTEMENTE todos os pedidos do sistema.</span>
              <span className="block">Esta ação não pode ser desfeita e resultará na perda de todo o histórico de vendas.</span>
              <span className="block mt-2">O contador de pedidos será reiniciado e o próximo pedido terá o ID #1.</span>
              <span className="font-bold block mt-4">Tem certeza absoluta que deseja continuar?</span>
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex flex-col sm:flex-row gap-2 mt-4">
            <Button
              variant="outline"
              onClick={closeConfirmDialog}
              className="sm:flex-1"
            >
              Cancelar
            </Button>
            <Button
              onClick={resetOrderCounter}
              disabled={isResetting}
              variant="destructive"
              className="bg-red-700 hover:bg-red-800 sm:flex-1"
            >
              {isResetting ? (
                <>
                  <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                  Excluindo Tudo...
                </>
              ) : (
                "Sim, excluir tudo"
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>

  )
}
