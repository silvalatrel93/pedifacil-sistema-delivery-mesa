import React from "react"

const ProductCardSkeleton = () => (
  <div className="bg-white rounded-lg shadow-md overflow-hidden animate-pulse">
    <div className="w-full h-40 bg-gray-300"></div>
    <div className="p-4">
      <div className="h-6 bg-gray-300 rounded w-3/4 mb-2"></div>
      <div className="h-4 bg-gray-300 rounded w-1/2"></div>
    </div>
  </div>
)

const ProductListSkeleton = () => {
  return (
    <div className="p-4">
      <div className="h-8 bg-gray-300 rounded w-1/4 mb-4 animate-pulse"></div>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
        {Array.from({ length: 8 }).map((_, index) => (
          <ProductCardSkeleton key={index} />
        ))}
      </div>
    </div>
  )
}

export default ProductListSkeleton
