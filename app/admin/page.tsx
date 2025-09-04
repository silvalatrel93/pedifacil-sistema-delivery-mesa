"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import {
  ArrowLeft,
  Save,
  Plus,
  Trash2,
  ShoppingBag,
  RefreshCw,
  ImageIcon,
  Layers,
  PlusCircle,
  Check,
  MessageSquare,
  Settings,
  Clock,
  Bell,
  ChevronDown,
  ChevronRight,
  Eye,
  EyeOff,
  Users,
  QrCode,
  Shield,
  LogOut,
  Calculator,
  MapPin,
} from "lucide-react"
import { TableVisibilityToggle } from "@/components/admin/table-visibility-toggle"
import DeliveryVisibilityToggle from "@/components/admin/delivery-visibility-toggle"
import { TablePricingManager } from "@/components/admin/table-pricing-manager"
import SocialShare from "@/components/social-share"
import {
  getAllProducts,
  getAllCategories,
  getAllAdditionals,
  saveProduct,
  deleteProduct,
  AdditionalCategoryService,
  type Product,
  type Category,
  type Additional,
} from "@/lib/db"
import type { AdditionalCategory } from "@/lib/services/additional-category-service"
import { formatCurrency } from "@/lib/utils"
import { createSafeKey } from "@/lib/key-utils";

export default function AdminPage() {
  const router = useRouter()
  const [products, setProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>([])
  const [additionals, setAdditionals] = useState<Additional[]>([])
  const [additionalCategories, setAdditionalCategories] = useState<AdditionalCategory[]>([])
  const [additionalsByCategory, setAdditionalsByCategory] = useState<{ [key: number]: Additional[] }>({})
  const [editingProduct, setEditingProduct] = useState<Product | null>(null)
  const [isModalOpen, setIsModalOpen] = useState(false)
  const [isAdditionalsModalOpen, setIsAdditionalsModalOpen] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [deleteStatus, setDeleteStatus] = useState<{ id: number; status: "pending" | "success" | "error" } | null>(null)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [searchTerm, setSearchTerm] = useState("")

  // Estados para controlar collapse/expand das categorias
  const [expandedCategories, setExpandedCategories] = useState<Set<number>>(new Set())
  const [allExpanded, setAllExpanded] = useState(false)

  // Função para carregar produtos, categorias e adicionais
  const loadData = async () => {
    try {
      setIsLoading(true)
      const [productsList, categoriesList, additionalsList, additionalCategoriesList] = await Promise.all([
        getAllProducts(),
        getAllCategories(),
        getAllAdditionals(),
        AdditionalCategoryService.getAllAdditionalCategories()
      ])
      console.log("Produtos carregados no admin:", productsList.length)
      console.log("Categorias carregadas no admin:", categoriesList.length)
      console.log("Adicionais carregados no admin:", additionalsList.length)
      console.log("Categorias de adicionais carregadas no admin:", additionalCategoriesList.length)

      // Associar o nome da categoria a cada adicional
      const additionalsWithCategoryName = additionalsList.map(additional => {
        const category = additionalCategoriesList.find(cat => cat.id === additional.categoryId);
        return {
          ...additional,
          categoryName: category ? category.name : "Sem categoria",
          categoryOrder: category ? category.order : 999 // Usar um valor alto para itens sem categoria
        };
      });

      // Ordenar adicionais por ordem de categoria e depois por nome
      const sortedAdditionals = [...additionalsWithCategoryName].sort((a, b) => {
        // Primeiro ordenar por ordem de categoria
        if (a.categoryOrder !== b.categoryOrder) {
          return a.categoryOrder - b.categoryOrder;
        }
        // Se mesma categoria, ordenar por nome
        return a.name.localeCompare(b.name);
      });

      setProducts(productsList)
      setCategories(categoriesList)
      setAdditionals(sortedAdditionals)
      setAdditionalCategories(additionalCategoriesList)

      // Inicializar todas as categorias como colapsadas (padrão)
    } catch (error) {
      console.error("Erro ao carregar dados:", error)
    } finally {
      setIsLoading(false)
    }
  }

  // Verificar autenticação e carregar produtos na montagem do componente
  useEffect(() => {
    // Verificar se o usuário está autenticado
    const isAuthenticated = localStorage.getItem("admin_authenticated") === "true"

    if (!isAuthenticated) {
      // Redirecionar para a página de login se não estiver autenticado
      window.location.href = "/admin/login"
      return
    }

    // Se estiver autenticado, carregar os dados
    setIsAuthenticated(true)
    loadData()
  }, [])

  // Função para toggle de uma categoria específica
  const toggleCategory = (categoryId: number) => {
    setExpandedCategories(prev => {
      const newSet = new Set(prev)
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId)
      } else {
        newSet.add(categoryId)
      }

      // Atualizar estado de "todas expandidas"
      setAllExpanded(newSet.size === categories.length)

      return newSet
    })
  }

  // Função para expandir/colapsar todas as categorias
  const toggleAllCategories = () => {
    if (allExpanded) {
      // Colapsar todas
      setExpandedCategories(new Set())
      setAllExpanded(false)
    } else {
      // Expandir todas
      const allCategoryIds = new Set(categories.map(cat => cat.id))
      setExpandedCategories(allCategoryIds)
      setAllExpanded(true)
    }
  }

  const handleEditProduct = (product: Product) => {
    setEditingProduct({ 
      ...product,
      hidden: product.hidden ?? false, // Garantir que hidden seja sempre um booleano
      hiddenFromTable: product.hiddenFromTable ?? false, // Garantir que hiddenFromTable seja sempre um booleano
      needsSpoon: product.needsSpoon ?? false // Garantir que needsSpoon seja sempre um booleano
    })
    setIsModalOpen(true)
  }

  // Modificar a função handleAddProduct para usar um ID seguro em vez de Date.now()

  const handleAddProduct = () => {
    // Usar a primeira categoria disponível como padrão
    const defaultCategoryId = categories.length > 0 ? categories[0].id : 1

    setEditingProduct({
      id: 0, // ID 0 indica um produto novo (não existe no banco)
      name: "",
      description: "",
      image: "/placeholder.svg?key=5xlcq",
      sizes: [
        { size: "300ml", price: 0 },
      ],
      categoryId: defaultCategoryId,
      allowedAdditionals: [], // Inicialmente sem adicionais permitidos
      additionalsLimit: 5, // Limite padrão de 5 adicionais
      active: true, // Adicionar a propriedade active que estava faltando
      hidden: false, // Por padrão, o produto é visível
      hiddenFromTable: false, // Por padrão, o produto é visível em mesa
      needsSpoon: false, // Por padrão, o produto não precisa de colher
    })
    setIsModalOpen(true)
  }

  const handleDeleteProduct = async (id: number) => {
    if (confirm("Tem certeza que deseja excluir este produto?")) {
      try {
        setDeleteStatus({ id, status: "pending" })
        const success = await deleteProduct(id)

        if (success) {
          // Remover o produto do estado local imediatamente
          setProducts(prevProducts => prevProducts.filter(product => product.id !== id))
          setDeleteStatus({ id, status: "success" })
          console.log(`Produto com ID ${id} excluído com sucesso`)
          
          // Limpar o status após um tempo
          setTimeout(() => {
            setDeleteStatus(null)
          }, 2000)
        } else {
          setDeleteStatus({ id, status: "error" })
          alert("Erro ao excluir produto. Tente novamente.")
        }
      } catch (error) {
        console.error("Erro ao excluir produto:", error)
        setDeleteStatus({ id, status: "error" })
        alert("Erro ao excluir produto. Tente novamente.")
      }
    }
  }

  const handleSaveProduct = async () => {
    if (!editingProduct) return

    if (!editingProduct.name) {
      alert("O nome do produto é obrigatório")
      return
    }

    try {
      const result = await saveProduct(editingProduct)
      
      if (result.error) {
        console.error("Erro ao salvar produto:", result.error)
        alert(`Erro ao salvar produto: ${result.error.message}`)
        return
      }
      
      if (result.data) {
        // Atualizar o estado local diretamente
        if (editingProduct.id === 0) {
          // Produto novo - adicionar à lista
          setProducts(prevProducts => [...prevProducts, result.data as Product])
        } else {
          // Produto existente - atualizar na lista
          setProducts(prevProducts => 
            prevProducts.map(p => p.id === editingProduct.id ? result.data as Product : p)
          )
        }
        
        alert("Produto salvo com sucesso!")
        setIsModalOpen(false)
      } else {
        alert("Erro inesperado ao salvar produto.")
      }
    } catch (error) {
      console.error("Erro ao salvar produto:", error)
      alert("Erro ao salvar produto. Tente novamente.")
    }
  }

  const handleSizeChange = (index: number, field: string, value: string) => {
    if (!editingProduct) return;

    const updatedSizes = [...editingProduct.sizes];
    if (field === "size") {
      updatedSizes[index].size = value;
    } else if (field === "price") {
      updatedSizes[index].price = parseFloat(value) || 0;
    } else if (field === "additionalsLimit") {
      updatedSizes[index].additionalsLimit = value ? parseInt(value) : undefined;
    }

    setEditingProduct({ ...editingProduct, sizes: updatedSizes });
  };

  const handleAddSize = () => {
    if (!editingProduct) return;

    setEditingProduct({
      ...editingProduct,
      sizes: [...editingProduct.sizes, { size: "", price: 0 }],
    });
  };

  const handleRemoveSize = (index: number) => {
    if (!editingProduct) return;

    const updatedSizes = editingProduct.sizes.filter((_, i) => i !== index);
    setEditingProduct({ ...editingProduct, sizes: updatedSizes });
  };

  const handleManageAdditionals = () => {
    setIsAdditionalsModalOpen(true)

    // Agrupar adicionais por categoria para o modal
    const grouped = additionals.reduce((acc, additional) => {
      const categoryId = additional.categoryId
      if (!acc[categoryId]) {
        acc[categoryId] = []
      }
      acc[categoryId].push(additional)
      return acc
    }, {} as { [key: number]: Additional[] })

    setAdditionalsByCategory(grouped)
  }

  const toggleAdditionalSelection = (additionalId: number) => {
    if (!editingProduct) return

    const isSelected = editingProduct.allowedAdditionals.includes(additionalId)

    if (isSelected) {
      // Remover adicional
      setEditingProduct({
        ...editingProduct,
        allowedAdditionals: editingProduct.allowedAdditionals.filter((id) => id !== additionalId),
      })
    } else {
      // Adicionar adicional
      setEditingProduct({
        ...editingProduct,
        allowedAdditionals: [...editingProduct.allowedAdditionals, additionalId],
      })
    }
  }

  const selectAllAdditionals = () => {
    if (!editingProduct) return

    const allAdditionalIds = additionals.map((additional) => additional.id)
    setEditingProduct({
      ...editingProduct,
      allowedAdditionals: allAdditionalIds,
    })
  }

  const deselectAllAdditionals = () => {
    if (!editingProduct) return

    setEditingProduct({
      ...editingProduct,
      allowedAdditionals: [],
    })
  }

  const getCategoryName = (categoryId: number): string => {
    const category = categories.find((c) => c.id === categoryId)
    return category ? category.name : "Categoria desconhecida"
  }

  const getAdditionalCount = (product: Product): string => {
    const totalAdditionals = additionals.length
    const allowedCount = product.allowedAdditionals.length

    if (allowedCount === 0) {
      return "Nenhum"
    } else if (allowedCount === totalAdditionals) {
      return "Todos"
    } else {
      return `${allowedCount} de ${totalAdditionals}`
    }
  }

  if (isLoading) {
    return (
      <div className="min-h-screen flex flex-col">
        <header className="bg-purple-900 text-white p-4 sticky top-0 z-10">
          <div className="container mx-auto flex items-center">
            <Link href="/" className="mr-4">
              <ArrowLeft size={24} />
            </Link>
            <h1 className="text-xl font-bold">Admin - Gerenciar Produtos</h1>
          </div>
        </header>
        <div className="flex-1 flex justify-center items-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700"></div>
        </div>
      </div>
    )
  }

  if (!isAuthenticated) {
    return null // Será redirecionado pelo useEffect
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 via-white to-green-50">
      <header className="bg-gradient-to-r from-purple-700 via-purple-800 to-purple-900 text-white p-3 sm:p-4 sticky top-0 z-40 shadow-lg">
        <div className="container mx-auto flex items-center justify-between">
          <div className="flex items-center min-w-0 flex-1">
            <Link href="/" className="mr-2 sm:mr-4 hover:bg-white/10 p-1.5 sm:p-2 rounded-lg transition-colors flex-shrink-0">
              <ArrowLeft size={20} className="sm:hidden" />
              <ArrowLeft size={24} className="hidden sm:block" />
            </Link>
            <h1 className="text-base sm:text-lg md:text-xl font-bold bg-gradient-to-r from-white to-purple-100 bg-clip-text text-transparent truncate">
              <span className="hidden sm:inline">Admin - Painel de Controle</span>
              <span className="sm:hidden">Admin</span>
            </h1>
          </div>
          <div className="flex items-center space-x-1 sm:space-x-2 flex-shrink-0">
            <button
              onClick={() => loadData()}
              className="bg-white/10 hover:bg-white/20 p-1.5 sm:p-2 rounded-lg transition-colors"
              title="Atualizar dados"
            >
              <RefreshCw size={18} className="sm:hidden" />
              <RefreshCw size={20} className="hidden sm:block" />
            </button>
            <button
              onClick={() => {
                localStorage.removeItem("admin_authenticated")
                window.location.href = "/admin/login"
              }}
              className="bg-red-500/80 hover:bg-red-600 p-1.5 sm:p-2 rounded-lg transition-colors"
              title="Sair do painel"
            >
              <LogOut size={18} className="sm:hidden" />
              <LogOut size={20} className="hidden sm:block" />
            </button>
            <div className="hidden sm:block">
              <SocialShare />
            </div>
          </div>
        </div>
      </header>

      <div className="container mx-auto p-4">
        {/* Dashboard Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 sm:gap-6 mb-6 sm:mb-8">
          <Link
            href="/admin/pedidos"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-blue-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-blue-200"
          >
            <div className="bg-blue-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <ShoppingBag size={22} className="text-blue-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-blue-600 mb-0.5">Pedidos</h2>
              <p className="text-sm text-gray-600">Gerenciar pedidos dos clientes</p>
            </div>
          </Link>

          <Link
            href="/admin/categorias"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-green-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-green-200"
          >
            <div className="bg-green-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <Layers size={22} className="text-green-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-green-600 mb-0.5">Categorias</h2>
              <p className="text-sm text-gray-600">Organizar categorias de produtos</p>
            </div>
          </Link>

          <Link
            href="/admin/adicionais"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-orange-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-orange-200"
          >
            <div className="bg-orange-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <PlusCircle size={22} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-orange-600 mb-0.5">Adicionais</h2>
              <p className="text-sm text-gray-600">Gerenciar ingredientes extras</p>
            </div>
          </Link>

          <Link
            href="/admin/categorias-adicionais"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-pink-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-pink-200"
          >
            <div className="bg-pink-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <Layers size={22} className="text-pink-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-pink-600 mb-0.5">Categorias de Adicionais</h2>
              <p className="text-sm text-gray-600">Organizar grupos de adicionais</p>
            </div>
          </Link>

          <Link
            href="/admin/carrossel"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-indigo-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-indigo-200"
          >
            <div className="bg-indigo-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <ImageIcon size={22} className="text-indigo-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-indigo-600 mb-0.5">Carrossel</h2>
              <p className="text-sm text-gray-600">Gerenciar imagens em destaque</p>
            </div>
          </Link>

          <Link
            href="/admin/frases"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-cyan-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-cyan-200"
          >
            <div className="bg-cyan-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <MessageSquare size={22} className="text-cyan-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-cyan-600 mb-0.5">Frases</h2>
              <p className="text-sm text-gray-600">Gerenciar frases motivacionais</p>
            </div>
          </Link>

          <Link
            href="/admin/notificacoes"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-yellow-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-yellow-200"
          >
            <div className="bg-yellow-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <Bell size={22} className="text-yellow-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-yellow-600 mb-0.5">Notificações</h2>
              <p className="text-sm text-gray-600">Sistema de notificações push</p>
            </div>
          </Link>

          <Link
            href="/admin/configuracoes"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-gray-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-gray-200"
          >
            <div className="bg-gray-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <Settings size={22} className="text-gray-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-gray-600 mb-0.5">Configurações da Loja</h2>
              <p className="text-sm text-gray-600">Configurar informações e dados da loja</p>
            </div>
          </Link>

          <Link
            href="/admin/configuracoes/senha"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-red-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-red-200"
          >
            <div className="bg-red-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <Shield size={22} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-red-600 mb-0.5">Configuração de Senha</h2>
              <p className="text-sm text-gray-600">Defina ou altere a senha do painel administrativo</p>
            </div>
          </Link>

          <Link
            href="/admin/horarios"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-amber-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-amber-200"
          >
            <div className="bg-amber-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <Clock size={22} className="text-amber-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-amber-600 mb-0.5">Horários de Funcionamento</h2>
              <p className="text-sm text-gray-600">Configure os horários de funcionamento da loja</p>
            </div>
          </Link>

          <Link
            href="/admin/mesas"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-teal-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-teal-200"
          >
            <div className="bg-teal-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <Users size={22} className="text-teal-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-teal-600 mb-0.5">Mesas</h2>
              <p className="text-sm text-gray-600">Gerenciar mesas e QR codes</p>
            </div>
          </Link>

          <Link
            href="/admin/pedidos-mesa"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-orange-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-orange-200"
          >
            <div className="bg-orange-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <QrCode size={22} className="text-orange-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-orange-600 mb-0.5">Pedidos das Mesas</h2>
              <p className="text-sm text-gray-600">Gerenciar pedidos presenciais</p>
            </div>
          </Link>



          <Link
            href="/admin/relatorios"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-emerald-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-emerald-200"
          >
            <div className="bg-emerald-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-emerald-600"
              >
                <path d="M3 3v18h18"></path>
                <path d="m19 9-5 5-4-4-3 3"></path>
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-emerald-600 mb-0.5">Dashboard de Relatórios</h2>
              <p className="text-sm text-gray-600">Análise de vendas e histórico de pedidos</p>
            </div>
          </Link>

          <Link
            href="/admin/calculadora"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-red-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-red-200"
          >
            <div className="bg-red-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <Calculator size={22} className="text-red-600" />
            </div>
            <div>
              <h2 className="text-lg font-semibold bg-gradient-to-r from-red-500 to-red-700 bg-clip-text text-transparent mb-0.5">Calculadora iFood</h2>
              <p className="text-sm text-gray-600">Compare custos iFood vs seu sistema</p>
            </div>
          </Link>

          <Link
            href="/admin/paginas"
            className="bg-white rounded-xl shadow-sm hover:shadow-md p-4 sm:p-5 flex items-center hover:bg-purple-50 transition-all duration-300 hover:translate-y-[-2px] group border border-transparent hover:border-purple-200"
          >
            <div className="bg-purple-100 p-3 rounded-full mr-4 transition-all duration-300 group-hover:scale-110">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="22"
                height="22"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="text-purple-700"
              >
                <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
                <polyline points="14 2 14 8 20 8" />
                <path d="M10 13v-1h4v1" />
                <path d="M10 17v-1h4v1" />
                <path d="M10 9v1" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-purple-700 mb-0.5">Gerenciar Páginas</h2>
              <p className="text-sm text-gray-600">Edite o conteúdo das páginas do site</p>
            </div>
          </Link>


        </div>

        <div className="bg-gradient-to-br from-white via-white to-purple-50 rounded-xl shadow-sm hover:shadow-lg p-3 sm:p-4 md:p-5 mb-4 sm:mb-6 border border-transparent hover:border-purple-100/50 transition-all duration-500 relative overflow-hidden group/container">
          {/* Efeitos de fundo */}
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-purple-400 via-pink-400 to-[#92c730] rounded-t-xl group-hover/container:h-1.5 transition-all duration-500"></div>
          <div className="absolute -top-16 sm:-top-20 -right-16 sm:-right-20 w-32 sm:w-40 h-32 sm:h-40 bg-gradient-to-br from-purple-200/20 to-transparent rounded-full blur-xl sm:blur-2xl group-hover/container:scale-110 transition-transform duration-1000"></div>
          <div className="absolute -bottom-16 sm:-bottom-20 -left-16 sm:-left-20 w-32 sm:w-40 h-32 sm:h-40 bg-gradient-to-tr from-[#92c730]/10 to-transparent rounded-full blur-xl sm:blur-2xl group-hover/container:scale-110 transition-transform duration-1000 group-hover/container:rotate-12"></div>
          <div className="absolute top-1/2 -right-8 sm:right-0 w-16 sm:w-20 h-16 sm:h-20 bg-gradient-to-tl from-purple-100/5 to-transparent rounded-full blur-lg sm:blur-xl opacity-0 group-hover/container:opacity-100 transition-opacity duration-700 group-hover/container:translate-x-3 sm:group-hover/container:translate-x-6"></div>

          {/* Cabeçalho */}
          <div className="relative z-10">
            <div className="flex flex-col xs:flex-row xs:items-center justify-between gap-2 xs:gap-3 sm:gap-4 mb-3 sm:mb-4">
              <h2 className="text-base xs:text-lg sm:text-xl md:text-2xl font-bold">
                <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-700 via-purple-800 to-[#5a7c1e]">
                  Gerenciar Produtos
                </span>
              </h2>
              <div className="flex items-center bg-gradient-to-r from-purple-100 to-[#e8f5d3] text-xs sm:text-sm text-purple-800 px-2 xs:px-3 py-1 xs:py-1.5 rounded-full font-medium self-start xs:self-center">
                <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="mr-1 xs:mr-1.5 flex-shrink-0 xs:w-[14px] xs:h-[14px]">
                  <path d="m7.5 4.27 9 5.15"></path>
                  <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z"></path>
                  <path d="m3.3 7 8.7 5 8.7-5"></path>
                  <path d="M12 22V12"></path>
                </svg>
                <span>{products.length} {products.length === 1 ? 'produto' : 'produtos'}</span>
              </div>
            </div>
            <div className="w-full h-0.5 bg-gradient-to-r from-purple-100 via-[#e8f5d3] to-transparent mb-3 sm:mb-4"></div>

            {/* Barra de pesquisa e controles */}
            <div className="flex flex-col gap-2 xs:gap-3 mb-4">
              {/* Pesquisa */}
              <div className="relative w-full">
                <div className="absolute inset-y-0 left-0 flex items-center pl-3 pointer-events-none">
                  <svg className="w-3.5 h-3.5 xs:w-4 xs:h-4 text-gray-500" aria-hidden="true" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 20 20">
                    <path stroke="currentColor" strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="m19 19-4-4m0-7A7 7 0 1 1 1 8a7 7 0 0 1 14 0Z" />
                  </svg>
                </div>
                <input
                  type="text"
                  className="block w-full p-2 xs:p-2.5 pl-9 xs:pl-10 text-sm text-gray-900 border border-purple-200 rounded-lg bg-white focus:ring-purple-500 focus:border-purple-500 transition-all duration-300"
                  placeholder="Pesquisar produtos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
                {searchTerm && (
                  <button
                    className="absolute inset-y-0 right-0 flex items-center pr-3 text-gray-500 hover:text-gray-700"
                    onClick={() => setSearchTerm("")}
                  >
                    <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="xs:w-4 xs:h-4">
                      <line x1="18" y1="6" x2="6" y2="18"></line>
                      <line x1="6" y1="6" x2="18" y2="18"></line>
                    </svg>
                  </button>
                )}
              </div>

              {/* Controles de collapse/expand */}
              <div className="flex flex-col xs:flex-row gap-2">
                <button
                  onClick={toggleAllCategories}
                  className="flex items-center justify-center xs:justify-start gap-2 px-3 py-2 text-sm font-medium text-purple-700 bg-purple-100 hover:bg-purple-200 rounded-lg transition-colors duration-200 w-full xs:w-auto"
                  title={allExpanded ? "Colapsar todas" : "Expandir todas"}
                >
                  {allExpanded ? <EyeOff size={14} className="xs:w-4 xs:h-4" /> : <Eye size={14} className="xs:w-4 xs:h-4" />}
                  <span className="text-xs xs:text-sm">
                    {allExpanded ? "Colapsar todas" : "Expandir todas"}
                  </span>
                </button>

                <button
                  onClick={handleAddProduct}
                  className="flex items-center justify-center xs:justify-start gap-2 px-3 py-2 text-sm font-medium text-white bg-gradient-to-r from-purple-600 to-purple-700 hover:from-purple-700 hover:to-purple-800 rounded-lg transition-all duration-200 shadow-md hover:shadow-lg w-full xs:w-auto"
                >
                  <Plus size={14} className="xs:w-4 xs:h-4" />
                  <span className="text-xs xs:text-sm">Novo Produto</span>
                </button>
              </div>
            </div>
          </div>

          {products.length === 0 ? (
            <p className="text-center text-gray-500 py-8">
              Nenhum produto cadastrado. Clique em "Novo Produto" para começar.
            </p>
          ) : (
            <div className="space-y-6">
              {/* Agrupar produtos por categoria */}
              {categories
                .sort((a, b) => a.order - b.order) // Ordenar categorias pela ordem definida
                .map((category) => {
                  // Filtrar produtos desta categoria e aplicar filtro de pesquisa
                  const categoryProducts = products.filter(product =>
                    product.categoryId === category.id &&
                    (searchTerm === "" ||
                      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      product.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                      product.sizes.some(size => size.size.toLowerCase().includes(searchTerm.toLowerCase()))
                    )
                  );

                  // Não mostrar categorias vazias
                  if (categoryProducts.length === 0) return null;

                  const isExpanded = expandedCategories.has(category.id);

                  return (
                    <div key={category.id} className="mb-6">
                      {/* Cabeçalho da categoria com botão de toggle */}
                      <button
                        onClick={() => toggleCategory(category.id)}
                        className="w-full text-left group"
                      >
                        <h3 className="text-base xs:text-lg font-medium mb-3 xs:mb-4 pb-2 flex items-center relative hover:bg-purple-50/50 rounded-lg p-2 -m-2 transition-colors duration-200">
                          <span className="bg-gradient-to-r from-purple-400 to-[#92c730] w-1 xs:w-1.5 h-5 xs:h-6 rounded-full mr-2 xs:mr-3 flex-shrink-0"></span>

                          {/* Ícone de expand/collapse */}
                          <div className="mr-2 xs:mr-3 transition-transform duration-200 text-purple-600 flex-shrink-0">
                            {isExpanded ? (
                              <ChevronDown size={18} className="xs:w-5 xs:h-5" />
                            ) : (
                              <ChevronRight size={18} className="xs:w-5 xs:h-5" />
                            )}
                          </div>

                          <span className="bg-clip-text text-transparent bg-gradient-to-r from-purple-700 to-[#5a7c1e] font-semibold truncate min-w-0 flex-1">
                            {category.name}
                          </span>
                          <span className="text-xs bg-gradient-to-r from-purple-50 to-[#f0f7e6] text-purple-700 px-1.5 xs:px-2 py-0.5 rounded-full ml-1 xs:ml-2 font-normal border border-purple-100/30 shadow-sm flex-shrink-0">
                            {categoryProducts.length} {categoryProducts.length === 1 ? 'produto' : 'produtos'}
                          </span>
                          <div className="absolute -bottom-1 left-5 xs:left-6 right-0 h-px bg-gradient-to-r from-purple-200/50 to-transparent"></div>
                        </h3>
                      </button>

                      {/* Lista de produtos com animação */}
                      <div className={`transition-all duration-300 ease-in-out overflow-hidden ${isExpanded
                        ? 'max-h-[5000px] opacity-100'
                        : 'max-h-0 opacity-0'
                        }`}>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 xs:gap-4 sm:gap-5">
                          {categoryProducts.map((product) => (
                            <div
                              key={product.id}
                              className="border border-gray-100 rounded-xl overflow-hidden flex flex-col xs:flex-row shadow-sm hover:shadow-md transition-all duration-300 hover:translate-y-[-1px] group bg-white max-w-full"
                            >
                              <div className="w-full h-36 xs:h-24 xs:w-24 sm:h-28 sm:w-28 md:w-32 md:h-32 lg:w-36 lg:h-36 relative overflow-hidden xs:rounded-l-xl rounded-t-xl xs:rounded-tr-none flex-shrink-0">
                                <Image
                                  src={product.image || "/placeholder.svg"}
                                  alt={product.name}
                                  fill
                                  sizes="(max-width: 475px) 100vw, (max-width: 640px) 24rem, (max-width: 768px) 28rem, (max-width: 1024px) 32rem, 36rem"
                                  priority={true}
                                  className="object-cover transition-transform duration-500 group-hover:scale-110"
                                  loading="eager"
                                  onError={(e) => {
                                    // Fallback para imagem padrão em caso de erro
                                    const target = e.target as HTMLImageElement;
                                    target.src = '/placeholder.svg';
                                  }}
                                />
                                {!product.image && (
                                  <div className="absolute inset-0 flex items-center justify-center bg-gray-50">
                                    <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round" className="text-gray-300 xs:w-6 xs:h-6 sm:w-8 sm:h-8"><rect width="18" height="18" x="3" y="3" rx="2" ry="2"></rect><circle cx="9" cy="9" r="2"></circle><path d="m21 15-3.086-3.086a2 2 0 0 0-2.828 0L6 21"></path></svg>
                                  </div>
                                )}
                              </div>
                              <div className="p-2 xs:p-3 sm:p-4 flex-1 min-w-0">
                                {/* Header com nome e badges de status */}
                                <div className="mb-2 sm:mb-3">
                                  <h3 className="font-semibold text-purple-900 text-sm xs:text-base sm:text-lg mb-1 sm:mb-2 line-clamp-1">
                                    {product.name}
                                  </h3>

                                  {/* Badges de status organizados responsivamente */}
                                  <div className="flex flex-wrap gap-1 xs:gap-1.5 sm:gap-2 text-[9px] xs:text-[10px] sm:text-xs">
                                    <span className="bg-blue-50 text-blue-700 px-1 xs:px-1.5 sm:px-2 py-0.5 rounded-full border border-blue-100 flex-shrink-0">
                                      Adicionais: {getAdditionalCount(product)}
                                    </span>

                                    {product.hiddenFromDelivery && (
                                      <span className="bg-purple-100 text-purple-600 px-1 xs:px-1.5 sm:px-2 py-0.5 rounded-full border border-purple-200 flex-shrink-0">
                                        <span className="hidden sm:inline">Delivery: Oculto</span>
                                        <span className="sm:hidden">Del: ✗</span>
                                      </span>
                                    )}

                                    {product.hiddenFromTable && (
                                      <span className="bg-orange-100 text-orange-600 px-1 xs:px-1.5 sm:px-2 py-0.5 rounded-full border border-orange-200 flex-shrink-0">
                                        <span className="hidden sm:inline">Mesa: Oculto</span>
                                        <span className="sm:hidden">Mesa: ✗</span>
                                      </span>
                                    )}
                                  </div>
                                </div>

                                {/* Controles de visibilidade */}
                                <div className="flex flex-col xs:flex-row xs:justify-between xs:items-center gap-2">
                                  {/* Botões específicos de delivery e mesa */}
                                  <div className="flex space-x-1.5 xs:space-x-2 flex-shrink-0">
                                    <DeliveryVisibilityToggle
                                      productId={product.id}
                                      isHidden={product.hiddenFromDelivery || false}
                                      onToggle={(productId: number, newHiddenFromDelivery: boolean) => {
                                        // Atualizar o estado local após alternar a visibilidade no delivery
                                        const updatedProducts = products.map(p =>
                                          p.id === productId ? { ...p, hiddenFromDelivery: newHiddenFromDelivery } : p
                                        );
                                        setProducts(updatedProducts);
                                      }}
                                    />
                                    <TableVisibilityToggle
                                      productId={product.id}
                                      initialHiddenFromTable={product.hiddenFromTable}
                                      onToggle={(newHiddenFromTable: boolean) => {
                                        // Atualizar o estado local após alternar a visibilidade em mesa
                                        const updatedProducts = products.map(p =>
                                          p.id === product.id ? { ...p, hiddenFromTable: newHiddenFromTable } : p
                                        );
                                        setProducts(updatedProducts);
                                      }}
                                    />
                                  </div>

                                  {/* Botões de ação */}
                                  <div className="flex space-x-1 xs:space-x-1.5 flex-shrink-0">
                                    <button
                                      onClick={() => handleEditProduct(product)}
                                      className="text-blue-600 hover:text-blue-800 p-1 xs:p-1.5 sm:p-2 rounded-full hover:bg-blue-50 transition-colors touch-manipulation"
                                      aria-label="Editar produto"
                                    >
                                      <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="xs:w-4 xs:h-4 sm:w-5 sm:h-5"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
                                    </button>
                                    <button
                                      onClick={() => handleDeleteProduct(product.id)}
                                      className="text-red-600 hover:text-red-800 p-1 xs:p-1.5 sm:p-2 rounded-full hover:bg-red-50 transition-colors touch-manipulation"
                                      disabled={deleteStatus?.id === product.id && deleteStatus.status === "pending"}
                                      aria-label="Excluir produto"
                                    >
                                      {deleteStatus?.id === product.id && deleteStatus.status === "pending" ? (
                                        <span className="animate-pulse text-[10px] xs:text-xs">...</span>
                                      ) : (
                                        <Trash2 className="w-3.5 h-3.5 xs:w-4 xs:h-4 sm:w-5 sm:h-5" />
                                      )}
                                    </button>
                                  </div>
                                </div>
                                <p className="text-xs xs:text-sm text-gray-500 line-clamp-2 mt-2 leading-relaxed">{product.description}</p>
                                <div className="mt-2 flex flex-wrap gap-1 xs:gap-2">
                                  {product.sizes.map((size, index) => (
                                    <span key={createSafeKey(`${product.id}-${index}-${size.size}-${size.price}`, 'size-display')} className="bg-gray-50 px-1.5 xs:px-2 py-0.5 xs:py-1 rounded-md text-gray-700 border border-gray-100 text-xs xs:text-sm">
                                      {size.size}: <span className="font-medium text-purple-700">{formatCurrency(size.price)}</span>
                                    </span>
                                  ))}
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      </div>

      {/* Edit Product Modal */}
      {isModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-purple-900">
                {products.some((p) => p.id === editingProduct.id) ? "Editar Produto" : "Novo Produto"}
              </h2>
            </div>

            <div className="p-4 space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Nome do Produto</label>
                <input
                  type="text"
                  value={editingProduct.name}
                  onChange={(e) => setEditingProduct({ ...editingProduct, name: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Nome do produto"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Categoria</label>
                <select
                  value={editingProduct.categoryId}
                  onChange={(e) => setEditingProduct({ ...editingProduct, categoryId: parseInt(e.target.value) })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                >
                  {categories.map((category) => (
                    <option key={category.id} value={category.id}>
                      {category.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="product-visibility"
                    checked={!editingProduct.hidden}
                    onChange={(e) => setEditingProduct({ ...editingProduct, hidden: !e.target.checked })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="product-visibility" className="text-sm font-medium text-gray-700">
                    Produto visível para clientes
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="product-table-visibility"
                    checked={!editingProduct.hiddenFromTable}
                    onChange={(e) => setEditingProduct({ ...editingProduct, hiddenFromTable: !e.target.checked })}
                    className="w-4 h-4 text-orange-600 border-gray-300 rounded focus:ring-orange-500"
                  />
                  <label htmlFor="product-table-visibility" className="text-sm font-medium text-gray-700">
                    Produto visível no sistema de mesa
                  </label>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="checkbox"
                    id="product-needs-spoon"
                    checked={editingProduct.needsSpoon}
                    onChange={(e) => setEditingProduct({ ...editingProduct, needsSpoon: e.target.checked })}
                    className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                  />
                  <label htmlFor="product-needs-spoon" className="text-sm font-medium text-gray-700">
                    Precisa de Colher? (Pergunta ao cliente)
                  </label>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
                <textarea
                  value={editingProduct.description}
                  onChange={(e) => setEditingProduct({ ...editingProduct, description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="Descrição do produto"
                  rows={3}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">URL da Imagem</label>
                <input
                  type="text"
                  value={editingProduct.image}
                  onChange={(e) => setEditingProduct({ ...editingProduct, image: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                  placeholder="URL da imagem"
                />
              </div>

              <div>
                <div className="flex justify-between items-center mb-2">
                  <label className="block text-sm font-medium text-gray-700">Tamanhos e Preços</label>
                  <button
                    type="button"
                    onClick={handleAddSize}
                    className="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-md flex items-center"
                  >
                    <Plus size={16} className="mr-1" />
                    Adicionar Tamanho
                  </button>
                </div>

                {editingProduct.sizes.map((size, index) => (
                  <div key={createSafeKey(index, 'size-item')} className="border border-gray-200 rounded-lg p-4 mb-3 hover:border-purple-300 transition-colors">
                    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 items-end">
                      {/* Tamanho */}
                      <div className="md:col-span-3">
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Tamanho</label>
                        <input
                          type="text"
                          value={size.size}
                          onChange={(e) => handleSizeChange(index, "size", e.target.value)}
                          className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                          placeholder="Ex: 500ml"
                        />
                      </div>

                      {/* Preço */}
                      <div className="md:col-span-4">
                        <label className="block text-xs text-gray-500 mb-1 font-medium">Preço</label>
                        <div className="relative">
                          <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <span className="text-gray-500 text-sm">R$</span>
                          </div>
                          <input
                            type="number"
                            value={size.price === 0 ? '' : size.price}
                            onChange={(e) => handleSizeChange(index, "price", e.target.value)}
                            className="w-full pl-8 pr-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500"
                            placeholder="0,00"
                            step="0.01"
                            min="0"
                            inputMode="decimal"
                          />
                        </div>
                      </div>

                      {/* Limite de adicionais */}
                      <div className="md:col-span-3">
                        <label className="block text-xs text-gray-500 mb-1 font-medium whitespace-nowrap">Limite de adicionais</label>
                        <input
                          type="number"
                          value={size.additionalsLimit ?? ''}
                          onChange={(e) => handleSizeChange(index, "additionalsLimit", e.target.value)}
                          className="w-full px-3 py-2 text-sm sm:text-base border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-purple-500 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
                          placeholder="Vazio = sem limite"
                          min="0"
                          max="20"
                        />
                      </div>

                      {/* Botão remover */}
                      <div className="md:col-span-2 flex justify-center">
                        <button
                          type="button"
                          onClick={() => handleRemoveSize(index)}
                          className="p-2 rounded-full transition-colors bg-red-100 text-red-600 hover:bg-red-200 cursor-pointer"
                          title="Remover tamanho"
                          aria-label="Remover tamanho"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
                {editingProduct.sizes.length === 0 && (
                  <p className="text-sm text-gray-500 italic">Nenhum tamanho adicionado. O produto será vendido sem variação de tamanho.</p>
                )}
              </div>

              <div>
                <div className="flex justify-between items-center">
                  <label className="block text-sm font-medium text-gray-700">Adicionais Permitidos</label>
                  <button
                    onClick={handleManageAdditionals}
                    className="text-sm bg-purple-100 text-purple-800 px-3 py-1 rounded-md"
                  >
                    Gerenciar Adicionais
                  </button>
                </div>
                <p className="text-xs text-gray-500 mt-1">
                  {!editingProduct.allowedAdditionals || editingProduct.allowedAdditionals.length === 0
                    ? "Nenhum adicional selecionado"
                    : editingProduct.allowedAdditionals.length === additionals.length
                      ? "Todos os adicionais selecionados"
                      : `${editingProduct.allowedAdditionals.length} adicionais selecionados`}
                </p>
              </div>

              <div className="bg-blue-50 border border-blue-200 rounded-lg p-3">
                <div className="flex items-center mb-2">
                  <svg className="w-4 h-4 text-blue-600 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7-4a1 1 0 11-2 0 1 1 0 012 0zM9 9a1 1 0 000 2v3a1 1 0 001 1h1a1 1 0 100-2v-3a1 1 0 00-1-1H9z" clipRule="evenodd" />
                  </svg>
                  <h4 className="text-sm font-medium text-blue-800">Sistema de Limites por Tamanho</h4>
                </div>
                <p className="text-xs text-blue-700">
                  Configure o limite de adicionais individualmente para cada tamanho acima.
                  Deixe vazio para permitir adicionais ilimitados naquele tamanho.
                </p>
              </div>

              {/* Gerenciador de Preços de Mesa */}
              <div>
                <TablePricingManager
                  product={editingProduct}
                  onUpdate={(updatedProduct) => setEditingProduct(updatedProduct)}
                />
              </div>
            </div>

            <div className="p-4 border-t sticky bottom-0 bg-white flex justify-end space-x-2">
              <button
                onClick={() => setIsModalOpen(false)}
                className="px-4 py-2 border border-gray-300 rounded-md text-gray-700"
              >
                Cancelar
              </button>
              <button
                onClick={handleSaveProduct}
                className="px-4 py-2 bg-purple-700 text-white rounded-md flex items-center"
              >
                <Save size={18} className="mr-1" />
                Salvar
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal de seleção de adicionais */}
      {isAdditionalsModalOpen && editingProduct && (
        <div className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-md w-full max-h-[90vh] overflow-auto">
            <div className="p-4 border-b sticky top-0 bg-white z-10">
              <h2 className="text-lg font-semibold text-purple-900">Adicionais para {editingProduct.name}</h2>
            </div>

            <div className="p-4">
              <div className="flex flex-col space-y-2 mb-4">
                <div className="flex justify-between">
                  <button
                    onClick={selectAllAdditionals}
                    className="px-3 py-1 bg-blue-100 text-blue-800 rounded-md text-sm"
                  >
                    Selecionar Todos
                  </button>
                  <button
                    onClick={deselectAllAdditionals}
                    className="px-3 py-1 bg-gray-100 text-gray-800 rounded-md text-sm"
                  >
                    Limpar Seleção
                  </button>
                </div>
                <div className="text-xs text-gray-500 italic">
                  Cada adicional mostra a categoria a qual pertence
                </div>
              </div>

              {additionals.length === 0 ? (
                <p className="text-center text-gray-500 py-4">
                  Nenhum adicional cadastrado. Adicione adicionais na página de gerenciamento de adicionais.
                </p>
              ) : (
                <div className="space-y-6">
                  {/* Renderizar adicionais agrupados por categoria */}
                  {additionalCategories
                    .sort((a, b) => a.order - b.order)
                    .map((category) => {
                      // Obter adicionais desta categoria
                      const categoryAdditionals = additionalsByCategory[category.id] || [];

                      // Não mostrar categorias vazias
                      if (categoryAdditionals.length === 0) return null;

                      return (
                        <div key={createSafeKey(category.id, 'admin-additional-category')} className="mb-4">
                          <h3 className="text-md font-medium text-purple-800 mb-2 pb-1 border-b border-purple-200">
                            {category.name} <span className="text-xs text-gray-500">({categoryAdditionals.length})</span>
                          </h3>

                          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                            {categoryAdditionals.map((additional, index) => (
                              <div
                                key={createSafeKey(additional.id, 'admin-additional-option', index)}
                                className={`flex items-center justify-between p-3 border rounded-md ${editingProduct.allowedAdditionals?.includes(additional.id) ? "border-purple-500 bg-purple-50" : "border-gray-200"
                                  }`}
                              >
                                <div className="flex items-center">
                                  <div className="w-10 h-10 relative mr-3 bg-purple-100 rounded-md overflow-hidden">
                                    {additional.image ? (
                                      <Image
                                        src={additional.image || "/placeholder.svg"}
                                        alt={additional.name}
                                        fill
                                        sizes="40px"
                                        className="object-cover"
                                      />
                                    ) : (
                                      <div className="flex items-center justify-center h-full text-purple-300">
                                        <Plus size={16} />
                                      </div>
                                    )}
                                  </div>
                                  <div>
                                    <p className="font-medium">{additional.name}</p>
                                    <p className="text-sm text-purple-700">{additional.price > 0 ? formatCurrency(additional.price) : "Grátis"}</p>
                                  </div>
                                </div>

                                <button
                                  onClick={() => toggleAdditionalSelection(additional.id)}
                                  className={`w-8 h-8 rounded-full flex items-center justify-center ${editingProduct.allowedAdditionals?.includes(additional.id) ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-600"
                                    }`}
                                >
                                  {editingProduct.allowedAdditionals?.includes(additional.id) ? <Check size={16} /> : <Plus size={16} />}
                                </button>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })}

                  {/* Renderizar adicionais sem categoria */}
                  {additionalsByCategory[0] && additionalsByCategory[0].length > 0 && (
                    <div className="mb-4">
                      <h3 className="text-md font-medium text-gray-600 mb-2 pb-1 border-b border-gray-200">
                        Sem categoria <span className="text-xs text-gray-500">({additionalsByCategory[0].length})</span>
                      </h3>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                        {additionalsByCategory[0].map((additional, index) => (
                          <div
                            key={createSafeKey(additional.id, 'admin-additional-option-no-category', index)}
                            className={`flex items-center justify-between p-3 border rounded-md ${editingProduct.allowedAdditionals?.includes(additional.id) ? "border-purple-500 bg-purple-50" : "border-gray-200"
                              }`}
                          >
                            <div className="flex items-center">
                              <div className="w-10 h-10 relative mr-3 bg-purple-100 rounded-md overflow-hidden">
                                {additional.image ? (
                                  <Image
                                    src={additional.image || "/placeholder.svg"}
                                    alt={additional.name}
                                    fill
                                    sizes="40px"
                                    className="object-cover"
                                  />
                                ) : (
                                  <div className="flex items-center justify-center h-full text-purple-300">
                                    <Plus size={16} />
                                  </div>
                                )}
                              </div>
                              <div>
                                <p className="font-medium">{additional.name}</p>
                                <p className="text-sm text-purple-700">{additional.price > 0 ? formatCurrency(additional.price) : "Grátis"}</p>
                              </div>
                            </div>

                            <button
                              onClick={() => toggleAdditionalSelection(additional.id)}
                              className={`w-8 h-8 rounded-full flex items-center justify-center ${editingProduct.allowedAdditionals?.includes(additional.id) ? "bg-purple-600 text-white" : "bg-gray-200 text-gray-600"
                                }`}
                            >
                              {editingProduct.allowedAdditionals?.includes(additional.id) ? <Check size={16} /> : <Plus size={16} />}
                            </button>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-4 border-t sticky bottom-0 bg-white flex justify-end space-x-2">
              <button
                onClick={() => setIsAdditionalsModalOpen(false)}
                className="px-4 py-2 bg-purple-700 text-white rounded-md"
              >
                Concluído
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Botão de compartilhamento social para o PWA */}
      <SocialShare title="Loja Virtual - Admin" message="Acesse o painel administrativo da Loja Virtual!" />
    </div>
  )
}
