"use client"

import React, { useState, useEffect, useRef, useCallback } from "react"
import Link from "next/link"
import { ArrowLeft, Users, Clock, RefreshCw, Check, X, Eye, Printer, QrCode, AlertCircle, Bell, BellOff, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { OrderService, subscribeToOrderChanges } from "@/lib/services/order-service"
import { TableService } from "@/lib/services/table-service"
import { updateOrderStatus, markOrderAsPrinted } from "@/lib/db"
import OrderLabelPrinter from "@/components/order-label-printer"
import { formatCurrency } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { ptBR } from "date-fns/locale"
import { useNotificationSound } from "@/hooks/useNotificationSound"
import type { Order, OrderStatus, Table } from "@/lib/types"

export default function PedidosMesaPage() {
  const [orders, setOrders] = useState<Order[]>([])
  const [tables, setTables] = useState<Table[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null)
  const [isDetailsModalOpen, setIsDetailsModalOpen] = useState(false)
  const [isSoundEnabled, setIsSoundEnabled] = useState(true)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [updatingStatus, setUpdatingStatus] = useState(false)
  const [filter, setFilter] = useState<'all' | 'pending' | 'ready' | 'completed'>('all')
  const [showNewOrderNotification, setShowNewOrderNotification] = useState(false)
  const [newOrdersCount, setNewOrdersCount] = useState(0)
  const [newOrdersData, setNewOrdersData] = useState<Order[]>([])
  const [showSoundActivationMessage, setShowSoundActivationMessage] = useState(false)
  const [selectedOrderForPrint, setSelectedOrderForPrint] = useState<Order | null>(null)
  const [isPrinterModalOpen, setIsPrinterModalOpen] = useState(false)
  
  // Estados para sistema de impressão automática
  const [printQueue, setPrintQueue] = useState<Order[]>([])
  const [currentPrintIndex, setCurrentPrintIndex] = useState(0)
  const [shouldAutoPrint, setShouldAutoPrint] = useState(false)

  const { playSound } = useNotificationSound()
  const prevOrdersRef = useRef<Order[]>([])
  const checkIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const notificationTimeoutRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  // Função para tocar o som de notificação específico para mesas
  const startTableSound = useCallback(() => {
    if (!isSoundEnabled) return;

    try {
      console.log('🔊 Iniciando reprodução do som de mesa...');

      // Criar um novo elemento de áudio se não existir
      if (!audioRef.current) {
        console.log('📱 Criando novo elemento de áudio para mesa...');
        audioRef.current = new Audio('/sounds/new-table-order.mp3');
        audioRef.current.volume = 0.8; // Volume um pouco mais alto para diferenciar
        audioRef.current.loop = true;
        audioRef.current.preload = 'auto';

        // Configurar eventos de erro
        audioRef.current.addEventListener('error', (e) => {
          console.error('❌ Erro ao carregar áudio de mesa:', e);
          console.error('❌ Detalhes do erro:', {
            error: e.error,
            src: audioRef.current?.src,
            networkState: audioRef.current?.networkState,
            readyState: audioRef.current?.readyState
          });
        });

        // Configurar evento de carregamento
        audioRef.current.addEventListener('canplaythrough', () => {
          console.log('✅ Áudio de mesa carregado com sucesso');
        });

        audioRef.current.addEventListener('loadstart', () => {
          console.log('🔄 Iniciando carregamento do som de mesa...');
        });

        audioRef.current.addEventListener('loadeddata', () => {
          console.log('📊 Dados do som de mesa carregados');
        });
      }

      // Função para reproduzir o som após interação do usuário
      const playSound = () => {
        console.log('🎵 Tentando reproduzir som após interação do usuário...');
        if (audioRef.current && isSoundEnabled) {
          audioRef.current.currentTime = 0; // Reiniciar do início
          audioRef.current.play().then(() => {
            console.log('✅ Som de mesa reproduzido com sucesso após interação');
          }).catch(err => {
            console.error('❌ Erro ao reproduzir som de mesa após interação:', err);
          });
          // Remover o listener após o primeiro clique
          document.removeEventListener('click', playSound);
          setShowSoundActivationMessage(false);
        }
      };

      console.log('🔍 Verificando estado do áudio:', {
        readyState: audioRef.current.readyState,
        networkState: audioRef.current.networkState,
        src: audioRef.current.src,
        volume: audioRef.current.volume,
        loop: audioRef.current.loop,
        isSoundEnabled
      });

      // Tentar reproduzir diretamente
      if (audioRef.current.readyState >= 2) { // HAVE_CURRENT_DATA
        console.log('🎯 Áudio pronto, tentando reproduzir automaticamente...');
        audioRef.current.currentTime = 0;
        audioRef.current.play().then(() => {
          console.log('✅ Som de mesa reproduzido automaticamente');
        }).catch(err => {
          console.log('⚠️ Reprodução automática bloqueada, aguardando interação do usuário...', err);
          setShowSoundActivationMessage(true);
          document.addEventListener('click', playSound, { once: true });
        });
      } else {
        console.log('⏳ Áudio ainda não está pronto, aguardando carregamento...');
        // Aguardar o carregamento do áudio
        audioRef.current.addEventListener('canplaythrough', () => {
          console.log('🎯 Áudio carregado, tentando reproduzir...');
          if (audioRef.current && isSoundEnabled) {
            audioRef.current.play().catch(err => {
              console.log('⚠️ Reprodução bloqueada após carregamento, aguardando interação...', err);
              setShowSoundActivationMessage(true);
              document.addEventListener('click', playSound, { once: true });
            });
          }
        }, { once: true });
      }
    } catch (err) {
      console.error('Erro ao configurar som de mesa:', err);
    }
  }, [isSoundEnabled, setShowSoundActivationMessage]);

  // Função para parar o som
  const stopTableSound = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setShowSoundActivationMessage(false);

    // Remover qualquer listener de clique pendente
    const removeClickListener = () => {
      if (audioRef.current) {
        audioRef.current.play().catch(() => { });
      }
    };
    document.removeEventListener('click', removeClickListener);
  }, [setShowSoundActivationMessage]);

  // Verificar autenticação
  useEffect(() => {
    const isAuthenticated = localStorage.getItem("admin_authenticated") === "true"
    if (!isAuthenticated) {
      window.location.href = "/admin/login"
      return
    }
  }, [])

  // Carregar dados iniciais
  useEffect(() => {
    loadInitialData()
  }, [])

  // Configurar real-time subscription e polling para verificar novos pedidos de mesa
  useEffect(() => {
    let isMounted = true;
    let isFetching = false;
    let realtimeSubscription: any = null;

    const loadAndProcessOrders = async (silent = true) => {
      if (isFetching) return;
      isFetching = true;

      try {
        if (isMounted) {
          await loadOrders(silent);
        }
      } finally {
        if (isMounted) {
          isFetching = false;
        }
      }
    };

    // Configurar subscrição real-time para pedidos de mesa
    try {
      realtimeSubscription = subscribeToOrderChanges(
        (payload) => {
          console.log('🔔 Mudança em pedido detectada via real-time (mesa):', payload);
          // Recarregar pedidos quando houver mudanças
          if (isMounted) {
            void loadAndProcessOrders(false); // Não silencioso para detectar novos pedidos
          }
        },
        (error) => {
          console.error('❌ Erro na subscrição real-time de pedidos de mesa:', error);
        }
      );
      console.log('✅ Subscrição real-time configurada para pedidos de mesa');
    } catch (error) {
      console.error('❌ Erro ao configurar subscrição real-time para pedidos de mesa:', error);
    }

    // Configurar polling a cada 30 segundos como fallback
    const pollingInterval = setInterval(() => {
      if (isMounted) {
        void loadAndProcessOrders(true);
      }
    }, 30000);

    checkIntervalRef.current = pollingInterval;

    // Limpar intervalo e subscrição ao desmontar
    return () => {
      isMounted = false;

      if (checkIntervalRef.current) {
        clearInterval(checkIntervalRef.current);
      }

      if (notificationTimeoutRef.current) {
        clearInterval(notificationTimeoutRef.current);
      }

      // Limpar subscrição real-time
      if (realtimeSubscription) {
        try {
          realtimeSubscription.unsubscribe();
          console.log('🔌 Subscrição real-time de pedidos de mesa desconectada');
        } catch (error) {
          console.error('❌ Erro ao desconectar subscrição real-time de pedidos de mesa:', error);
        }
      }

      // Parar o som ao desmontar
      stopTableSound();
    };
  }, [isSoundEnabled, startTableSound, stopTableSound]);

  const loadInitialData = async () => {
    setIsLoading(true)
    try {
      await Promise.all([
        loadOrders(),
        loadTables()
      ])
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
    } finally {
      setIsLoading(false)
    }
  }

  const loadOrders = async (silent = false) => {
    try {
      const tableOrders = await OrderService.getTableOrders()

      // Verificar se há novos pedidos comparando com a lista anterior
      const previousOrderIds = prevOrdersRef.current.map(order => order.id);
      const currentOrderIds = tableOrders.map(order => order.id);

      // Encontrar pedidos que são realmente novos (não existiam antes)
      const newOrderIds = currentOrderIds.filter(id => !previousOrderIds.includes(id));
      const newOrders = tableOrders.filter(order =>
        newOrderIds.includes(order.id) && order.status === "new"
      );

      // Se houver novos pedidos e não for carregamento silencioso
      if (newOrders.length > 0 && !silent) {
        try {
          // Marcar cada pedido como notificado no banco de dados
          await Promise.all(
            newOrders.map(order =>
              OrderService.markOrderAsNotified(order.id).catch(error => {
                console.error(`Erro ao marcar pedido de mesa ${order.id} como notificado:`, error);
                return false;
              })
            )
          );

          // Atualizar os pedidos localmente para refletir a mudança
          const updatedOrders = tableOrders.map(order =>
            newOrders.some(o => o.id === order.id)
              ? { ...order, notified: true }
              : order
          );

          // Tocar som e mostrar notificação para novos pedidos de mesa
          if (isSoundEnabled) {
            console.log(`🔔 Reproduzindo som para ${newOrders.length} novo(s) pedido(s) de mesa`);
            console.log('🎵 Estado do som:', { isSoundEnabled, hasAudioRef: !!audioRef.current });
            startTableSound();
          } else {
            console.log(`🔇 Som desabilitado - ${newOrders.length} novo(s) pedido(s) de mesa detectado(s)`);
          }

          // Definir contador exato de novos pedidos
          setNewOrdersCount(newOrders.length);

          // Armazenar dados dos novos pedidos para mostrar mesas específicas
          setNewOrdersData(newOrders);

          // Mostrar notificação
          setShowNewOrderNotification(true);

          // Atualizar a referência para os pedidos atuais
          prevOrdersRef.current = updatedOrders;
          setOrders(updatedOrders);

          console.log(`Novos pedidos de mesa detectados:`, newOrders.map(o => ({ id: o.id, table: o.tableId })));

        } catch (error) {
          console.error("Erro ao processar novos pedidos de mesa:", error);
          // Atualizar mesmo com erro
          prevOrdersRef.current = tableOrders;
          setOrders(tableOrders);
        }
      } else {
        // Se não houver novos pedidos, atualizar normalmente
        prevOrdersRef.current = tableOrders;
        setOrders(tableOrders);

        if (silent) {
          console.log(`Atualização silenciosa: ${tableOrders.length} pedidos carregados`);
        }
      }
    } catch (error) {
      console.error("Erro ao carregar pedidos de mesa:", error)
    }
  }

  const loadTables = async () => {
    try {
      const tablesData = await TableService.getAllTables()
      setTables(tablesData)
    } catch (error) {
      console.error("Erro ao carregar mesas:", error)
    }
  }



  const handleStatusChange = async (orderId: number, newStatus: OrderStatus) => {
    if (updatingStatus) return

    setUpdatingStatus(true)
    try {
      await updateOrderStatus(orderId, newStatus)
      await loadOrders()

      // Se estiver aceitando um pedido (mudando de 'new' para 'preparing'), parar o som E IMPRIMIR
      if (newStatus === 'preparing') {
        stopTableSound()

        // Verificar se não há mais pedidos novos para esconder a notificação
        const remainingNewOrders = orders.filter(order => order.id !== orderId && order.status === 'new')
        if (remainingNewOrders.length === 0) {
          setShowNewOrderNotification(false)
          setNewOrdersCount(0)
          setNewOrdersData([])
        }
        
        // IMPRESSÃO AUTOMÁTICA QUANDO ACEITAR PEDIDO
        const order = orders.find(o => o.id === orderId)
        if (order) {
          console.log(`Configurando impressão automática para o pedido #${orderId} após aceitar`)
          setPrintQueue([order])        // Fila com 1 item
          setCurrentPrintIndex(0)       // Índice inicial
          setSelectedOrderForPrint(order) // Pedido atual
          setIsPrinterModalOpen(true)   // Abrir modal
          setShouldAutoPrint(true)      // Ativar auto-print
          setCurrentPrintIndex(1)       // Próximo índice
        }
      }
    } catch (error) {
      console.error("Erro ao atualizar status:", error)
      alert("Erro ao atualizar status do pedido")
    } finally {
      setUpdatingStatus(false)
    }
  }

  const handleRefresh = async () => {
    setIsRefreshing(true)
    try {
      await loadOrders()
    } catch (error) {
      console.error("Erro ao atualizar pedidos:", error)
    } finally {
      setIsRefreshing(false)
    }
  }

  const handleDeleteOrder = async (orderId: string | number) => {
    if (!confirm('Tem certeza que deseja excluir este pedido? Esta ação não pode ser desfeita.')) {
      return
    }

    try {
      const orderIdNumber = typeof orderId === 'string' ? parseInt(orderId) : orderId
      const success = await OrderService.deleteOrder(orderIdNumber)

      if (success) {
        // Atualizar a lista de pedidos removendo o pedido deletado
        setOrders(prevOrders => prevOrders.filter(order => order.id !== orderIdNumber))

        // Se o pedido deletado estava sendo visualizado nos detalhes, fechar o modal
        if (selectedOrder?.id === orderIdNumber) {
          setIsDetailsModalOpen(false)
          setSelectedOrder(null)
        }
      } else {
        alert('Erro ao deletar pedido. Tente novamente.')
      }
    } catch (error) {
      console.error('Erro ao deletar pedido:', error)
      alert('Erro ao deletar pedido. Tente novamente.')
    }
  }

  const handlePrintLabel = (order: Order) => {
    setSelectedOrderForPrint(order)
    setIsPrinterModalOpen(true)
  }

  const handlePrintComplete = async () => {
    if (selectedOrderForPrint?.id) {
      try {
        await markOrderAsPrinted(selectedOrderForPrint.id)
        await loadOrders(true)
      } catch (error) {
        console.error("Erro ao marcar pedido como impresso:", error)
      }
    }
    
    // Resetar estado atual
    setIsPrinterModalOpen(false)
    setSelectedOrderForPrint(null)
    setShouldAutoPrint(false)
    
    // Processar próximo da fila
    setTimeout(() => {
      processNextPrintInQueue()
    }, 1000)
  }

  // Função para aceitar os novos pedidos
  const handleAcceptOrders = async () => {
    try {
      // Atualizar status de todos os pedidos novos para 'preparing'
      const newOrders = orders.filter(order => order.status === 'new')

      // Atualizar cada pedido novo
      for (const order of newOrders) {
        await updateOrderStatus(order.id, 'preparing')
      }

      // Recarregar a lista de pedidos para refletir as mudanças
      await loadOrders()

      // IMPRESSÃO AUTOMÁTICA DE TODOS OS PEDIDOS ACEITOS
      if (newOrders.length > 0) {
        console.log(`Configurando impressão automática para ${newOrders.length} pedidos aceitos em lote`)
        
        // Configurar fila de impressão com todos os pedidos aceitos
        setPrintQueue(newOrders)
        setCurrentPrintIndex(0)
        
        // Iniciar com o primeiro pedido
        setSelectedOrderForPrint(newOrders[0])
        setIsPrinterModalOpen(true)
        setShouldAutoPrint(true)
        setCurrentPrintIndex(1)
      }

    } catch (error) {
      console.error('Erro ao aceitar pedidos:', error)
      alert('Erro ao aceitar pedidos. Tente novamente.')
    }

    setShowNewOrderNotification(false)
    setNewOrdersCount(0)
    setNewOrdersData([])
    stopTableSound()

    // Scroll para a área dos pedidos
    const ordersSection = document.querySelector('[data-orders-section]')
    if (ordersSection) {
      ordersSection.scrollIntoView({ behavior: 'smooth', block: 'start' })
    } else {
      window.scrollTo({ top: 300, behavior: 'smooth' })
    }
  }

  // Função para processar próximo item da fila de impressão
  const processNextPrintInQueue = React.useCallback(() => {
    if (printQueue.length > 0 && currentPrintIndex < printQueue.length) {
      const nextOrder = printQueue[currentPrintIndex]
      
      // Configurar próximo pedido
      setSelectedOrderForPrint(nextOrder)
      setCurrentPrintIndex(prev => prev + 1)
      
      // Delay para evitar sobrecarga
      setTimeout(() => {
        setIsPrinterModalOpen(true)
        setShouldAutoPrint(true)
      }, 1000)
    } else {
      // Fila concluída
      handlePrintQueueComplete()
    }
  }, [printQueue, currentPrintIndex])

  // Função de conclusão da fila de impressão
  const handlePrintQueueComplete = React.useCallback(() => {
    const queueLength = printQueue.length
    
    // Resetar estados
    setPrintQueue([])
    setCurrentPrintIndex(0)
    setShouldAutoPrint(false)
    setIsPrinterModalOpen(false)
    setSelectedOrderForPrint(null)
    
    // Notificação de conclusão
    if (typeof window !== 'undefined' && queueLength > 1) {
      // Som de conclusão
      try {
        const audio = new Audio('/sounds/completion.mp3')
        audio.play().catch(() => {})
      } catch (error) {
        console.log('Erro ao reproduzir som de conclusão:', error)
      }
      
      // Alerta visual
      alert(`✅ Impressão concluída! ${queueLength} etiquetas foram processadas.`)
    }
  }, [printQueue.length])

  // Função para cancelar fila de impressão
  const handleCancelPrintQueue = React.useCallback(() => {
    if (confirm('Deseja cancelar a impressão dos pedidos restantes?')) {
      handlePrintQueueComplete()
    }
  }, [handlePrintQueueComplete])

  // Função para marcar múltiplos pedidos como entregues e imprimir
  const handleBulkDelivered = React.useCallback(async () => {
    const readyOrders = orders.filter(order => order.status === 'ready')
    
    if (readyOrders.length === 0) {
      alert('Nenhum pedido pronto encontrado para marcar como entregue.')
      return
    }

    if (!confirm(`Marcar ${readyOrders.length} pedido(s) como entregue e imprimir etiquetas?`)) {
      return
    }

    try {
      // Atualizar todos os pedidos
      await Promise.all(
        readyOrders.map(order => updateOrderStatus(order.id, 'delivered'))
      )
      
      await loadOrders(true)
      
      // Configurar fila de impressão para múltiplos pedidos
      setTimeout(() => {
        setPrintQueue(readyOrders)
        setCurrentPrintIndex(0)
        setSelectedOrderForPrint(readyOrders[0])
        setIsPrinterModalOpen(true)
        setShouldAutoPrint(true)
        setCurrentPrintIndex(1)
      }, 500)
      
    } catch (error) {
      console.error('Erro ao atualizar pedidos:', error)
      alert('Erro ao atualizar pedidos. Tente novamente.')
    }
  }, [orders, loadOrders])

  const handleViewDetails = (order: Order) => {
    setSelectedOrder(order)
    setIsDetailsModalOpen(true)
  }

  const getTableName = (tableId?: number) => {
    if (!tableId) return "Mesa não identificada"
    const table = tables.find(t => t.id === tableId)
    return table ? table.name : `Mesa ${tableId}`
  }

  const getOrdersByStatus = (status: OrderStatus) => {
    return orders.filter(order => order.status === status)
  }

  const getFilteredOrders = () => {
    if (filter === 'all') return orders
    if (filter === 'pending') return orders.filter(order =>
      ['new', 'pending', 'preparing'].includes(order.status)
    )
    if (filter === 'ready') return orders.filter(order => order.status === 'ready')
    if (filter === 'completed') return orders.filter(order =>
      ['delivered', 'completed'].includes(order.status)
    )
    return orders
  }

  const getStatusColor = (status: OrderStatus) => {
    switch (status) {
      case 'new': return 'bg-yellow-100 text-yellow-800 border-yellow-200'
      case 'preparing': return 'bg-blue-100 text-blue-800 border-blue-200'
      case 'delivering': return 'bg-purple-100 text-purple-800 border-purple-200'
      case 'ready': return 'bg-green-100 text-green-800 border-green-200'
      case 'delivered': return 'bg-green-100 text-green-800 border-green-200'
      case 'completed': return 'bg-gray-100 text-gray-800 border-gray-200'
      case 'cancelled': return 'bg-red-100 text-red-800 border-red-200'
      default: return 'bg-gray-100 text-gray-800 border-gray-200'
    }
  }

  const getStatusText = (status: OrderStatus) => {
    switch (status) {
      case 'new': return 'Novo'
      case 'pending': return 'Pendente'
      case 'pending_payment': return 'Pago'
      case 'preparing': return 'Preparando'
      case 'ready': return 'Pronto'
      case 'delivered': return 'Entregue'
      case 'completed': return 'Concluído'
      case 'cancelled': return 'Cancelado'
      default: return status
    }
  }

  // Formatar número de telefone
  const formatPhoneNumber = (phone: string): string => {
    if (!phone) return ''

    // Remove todos os caracteres não numéricos
    const numbers = phone.replace(/\D/g, '')

    // Formata conforme o padrão brasileiro
    if (numbers.length === 11) {
      return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 7)}-${numbers.substring(7)}`
    } else if (numbers.length === 10) {
      return `(${numbers.substring(0, 2)}) ${numbers.substring(2, 6)}-${numbers.substring(6)}`
    }

    return phone
  }

  const formatPaymentMethod = (method: string) => {
    switch (method) {
      case 'pix': return 'PIX'
      case 'money': return 'Dinheiro'
      case 'card': return 'Cartão'
      default: return 'Outros'
    }
  }

  const getCardBackgroundColor = (status: OrderStatus) => {
    switch (status) {
      case 'new': return 'bg-yellow-50 border-yellow-200'
      case 'preparing': return 'bg-blue-50 border-blue-200'
      case 'delivering': return 'bg-purple-50 border-purple-200'
      case 'ready': return 'bg-green-50 border-green-200'
      case 'delivered': return 'bg-green-50 border-green-200'
      case 'completed': return 'bg-gray-50 border-gray-200'
      case 'cancelled': return 'bg-red-50 border-red-200'
      default: return 'bg-white border-gray-200'
    }
  }

  const renderOrderCard = (order: Order) => (
    <Card key={order.id} className={`mb-4 ${getCardBackgroundColor(order.status)}`}>
      <CardHeader className="pb-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center space-x-3 min-w-0 flex-1">
            <div className="bg-purple-100 p-2 rounded-full flex-shrink-0">
              <Users className="w-4 h-4 sm:w-5 sm:h-5 text-purple-600" />
            </div>
            <div className="min-w-0 flex-1">
              <CardTitle className="text-base sm:text-lg truncate">
                {getTableName(order.tableId)}
              </CardTitle>
              <p className="text-xs sm:text-sm text-gray-600 truncate">
                Pedido #{order.id} • {order.customerName}
              </p>
            </div>
          </div>
          <div className="flex items-center space-x-2 flex-shrink-0">
            <Badge className={`${getStatusColor(order.status)} ${order.status === 'new' ? 'flash-animation' : ''} text-xs`}>
              {getStatusText(order.status)}
            </Badge>
            {order.printed && (
              <Badge className="bg-gray-100 text-gray-800 text-xs">
                Impresso
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2 text-sm">
          <div className="flex items-center justify-between sm:flex-col sm:items-start">
            <span className="text-gray-600">Total:</span>
            <span className="font-semibold text-base sm:text-lg">{formatCurrency(order.total)}</span>
          </div>

          <div className="flex items-center justify-between sm:flex-col sm:items-start">
            <span className="text-gray-600">Há:</span>
            <span className="text-xs sm:text-sm">{formatDistanceToNow(order.date, { locale: ptBR })}</span>
          </div>

          <div className="flex items-center justify-between sm:flex-col sm:items-start">
            <span className="text-gray-600">Pagamento:</span>
            <span className="capitalize text-xs sm:text-sm">{formatPaymentMethod(order.paymentMethod)}</span>
          </div>
        </div>

        <div className="space-y-2 mt-4">
          {/* Primeira linha: Botões de ação secundária */}
          <div className="flex gap-2">
            <Button
              onClick={() => handleViewDetails(order)}
              variant="outline"
              size="sm"
              className="flex-1 text-xs sm:text-sm"
            >
              <Eye className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              <span className="hidden sm:inline">Detalhes</span>
              <span className="sm:hidden">Ver</span>
            </Button>

            <Button
              onClick={() => handlePrintLabel(order)}
              variant="outline"
              size="sm"
              className={`${order.printed ? 'bg-gray-50 text-gray-500' : 'bg-blue-50 hover:bg-blue-100 text-blue-600 border-blue-200 hover:border-blue-300'} px-2 sm:px-3`}
              title={order.printed ? "Já impresso" : "Imprimir etiqueta"}
            >
              <Printer className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>

            <Button
              onClick={() => handleDeleteOrder(order.id)}
              variant="outline"
              size="sm"
              className="bg-red-50 hover:bg-red-100 text-red-600 border-red-200 hover:border-red-300 px-2 sm:px-3"
              title="Excluir pedido"
            >
              <Trash2 className="w-3 h-3 sm:w-4 sm:h-4" />
            </Button>
          </div>

          {/* Segunda linha: Botão de status principal */}
          {order.status === 'new' && (
            <Button
              onClick={() => handleStatusChange(order.id, 'preparing')}
              disabled={updatingStatus}
              size="sm"
              className="w-full bg-white text-green-600 hover:bg-green-50 border border-green-600 hover:border-green-700 blink-green-animation text-sm py-2 font-bold"
            >
              <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Aceitar
            </Button>
          )}

          {order.status === 'preparing' && (
            <Button
              onClick={() => handleStatusChange(order.id, 'ready')}
              disabled={updatingStatus}
              size="sm"
              className="w-full bg-green-600 hover:bg-green-700 text-sm py-2"
            >
              <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Pronto
            </Button>
          )}

          {order.status === 'ready' && (
            <Button
              onClick={() => handleStatusChange(order.id, 'delivered')}
              disabled={updatingStatus}
              size="sm"
              className="w-full bg-purple-600 hover:bg-purple-700 text-sm py-2"
            >
              <Check className="w-3 h-3 sm:w-4 sm:h-4 mr-1 sm:mr-2" />
              Entregue
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="bg-purple-900 text-white p-4 sticky top-0 z-10">
          <div className="container mx-auto flex items-center">
            <Link href="/admin" className="mr-4">
              <ArrowLeft size={24} />
            </Link>
            <div className="flex items-center">
              <Users size={20} className="text-white/90 mr-2" />
              <h1 className="text-xl font-bold">Pedidos das Mesas</h1>
            </div>
          </div>
        </header>
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700"></div>
        </div>
      </div>
    )
  }

  return (
    <>
      <style jsx global>{`
        @keyframes blink {
          0%, 50% { 
            opacity: 1; 
            background-color: rgb(34 197 94); /* green-600 */
          }
          51%, 100% { 
            opacity: 0.8; 
            background-color: rgb(21 128 61); /* green-700 */
          }
        }
        
        @keyframes flash {
          0%, 50% { 
            opacity: 1; 
          }
          51%, 100% { 
            opacity: 0.4; 
          }
        }
        
        @keyframes pulse-button {
          0%, 50% { 
            opacity: 1;
            transform: scale(1);
          }
          51%, 100% { 
            opacity: 0.8;
            transform: scale(1.02);
          }
        }
        
        @keyframes blink-green {
          0%, 50% { 
            background-color: white;
            color: rgb(34 197 94); /* green-600 */
            border-color: rgb(34 197 94);
          }
          51%, 100% { 
            background-color: rgb(34 197 94); /* green-600 */
            color: white;
            border-color: rgb(34 197 94);
          }
        }
        
        .flash-animation {
          animation: flash 1.5s ease-in-out infinite;
        }
        
        .pulse-button-animation {
          animation: pulse-button 1.2s ease-in-out infinite;
        }
        
        .blink-green-animation {
          animation: blink-green 1s ease-in-out infinite;
        }
      `}</style>

      <div className="min-h-screen bg-gray-50">
        <header className="bg-gradient-to-r from-purple-700 via-purple-800 to-purple-900 text-white p-3 sm:p-4 sticky top-0 z-10 shadow-lg">
          <div className="container mx-auto">
            {/* Header principal */}
            <div className="flex items-center justify-between mb-2 sm:mb-0">
              <div className="flex items-center">
                <Link href="/admin" className="mr-2 sm:mr-4 hover:bg-white/10 p-1.5 sm:p-2 rounded-lg transition-colors">
                  <ArrowLeft size={20} className="sm:w-6 sm:h-6" />
                </Link>
                <div className="flex items-center">
                  <Users size={16} className="text-white/90 mr-1 sm:mr-2 sm:w-5 sm:h-5" />
                  <h1 className="text-lg sm:text-xl font-bold">Pedidos das Mesas</h1>
                </div>
              </div>
              {/* Botões de controle - ocultos em mobile, mostrados em tablet+ */}
              <div className="hidden sm:flex items-center space-x-2">
                <Button
                  onClick={() => {
                    const newSoundState = !isSoundEnabled;
                    setIsSoundEnabled(newSoundState);

                    // Se estiver ativando o som, testar reprodução
                    if (newSoundState) {
                      // Parar qualquer som atual
                      stopTableSound();

                      // Testar o som após um pequeno delay
                      setTimeout(() => {
                        if (audioRef.current) {
                          audioRef.current.currentTime = 0;
                          audioRef.current.play().then(() => {
                            console.log('Teste de som executado com sucesso');
                            // Parar o som de teste após 2 segundos
                            setTimeout(() => {
                              if (audioRef.current) {
                                audioRef.current.pause();
                                audioRef.current.currentTime = 0;
                              }
                            }, 2000);
                          }).catch(err => {
                            console.log('Som requer interação do usuário');
                            setShowSoundActivationMessage(true);
                          });
                        }
                      }, 100);
                    } else {
                      // Se estiver desativando, parar qualquer som
                      stopTableSound();
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className={`${isSoundEnabled
                    ? 'bg-green-500/20 hover:bg-green-500/30 text-green-100 border-green-400/30'
                    : 'bg-red-500/20 hover:bg-red-500/30 text-red-100 border-red-400/30'
                    } transition-all duration-200`}
                  title={isSoundEnabled ? "Som ativado - Clique para testar/desativar" : "Som desativado - Clique para ativar"}
                >
                  {isSoundEnabled ? (
                    <div className="flex items-center space-x-1">
                      <Bell className="w-4 h-4" />
                      <span className="text-xs">ON</span>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-1">
                      <BellOff className="w-4 h-4" />
                      <span className="text-xs">OFF</span>
                    </div>
                  )}
                </Button>
                <Button
                  onClick={() => {
                    console.log('🧪 Teste manual do som iniciado...');
                    if (audioRef.current) {
                      console.log('🔍 Estado atual do áudio:', {
                        readyState: audioRef.current.readyState,
                        networkState: audioRef.current.networkState,
                        src: audioRef.current.src,
                        volume: audioRef.current.volume,
                        paused: audioRef.current.paused,
                        currentTime: audioRef.current.currentTime
                      });
                      audioRef.current.currentTime = 0;
                      audioRef.current.play().then(() => {
                        console.log('✅ Teste manual: Som reproduzido com sucesso');
                        setTimeout(() => {
                          if (audioRef.current) {
                            audioRef.current.pause();
                            audioRef.current.currentTime = 0;
                            console.log('⏹️ Teste manual: Som parado');
                          }
                        }, 3000);
                      }).catch(err => {
                        console.error('❌ Teste manual: Erro ao reproduzir som:', err);
                      });
                    } else {
                      console.log('❌ Teste manual: audioRef.current é null');
                      startTableSound();
                    }
                  }}
                  variant="outline"
                  size="sm"
                  className="bg-blue-500/20 hover:bg-blue-500/30 text-blue-100 border-blue-400/30 hidden sm:inline-flex"
                  title="Teste manual do som"
                >
                  <span className="hidden md:inline">Teste Som</span>
                  <span className="md:hidden">Teste</span>
                </Button>
                <Button
                  onClick={handleRefresh}
                  disabled={isRefreshing}
                  variant="outline"
                  size="sm"
                  className="bg-white/10 hover:bg-white/20 text-white border-white/20"
                >
                  <RefreshCw className={`w-4 h-4 ${isRefreshing ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>

            {/* Botões de controle mobile */}
            <div className="flex sm:hidden items-center justify-center space-x-2 mt-2">
              <Button
                onClick={() => {
                  const newSoundState = !isSoundEnabled;
                  setIsSoundEnabled(newSoundState);

                  if (newSoundState) {
                    stopTableSound();
                    setTimeout(() => {
                      if (audioRef.current) {
                        audioRef.current.currentTime = 0;
                        audioRef.current.play().then(() => {
                          console.log('Teste de som executado com sucesso');
                          setTimeout(() => {
                            if (audioRef.current) {
                              audioRef.current.pause();
                              audioRef.current.currentTime = 0;
                            }
                          }, 2000);
                        }).catch(err => {
                          console.log('Som requer interação do usuário');
                          setShowSoundActivationMessage(true);
                        });
                      }
                    }, 100);
                  } else {
                    stopTableSound();
                  }
                }}
                variant="outline"
                size="sm"
                className={`${isSoundEnabled
                  ? 'bg-green-500/20 hover:bg-green-500/30 text-green-100 border-green-400/30'
                  : 'bg-red-500/20 hover:bg-red-500/30 text-red-100 border-red-400/30'
                  } transition-all duration-200 flex-1`}
              >
                {isSoundEnabled ? (
                  <div className="flex items-center space-x-1">
                    <Bell className="w-4 h-4" />
                    <span className="text-xs">ON</span>
                  </div>
                ) : (
                  <div className="flex items-center space-x-1">
                    <BellOff className="w-4 h-4" />
                    <span className="text-xs">OFF</span>
                  </div>
                )}
              </Button>
              <Button
                onClick={handleRefresh}
                disabled={isRefreshing}
                variant="outline"
                size="sm"
                className="bg-white/10 hover:bg-white/20 text-white border-white/20 flex-1"
              >
                <RefreshCw className={`w-4 h-4 mr-1 ${isRefreshing ? 'animate-spin' : ''}`} />
                <span className="text-xs">Atualizar</span>
              </Button>
            </div>
          </div>
        </header>

        {/* Notificação de novos pedidos de mesa com efeito piscante */}
        {showNewOrderNotification && (
          <div className="bg-green-600 text-white p-4 shadow-lg" style={{
            animation: 'blink 1s linear infinite'
          }}>
            <div className="container mx-auto">
              <div className="flex flex-col items-center space-y-3">
                <div className="text-center">
                  <p className="font-bold text-lg">
                    {newOrdersCount} novo{newOrdersCount > 1 ? 's' : ''} pedido{newOrdersCount > 1 ? 's' : ''}!
                  </p>
                  <div className="flex flex-wrap justify-center gap-2 mt-2">
                    {newOrdersData.map((order, index) => (
                      <span key={order.id} className="bg-white/20 px-3 py-1 rounded-full text-sm font-semibold">
                        {getTableName(order.tableId) || `Mesa ${order.tableId || 'N/A'}`}
                      </span>
                    ))}
                  </div>
                </div>

                <Button
                  onClick={handleAcceptOrders}
                  size="lg"
                  className="bg-white text-green-600 hover:bg-green-50 font-bold px-8 py-3 text-lg rounded-lg shadow-lg transform hover:scale-105 transition-all duration-200 animate-bounce"
                  style={{
                    boxShadow: '0 0 20px rgba(255, 255, 255, 0.8)'
                  }}
                >
                  ACEITAR PEDIDO{newOrdersCount > 1 ? 'S' : ''}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Mensagem de ativação de som */}
        {showSoundActivationMessage && (
          <div className="bg-blue-600 text-white p-4 shadow-lg">
            <div className="container mx-auto flex items-center justify-center">
              <div className="text-center">
                <p className="font-bold">🔊 Clique em qualquer lugar para ativar o som de notificações</p>
                <p className="text-sm opacity-90">
                  Necessário para reproduzir sons de novos pedidos de mesa
                </p>
                <Button
                  onClick={() => {
                    if (audioRef.current) {
                      audioRef.current.play().then(() => {
                        setShowSoundActivationMessage(false);
                        console.log('Som ativado manualmente');
                      }).catch(err => {
                        console.error('Erro ao ativar som:', err);
                      });
                    }
                  }}
                  className="mt-2 bg-white text-blue-600 hover:bg-blue-50"
                  size="sm"
                >
                  Ativar Som Agora
                </Button>
              </div>
            </div>
          </div>
        )}

        <div className="container mx-auto p-4">
          {/* Estatísticas */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-yellow-600">
                    {getOrdersByStatus('new').length}
                  </p>
                  <p className="text-sm text-gray-600">Novos</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-orange-600">
                    {getOrdersByStatus('preparing').length}
                  </p>
                  <p className="text-sm text-gray-600">Preparando</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {getOrdersByStatus('ready').length}
                  </p>
                  <p className="text-sm text-gray-600">Prontos</p>
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardContent className="p-4">
                <div className="text-center">
                  <p className="text-2xl font-bold text-gray-600">
                    {orders.length}
                  </p>
                  <p className="text-sm text-gray-600">Total</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filtros */}
          <div className="flex flex-wrap gap-2 mb-6" data-orders-section>
            <Button
              onClick={() => setFilter('all')}
              variant={filter === 'all' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 sm:flex-none min-w-0"
            >
              Todos
            </Button>
            <Button
              onClick={() => setFilter('pending')}
              variant={filter === 'pending' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 sm:flex-none min-w-0"
            >
              Pendentes
            </Button>
            <Button
              onClick={() => setFilter('ready')}
              variant={filter === 'ready' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 sm:flex-none min-w-0"
            >
              Prontos
            </Button>
            <Button
              onClick={() => setFilter('completed')}
              variant={filter === 'completed' ? 'default' : 'outline'}
              size="sm"
              className="flex-1 sm:flex-none min-w-0"
            >
              Concluídos
            </Button>
          </div>

          {/* Lista de Pedidos */}
          {getFilteredOrders().length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <QrCode className="h-16 w-16 mx-auto text-gray-400 mb-4" />
                <p className="text-gray-500 text-lg">
                  {filter === 'all'
                    ? "Nenhum pedido de mesa encontrado"
                    : `Nenhum pedido ${filter === 'pending' ? 'pendente' : filter === 'ready' ? 'pronto' : 'concluído'} encontrado`
                  }
                </p>
                <p className="text-gray-400 text-sm mt-2">
                  Os pedidos feitos através dos QR codes das mesas aparecerão aqui
                </p>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {getFilteredOrders().map(renderOrderCard)}
            </div>
          )}
        </div>

        {/* Modal de Impressão */}
        {isPrinterModalOpen && selectedOrderForPrint && (
          <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-auto">
              <div className="p-4 border-b">
                <h2 className="text-lg font-semibold text-purple-900">Imprimir Etiqueta</h2>
                
                {/* Indicador de progresso para múltiplos pedidos */}
                {printQueue.length > 1 && (
                  <div className="mt-3 p-3 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-medium text-blue-800">
                        Imprimindo {currentPrintIndex} de {printQueue.length} pedidos
                      </span>
                      <button
                        onClick={handleCancelPrintQueue}
                        className="text-xs px-2 py-1 bg-red-100 text-red-600 rounded hover:bg-red-200"
                      >
                        Cancelar Fila
                      </button>
                    </div>
                    
                    {/* Barra de progresso */}
                    <div className="w-full bg-blue-200 rounded-full h-2">
                      <div
                        className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                        style={{ width: `${(currentPrintIndex / printQueue.length) * 100}%` }}
                      />
                    </div>
                  </div>
                )}
              </div>

              <div className="p-4">
                <OrderLabelPrinter 
                  order={selectedOrderForPrint} 
                  onPrintComplete={handlePrintComplete}
                  autoPrint={shouldAutoPrint}
                />
              </div>

              <div className="p-4 border-t flex justify-between">
                {printQueue.length > 1 && (
                  <button
                    onClick={handleCancelPrintQueue}
                    className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 mr-2"
                  >
                    Cancelar Fila ({printQueue.length - currentPrintIndex} restantes)
                  </button>
                )}
                <button
                  onClick={() => {
                    setIsPrinterModalOpen(false)
                    setShouldAutoPrint(false)
                    if (printQueue.length <= 1) {
                      setPrintQueue([])
                      setCurrentPrintIndex(0)
                      setSelectedOrderForPrint(null)
                    }
                  }}
                  className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 ml-auto"
                >
                  Fechar
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Modal de Detalhes */}
        <Dialog open={isDetailsModalOpen} onOpenChange={setIsDetailsModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto w-[95vw] sm:w-full">
            <DialogHeader>
              <DialogTitle className="text-base sm:text-lg">
                Detalhes do Pedido #{selectedOrder?.id}
              </DialogTitle>
              <DialogDescription className="sr-only">
                Modal com informações detalhadas do pedido selecionado
              </DialogDescription>
            </DialogHeader>

            {selectedOrder && (
              <div className="space-y-4 sm:space-y-6 pb-4">
                {/* Informações básicas */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4">
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Mesa</p>
                    <p className="text-base sm:text-lg font-bold">{getTableName(selectedOrder.tableId)}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Data/Hora</p>
                    <p className="text-xs sm:text-sm">{new Date(selectedOrder.date).toLocaleString('pt-BR')}</p>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Status</p>
                    <Badge className={getStatusColor(selectedOrder.status)}>
                      {getStatusText(selectedOrder.status)}
                    </Badge>
                  </div>
                  <div>
                    <p className="text-xs sm:text-sm font-medium text-gray-600">Total</p>
                    <p className="text-base sm:text-lg font-bold">{formatCurrency(selectedOrder.total)}</p>
                  </div>
                </div>

                {/* Informações do cliente */}
                <div className="border-t pt-3 sm:pt-4">
                  <h4 className="font-medium text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3">Cliente</h4>
                  <div className="space-y-2">
                    <p className="font-medium text-base sm:text-lg">{selectedOrder.customerName}</p>
                    {selectedOrder.customerPhone && (
                      <div className="flex items-center text-xs sm:text-sm text-gray-600">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 sm:h-4 sm:w-4 mr-2" viewBox="0 0 20 20" fill="currentColor">
                          <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                        </svg>
                        <span className="font-medium mr-2">Telefone:</span>
                        <span>{formatPhoneNumber(selectedOrder.customerPhone)}</span>
                      </div>
                    )}
                    {selectedOrder.customerPhone && (
                      <div className="flex flex-col sm:flex-row gap-2 mt-2">
                        <a
                          href={`tel:${selectedOrder.customerPhone}`}
                          className="text-xs flex items-center justify-center text-blue-600 hover:text-blue-800 bg-blue-50 px-3 py-2 rounded flex-1 sm:flex-none"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 20 20" fill="currentColor">
                            <path d="M2 3a1 1 0 011-1h2.153a1 1 0 01.986.836l.74 4.435a1 1 0 01-.54 1.06l-1.548.773a11.037 11.037 0 006.105 6.105l.774-1.548a1 1 0 011.059-.54l4.435.74a1 1 0 01.836.986V17a1 1 0 01-1 1h-2C7.82 18 2 12.18 2 5V3z" />
                          </svg>
                          Ligar
                        </a>
                        <a
                          href={`https://wa.me/55${selectedOrder.customerPhone.replace(/\D/g, '')}`}
                          className="text-xs flex items-center justify-center text-green-600 hover:text-green-800 bg-green-50 px-3 py-2 rounded flex-1 sm:flex-none"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3 mr-1" viewBox="0 0 448 512" fill="currentColor">
                            <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L0 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7.9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z" />
                          </svg>
                          WhatsApp
                        </a>
                      </div>
                    )}
                  </div>
                </div>

                {/* Itens do pedido */}
                <div className="border-t pt-3 sm:pt-4">
                  <h4 className="font-medium text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3">Itens do Pedido</h4>
                  <ul className="space-y-3 sm:space-y-4">
                    {selectedOrder.items.map((item, index) => (
                      <li key={index} className="border-b pb-2 sm:pb-3 last:border-b-0">
                        <div className="flex flex-col sm:flex-row sm:justify-between gap-1">
                          <span className="font-medium text-sm sm:text-base">
                            {item.quantity}x {item.name} <span className="text-xs sm:text-sm text-gray-600">({item.size})</span>
                          </span>
                          <span className="text-right sm:text-left font-medium text-sm sm:text-base">{formatCurrency(item.price * item.quantity)}</span>
                        </div>

                        {item.additionals && item.additionals.length > 0 && (
                          <div className="mt-2">
                            <p className="text-sm text-purple-700 italic font-medium">Adicionais Complementos:</p>
                            <ul className="pl-4 space-y-1 mt-1">
                              {item.additionals.map((additional, idx) => (
                                <li key={idx} className="text-sm flex flex-col sm:flex-row sm:justify-between">
                                  <span>
                                    • {additional.quantity || 1}x {additional.name}
                                  </span>
                                  <span className="pl-4 sm:pl-0 text-right sm:text-left">
                                    {additional.price > 0 ? formatCurrency(additional.price * (additional.quantity || 1)) :
                                      <span className="text-green-600 font-medium">Grátis</span>}
                                  </span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}

                        {/* Informação sobre colher */}
                        {item.needsSpoon === true && (
                          <div className="mt-2 bg-green-50 border-green-400 border-l-4 p-2 rounded-r-md">
                            <div className="flex items-start">
                              <span className="inline-block w-2.5 h-2.5 bg-gradient-to-r from-green-400 to-green-600 rounded-full mr-1.5 mt-0.5 flex-shrink-0"></span>
                              <div className="text-sm">
                                <span className="font-semibold text-green-800">
                                  Precisa de colher: {item.spoonQuantity && item.spoonQuantity > 1 ?
                                    `Sim (${item.spoonQuantity} colheres)` :
                                    'Sim (1 colher)'
                                  }
                                </span>
                              </div>
                            </div>
                          </div>
                        )}
                        {item.needsSpoon === false && (
                          <div className="mt-2 bg-red-50 border-red-400 border-l-4 p-2 rounded-r-md">
                            <div className="flex items-start">
                              <span className="inline-block w-2.5 h-2.5 bg-gradient-to-r from-red-400 to-red-600 rounded-full mr-1.5 mt-0.5 flex-shrink-0"></span>
                              <div className="text-sm">
                                <span className="font-semibold text-red-800">
                                  Não precisa de colher
                                </span>
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Observações do cliente */}
                        {item.notes && item.notes.trim() !== "" && (
                          <div className="mt-2 bg-yellow-50 border-l-4 border-yellow-400 p-2 rounded-r-md">
                            <div className="flex items-start">
                              <span className="inline-block w-2.5 h-2.5 bg-gradient-to-r from-yellow-400 to-yellow-600 rounded-full mr-1.5 mt-1 flex-shrink-0"></span>
                              <div className="text-sm">
                                <span className="font-semibold text-yellow-800">Observação:</span>
                                <span className="text-yellow-700 ml-1">{item.notes}</span>
                              </div>
                            </div>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Informações de pagamento */}
                <div className="border-t pt-3 sm:pt-4">
                  <h4 className="font-medium text-xs sm:text-sm text-gray-700 mb-2 sm:mb-3">Pagamento</h4>
                  <div className="space-y-2">
                    <div className="grid grid-cols-2 gap-2">
                      <span className="text-gray-700 text-xs sm:text-sm">Método:</span>
                      <span className="text-right font-medium text-xs sm:text-sm">{selectedOrder.paymentMethod}</span>

                      <span className="text-gray-700 text-xs sm:text-sm">Subtotal:</span>
                      <span className="text-right font-medium text-xs sm:text-sm">{formatCurrency(selectedOrder.subtotal)}</span>

                      {selectedOrder.paymentChange && parseFloat(selectedOrder.paymentChange) > 0 && (
                        <>
                          <span className="text-gray-700 text-xs sm:text-sm">Pago com:</span>
                          <span className="text-right font-medium text-xs sm:text-sm">
                            {formatCurrency(parseFloat(selectedOrder.paymentChange))}
                          </span>
                          <span className="text-green-700 font-semibold text-xs sm:text-sm">Troco:</span>
                          <span className="text-right text-green-700 font-semibold text-xs sm:text-sm">
                            {formatCurrency(Math.round((parseFloat(selectedOrder.paymentChange) - selectedOrder.total) * 100) / 100)}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                </div>

                <div className="flex justify-between items-center pt-3 sm:pt-4 border-t">
                  <p className="text-base sm:text-lg font-bold">Total</p>
                  <p className="text-base sm:text-lg font-bold">{formatCurrency(selectedOrder.total)}</p>
                </div>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </>
  )
}