import { useState, useEffect, useMemo, useRef, memo } from 'react';
import './ProductGallery.css';
import { getAllItems, subscribeToItems } from '../utils/db';
import LoadingScreen from './LoadingScreen';

// Sub-component for product card - Memoized for performance
const ProductCard = memo(function ProductCard({ product, index, onOpenLightbox }) {
    return (
        <div
            className="product-card cute-card"
            style={{ animationDelay: `${index * 0.05}s` }}
            onClick={() => onOpenLightbox(product)}
        >
            <div className="product-image">
                <img
                    src={product.images ? product.images[0] : product.image}
                    alt={product.name}
                    className="cake-image"
                />
                {product.images && product.images.length > 1 && (
                    <div className="album-badge">🖼️ {product.images.length} Ảnh</div>
                )}
            </div>
            {/* RESTORED TAGS PER USER REQUEST (Sanitized to hide internal IDs) */}
            <div className="product-tags-row">
                {product.categoryId && !product.categoryId.includes('_') && (
                    <span className="product-tag-badge primary">
                        #{product.categoryId.replace('cat_', '')}
                    </span>
                )}
                {(product.tags || [])
                    .filter(tag => {
                        // Hide internal IDs like "1770363107410_0.0907..."
                        if (tag.includes('_') && !isNaN(tag.split('_')[0])) return false;
                        if (!isNaN(tag) && tag.length > 8) return false;
                        return true;
                    })
                    .map((tag, i) => (
                        <span key={i} className="product-tag-badge">#{tag}</span>
                    ))}
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
                        onOpenLightbox(product, true);
                    }}>
                        ✨ Đặt bánh
                    </span>
                </div>
            </div>
        </div>
    );
});

export default function ProductGallery() {
    const [filter, setFilter] = useState('All');
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentImgIndex, setCurrentImgIndex] = useState(0);
    const [showContactOptions, setShowContactOptions] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const galleryRef = useRef(null);

    useEffect(() => {
        console.log("🌸 ProductGallery v2.2.0 - Live");
        // Real-time synchronization for products and categories
        const unsubProducts = subscribeToItems('products', (items) => {
            setProducts(items);
            setIsLoading(false); // Stop loading after first batch (even if empty)
        });
        const unsubCategories = subscribeToItems('categories', (items) => {
            setCategories(items);
            // Categories usually load fast, but products are more critical for the "empty" message
        });

        return () => {
            unsubProducts();
            unsubCategories();
        };
    }, []);

    useEffect(() => {
        const handleEsc = (e) => {
            if (e.key === 'Escape') closeLightbox();
        };
        window.addEventListener('keydown', handleEsc);
        return () => window.removeEventListener('keydown', handleEsc);
    }, [selectedProduct]);

    // AUTO-SCROLL TO TOP ON FILTER CHANGE
    useEffect(() => {
        if (!isLoading && galleryRef.current) {
            // Give a bit more time for React to settle the DOM after heavy renders
            const timer = setTimeout(() => {
                const headerOffset = 100; // Account for the sticky category picker
                const elementPosition = galleryRef.current.getBoundingClientRect().top;
                const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

                window.scrollTo({
                    top: offsetPosition,
                    behavior: 'smooth'
                });
            }, 250);

            return () => clearTimeout(timer);
        }
    }, [filter]);

    // DYNAMIC CATEGORY RECOVERY: Ensures categories never appear empty if products exist
    const allFilterableCategories = useMemo(() => {
        const nameMap = new Map(); // Key: name.toLowerCase(), Value: { id, name }

        // 1. Add known categories from state
        categories.forEach(c => {
            if (c && c.name) {
                const key = c.name.toLowerCase().trim();
                if (!nameMap.has(key)) {
                    nameMap.set(key, { id: c.id, name: c.name.trim(), subCategories: [] });
                }
            }
        });

        // 2. Discover missing categories/tags from products
        products.forEach(p => {
            (p.tags || []).forEach(tag => {
                if (tag && tag.trim()) {
                    // HIDE INTERNAL IDs from filter tabs
                    if (tag.includes('_') && !isNaN(tag.split('_')[0])) return;
                    if (!isNaN(tag) && tag.length > 8) return;

                    let realName = tag.trim();
                    let realId = tag.trim();

                    // SANITY CHECK: If this tag is actually an ID string, try to recover the name
                    if (tag.startsWith('cat_')) {
                        const existingCat = categories.find(c => c.id === tag);
                        if (existingCat) {
                            realName = existingCat.name;
                            realId = existingCat.id;
                        } else {
                            // ORPHANED ID: If it looks like an ID but we can't find it, 
                            // don't show it as a filter button.
                            return;
                        }
                    }

                    const key = realName.toLowerCase().trim();
                    if (!nameMap.has(key)) {
                        nameMap.set(key, { id: realId, name: realName, subCategories: [] });
                    }
                }
            });

            if (p.categoryId) {
                const existing = categories.find(c => c.id === p.categoryId);
                if (existing) {
                    const key = existing.name.toLowerCase().trim();
                    if (!nameMap.has(key)) {
                        nameMap.set(key, { id: existing.id, name: existing.name.trim(), subCategories: [] });
                    }
                } else {
                    const guessedName = (p.tags && p.tags.length > 0) ? p.tags[0] : p.categoryId;
                    const key = String(guessedName).toLowerCase().trim();
                    if (!nameMap.has(key)) {
                        nameMap.set(key, { id: p.categoryId, name: String(guessedName).trim(), subCategories: [] });
                    }
                }
            }
        });

        return Array.from(nameMap.values()).sort((a, b) => a.name.localeCompare(b.name));
    }, [categories, products]);

    const getCategoryName = (catId) => {
        const cat = allFilterableCategories.find(c => c.id === catId);
        return cat ? cat.name : (catId || '');
    };

    // OPTIMIZATION: Pre-calculate grouped products for "All" view to avoid O(N^2) in render
    const groupedProducts = useMemo(() => {
        if (filter !== 'All') return [];

        return allFilterableCategories.map(cat => {
            const catNameLower = cat.name.toLowerCase();
            const productsInCat = products.filter(p => {
                const pCatName = getCategoryName(p.categoryId).toLowerCase();
                if (pCatName === catNameLower) return true;
                return (p.tags || []).some(t => {
                    const tName = t.startsWith('cat_') ? getCategoryName(t) : t;
                    return tName.toLowerCase() === catNameLower;
                });
            });
            return { ...cat, items: productsInCat };
        }).filter(cat => cat && cat.items && cat.items.length > 0);
    }, [products, allFilterableCategories]); // Use allFilterableCategories to ensure no product is hidden

    const handleMouseMove = (e) => {
        // Disable zoom on mobile/touch devices to prevent "cấn" behavior
        if (window.matchMedia("(pointer: coarse)").matches) return;

        const container = e.currentTarget;
        const img = container.querySelector('img');
        if (!img) return;

        const rect = container.getBoundingClientRect();
        const x = ((e.clientX - rect.left) / rect.width) * 100;
        const y = ((e.clientY - rect.top) / rect.height) * 100;
        img.style.transformOrigin = `${x}% ${y}%`;
    };

    const filteredProducts = filter === 'All'
        ? products
        : products.filter(p => {
            const filterName = filter.toLowerCase();
            const primaryCatName = getCategoryName(p.categoryId).toLowerCase();

            return primaryCatName === filterName ||
                (p.tags || []).some(t => t.toLowerCase() === filterName);
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

    if (isLoading) return <LoadingScreen />;

    return (
        <section className="gallery" ref={galleryRef}>
            <div className="wave-top">
                <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '60px' }}>
                    <path
                        fill="var(--beige)"
                        d="M0,32L48,42.7C96,53,192,75,288,80C384,85,480,75,576,58.7C672,43,768,21,864,16C960,11,1056,21,1152,37.3C1248,53,1344,75,1392,85.3L1440,96L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
                    ></path>
                </svg>
            </div>
            <div className="gallery-container" style={{ position: 'relative', zIndex: 1 }}>
                <h2 className="gallery-title">Mẫu Bánh</h2>
                <div className="gallery-divider"></div>

                {allFilterableCategories.length > 0 && (
                    <div className="category-picker-container">
                        <div className="picker-main-actions">
                            <button
                                className={`btn-filter-all ${filter === 'All' ? 'active' : ''}`}
                                onClick={() => {
                                    setFilter('All');
                                    setIsExpanded(false);
                                }}
                            >
                                Tất Cả
                            </button>

                            <button
                                className={`btn-toggle-themes ${filter !== 'All' ? 'active' : ''}`}
                                onClick={() => setIsExpanded(!isExpanded)}
                            >
                                {filter === 'All' ? 'Chọn Chủ Đề' : `#${filter}`}
                                <span className={`arrow ${isExpanded ? 'up' : 'down'}`}>▼</span>
                            </button>
                        </div>

                        <div className={`category-picker-wrapper ${!isExpanded ? 'collapsed' : ''}`}>
                            <div className="filter-tabs">
                                <div className="tabs-content">
                                    {allFilterableCategories.map(cat => (
                                        <button
                                            key={cat.id}
                                            className={`filter-btn ${filter === cat.name ? 'active' : ''}`}
                                            onClick={() => {
                                                setFilter(cat.name);
                                                setIsExpanded(false);
                                            }}
                                        >
                                            {cat.name}
                                        </button>
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                <div className="products-grid-container">
                    {filter !== 'All' ? (
                        <div className="products-grid">
                            {filteredProducts.length === 0 ? (
                                <div className="empty-state">
                                    <p>🎂 Chưa có sản phẩm cho mục này</p>
                                </div>
                            ) : (
                                filteredProducts.map((product, index) => (
                                    <ProductCard
                                        key={product.id}
                                        product={product}
                                        index={index}
                                        onOpenLightbox={openLightbox}
                                    />
                                ))
                            )}
                        </div>
                    ) : (
                        /* Optimized Grouped View */
                        groupedProducts.map((cat, groupIndex) => (
                            <div key={cat.id} className="category-section" style={{ marginBottom: '3rem' }}>
                                <h3 className="section-title" style={{
                                    fontSize: '1.8rem',
                                    color: 'var(--brown)',
                                    marginBottom: '1.5rem',
                                    paddingLeft: '1rem',
                                    borderLeft: '5px solid var(--pink)',
                                    display: 'flex',
                                    alignItems: 'center',
                                    gap: '10px'
                                }}>
                                    ✨ {cat.name} <span style={{ fontSize: '1rem', opacity: 0.6 }}>({cat.items.length})</span>
                                </h3>
                                <div className="products-grid">
                                    {cat.items.map((product, index) => (
                                        <ProductCard
                                            key={product.id}
                                            product={product}
                                            index={index}
                                            onOpenLightbox={openLightbox}
                                        />
                                    ))}
                                </div>
                            </div>
                        ))
                    )}

                    {products.length === 0 && (
                        <div className="empty-state">
                            <p>🎂 Chưa có sản phẩm nào</p>
                            <p style={{ fontSize: '0.9rem', marginTop: '0.5rem' }}>
                                Admin vui lòng vào <a href="/AdminLulucake" style={{ color: 'var(--pink)', fontWeight: '600' }}>trang quản trị</a> để thêm sản phẩm
                            </p>
                        </div>
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
                                        <div className="carousel-card" onMouseMove={handleMouseMove}>
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
