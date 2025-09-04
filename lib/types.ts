// Tipos para o sistema de açaí online

// Produto
export interface Product {
  id: number
  name: string
  description: string
  image: string
  price?: number // Preço base para produtos sem variações de tamanho
  sizes: ProductSize[]
  tableSizes?: ProductSize[] // Preços específicos para mesa (opcional)
  categoryId: number
  categoryName?: string
  active: boolean
  hidden?: boolean // Indica se o produto deve ser ocultado na visualização do cliente
  hiddenFromTable?: boolean // Indica se o produto deve ser ocultado especificamente no sistema de mesa
  hiddenFromDelivery?: boolean // Indica se o produto deve ser ocultado especificamente no sistema de delivery
  allowedAdditionals: number[]
  hasAdditionals?: boolean
  additionalsLimit?: number // Limite personalizado de adicionais para este produto
  needsSpoon?: boolean // Indica se o produto precisa de colher
}

// Tamanho do produto
export interface ProductSize {
  size: string
  price: number
  additionalsLimit?: number // Limite específico de adicionais para este tamanho
}

// Categoria
export interface Category {
  id: number
  name: string
  order: number
  active: boolean
}

// Adicional
export interface Additional {
  id: number
  name: string
  price: number
  categoryId: number
  categoryName?: string
  active: boolean
  image?: string
  quantity?: number // Quantidade no carrinho
  hasPricing?: boolean // Indica se o adicional tem preço ou é gratuito
}

// Item do carrinho
export interface CartItem {
  id: string
  productId: number
  name: string
  price: number // Preço base do produto (sem adicionais)
  quantity: number
  image?: string
  size: string
  originalSize?: string // Campo opcional para armazenar o tamanho original com identificador
  originalPrice?: number // Preço total incluindo adicionais (se houver)
  additionals?: Additional[]
  categoryName?: string // Nome da categoria do produto
  needsSpoon?: boolean // true = sim, false = não, undefined = não selecionado (obrigatório)
  spoonQuantity?: number // Quantidade de colheres (só relevante se needsSpoon = true)
  notes?: string // Observações do cliente (ex: "remover banana", "sem açúcar")
}

// Adicional no carrinho
export interface CartAdditional {
  id: number
  name: string
  price: number
  quantity?: number // Adicionado campo de quantidade para adicionais
}

// Slide do carrossel
export interface CarouselSlide {
  id: number
  image: string
  title: string
  subtitle: string
  order: number
  active: boolean
}

// Frase
export interface Phrase {
  id: number
  text: string
  order: number
  active: boolean
}

// Configuração da loja
export interface StoreConfig {
  id: string
  name: string
  logoUrl: string
  deliveryFee: number
  maringaDeliveryFee?: number // Taxa de entrega específica para Maringá
  picoleDeliveryFee?: number // Taxa de entrega específica para picolés
  minimumPicoleOrder?: number // Valor mínimo para isenção da taxa de entrega de picolés
  moreninhaDeliveryFee?: number // Taxa de entrega específica para moreninha
  minimumMoreninhaOrder?: number // Valor mínimo para isenção da taxa de entrega de moreninha
  storeColor?: string // Cor principal da loja em formato hexadecimal
  isOpen: boolean
  operatingHours: OperatingHours
  specialDates: SpecialDate[]
  whatsappNumber?: string
  pixKey?: string
  lastUpdated?: string
  carousel_initialized?: boolean
  maxPicolesPerOrder: number // Limite de picolés por pedido
}

// Horário de funcionamento
export interface OperatingHours {
  [day: string]: {
    open: boolean
    hours: string
  }
}

// Data especial
export interface SpecialDate {
  date: string
  open: boolean
  hours?: string
  description: string
}

// Status do pedido
export type OrderStatus = 'new' | 'pending' | 'pending_payment' | 'preparing' | 'ready' | 'delivering' | 'delivered' | 'completed' | 'cancelled' | 'canceled';

// Tipo do pedido
export type OrderType = 'delivery' | 'table';

// Mesa
export interface Table {
  id: number
  number: number
  name: string
  active: boolean
  qrCode: string
  createdAt: Date
  updatedAt: Date
}

// Pedido
export interface Order {
  id: number
  customerName: string
  customerPhone: string
  address: Address
  items: OrderItem[]
  subtotal: number
  deliveryFee: number
  total: number
  paymentMethod: string
  paymentChange?: string
  status: OrderStatus
  date: Date
  printed: boolean
  notified: boolean
  tableId?: number // ID da mesa para pedidos presenciais
  orderType: OrderType // Tipo do pedido
  tableName?: string // Nome da mesa (para exibição)
}

// Endereço
export interface Address {
  street: string
  number: string
  complement?: string
  addressType?: string // Tipo de endereço: casa, apto, condominio
  neighborhood: string
  city: string
  state: string
  zipCode?: string
  reference?: string
}

// Item do pedido
export interface OrderItem {
  productId: number
  name: string
  price: number
  quantity: number
  size: string
  additionals?: CartAdditional[]
  needsSpoon?: boolean // true = sim, false = não, undefined = não selecionado (obrigatório)
  spoonQuantity?: number // Quantidade de colheres (só relevante se needsSpoon = true)
  notes?: string // Observações do cliente (ex: "remover banana", "sem açúcar")
}

// Conteúdo da página
export interface PageContent {
  id: string
  title?: string // Título da página (opcional para compatibilidade)
  page?: string // Página (opcional para compatibilidade)
  section?: string // Seção (opcional para compatibilidade)
  content: string
  lastUpdated: Date
}

// Interface para dados do Supabase (snake_case) - estrutura real da tabela
export interface SupabaseStoreConfig {
  id: string
  name: string
  logo_url: string
  delivery_fee: number
  maringa_delivery_fee?: number
  picole_delivery_fee?: number
  minimum_picole_order?: number
  moreninha_delivery_fee?: number
  minimum_moreninha_order?: number
  store_color?: string
  is_open: boolean
  operating_hours: OperatingHours
  special_dates?: SpecialDate[]
  last_updated: string
  created_at?: string
  updated_at?: string
  max_picoles?: number
  whatsapp_number?: string
  pix_key?: string
  carousel_initialized?: boolean
}

// Notificação
export interface Notification {
  id: number
  title: string
  message: string
  type: string
  active: boolean
  startDate: Date
  endDate: Date
  priority: number
  read: boolean
  createdAt?: Date
}
