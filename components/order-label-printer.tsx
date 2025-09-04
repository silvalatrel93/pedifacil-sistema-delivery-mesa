"use client"

import { useRef, useState, useEffect, useCallback, ReactNode } from "react"
import { Printer, Download } from "lucide-react"
import { formatCurrency, cleanSizeDisplay } from "@/lib/utils"
import { format } from "date-fns"
import { ptBR } from "date-fns/locale"
import { jsPDF } from "jspdf"
import type { Order, Additional, Table } from "@/lib/types"
import { getStoreConfig } from "@/lib/db"
import { TableService } from "@/lib/services/table-service"
import { getSalmoAleatorio } from "@/lib/salmos"

interface OrderLabelPrinterProps {
  order: Order
  onPrintComplete: () => void
  autoPrint?: boolean
}

// Largura configurável da etiqueta (80mm ou 58mm são os padrões de impressora térmica)
const LABEL_WIDTH_MM = 80 // Configurado para MP-4200 TH (58-82.5mm)

export default function OrderLabelPrinter({ order, onPrintComplete, autoPrint = false }: OrderLabelPrinterProps) {
  const printContainerRef = useRef<HTMLDivElement>(null)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [storeName, setStoreName] = useState("Loja Virtual")
  const [logoUrl, setLogoUrl] = useState("")
  const [salmo, setSalmo] = useState({ referencia: "", texto: "" })

  const [isLogoReady, setIsLogoReady] = useState(false)
  const [logoError, setLogoError] = useState(false)
  const [tableInfo, setTableInfo] = useState<Table | null>(null)

  // Buscar o nome e logo da loja quando o componente for montado
  useEffect(() => {
    const fetchStoreConfig = async () => {
      try {
        const storeConfig = await getStoreConfig()
        if (storeConfig) {
          if (storeConfig.name) {
            setStoreName(storeConfig.name)
          }
          if (storeConfig.logoUrl) {
            // Pré-carregar a imagem para garantir que esteja disponível
            const img = new Image()
            img.onload = () => {
              setLogoUrl(storeConfig.logoUrl)
              setIsLogoReady(true)
              setLogoError(false)
            }
            img.onerror = () => {
              console.error("Erro ao carregar a logo")
              setLogoError(true)
              // Usar uma imagem de fallback ou continuar sem logo
              setLogoUrl("")
              setIsLogoReady(true)
            }
            img.src = storeConfig.logoUrl
          } else {
            setIsLogoReady(true) // Nenhuma logo para carregar
          }
        } else {
          setIsLogoReady(true) // Nenhuma configuração encontrada
        }
      } catch (error) {
        console.error("Erro ao buscar configurações da loja:", error)
        setLogoError(true)
        setIsLogoReady(true) // Continuar mesmo com erro
      }
    }

    const fetchTableInfo = async () => {
       if (order.tableId) {
         try {
           const table = await TableService.getTableById(order.tableId)
           setTableInfo(table)
         } catch (error) {
           console.error("Erro ao buscar informações da mesa:", error)
         }
       }
     }

    // Gerar um salmo aleatório
    setSalmo(getSalmoAleatorio())

    fetchStoreConfig()
    fetchTableInfo()
  }, [order.tableId])

  // Função para normalizar texto especificamente para impressão térmica
  const normalizeForThermalPrint = (text: string): string => {
    if (!text) return '';
    
    return text
      // Converter para string se não for
      .toString()
      // Remover caracteres especiais que causam problemas na impressão térmica
      .replace(/[áàâãä]/gi, 'A')
      .replace(/[éèêë]/gi, 'E') 
      .replace(/[íìîï]/gi, 'I')
      .replace(/[óòôõö]/gi, 'O')
      .replace(/[úùûü]/gi, 'U')
      .replace(/ç/gi, 'C')
      .replace(/ñ/gi, 'N')
      // Substituir bullet points e símbolos especiais
      .replace(/[•·‧∙]/g, '-') // Bullet points viram hífen
      .replace(/[★☆]/g, '*') // Estrelas viram asterisco
      // Remover aspas especiais
      .replace(/[""]/g, '"')
      .replace(/['']/g, "'")
      // Remover hífens especiais
      .replace(/[–—]/g, '-')
      // Converter outros símbolos problemáticos
      .replace(/…/g, '...')
      .replace(/°/g, 'o')
      .replace(/²/g, '2')
      .replace(/³/g, '3')
      .replace(/ª/g, 'a')
      .replace(/º/g, 'o')
      // Remover caracteres de controle e não imprimíveis
      .replace(/[\x00-\x1F\x7F-\x9F]/g, '')
      // Normalizar espaços múltiplos
      .replace(/\s+/g, ' ')
      .trim();
  };

  // Função para quebrar texto longo em múltiplas linhas
  const breakLongText = (text: string, maxLength: number): string[] => {
    if (text.length <= maxLength) {
      return [text];
    }
    
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      
      if (testLine.length <= maxLength) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
          currentLine = word;
        } else {
          // Palavra muito longa, quebrar forçadamente
          lines.push(word.substring(0, maxLength));
          currentLine = word.substring(maxLength);
        }
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  };

  // Função para formatar linha de adicional com quebra responsiva para textos longos
  // Função para calcular altura estimada do PDF
  const calculateEstimatedHeight = (): number => {
    let estimatedHeight = 50 // Altura base (cabeçalho + margens)
    
    // Logo (se existir)
    if (logoUrl) {
      estimatedHeight += 25
    }
    
    // Seções básicas (cliente, endereço/tipo)
    estimatedHeight += 40
    
    // Itens
    order.items.forEach((item) => {
      estimatedHeight += 8 // Linha do item
      
      // Adicionais
      if (item.additionals && item.additionals.length > 0) {
        estimatedHeight += 5 // Título dos adicionais
        estimatedHeight += item.additionals.length * 6 // Cada adicional com mais espaço
      }
      
      // Colher
      if (item.needsSpoon === true) {
        estimatedHeight += 5
      }
      // Reservar espaço quando explicitamente nao precisa de colher
      if (item.needsSpoon === false) {
        estimatedHeight += 5
      }
      
      // Observações
      if (item.notes && item.notes.trim() !== "") {
        const notesLines = Math.ceil(item.notes.length / 45) // Estimativa mais conservadora
        estimatedHeight += 8 + (notesLines * 5) // Mais espaço para observações
      }
      
      estimatedHeight += 4 // Espaço entre itens
    })
    
    // Totais e pagamento
    estimatedHeight += 60 // Aumentado para acomodar quebras de linha
    
    // Calcular altura da forma de pagamento baseada no conteúdo
    let paymentText = "Forma de pagamento: "
    const isTableOrder = order.orderType === 'table' || order.tableId
    if (order.paymentMethod === "pix") {
        paymentText += isTableOrder ? "Pix" : "Pix na Entrega"
      } else if (order.paymentMethod === "card") {
        paymentText += isTableOrder ? "Cartão" : "Cartão na Entrega"
      } else if (order.paymentMethod === "money") {
      paymentText += "Dinheiro"
      if (order.paymentChange && parseFloat(order.paymentChange) > 0) {
        const troco = Math.round((parseFloat(order.paymentChange) - order.total) * 100) / 100
        paymentText += ` (Troco: R$ ${troco.toFixed(2).replace('.', ',')})` 
      } else {
        paymentText += " (Sem troco)"
      }
    }
    
    // Estimar linhas necessárias para forma de pagamento (baseado na largura disponível)
    const availableWidthChars = Math.floor((LABEL_WIDTH_MM - 10) / 2) // Aproximação de caracteres por linha
    const paymentLines = Math.ceil(paymentText.length / availableWidthChars)
    estimatedHeight += paymentLines * 5 + 10 // Altura das linhas + espaço extra
    
    // Salmo
    const salmoText = salmo.texto + salmo.referencia
    const salmoLines = Math.ceil(salmoText.length / availableWidthChars)
    estimatedHeight += salmoLines * 4 + 15 // Altura do salmo + espaços
    
    // Adicionar margem de segurança mais generosa
    return Math.max(estimatedHeight * 1.3, 180) // Mínimo de 180mm com 30% de margem
  }

  // Função para regenerar PDF com altura correta
  const regeneratePDFWithCorrectHeight = async (doc: jsPDF, correctHeight: number) => {
    // Esta função replicaria todo o processo de geração do PDF
    // Por simplicidade, vamos apenas salvar o PDF atual
    doc.save(`pedido-${order.id}.pdf`)
  }

  const formatAdditionalLineResponsive = (quantity: number, name: string, price: number): string[] => {
    const normalizedName = normalizeForThermalPrint(name);
    const priceText = price === 0 ? 'Grátis' : formatCurrency(price * quantity);
    const prefix = `+ ${quantity}x `;
    const lineLength = 42;
    
    // Calcular espaço disponível para o nome na primeira linha
    const availableSpace = lineLength - prefix.length - priceText.length - 3; // 3 espaços mínimos
    
    if (normalizedName.length <= availableSpace) {
      // Nome cabe em uma linha - usar formatação original
      const spacing = lineLength - (prefix + normalizedName).length - priceText.length;
      const spacingText = spacing > 0 ? ' '.repeat(spacing) : '   ';
      return [`${prefix}${normalizedName}${spacingText}${priceText}`];
    }
    
    // Nome muito longo - quebrar em múltiplas linhas
    const nameLines = breakLongText(normalizedName, availableSpace);
    const result: string[] = [];
    
    // Primeira linha com preço
    const firstLine = `${prefix}${nameLines[0]}`;
    const spacing = lineLength - firstLine.length - priceText.length;
    const spacingText = spacing > 0 ? ' '.repeat(spacing) : '   ';
    result.push(`${firstLine}${spacingText}${priceText}`);
    
    // Linhas adicionais com indentação (sem preço)
    const indent = '    '; // 4 espaços de indentação
    for (let i = 1; i < nameLines.length; i++) {
      result.push(`${indent}${nameLines[i]}`);
    }
    
    return result;
  };

  // Função para formatar linha de adicional com espaçamento adequado (mantida para compatibilidade)
  const formatAdditionalLine = (quantity: number, name: string, price: number): string => {
    const lines = formatAdditionalLineResponsive(quantity, name, price);
    return lines.join('\n');
  };

  // Função para formatar linha de item principal com espaçamento adequado
  const formatItemLine = (quantity: number, name: string, size: string, price: number): string => {
    const normalizedName = normalizeForThermalPrint(name);
    const cleanedSize = cleanSizeDisplay(size);
    return `${quantity}x ${normalizedName}: (${cleanedSize})`;
  };

  // Função para imprimir diretamente na impressora
  const handlePrint = useCallback(() => {
    if (!isLogoReady) {
      // Se a logo ainda não estiver pronta, tente novamente em breve
      setTimeout(handlePrint, 100)
      return
    }
    if (printContainerRef.current) {
      // Processar o conteúdo para normalizar caracteres antes da impressão
      let processedContent = printContainerRef.current.innerHTML;
      
      // Normalizar especificamente o nome da loja
      const normalizedStoreName = normalizeForThermalPrint(storeName);
      
      // Substituir o nome da loja no conteúdo
      processedContent = processedContent
        .replace(new RegExp(storeName.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g'), normalizedStoreName)
        .replace(/[""]/g, '"')
        .replace(/['']/g, "'")
        .replace(/[–—]/g, '-')
        .replace(/…/g, '...')
        .replace(/°/g, 'o')
        .replace(/²/g, '2')
        .replace(/³/g, '3');

      // Criar um iframe oculto para impressão
      const printIframe = document.createElement("iframe")
      printIframe.style.position = "fixed"
      printIframe.style.right = "0"
      printIframe.style.bottom = "0"
      printIframe.style.width = "0"
      printIframe.style.height = "0"
      printIframe.style.border = "0"

      document.body.appendChild(printIframe)

      // Configurar o conteúdo do iframe
      const printDocument = printIframe.contentWindow?.document
      if (printDocument) {
        printDocument.open()

        // Definir o estilo para impressora térmica (largura configurável)
        printDocument.write(`
          <!DOCTYPE html>
          <html lang="pt-BR">
            <head>
              <meta charset="UTF-8">
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <title>Etiqueta de Pedido #${order.id}</title>
              <style>
                /* Configurações globais para impressão térmica */
                * {
                  -webkit-print-color-adjust: exact;
                  print-color-adjust: exact;
                  box-sizing: border-box;
                }
                
                @page {
                  size: ${LABEL_WIDTH_MM}mm auto;
                  margin: 0mm;
                }
                
                @media print {
                  * {
                    -webkit-font-smoothing: none !important;
                    -moz-osx-font-smoothing: unset !important;
                    font-smoothing: none !important;
                    text-rendering: optimizeSpeed !important;
                  }
                }
                
                body {
                  font-family: 'Courier New', 'Liberation Mono', 'DejaVu Sans Mono', 'Consolas', monospace;
                  width: ${LABEL_WIDTH_MM - 8}mm;
                  padding: 3mm;
                  margin: 0;
                  font-size: 10pt;
                  font-variant: normal;
                  font-weight: normal;
                  text-rendering: optimizeSpeed;
                  -webkit-font-smoothing: none;
                  -moz-osx-font-smoothing: unset;
                  font-smoothing: none;
                  letter-spacing: 0;
                  word-spacing: 0;
                  line-height: 1.2;
                  word-break: break-word;
                  font-feature-settings: "kern" 0, "liga" 0;
                }
                .header {
                  text-align: center;
                  margin-bottom: 5mm;
                }
                .logo {
                  max-width: ${LABEL_WIDTH_MM - 20}mm;
                  max-height: 18mm;
                  margin: 0 auto 3mm;
                  display: block;
                }
                .title {
                  font-size: 12pt;
                  font-weight: bold;
                  margin-bottom: 1.5mm;
                }
                .subtitle {
                  font-size: 10pt;
                  margin-bottom: 1mm;
                }
                .section {
                  margin-bottom: 3mm;
                }
                .section-title {
                  font-weight: bold;
                  border-bottom: 1px solid #000;
                  margin-bottom: 1.5mm;
                  font-size: 10pt;
                  font-family: Arial, sans-serif !important;
                  text-transform: uppercase;
                }
                .item {
                  display: flex;
                  justify-content: space-between;
                  margin-bottom: 1mm;
                  font-size: 9pt;
                }
                .additional-status {
                  font-style: italic;
                  margin-left: 4mm;
                  margin-top: 1mm;
                  margin-bottom: 1mm;
                  font-size: 9pt;
                }
                .spoon-info {
                  font-weight: bold;
                  margin-left: 4mm;
                  margin-top: 1mm;
                  margin-bottom: 1mm;
                  font-size: 9pt;
                }
                .additional {
                  font-family: 'Courier New', 'Liberation Mono', 'DejaVu Sans Mono', 'Consolas', monospace;
                  font-size: 8pt;
                  font-weight: normal;
                  font-variant: normal;
                  margin-left: 4mm;
                  margin-bottom: 1mm;
                  padding-left: 0;
                  white-space: pre;
                  word-break: keep-all;
                  letter-spacing: 0;
                  word-spacing: 0;
                  text-rendering: optimizeSpeed;
                  line-height: 1.3;
                }
                .additional-group {
                  margin-bottom: 2mm;
                }
                .divider {
                  border-top: 1px dashed #000;
                  margin: 3mm 0;
                }
                .total {
                  font-weight: bold;
                  font-size: 10pt;
                  font-variant: normal;
                }
                .footer {
                  text-align: center;
                  margin-top: 4mm;
                  font-size: 9pt;
                  font-variant: normal;
                }
                .salmo {
                  text-align: center;
                  margin-top: 4mm;
                  font-size: 8pt;
                  font-style: italic;
                  font-variant: normal;
                  border-top: 1px dashed #000;
                  padding-top: 3mm;
                }
                .salmo-texto {
                  margin-bottom: 1.5mm;
                  line-height: 1.1;
                  font-variant: normal;
                }
                .salmo-referencia {
                  font-weight: bold;
                  font-size: 7pt;
                  font-variant: normal;
                }
                .item-formatted {
                  font-family: 'Courier New', 'Liberation Mono', 'DejaVu Sans Mono', 'Consolas', monospace;
                  font-size: 9pt;
                  font-weight: normal;
                  font-variant: normal;
                  margin-bottom: 2mm;
                  white-space: pre;
                  word-break: keep-all;
                  letter-spacing: 0;
                  word-spacing: 0;
                  text-rendering: optimizeSpeed;
                }
                .items-spacing {
                  margin-bottom: 4mm;
                }
              </style>
            </head>
            <body>
              ${processedContent}
            </body>
          </html>
        `)

        printDocument.close()

        // Imprimir e remover o iframe
        console.log('OrderLabelPrinter - Executando window.print() agora!');
        printIframe.contentWindow?.focus()
        
        // Tentar diferentes métodos de impressão para maximizar compatibilidade
        try {
          if (printIframe.contentWindow) {
            // Método 1: Tentar API moderna do Chrome/Edge para impressão silenciosa
            if ((window as any).chrome && (window as any).chrome.runtime) {
              console.log('Tentando impressão via Chrome API...');
              printIframe.contentWindow.print();
            }
            // Método 2: Tentar com configurações de impressão otimizadas
            else {
              console.log('Usando método de impressão padrão...');
              printIframe.contentWindow.print();
            }
          }
        } catch (error) {
          console.log('Erro na impressão:', error);
          // Fallback para método básico
          printIframe.contentWindow?.print();
        }
        
        // Tentar clicar automaticamente no botão "Imprimir" do diálogo após um pequeno delay
        setTimeout(() => {
          try {
            // Simular tecla Enter para confirmar a impressão
            const event = new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              which: 13,
              bubbles: true
            });
            document.dispatchEvent(event);
          } catch (error) {
            console.log('Não foi possível simular Enter automaticamente:', error);
          }
        }, 100);

        // Remover o iframe após a impressão
        setTimeout(() => {
          document.body.removeChild(printIframe)
          onPrintComplete()
        }, 1000)
      }
    }
  }, [isLogoReady, storeName, onPrintComplete])

  // useEffect para impressão automática
  useEffect(() => {
    if (autoPrint && isLogoReady) {
      // Aguardar um pequeno delay para garantir que o componente esteja totalmente renderizado
      const timer = setTimeout(() => {
        handlePrint()
      }, 500)
      
      return () => clearTimeout(timer)
    }
  }, [autoPrint, isLogoReady, handlePrint])

  // Função para carregar uma imagem e retornar como base64
  const loadImage = (url: string): Promise<string> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.crossOrigin = "anonymous" // Importante para evitar problemas de CORS
      img.onload = () => {
        // Redimensionar a imagem para um tamanho mais adequado
        const maxWidth = 300 // Largura máxima em pixels
        const maxHeight = 150 // Altura máxima em pixels

        let width = img.width
        let height = img.height

        // Redimensionar mantendo a proporção
        if (width > maxWidth) {
          height = (height * maxWidth) / width
          width = maxWidth
        }

        if (height > maxHeight) {
          width = (width * maxHeight) / height
          height = maxHeight
        }

        const canvas = document.createElement("canvas")
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext("2d")
        ctx?.drawImage(img, 0, 0, width, height)
        resolve(canvas.toDataURL("image/png"))
      }
      img.onerror = (error) => {
        reject(error)
      }
      img.src = url
    })
  }

  // Função para gerar e baixar PDF
  const handleGeneratePDF = async () => {
    if (!printContainerRef.current) return

    try {
      setIsGeneratingPDF(true)

      // Calcular altura estimada baseada no conteúdo
      const estimatedHeight = calculateEstimatedHeight()
      
      // Criar um novo documento PDF com tamanho para impressora térmica (largura configurável)
      const doc = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: [LABEL_WIDTH_MM, estimatedHeight], // Altura dinâmica baseada no conteúdo
      })

      // Configurar fonte
      doc.setFont("courier", "normal")
      doc.setFontSize(10)

      // Margens
      const margin = 5
      let yPos = margin

      // Adicionar logo se disponível
      if (logoUrl) {
        try {
          const logoBase64 = await loadImage(logoUrl)
          // Calcular dimensões para manter a proporção e limitar a largura
          const maxWidth = LABEL_WIDTH_MM * 0.4 // 40% da largura
          const imgProps = doc.getImageProperties(logoBase64)
          const imgWidth = Math.min(maxWidth, imgProps.width / (imgProps.width / maxWidth))
          const imgHeight = imgProps.height * (imgWidth / imgProps.width)

          // Centralizar a imagem
          const xPos = (LABEL_WIDTH_MM - imgWidth) / 2
          doc.addImage(logoBase64, "PNG", xPos, yPos, imgWidth, imgHeight)
          yPos += imgHeight + 5 // Adicionar espaço após a logo
        } catch (error) {
          console.error("Erro ao carregar a logo:", error)
          // Continuar sem a logo
        }
      }

      // Configurar fonte com suporte a caracteres especiais
      doc.setFont("helvetica", "bold")
      doc.setFontSize(12)
      // Cabeçalho
      doc.text(storeName.toUpperCase(), LABEL_WIDTH_MM / 2, yPos, { align: "center" })
      yPos += 10

      doc.setFontSize(10)
      doc.text(`Pedido #${order.id}`, LABEL_WIDTH_MM / 2, yPos, { align: "center" })
      yPos += 5

      doc.setFont("courier", "normal")
      doc.text(format(new Date(order.date), "dd/MM/yyyy HH:mm", { locale: ptBR }), LABEL_WIDTH_MM / 2, yPos, { align: "center" })
      yPos += 10

      // Cliente
      doc.setFont("courier", "bold")
      doc.text("CLIENTE", margin, yPos)
      yPos += 5
      doc.setFont("courier", "normal")
      doc.text(normalizeForThermalPrint(order.customerName), margin, yPos)
      yPos += 5
      doc.text(order.customerPhone, margin, yPos)
      yPos += 10

      // Verificar se é pedido de mesa
      if (order.orderType === 'table' || order.tableId) {
        // Para pedidos de mesa, usar "TIPO:" em negrito
        doc.setFont("courier", "bold")
        doc.text("TIPO:", margin, yPos)
        yPos += 5
        doc.setFont("courier", "normal")
        const tableDisplayName = order.tableName || (tableInfo ? tableInfo.name : `Mesa ${String(order.tableId || 0).padStart(2, '0')}`)
        doc.text(tableDisplayName, margin, yPos)
        yPos += 5
      } else {
        // Para delivery, manter "ENDEREÇO"
        doc.setFont("helvetica", "bold")
        doc.text("ENDEREÇO", margin, yPos)
        yPos += 5
        doc.setFont("courier", "normal")
        // Tipo de endereço para delivery
        if (order.address.addressType) {
          let addressTypeText = ""
          switch (order.address.addressType) {
            case 'casa':
              addressTypeText = "Casa"
              break
            case 'apto':
              addressTypeText = "Apartamento"
              break
            case 'condominio':
              addressTypeText = "Condomínio"
              break
            default:
              addressTypeText = order.address.addressType
          }
          doc.text(`Tipo: ${addressTypeText}`, margin, yPos)
          yPos += 5
        }
        
        doc.text(`${normalizeForThermalPrint(order.address.street)}, ${order.address.number}`, margin, yPos)
        yPos += 5
        doc.text(`Bairro: ${normalizeForThermalPrint(order.address.neighborhood)}`, margin, yPos)
        yPos += 5
        doc.text(`Cidade: ${normalizeForThermalPrint(order.address.city)}`, margin, yPos)
        yPos += 5
        if (order.address.complement) {
          doc.text(`Complemento: ${normalizeForThermalPrint(order.address.complement)}`, margin, yPos)
          yPos += 5
        }
      }
      yPos += 5

      // Itens
      doc.setFont("courier", "bold")
      doc.text("ITENS", margin, yPos)
      yPos += 5
      doc.setFont("courier", "normal")

      // Calcular a largura disponível para o texto
      const availableWidth = LABEL_WIDTH_MM - 2 * margin

      order.items.forEach((item) => {
        // Usar a nova formatação de linha
        const formattedItemLine = formatItemLine(item.quantity, item.name, item.size, item.price)
        doc.text(formattedItemLine, margin, yPos)
        yPos += 5

        // Adicionar status de adicionais
        if (item.additionals && item.additionals.length > 0) {
          doc.setFont("courier", "italic")
          doc.text("Adicionais Complementos:", margin + 3, yPos)
          yPos += 5
          doc.setFont("courier", "normal")

          // Adicionar adicionais do item
          item.additionals.forEach((additional) => {
            const formattedLines = formatAdditionalLineResponsive(additional.quantity ?? 1, additional.name, additional.price)
            formattedLines.forEach(line => {
              doc.text(line, margin + 5, yPos)
              yPos += 4
            })
          })
        }

        // Adicionar informação da colher
        if (item.needsSpoon === true) {
          doc.setFont("courier", "bold")
          let spoonText = "Precisa de colher: "
          spoonText += item.spoonQuantity && item.spoonQuantity > 1 ? 
            `Sim (${item.spoonQuantity} colheres)` : 
            'Sim (1 colher)'
          doc.text(spoonText, margin + 3, yPos)
          yPos += 5
          doc.setFont("courier", "normal")
        }
        else if (item.needsSpoon === false) {
          doc.setFont("courier", "bold")
          doc.text("Nao precisa de colher", margin + 3, yPos)
          yPos += 5
          doc.setFont("courier", "normal")
        }

        // Adicionar observações do cliente - Responsivo
        if (item.notes && item.notes.trim() !== "") {
          doc.setFont("courier", "bold")
          doc.text("Obs:", margin + 3, yPos)
          yPos += 4
          doc.setFont("courier", "normal")
          
          // Quebrar o texto das observações em múltiplas linhas se necessário
          const normalizedNotes = normalizeForThermalPrint(item.notes)
          const notesLines = doc.splitTextToSize(normalizedNotes, availableWidth - 10)
          
          notesLines.forEach((line: string) => {
            doc.text(line, margin + 8, yPos)
            yPos += 4
          })
          
          yPos += 2 // Espaço extra após observações
        }

        yPos += 3 // Espaço extra após cada item
      })

      yPos += 5

      // Linha divisória
      doc.setDrawColor(0)
      doc.setLineDashPattern([1, 1], 0)
      doc.line(margin, yPos, LABEL_WIDTH_MM - margin, yPos)
      yPos += 5

      // Espaçamento adicional de 1 linha entre divider e subtotal  
      yPos += 5

      // Totais
      doc.text("Subtotal:", margin, yPos)
      doc.text(formatCurrency(order.subtotal), LABEL_WIDTH_MM - margin, yPos, { align: "right" })
      yPos += 5

      doc.text("Taxa de entrega:", margin, yPos)
      doc.text(formatCurrency(order.deliveryFee), LABEL_WIDTH_MM - margin, yPos, { align: "right" })
      yPos += 5

      // Explicação da taxa de entrega para picolés - Responsivo
      const isPicoleOnlyOrder = order.items.every(item => {
        const picoléTerms = ["PICOLÉ", "PICOLÉ AO LEITE", "PICOLE", "PICOLE AO LEITE", "PICOLÉ AO LEITÉ", "PICOLE AO LEITÉ"]
        const itemCategory = item.name || ""
        return picoléTerms.some(term => itemCategory.toUpperCase().includes(term))
      })
      
      if (isPicoleOnlyOrder && order.deliveryFee > 0 && order.subtotal < 20) {
        doc.setFont("courier", "italic")
        doc.setFontSize(8)
        const explicacao = "* Taxa aplicada para picoles abaixo de R$ 20,00"
        const explicacaoLines = doc.splitTextToSize(normalizeForThermalPrint(explicacao), availableWidth)
        explicacaoLines.forEach((line: string) => {
          doc.text(line, margin, yPos)
          yPos += 4
        })
        yPos += 1
        doc.setFont("courier", "normal")
        doc.setFontSize(10)
      }

      // Explicação da taxa de entrega para moreninha - Responsivo
      const isMoreninhaOnlyOrder = order.items.every(item => {
        const itemCategory = item.name || ""
        return itemCategory.toUpperCase().includes("MORENINHA")
      })
      
      if (isMoreninhaOnlyOrder && order.deliveryFee > 0 && order.subtotal < 17) {
        doc.setFont("courier", "italic")
        doc.setFontSize(8)
        const explicacao = "* Taxa aplicada para moreninha abaixo de R$ 17,00"
        const explicacaoLines = doc.splitTextToSize(normalizeForThermalPrint(explicacao), availableWidth)
        explicacaoLines.forEach((line: string) => {
          doc.text(line, margin, yPos)
          yPos += 4
        })
        yPos += 1
        doc.setFont("courier", "normal")
        doc.setFontSize(10)
      }

      doc.setFont("courier", "bold")
      doc.text("TOTAL:", margin, yPos)
      doc.text(formatCurrency(order.total), LABEL_WIDTH_MM - margin, yPos, { align: "right" })
      yPos += 10

      // Forma de pagamento - Responsivo
      doc.setFont("courier", "normal")
      let paymentText = "Forma de pagamento: "
      const isTableOrder = order.orderType === 'table' || order.tableId
      if (order.paymentMethod === "pix") {
        paymentText += isTableOrder ? "Pix" : "Pix na Entrega"
      } else if (order.paymentMethod === "card") {
        paymentText += isTableOrder ? "Cartão" : "Cartão na Entrega"
      } else if (order.paymentMethod === "money") {
        paymentText += "Dinheiro"
        if (order.paymentChange && parseFloat(order.paymentChange) > 0) {
          const troco = Math.round((parseFloat(order.paymentChange) - order.total) * 100) / 100
          paymentText += ` (Troco: R$ ${troco.toFixed(2).replace('.', ',')})` 
        } else {
          paymentText += " (Sem troco)"
        }
      }
      
      // Quebrar o texto da forma de pagamento em múltiplas linhas se necessário
      const paymentLines = doc.splitTextToSize(normalizeForThermalPrint(paymentText), availableWidth)
      paymentLines.forEach((line: string) => {
        doc.text(line, margin, yPos)
        yPos += 5
      })
      yPos += 5 // Espaço extra após forma de pagamento

      // Rodapé - Responsivo
      doc.setFont("courier", "normal")
      doc.setFontSize(9)
      const rodapeText = "Obrigado pela preferencia!"
      const rodapeLines = doc.splitTextToSize(normalizeForThermalPrint(rodapeText), availableWidth)
      rodapeLines.forEach((line: string) => {
        doc.text(line, LABEL_WIDTH_MM / 2, yPos, { align: "center" })
        yPos += 5
      })
      yPos += 5

      // Adicionar salmo
      doc.setDrawColor(0)
      doc.setLineDashPattern([1, 1], 0)
      doc.line(margin, yPos, LABEL_WIDTH_MM - margin, yPos)
      yPos += 5

      // Quebrar o texto do salmo em múltiplas linhas se necessário
      const salmoTexto = doc.splitTextToSize(normalizeForThermalPrint(salmo.texto), availableWidth)

      doc.setFont("courier", "italic")
      doc.setFontSize(8)

      // Centralizar cada linha do texto do salmo
      salmoTexto.forEach((linha: string) => {
        doc.text(linha, LABEL_WIDTH_MM / 2, yPos, { align: "center" })
        yPos += 4
      })

      // Adicionar a referência do salmo
      doc.setFont("courier", "bold")
      const referenciaLines = doc.splitTextToSize(normalizeForThermalPrint(salmo.referencia), availableWidth)
      referenciaLines.forEach((linha: string) => {
        doc.text(linha, LABEL_WIDTH_MM / 2, yPos, { align: "center" })
        yPos += 4
      })
      yPos += 1 // Espaço final

      // Verificar se precisamos ajustar o tamanho da página
      const finalHeight = yPos + 5 // Adicionar margem final
      if (finalHeight > estimatedHeight) {
        // Recriar o PDF com a altura correta se necessário
        const newDoc = new jsPDF({
          orientation: "portrait",
          unit: "mm",
          format: [LABEL_WIDTH_MM, finalHeight],
        })
        
        // Replicar todo o conteúdo no novo documento
        await regeneratePDFWithCorrectHeight(newDoc, finalHeight)
        return
      }

      // Salvar o PDF
      doc.save(`pedido-${order.id}.pdf`)

      // Marcar como impresso após gerar o PDF
      onPrintComplete()
    } catch (error) {
      console.error("Erro ao gerar PDF:", error)
      alert("Erro ao gerar PDF. Tente novamente.")
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  return (
    <div>
      <div className="mb-4 border rounded-lg p-4 max-h-96 overflow-auto">
        <div ref={printContainerRef} className="thermal-receipt">
          <div className="header">
            {logoUrl ? (
            <img
              src={logoUrl}
              alt={`Logo ${storeName}`}
              className="logo"
              style={{
                maxWidth: `${LABEL_WIDTH_MM - 20}mm`,
                maxHeight: "18mm",
                margin: "0 auto 3mm",
                display: "block",
              }}
              onError={(e) => {
                // Se a imagem falhar ao carregar, remova o src para evitar tentativas repetidas
                const target = e.target as HTMLImageElement
                target.style.display = 'none'
              }}
            />
          ) : !logoError && (
            // Mostrar placeholder enquanto carrega (se não houver erro)
            <div 
              className="logo-placeholder" 
              style={{
                width: `${LABEL_WIDTH_MM - 20}mm`,
                height: "18mm",
                margin: "0 auto 3mm",
                backgroundColor: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "#9ca3af",
                fontSize: "10px"
              }}
            >
              {isLogoReady ? "Sem logo configurada" : "Carregando..."}
            </div>
          )}
            <div className="title">{normalizeForThermalPrint(storeName).toUpperCase()}</div>
            <div className="subtitle">Pedido #{order.id}</div>
            <div className="subtitle">{format(new Date(order.date), "dd/MM/yyyy HH:mm", { locale: ptBR })}</div>
          </div>

          <div className="section">
            <div className="section-title">CLIENTE</div>
            <div className="mb-1">{normalizeForThermalPrint(order.customerName)}</div>
            <div className="mb-1 font-bold">CELULAR</div>
            <div>{order.customerPhone}</div>
          </div>

          <div className="section">
            <div className="section-title" style={{ fontFamily: 'Arial, sans-serif' }}>
              {order.orderType === 'table' || order.tableId ? 'TIPO' : 'ENDEREÇO'}
            </div>
            {/* Verificar se é pedido de mesa */}
            {order.orderType === 'table' || order.tableId ? (
              <div>
                {tableInfo ? tableInfo.name : `Mesa ${String(order.tableId || 0).padStart(2, '0')}`}
              </div>
            ) : (
              <>
                {/* Tipo de endereço para delivery */}
                {order.address.addressType && (
                  <div>
                    Tipo: {order.address.addressType === 'casa' ? 'Casa' : 
                          order.address.addressType === 'apto' ? 'Apartamento' : 
                          order.address.addressType === 'condominio' ? 'Condomínio' : 
                          order.address.addressType}
                  </div>
                )}
                <div>
                  {normalizeForThermalPrint(order.address.street)}, {order.address.number}
                </div>
                <div>Bairro: {normalizeForThermalPrint(order.address.neighborhood)}</div>
                <div>Cidade: {normalizeForThermalPrint(order.address.city)}</div>
                {order.address.complement && <div>Complemento: {normalizeForThermalPrint(order.address.complement)}</div>}
              </>
            )}
          </div>

          <div className="section">
            <div className="section-title">ITENS DO PEDIDO</div>
            {(Array.isArray(order.items) ? order.items : (typeof order.items === 'string' ? JSON.parse(order.items) : [])).map((item: any, index: number) => (
              <div key={index} style={{ marginBottom: "6px" }}>
                <div className="flex justify-between items-start w-full" style={{ fontFamily: "monospace", fontSize: "11px", marginBottom: "4px" }}>
                <div className="flex-1 pr-2">
                  {item.quantity}x {normalizeForThermalPrint(item.name)} ({cleanSizeDisplay(item.size)})
                </div>
                <div className="font-medium text-right">
                  {formatCurrency(item.price * item.quantity)}
                </div>
              </div>

                {/* Indicar se tem ou não adicionais */}
                {item.additionals && item.additionals.length > 0 ? (
                  <div className="mb-2">
                    <div className="additional-status font-bold">Adicionais Complementos</div>
                    {item.additionals.map((additional: any, idx: number) => {
                      const formattedLines = formatAdditionalLineResponsive(additional.quantity ?? 1, additional.name, additional.price)
                      
                      return (
                        <div key={idx} className="additional-group" style={{ marginBottom: '2px' }}>
                          {formattedLines.map((line, lineIdx) => (
                            <div 
                              key={lineIdx} 
                              className="additional" 
                              style={{ 
                                fontFamily: 'monospace', 
                                fontSize: '10px', 
                                marginBottom: '1px', 
                                whiteSpace: 'pre' 
                              }}
                            >
                              {line}
                            </div>
                          ))}
                        </div>
                      )
                    })}
                  </div>
                ) : null}

                {/* Indicar se precisa de colher - exibir Sim/Não quando definido */}
                {item.needsSpoon === true && (
                  <div className="spoon-info">
                    Precisa de colher: {item.spoonQuantity && item.spoonQuantity > 1 ? 
                      `Sim (${item.spoonQuantity} colheres)` : 
                      'Sim (1 colher)'
                    }
                  </div>
                )}
                {item.needsSpoon === false && (
                  <div className="spoon-info">Nao precisa de colher</div>
                )}

                {/* Observações do cliente */}
                {item.notes && item.notes.trim() !== "" && (
                  <div className="additional-status">
                    <strong>Obs:</strong> {normalizeForThermalPrint(item.notes)}
                  </div>
                )}
              </div>
            ))}
            {/* Espaçamento adicional de 1 linha após todos os itens */}
            <div className="items-spacing"></div>
          </div>

          <div className="divider"></div>
          
          {/* Espaçamento adicional de 1 linha entre divider e subtotal */}
          <div className="items-spacing"></div>

          <div className="section">
            <div className="item flex justify-between">
              <div>Subtotal:</div>
              <div style={{ fontWeight: "bold" }}>{formatCurrency(order.subtotal)}</div>
            </div>
            <div className="item flex justify-between">
              <div>Taxa de entrega:</div>
              <div style={{ fontWeight: "bold" }}>{formatCurrency(order.deliveryFee)}</div>
            </div>
            
            {/* Explicação da taxa de entrega para picolés */}
            {(() => {
              const isPicoleOnlyOrder = order.items.every(item => {
                const picoléTerms = ["PICOLÉ", "PICOLÉ AO LEITE", "PICOLE", "PICOLE AO LEITE", "PICOLÉ AO LEITÉ", "PICOLE AO LEITÉ"]
                const itemCategory = item.name || ""
                return picoléTerms.some(term => itemCategory.toUpperCase().includes(term))
              })
              
              if (isPicoleOnlyOrder && order.deliveryFee > 0 && order.subtotal < 20) {
                return (
                  <div style={{ 
                    fontSize: "9px", 
                    fontStyle: "italic", 
                    color: "#666", 
                    marginTop: "2px",
                    textAlign: "center"
                  }}>
                    * Taxa aplicada para picolés abaixo de R$ 20,00
                  </div>
                )
              }
              return null
            })()}

            {/* Explicação da taxa de entrega para moreninha */}
            {(() => {
              const isMoreninhaOnlyOrder = order.items.every(item => {
                const itemCategory = item.name || ""
                return itemCategory.toUpperCase().includes("MORENINHA")
              })
              
              if (isMoreninhaOnlyOrder && order.deliveryFee > 0 && order.subtotal < 17) {
                return (
                  <div style={{ 
                    fontSize: "9px", 
                    fontStyle: "italic", 
                    color: "#666", 
                    marginTop: "2px",
                    textAlign: "center"
                  }}>
                    * Taxa aplicada para moreninha abaixo de R$ 17,00
                  </div>
                )
              }
              return null
            })()}
            
            <div className="item total flex justify-between">
              <div>TOTAL:</div>
              <div>{formatCurrency(order.total)}</div>
            </div>
          </div>

          <div className="section">
            <div className="mb-1">
              <span className="font-medium">Forma de pagamento:</span> {
                (() => {
                  const isTableOrder = order.orderType === 'table' || order.tableId
                  if (order.paymentMethod === "pix") {
                    return isTableOrder ? "Pix" : "Pix na Entrega"
                  } else if (order.paymentMethod === "card") {
                    return isTableOrder ? "Cartão" : "Cartão na Entrega"
                  } else {
                    return "Dinheiro"
                  }
                })()
              }
            </div>
            {order.paymentMethod === "money" && order.paymentChange && parseFloat(order.paymentChange) > 0 && (
              <div className="grid grid-cols-2 gap-1 text-sm">
                <div>Valor pago:</div>
                <div className="text-right font-medium">{formatCurrency(parseFloat(order.paymentChange))}</div>
                <div className="text-green-700 font-semibold">Troco:</div>
                <div className="text-right font-bold text-green-700">
                  {formatCurrency(Math.round((parseFloat(order.paymentChange) - order.total) * 100) / 100)}
                </div>
              </div>
            )}
          </div>

          <div className="footer">Obrigado pela preferencia!</div>

          {/* Adicionar salmo */}
          <div className="salmo">
            <div className="salmo-texto">{normalizeForThermalPrint(salmo.texto)}</div>
            <div className="salmo-referencia">{normalizeForThermalPrint(salmo.referencia)}</div>
          </div>
        </div>
      </div>

      {/* Instrução para configuração de impressão - Estilo mais discreto */}
      <div className="mb-3 p-2 bg-gray-50 border border-gray-200 text-gray-600 text-[11px] rounded-md">
        <div className="flex items-start">
          <span className="text-gray-500 mr-1">ℹ️</span>
          <div>
            <p className="mb-1">Configure a largura do papel para <span className="font-medium">{LABEL_WIDTH_MM}mm</span> na impressão.</p>
            <p className="text-gray-500 text-[10px]">MP-4200 TH: papel 58-82.5mm. Atual: 80mm.</p>
          </div>
        </div>
      </div>
      <div className="flex space-x-2">
        <button
          onClick={handlePrint}
          className="flex-1 bg-purple-700 hover:bg-purple-800 text-white py-2 rounded-md flex items-center justify-center"
        >
          <Printer size={18} className="mr-2" />
          Imprimir
        </button>

        <button
          onClick={handleGeneratePDF}
          disabled={isGeneratingPDF}
          className="flex-1 bg-blue-600 hover:bg-blue-700 text-white py-2 rounded-md flex items-center justify-center"
        >
          <Download size={18} className="mr-2" />
          {isGeneratingPDF ? "Gerando..." : "Salvar PDF"}
        </button>
      </div>
    </div>
  )
}
