import { useState, useEffect, useMemo } from 'react';
import './ProductGallery.css';
import { getAllItems } from '../utils/db';

export default function ProductGallery() {
    const [filter, setFilter] = useState('All');
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentImgIndex, setCurrentImgIndex] = useState(0);
    const [showContactOptions, setShowContactOptions] = useState(false);

    useEffect(() => {
        const loadData = async () => {
            const dbProducts = await getAllItems('products');
            const dbCategories = await getAllItems('categories');

            setProducts(dbProducts || []);
            setCategories(dbCategories || []);
        };

        loadData();

        // Check for updates
        const interval = setInterval(loadData, 2000);
        return () => clearInterval(interval);
    }, []);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') closeLightbox();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [selectedProduct]);

    // DYNAMIC CATEGORY RECOVERY: Ensures categories never appear empty if products exist
    const allFilterableCategories = useMemo(() => {
        const catMap = new Map();

        // 1. Add known categories from state
        categories.forEach(c => {
            if (c && c.id) catMap.set(c.id, c);
        });

        // 2. Discover missing categories/tags from products
        products.forEach(p => {
            if (p.categoryId && !catMap.has(p.categoryId)) {
                // Try to find a name from tags or just use the ID/Placeholder
                const guessedName = (p.tags && p.tags.length > 0) ? p.tags[0] : 'Chưa phân loại';
                catMap.set(p.categoryId, { id: p.categoryId, name: guessedName, subCategories: [] });
            }

            // Also treat every tag as a filterable category
            (p.tags || []).forEach(tag => {
                if (tag && !catMap.has(tag)) {
                    catMap.set(tag, { id: tag, name: tag, subCategories: [] });
                }
            });
        });

        return Array.from(catMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [categories, products]);

    const getCategoryName = (catId) => {
        const cat = allFilterableCategories.find(c => c.id === catId);
        return cat ? cat.name : (catId || '');
    };

    const handleMouseMove = (e) => {
        const card = e.currentTarget;
        const img = card.querySelector('.cake-image');
        const rect = card.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
    };

    const filteredProducts = filter === 'All'
        ? products
        : products.filter(p => {
            const primaryCatName = getCategoryName(p.categoryId);
            // Check both the primary category name and the tags (which are now names)
            return primaryCatName === filter || (p.tags || []).includes(filter);
        });

    const openLightbox = (product, startRevealed = false) => {
        setSelectedProduct(product);
        setCurrentImgIndex(0);
        setShowContactOptions(startRevealed);
        document.body.style.overflow = 'hidden';
    };

    const closeLightbox = () => {
        setSelectedProduct(null);
        setShowContactOptions(false);
        document.body.style.overflow = 'auto';
    };

    const goToSlide = (index, e) => {
        e.stopPropagation();
        setCurrentImgIndex(index);
        setShowContactOptions(false); // Reset reveal when changing image
    };

    return (
        <section className="gallery">
            <div className="gallery-container">
                <h2 className="gallery-title">🎂 Menu Bánh Ngọt</h2>
                <p className="gallery-subtitle">Bánh ngọt handmade - Làm bằng cả trái tim 💕</p>

                {allFilterableCategories.length > 0 && (
                    <div className="filter-tabs">
                        <button
                            className={`filter-btn ${filter === 'All' ? 'active' : ''}`}
                            onClick={() => setFilter('All')}
                        >
                            🎂 Tất Cả
                        </button>
                        {allFilterableCategories.map(cat => (
                            <button
                                key={cat.id}
                                className={`filter-btn ${filter === cat.name ? 'active' : ''}`}
                                onClick={() => setFilter(cat.name)}
                            >
                                #{cat.name}
                            </button>
                        ))}
                    </div>
                )}

                <div className="products-grid">
                    {filteredProducts.length === 0 ? (
                        <div className="empty-state">
                            <p>🎂 Chưa có sản phẩm nào</p>
                            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                Admin vui lòng vào <a href="/AdminLulucake" style={{ color: 'var(--pink)', fontWeight: '600' }}>trang quản trị</a> để thêm sản phẩm
                            </p>
                        </div>
                    ) : (
                        filteredProducts.map((product, index) => (
                            <div
                                key={product.id}
                                className="product-card cute-card"
                                style={{ animationDelay: `${index * 0.1}s` }}
                                onClick={() => openLightbox(product)}
                            >
                                <div
                                    className="product-image"
                                    onMouseMove={handleMouseMove}
                                >
                                    <img
                                        src={product.images ? product.images[0] : product.image}
                                        alt={product.name}
                                        className="cake-image"
                                    />
                                    {product.images && product.images.length > 1 && (
                                        <div className="album-badge">🖼️ {product.images.length} Ảnh</div>
                                    )}
                                </div>
                                <div className="product-tags-row">
                                    {/* Primary category badge removed as requested - using tags only */}
                                    {(product.tags || []).map(tagId => {
                                        const displayName = getCategoryName(tagId) || tagId;
                                        return (
                                            <span key={tagId} className="product-tag-badge">#{displayName}</span>
                                        );
                                    })}
                                </div>
                                <div className="product-info">
                                    <h3 className="product-name">{product.name}</h3>
                                    <p className="product-description">{product.description}</p>
                                    <div className="product-footer">
                                        {(product.price && product.price !== 'Liên hệ') && (
                                            <span className="product-price">{product.price}</span>
                                        )}
                                        <span className="btn-add" onClick={(e) => {
                                            e.stopPropagation();
                                            openLightbox(product, true);
                                        }}>
                                            ✨ Đặt bánh
                                        </span>
                                    </div>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>

            {/* Lightbox Carousel Modal */}
            {selectedProduct && (
                <div className="lightbox-overlay" onClick={closeLightbox}>
                    <button className="lightbox-close" onClick={closeLightbox}>✕</button>

                    <div className="carousel-window">
                        <div
                            className="carousel-track"
                            style={{
                                transform: `translateX(calc(50% - (var(--sw) / 2) - (${currentImgIndex} * var(--sw))))`
                            }}
                        >
                            {(selectedProduct.images || [selectedProduct.image]).map((img, i) => (
                                <div
                                    key={i}
                                    className={`carousel-slide ${i === currentImgIndex ? 'active' : ''}`}
                                    onClick={(e) => {
                                        if (i !== currentImgIndex) {
                                            setCurrentImgIndex(i);
                                            setShowContactOptions(false); // Reset reveal when changing image
                                        }
                                    }}
                                >
                                    <div className="carousel-card-wrapper" onClick={(e) => e.stopPropagation()}>
                                        <div className="carousel-card">
                                            <img src={img} alt={`${selectedProduct.name} ${i}`} className="carousel-img" />
                                        </div>

                                        {i === currentImgIndex && (
                                            <div className="carousel-external-info">
                                                <h3>{selectedProduct.name}</h3>
                                                <div className="external-footer">
                                                    {(selectedProduct.price && selectedProduct.price !== 'Liên hệ') && (
                                                        <span className="external-price">{selectedProduct.price}</span>
                                                    )}

                                                    {!showContactOptions ? (
                                                        <button
                                                            className="btn-reveal-contact"
                                                            onClick={() => setShowContactOptions(true)}
                                                        >
                                                            Đặt Ngay
                                                        </button>
                                                    ) : (
                                                        <div className="order-options reveal-anim">
                                                            <a href="https://zalo.me/0798341868" target="_blank" rel="noopener noreferrer" className="contact-item">
                                                                <div className="contact-logo-container zalo">
                                                                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/9/91/Icon_of_Zalo.svg/1200px-Icon_of_Zalo.svg.png" alt="Zalo" />
                                                                </div>
                                                                <span className="contact-label">Zalo</span>
                                                            </a>
                                                            <a href="https://m.me/tiembanhlulu" target="_blank" rel="noopener noreferrer" className="contact-item">
                                                                <div className="contact-logo-container facebook">
                                                                    <img src="https://upload.wikimedia.org/wikipedia/commons/thumb/0/05/Facebook_Logo_%282019%29.png/1200px-Facebook_Logo_%282019%29.png" alt="Facebook" />
                                                                </div>
                                                                <span className="contact-label">Facebook</span>
                                                            </a>
                                                            <a href="tel:0798341868" className="contact-item">
                                                                <div className="contact-logo-container hotline">
                                                                    <svg viewBox="0 0 24 24" fill="currentColor">
                                                                        <path d="M6.62,10.79C8.06,13.62 10.38,15.94 13.21,17.38L15.41,15.18C15.69,14.9 16.08,14.82 16.43,14.93C17.55,15.3 18.75,15.5 20,15.5A1,1 0 0,1 21,16.5V20A1,1 0 0,1 20,21A17,17 0 0,1 3,4A1,1 0 0,1 4,3H7.5A1,1 0 0,1 8.5,4C8.5,5.25 8.7,6.45 9.07,7.57C9.18,7.92 9.1,8.31 8.82,8.59L6.62,10.79Z" />
                                                                    </svg>
                                                                </div>
                                                                <span className="contact-label">Hotline</span>
                                                            </a>
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>

                    {(selectedProduct.images?.length > 1) && (
                        <div className="carousel-dots-fixed">
                            {selectedProduct.images.map((_, i) => (
                                <span
                                    key={i}
                                    className={`dot ${i === currentImgIndex ? 'active' : ''}`}
                                    onClick={() => setCurrentImgIndex(i)}
                                />
                            ))}
                        </div>
                    )}
                </div>
            )}
        </section>
    );
}
