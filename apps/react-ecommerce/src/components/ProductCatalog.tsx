/**
 * SPABench App C — ProductCatalog component
 *
 * EP-C-002: GET http://localhost:3003/api/v2/products/list
 * technique: fetch_interception (TC-P3-013) + fetch_api_native (TC-P2-014)
 * phase: 3 (primary — fires on page load, intercepted at network layer)
 *
 * The useEffect fires immediately on component mount, making this endpoint
 * discoverable via Phase 3 traffic interception without any user interaction.
 * It is also discoverable via Phase 2 AST analysis of the useEffect body.
 *
 * TC-P2-014 (fetch_api_native): Native fetch() with URLSearchParams construction.
 * Parameters page, limit, category are recoverable from the URLSearchParams calls.
 *
 * source_file: src/components/ProductCatalog.tsx
 * minified_location: assets/index.abc123.js:1:51020
 */
import React, { useState, useEffect } from 'react';
import { listProducts, Product } from '../services/ProductService';

interface Props {
  category?: string;
  pageSize?: number;
}

const ProductCatalog: React.FC<Props> = ({ category, pageSize = 12 }) => {
  const [products, setProducts] = useState<Product[]>([]);
  const [page, setPage] = useState(0);
  const [loading, setLoading] = useState(true);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    // EP-C-002: fires on mount — interceptable via Phase 3
    // TC-P2-014: native fetch inside listProducts → fetch_api_native pattern
    setLoading(true);
    listProducts({ page, limit: pageSize, category })
      .then(data => {
        setProducts(data.items);
        setTotal(data.total);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [page, pageSize, category]);

  if (loading) return <div className="loading">Loading products…</div>;

  return (
    <div className="product-catalog">
      <div className="product-grid">
        {products.map(p => (
          <div key={p.id} className="product-card" data-id={p.id}>
            <img src={p.imageUrl} alt={p.name} />
            <h3>{p.name}</h3>
            <p className="price">${p.price.toFixed(2)}</p>
            <p className="stock">{p.stock > 0 ? `${p.stock} in stock` : 'Out of stock'}</p>
          </div>
        ))}
      </div>
      <div className="pagination">
        <button disabled={page === 0} onClick={() => setPage(p => p - 1)}>Prev</button>
        <span>Page {page + 1} of {Math.ceil(total / pageSize)}</span>
        <button disabled={(page + 1) * pageSize >= total} onClick={() => setPage(p => p + 1)}>Next</button>
      </div>
    </div>
  );
};

export default ProductCatalog;
