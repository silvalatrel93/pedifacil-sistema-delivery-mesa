"use client"

import { useState, useEffect, useMemo, useRef, useCallback } from "react"
import { useSearchParams } from "next/navigation"
import { getVisibleProductsWithContext } from "@/lib/services/product-service"
import { getActiveCategories } from "@/lib/services/category-service"
import ProductCard from "@/components/product-card"
import { ImagePreloader } from "@/components/image-preloader"
import type { Product, Category } from "@/lib/types"
import { createSafeKey } from "@/lib/key-utils"

interface ProductListProps {
  products?: Product[]
  categories?: Category[]
  storeColor?: string
}

// Função auxiliar para abreviar nomes de categorias
const abbreviateCategory = (name: string, isMobile: boolean): string => {
  // Mapeamento de nomes longos para versões abreviadas
  const abbreviations: Record<string, string> = {
    "PROMOÇÃO DIA": "PROMOÇÃO",
    "TOPS HEAI AÇAÍ COPO PRONTO": "AÇAÍ PRONTO",
    "MONTE SEU AÇAÍ NO COPO": "MONTE SEU AÇAÍ",
    "AÇAÍ TRADICIONAL": "TRADICIONAL",
    "AÇAÍ ESPECIAL": "ESPECIAL",
    "AÇAÍ KIDS": "KIDS",
    "AÇAÍ ZERO AÇÚCAR": "ZERO AÇÚCAR",
    "AÇAÍ COM SORVETE": "C/ SORVETE",
    "MILK SHAKE": "MILK SHAKE",
    "SORVETE TRADICIONAL": "SORVETE",
    "PICOLÉ TRADICIONAL": "PICOLÉ"
  };

  // Se for mobile, usar versões mais curtas
  if (isMobile && abbreviations[name]) {
    return abbreviations[name];
  }

  // Para desktop, podemos usar versões um pouco mais longas
  if (!isMobile && name.length > 20) {
    return abbreviations[name] || name.substring(0, 20) + "...";
  }

  return name;
};

export default function ProductList({ products: _initialProducts = [], categories: initialCategories = [], storeColor = "#8B5CF6" }: ProductListProps) {
  const searchParams = useSearchParams()
  const [allProducts, setAllProducts] = useState<Product[]>([])
  const [categories, setCategories] = useState<Category[]>(initialCategories)
  const [selectedCategory, setSelectedCategory] = useState<number | null>(0)
  const [activeCategory, setActiveCategory] = useState<number | null>(null)
  const [isInitialLoading, setIsInitialLoading] = useState(true)
  const [isBarFixed, setIsBarFixed] = useState(false)
  const [isScrollingDown, setIsScrollingDown] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const prevScrollY = useRef(0)
  const categoriesBarRef = useRef<HTMLDivElement>(null)
  const categoryRefs = useRef<Map<number, HTMLDivElement | null>>(new Map())
  const categoryButtonsRef = useRef<Map<number, HTMLButtonElement | null>>(new Map())
  const initialCategoriesBarPosition = useRef<number | null>(null)
  const contentRef = useRef<HTMLDivElement>(null)

  // Detectar dispositivo móvel e injetar estilos CSS para a barra de categorias
  useEffect(() => {
    // Detectar se é dispositivo móvel
    const checkIfMobile = () => {
      const userAgent = window.navigator.userAgent.toLowerCase();
      const isMobileDevice = /android|webos|iphone|ipad|ipod|blackberry|iemobile|opera mini/i.test(userAgent);
      const isSmallScreen = window.innerWidth < 768;
      setIsMobile(isMobileDevice || isSmallScreen);
    };

    // Verificar inicialmente
    checkIfMobile();

    // Adicionar listener para redimensionamento da janela
    window.addEventListener('resize', checkIfMobile);

    // Injetar estilos CSS
    const styleElement = document.createElement("style")
    styleElement.innerHTML = `
      /* Estilização da barra de rolagem */
      .categories-scrollbar::-webkit-scrollbar {
        height: 4px;
        background-color: transparent;
      }
      
      .categories-scrollbar::-webkit-scrollbar-thumb {
        background-color: rgba(139, 92, 246, 0.3);
        border-radius: 10px;
        transition: background-color 0.3s ease;
      }
      
      .categories-scrollbar::-webkit-scrollbar-thumb:hover {
        background-color: rgba(139, 92, 246, 0.7);
      }
      
      .categories-scrollbar {
        scrollbar-width: thin;
        scrollbar-color: rgba(139, 92, 246, 0.3) transparent;
        -ms-overflow-style: none; /* IE and Edge */
        overflow-x: auto;
        overflow-y: hidden;
        -webkit-overflow-scrolling: touch; /* Suave no iOS */
        scroll-behavior: smooth;
        will-change: transform;
        backface-visibility: hidden;
        transform: translateZ(0);
      }
      
      /* Suporte para navegadores que não suportam scrollbar-width */
      @supports not (scrollbar-width: thin) {
        .categories-scrollbar {
          scrollbar-width: none; /* Firefox */
        }
        .categories-scrollbar::-webkit-scrollbar {
          display: none; /* Chrome, Safari e Opera */
        }
      }
      
      .scroll-snap-align-center {
        scroll-snap-align: center;
        scroll-snap-stop: always;
      }
      
      /* Ajustes responsivos para categorias */
      @media (max-width: 640px) {
        .category-button {
          padding: 0.5rem 0.75rem;
          font-size: 0.875rem;
        }
      }
      
      @media (max-width: 480px) {
        .category-button {
          padding: 0.375rem 0.625rem;
          font-size: 0.75rem;
        }
      }
    `
    document.head.appendChild(styleElement)

    return () => {
      document.head.removeChild(styleElement)
      window.removeEventListener('resize', checkIfMobile);
    }
  }, [])

  // Carregar categorias e todos os produtos uma única vez no início
  useEffect(() => {
    const initializeData = async () => {
      try {
        // Carregar categorias
        const activeCategories = await getActiveCategories()
        const allOption: Category = {
          id: 0,
          name: "Todos",
          order: -1,
          active: true,
        }
        const categoriesWithAll = [allOption, ...activeCategories]
        setCategories(categoriesWithAll)

        // Se produtos foram passados como props (ex: página de mesa), usar eles
        // Caso contrário, carregar produtos do contexto
        if (_initialProducts && _initialProducts.length > 0) {
          setAllProducts(_initialProducts)
        } else {
          const allProductsList = await getVisibleProductsWithContext()
          setAllProducts(allProductsList)
        }

        // Selecionar a primeira categoria por padrão
        if (categoriesWithAll.length > 0) {
          setSelectedCategory(categoriesWithAll[0].id)
        }
      } catch (error) {
        console.error("Erro ao carregar dados iniciais:", error)
      } finally {
        setIsInitialLoading(false)
      }
    }

    initializeData()
  }, [_initialProducts])

  // Sincronizar categoria da URL (parametro 'categoria')
  useEffect(() => {
    const categoriaParam = searchParams?.get('categoria')
    if (categoriaParam) {
      const parsed = parseInt(categoriaParam, 10)
      if (!isNaN(parsed)) {
        setSelectedCategory(parsed)
        setActiveCategory(parsed)
      }
    }
  }, [searchParams])

  // Se houver 'produto' na URL, mudar automaticamente para a categoria do produto
  useEffect(() => {
    const produtoParam = searchParams?.get('produto')
    const openProductId = produtoParam ? parseInt(produtoParam, 10) : NaN
    if (!isNaN(openProductId) && allProducts.length > 0) {
      const target = allProducts.find(p => Number(p.id) === openProductId)
      if (target && target.categoryId !== undefined && target.categoryId !== null) {
        if (selectedCategory !== target.categoryId) {
          setSelectedCategory(target.categoryId)
          setActiveCategory(target.categoryId)
        }
      }
    }
  }, [searchParams, allProducts])

  // Atualizar produtos quando os props mudarem (importante para páginas de mesa)
  useEffect(() => {
    if (_initialProducts && _initialProducts.length > 0) {
      setAllProducts(_initialProducts)
    }
  }, [_initialProducts])

  // Filtrar produtos com base na categoria selecionada (feito no cliente)
  const filteredProducts = useMemo(() => {
    if (!selectedCategory) return []
    if (selectedCategory === 0) return allProducts // "Todos"
    return allProducts.filter((product) => product.categoryId === selectedCategory)
  }, [selectedCategory, allProducts])

  // Coletar URLs das imagens dos produtos para preload (apenas da categoria atual)
  const productImageUrls = useMemo(() => {
    if (selectedCategory === 0) {
      // Para "Todos", precarregar apenas as primeiras imagens de cada categoria
      const firstProductsPerCategory = categories
        .filter(cat => cat.id !== 0)
        .map(cat => {
          const categoryProducts = allProducts.filter(p => p.categoryId === cat.id)
          return categoryProducts.slice(0, 2) // Apenas os 2 primeiros de cada categoria
        })
        .flat()
        .map(product => product.image)
        .filter(Boolean)

      return firstProductsPerCategory
    } else {
      // Para categoria específica, precarregar todas as imagens da categoria
      return filteredProducts.map(product => product.image).filter(Boolean)
    }
  }, [selectedCategory, allProducts, categories, filteredProducts])

  // Função para controlar a barra fixa durante o scroll
  const handleScroll = useCallback(() => {
    const currentScrollY = window.scrollY

    // Salvar a posição inicial da barra de categorias
    if (initialCategoriesBarPosition.current === null && categoriesBarRef.current) {
      initialCategoriesBarPosition.current = categoriesBarRef.current.getBoundingClientRect().top + window.scrollY
    }

    // Verificar a direção do scroll
    const isScrollDown = currentScrollY > prevScrollY.current
    setIsScrollingDown(isScrollDown)

    // Verificar se a barra deve ser fixa
    if (initialCategoriesBarPosition.current !== null) {
      const shouldBeFixed = currentScrollY > initialCategoriesBarPosition.current - 56

      // Aplicar a fixação da barra com base na posição, sem alternar rapidamente
      if (shouldBeFixed !== isBarFixed) {
        // Usar um pequeno atraso para evitar mudanças rápidas de estado
        requestAnimationFrame(() => {
          setIsBarFixed(shouldBeFixed)
        })
      }
    }

    prevScrollY.current = currentScrollY

    // Detectar categoria ativa durante a rolagem
    if (selectedCategory === 0) {
      const headerHeight = 56
      const categoriesBarHeight = 56
      const offset = headerHeight + categoriesBarHeight + 20

      let activeId = null
      let minDistance = Infinity

      categoryRefs.current.forEach((ref, id) => {
        if (ref) {
          const rect = ref.getBoundingClientRect()
          if (rect.top <= offset) {
            const distance = Math.abs(rect.top - offset)
            if (distance < minDistance) {
              minDistance = distance
              activeId = id
            }
          }
        }
      })

      if (activeId !== activeCategory) {
        setActiveCategory(activeId)

        // Rolar a barra de categorias para mostrar a categoria ativa
        const buttonRef = activeId !== null ? categoryButtonsRef.current.get(activeId) : null
        const categoriesContainer = document.querySelector('.categories-scrollbar');
        if (buttonRef && categoriesContainer) {
          const containerRect = categoriesContainer.getBoundingClientRect();
          const buttonRect = buttonRef.getBoundingClientRect();

          // Calcular a posição de scroll para centralizar o botão
          const scrollLeft = buttonRect.left - containerRect.left - (containerRect.width / 2) + (buttonRect.width / 2);

          // Aplicar o scroll com comportamento suave apenas se a diferença for significativa
          if (Math.abs(scrollLeft) > buttonRect.width / 2) {
            categoriesContainer.scrollTo({
              left: categoriesContainer.scrollLeft + scrollLeft,
              behavior: 'smooth'
            });
          }
        }
      }
    }
  }, [selectedCategory, activeCategory])

  // Função para limitar a frequência de execução do handler de scroll usando requestAnimationFrame
  const throttledScrollHandler = useCallback(() => {
    let ticking = false
    return () => {
      if (!ticking) {
        window.requestAnimationFrame(() => {
          handleScroll()
          ticking = false
        })
        ticking = true
      }
    }
  }, [handleScroll])

  // Adicionar listener de scroll
  useEffect(() => {
    const scrollHandler = throttledScrollHandler()
    window.addEventListener('scroll', scrollHandler)
    handleScroll()

    return () => {
      window.removeEventListener('scroll', scrollHandler)
    }
  }, [throttledScrollHandler, handleScroll])

  // Função para mudar de categoria com transição suave
  const handleCategoryChange = (categoryId: number) => {
    if (categoryId === selectedCategory) return

    // Mudar a categoria imediatamente
    setSelectedCategory(categoryId)
    setActiveCategory(categoryId) // Atualizar a categoria ativa

    // Rolar para a categoria selecionada se for "Todos" e a categoria existe
    if (categoryId !== 0 && selectedCategory === 0) {
      const categoryRef = categoryRefs.current.get(categoryId)
      if (categoryRef) {
        const headerHeight = 56 // Altura do cabeçalho fixo
        const categoriesBarHeight = 56 // Altura da barra de categorias
        const headerOffset = headerHeight + categoriesBarHeight + 10 // Adicionar margem extra

        const elementPosition = categoryRef.getBoundingClientRect().top + window.scrollY
        const offsetPosition = elementPosition - headerOffset

        window.scrollTo({
          top: offsetPosition,
          behavior: "smooth"
        })
      }
    }
  }

  // Renderizar produtos agrupados por categoria quando "Todos" está selecionado
  const renderProductsByCategory = () => {
    return categories
      .filter((category) => category.id !== 0) // Excluir a categoria "Todos"
      .map((category) => {
        const categoryProducts = allProducts.filter((product) => product.categoryId === category.id)

        if (categoryProducts.length === 0) return null

        return (
          <div
            key={createSafeKey(category.id, 'category')}
            className="mb-8"
            ref={(el) => {
              if (el) categoryRefs.current.set(category.id, el);
            }}
            id={`category-${category.id}`}
          >
            <div className="relative mb-6">
              <div className="flex flex-col items-center">
                <h2 className="text-xl font-bold mb-2 text-transparent bg-clip-text relative z-10 text-center" data-component-name="ProductList" style={{
                  backgroundImage: `linear-gradient(to right, ${storeColor}, ${storeColor}dd)`
                }}>{category.name}</h2>
                {selectedCategory === 0 && (
                  <div className="w-3/4 h-0.5" style={{
                    backgroundImage: `linear-gradient(to right, transparent, ${storeColor}, transparent)`
                  }}></div>
                )}
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
              {categoryProducts.map((product, index) => {
                const produtoParam = searchParams?.get('produto')
                const openProductId = produtoParam ? parseInt(produtoParam, 10) : NaN
                const forceOpen = !isNaN(openProductId) && Number(product.id) === openProductId
                return (
                  <ProductCard
                    key={createSafeKey(product.id, 'product')}
                    product={product}
                    priority={index < 2} // Prioridade para os primeiros 2 produtos por categoria 
                    storeColor={storeColor}
                    forceOpen={forceOpen}
                  />
                )
              })}
            </div>
          </div>
        )
      })
  }

  return (
    <div className="w-full">
      {/* Preloader de imagens otimizado */}
      <ImagePreloader
        imageUrls={productImageUrls}
        maxPreload={6}
        delay={2000} // Aguardar 2 segundos após o carregamento da página
      />

      {/* Barra de categorias */}
      <div
        ref={categoriesBarRef}
        style={{
          position: isBarFixed ? "fixed" : "relative",
          top: isBarFixed ? "56px" : "auto",
          left: 0,
          right: 0,
          width: "100%",
          zIndex: 20,
          padding: "4px 0",
          boxShadow: "0 1px 3px rgba(0,0,0,0.12)",
          transition: "transform 0.3s ease, opacity 0.3s ease",
          transform: isBarFixed && !isScrollingDown ? "translateY(-100%)" : "translateY(0)",
          opacity: isBarFixed && !isScrollingDown ? 0 : 1,
          background: "rgba(255, 255, 255, 0.95)",
          backdropFilter: "blur(8px)",
          WebkitBackdropFilter: "blur(8px)",
          borderBottom: "1px solid #eaeaea",
          marginLeft: 0,
          marginRight: 0,
          boxSizing: "border-box",
          willChange: "transform, opacity"
        }}
      >
        <div className="relative">
          {/* Gradiente de fade à esquerda */}
          <div
            className="absolute left-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{
              background: "linear-gradient(to right, white, transparent)",
            }}
          ></div>

          <div
            className="flex overflow-x-auto py-1 gap-2 pl-3 pr-3 md:gap-3 md:pl-4 md:pr-4 categories-scrollbar"
            style={{
              WebkitOverflowScrolling: 'touch',
              scrollBehavior: 'smooth',
              scrollSnapType: 'x mandatory',
              scrollPadding: '0 1rem',
              overscrollBehaviorX: 'contain'
            }}
          >
            {categories.map((category) => (
              <button
                key={createSafeKey(category.id, 'category-tab')}
                ref={(el) => {
                  if (el) categoryButtonsRef.current.set(category.id, el);
                }}
                onClick={() => handleCategoryChange(category.id)}
                className="category-button px-4 py-2 rounded-full whitespace-nowrap transition-all duration-200 hover:scale-105 focus:outline-none focus:ring-2 scroll-snap-align-center"
                style={{
                  ...(selectedCategory === category.id || (selectedCategory === 0 && activeCategory === category.id)
                    ? {
                        backgroundImage: `linear-gradient(to right, ${storeColor}, ${storeColor}dd)`,
                        color: 'white',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
                        fontWeight: '500',
                        focusRingColor: `${storeColor}66`
                      }
                    : {
                        backgroundColor: 'white',
                        color: '#374151',
                        border: '1px solid #e5e7eb'
                      }
                  )
                }}
                data-component-name="ProductList"
                title={category.name} // Mostrar o nome completo no tooltip
              >
                {abbreviateCategory(category.name, isMobile)}
              </button>
            ))}
          </div>

          {/* Gradiente de fade à direita */}
          <div
            className="absolute right-0 top-0 bottom-0 w-8 z-10 pointer-events-none"
            style={{
              background: "linear-gradient(to left, white, transparent)",
            }}
          ></div>
        </div>
      </div>

      {/* Espaçador para compensar a barra de categorias fixa (apenas quando está fixa) */}
      {isBarFixed && <div className="h-[56px]"></div>}

      {/* Conteúdo dos produtos com transição suave */}
      <div className="px-3 sm:px-4 lg:px-6 py-4 min-h-[500px]">
        {isInitialLoading ? (
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-700"></div>
          </div>
        ) : (
          <div
            ref={contentRef}
            className="transition-opacity duration-300 opacity-100"
          >
            {filteredProducts.length === 0 && selectedCategory !== 0 ? (
              <div className="text-center py-12">
                <p className="text-gray-500">Nenhum produto encontrado nesta categoria.</p>
              </div>
            ) : selectedCategory === 0 ? (
              // Exibição agrupada por categoria quando "Todos" está selecionado
              <div>{renderProductsByCategory()}</div>
            ) : (
              // Exibição normal para categorias específicas
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-3 sm:gap-4">
                {filteredProducts.map((product) => {
                  const produtoParam = searchParams?.get('produto')
                  const openProductId = produtoParam ? parseInt(produtoParam, 10) : NaN
                  const forceOpen = !isNaN(openProductId) && Number(product.id) === openProductId
                  return (
                    <ProductCard key={createSafeKey(product.id, 'product')} product={product} storeColor={storeColor} forceOpen={forceOpen} />
                  )
                })}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
