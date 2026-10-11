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
