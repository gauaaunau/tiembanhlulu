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
                    loading="lazy"
                    decoding="async"
                />
                {product.images && product.images.length > 1 && (
                    <div className="album-badge">🖼️ {product.images.length} Ảnh</div>
                )}
            </div>
            {/* RESTORED TAGS PER USER REQUEST (Sanitized to hide internal IDs) */}
            <div className="product-tags-row">
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
                <h3 className="product-name">
                    {product.name.match(/^Bánh \d+$/) ? product.name.replace('Bánh ', 'Mã: ') : product.name}
                </h3>
                <p className="product-description">{product.description}</p>
                <div className="product-footer">
                    <span className="product-price">
                        Giá: {(!product.price || product.price === 'Liên hệ') ? 'Liên hệ tiệm' : (isNaN(product.price) ? product.price : `${product.price} cành`)}
                    </span>
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

const ITEMS_PER_PAGE = 20;
const GROUPS_PER_PAGE = 3;

export default function ProductGallery() {
    const [filter, setFilter] = useState('All');
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [selectedProduct, setSelectedProduct] = useState(null);
    const [currentImgIndex, setCurrentImgIndex] = useState(0);
    const [showContactOptions, setShowContactOptions] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [isExpanded, setIsExpanded] = useState(false);
    const [catSearch, setCatSearch] = useState('');
    const [searchTerm, setSearchTerm] = useState('');
    const [currentPage, setCurrentPage] = useState(1);
    const galleryRef = useRef(null);

    useEffect(() => {
        console.log("ProductGallery v6.1.6 - Live");
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

    // AUTO-SCROLL TO TOP ON FILTER/PAGE CHANGE
    useEffect(() => {
        if (!isLoading && galleryRef.current) {
            // Reset page on filter change
            // (But we need to distinguish filter change vs page change? 
            // Actually, if filter changes, page should be 1. logic below.)

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
    }, [filter, currentPage]);

    // Reset pagination when filter or search changes
    useEffect(() => {
        setCurrentPage(1);
    }, [filter, searchTerm, catSearch]);

    // 1. Detect ALL unique categories/tags present in products
    const rawCategories = useMemo(() => {
        const nameMap = new Map();

        products.forEach(p => {
            if (p.categoryId) {
                const existing = categories.find(c => c.id === p.categoryId);
                if (existing) {
                    const key = existing.name.toLowerCase().trim();
                    if (!nameMap.has(key)) {
                        nameMap.set(key, { id: existing.id, name: existing.name.trim() });
                    }
                }
            }
            if (p.tags && p.tags.length > 0) {
                p.tags.forEach(tag => {
                    const tagClean = tag.replace(/^(#)/, '').trim();
                    if (tagClean && !tagClean.includes('_')) { // Skip ID-like tags
                        const key = tagClean.toLowerCase();
                        if (!nameMap.has(key)) {
                            nameMap.set(key, { id: `tag_${tagClean}`, name: tagClean });
                        }
                    }
                });
            }
        });

        return Array.from(nameMap.values()).sort((a, b) =>
            a.name.localeCompare(b.name, 'vi', { sensitivity: 'base' })
        );
    }, [products, categories]);

    // PRE-CALCULATE UNCATEGORIZED (v5.1.1): Products missing valid tags/categories
    const uncategorizedProducts = useMemo(() => {
        const searchNorm = searchTerm.toLowerCase().trim();
        return products.filter(p => {
            if (searchNorm && !p.name.toLowerCase().includes(searchNorm)) return false;

            const hasCategory = p.categoryId && categories.find(c => c.id === p.categoryId);
            const hasTags = (p.tags || []).some(t => {
                const tClean = t.replace(/^(#)/, '').trim();
                return tClean && !tClean.includes('_');
            });
            return !hasCategory && !hasTags;
        });
    }, [products, categories, searchTerm]);

    // 2. Filter categories based on search
    const allFilterableCategories = useMemo(() => {
        if (!catSearch.trim()) return rawCategories;

        const normalize = (str) => str.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim();
        const searchNormalized = normalize(catSearch);

        return rawCategories.filter(cat =>
            normalize(cat.name).includes(searchNormalized) ||
            cat.name.toLowerCase().includes(catSearch.toLowerCase().trim())
        );
    }, [rawCategories, catSearch]);

    const getCategoryName = (catId) => {
        const cat = rawCategories.find(c => c.id === catId);
        return cat ? cat.name : (catId || '');
    };

    const groupedProducts = useMemo(() => {
        if (filter !== 'All') return [];
        const searchNorm = searchTerm.toLowerCase().trim();

        const groups = rawCategories.map(cat => {
            const catNameLower = cat.name.toLowerCase();
            const productsInCat = products.filter(p => {
                // Name filter
                if (searchNorm && !p.name.toLowerCase().includes(searchNorm)) return false;

                const pCatName = getCategoryName(p.categoryId).toLowerCase();
                if (pCatName === catNameLower) return true;
                return (p.tags || []).some(t => {
                    // Normalize tag for comparison
                    const tClean = t.replace(/^(#)/, '').trim().toLowerCase();
                    return tClean === catNameLower;
                });
            });
            return { ...cat, items: productsInCat };
        });

        // Add Fallback Group for Uncategorized (v5.1.1)
        if (uncategorizedProducts.length > 0) {
            groups.push({
                id: 'uncategorized',
                name: 'Sản phẩm mới',
                items: uncategorizedProducts
            });
        }

        return groups.filter(cat => cat && cat.items && cat.items.length > 0);
    }, [products, rawCategories, uncategorizedProducts, filter, searchTerm]);

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

    const filteredProducts = useMemo(() => {
        const searchNorm = searchTerm.toLowerCase().trim();
        const baseFiltered = filter === 'All'
            ? products
            : products.filter(p => {
                const filterName = filter.toLowerCase();
                const primaryCatName = getCategoryName(p.categoryId).toLowerCase();

                return primaryCatName === filterName ||
                    (p.tags || []).some(t => t.toLowerCase() === filterName);
            });

        if (!searchNorm) return baseFiltered;

        return baseFiltered.filter(p =>
            p.name.toLowerCase().includes(searchNorm) ||
            (p.description || '').toLowerCase().includes(searchNorm)
        );
    }, [products, filter, searchTerm, categories]);

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

    // PAGINATION LOGIC
    const totalPages = filter !== 'All'
        ? Math.ceil(filteredProducts.length / ITEMS_PER_PAGE)
        : Math.ceil(groupedProducts.length / GROUPS_PER_PAGE);

    const paginatedProducts = filter !== 'All'
        ? filteredProducts.slice((currentPage - 1) * ITEMS_PER_PAGE, currentPage * ITEMS_PER_PAGE)
        : [];

    const paginatedGroups = filter === 'All'
        ? groupedProducts.slice((currentPage - 1) * GROUPS_PER_PAGE, currentPage * GROUPS_PER_PAGE)
        : [];

    if (isLoading) return <LoadingScreen />;

    return (
        <section className="gallery" ref={galleryRef}>
            <div className="wave-top">
                <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '60px' }}>
                    <path
                        fill="white"
                        d="M0,32L48,42.7C96,53,192,75,288,80C384,85,480,75,576,58.7C672,43,768,21,864,16C960,11,1056,21,1152,37.3C1248,53,1344,75,1392,85.3L1440,96L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
                    ></path>
                </svg>
            </div>
            <div className="gallery-container" style={{ position: 'relative', zIndex: 1 }}>
                <h2 className="gallery-title">Mẫu Bánh</h2>
                <div className="gallery-divider"></div>

                {/* Product Search Bar (v5.2.0) */}
                <div className="product-search-bar">
                    <div className="search-input-wrapper">
                        <span className="search-icon">🔍</span>
                        <input
                            type="text"
                            placeholder="Tìm kiếm mẫu bánh..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="search-input"
                        />
                        {searchTerm && (
                            <button className="clear-search" onClick={() => setSearchTerm('')} title="Xoá tìm kiếm">✕</button>
                        )}
                    </div>
                </div>

                {rawCategories.length > 0 && (
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
                                <div className="category-search-box">
                                    <span className="search-icon">🔍</span>
                                    <input
                                        type="text"
                                        placeholder="Tìm chủ đề (ví dụ: Cá, Bé trai...)"
                                        value={catSearch}
                                        onChange={(e) => setCatSearch(e.target.value)}
                                        onFocus={(e) => e.stopPropagation()}
                                        onClick={(e) => e.stopPropagation()}
                                    />
                                    {catSearch && (
                                        <button className="clear-search" onClick={(e) => {
                                            e.stopPropagation();
                                            setCatSearch('');
                                        }}>✕</button>
                                    )}
                                </div>
                                <div className="tabs-content">
                                    {allFilterableCategories.length === 0 ? (
                                        <p className="no-search-results">Không tìm thấy chủ đề nào 🍰</p>
                                    ) : (
                                        allFilterableCategories.map(cat => (
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
                                        ))
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}


                <div className="products-grid-container">
                    {filter !== 'All' ? (
                        <div className="products-grid">
                            {paginatedProducts.length === 0 ? (
                                <div className="empty-state">
                                    <p>🎂 Chưa có sản phẩm cho mục này</p>
                                </div>
                            ) : (
                                paginatedProducts.map((product, index) => (
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
                        /* Optimized Grouped View with Pagination */
                        paginatedGroups.map((cat, groupIndex) => (
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

                    {/* Pagination Controls (v8.0.0) */}
                    {totalPages > 1 && (
                        <div className="pagination-controls">
                            <button
                                className="pagination-btn"
                                disabled={currentPage === 1}
                                onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                            >
                                ← Trang trước
                            </button>

                            <span className="pagination-info">
                                Trang <b>{currentPage}</b> / {totalPages}
                            </span>

                            <button
                                className="pagination-btn"
                                disabled={currentPage === totalPages}
                                onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                            >
                                Trang sau →
                            </button>
                        </div>
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
                                                <h3>
                                                    {selectedProduct.name.match(/^Bánh \d+$/) ? selectedProduct.name.replace('Bánh ', 'Mã: ') : selectedProduct.name}
                                                </h3>
                                                <div className="external-footer">
                                                    <span className="external-price">
                                                        Giá: {(!selectedProduct.price || selectedProduct.price === 'Liên hệ') ? 'Liên hệ tiệm' : (isNaN(selectedProduct.price) ? selectedProduct.price : `${selectedProduct.price} cành`)}
                                                    </span>

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
