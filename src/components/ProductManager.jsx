import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import './ProductManager.css';
import {
    getAllItems,
    saveItem,
    saveAllItems,
    deleteItem,
    deleteItemsBulk,
    addItemsBulk,
    deleteAllItems,
    subscribeToItems,
    waitForSync
} from '../utils/db';
import { uploadImage, base64ToBlob } from '../utils/storage';
import LoadingScreen from './LoadingScreen';

export default function ProductManager() {
    const [products, setProducts] = useState([]);
    const [categories, setCategories] = useState([]);
    const [formData, setFormData] = useState({
        name: '',
        categoryId: '',
        subCategoryId: '',
        price: '',
        description: '',
        images: [],
        tags: []
    });
    const [imagePreview, setImagePreview] = useState('');
    const [editingId, setEditingId] = useState(null);
    const [stagedImages, setStagedImages] = useState([]);
    const [isBulkMode, setIsBulkMode] = useState(false);
    const [activeAdminTab, setActiveAdminTab] = useState('add'); // 'add' or 'bulk-tag'
    const [isCloudEnabled] = useState(!!import.meta.env.VITE_FIREBASE_API_KEY);
    const [isStorageEnabled] = useState(false); // REVERTED (v5.0.0): Back to Base64 per user request
    const [uploadingImages, setUploadingImages] = useState(false);
    const [batchResting, setBatchResting] = useState(false); // v5.0.5
    const [targetTagId, setTargetTagId] = useState('');
    const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
    const [tagInputText, setTagInputText] = useState('');
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [typedTag, setTypedTag] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadStatus, setUploadStatus] = useState({ total: 0, processed: 0, added: 0 });
    const [importing, setImporting] = useState(false); // v5.0.3 - Moved up for init safety
    const [importStats, setImportStats] = useState({ current: 0, total: 0, startTime: 0 }); // v5.0.3 - Moved up
    const [progressLabel, setProgressLabel] = useState('Đang nhập hàng...'); // v5.0.8 - Moved up
    const wakeLockRef = useRef(null); // v5.0.9
    const statusTimeoutRef = useRef(null);
    const [inlineEditingId, setInlineEditingId] = useState(null); // v5.1.0
    const [inlinePriceValue, setInlinePriceValue] = useState(''); // v5.1.0
    const [adminSearch, setAdminSearch] = useState(''); // v5.2.0
    const [tiktokUrls, setTiktokUrls] = useState(['', '', '']); // v5.5.0
    const [isSavingSettings, setIsSavingSettings] = useState(false);

    useEffect(() => {
        console.log("🛠️ ProductManager v4.2.1 - Live");
        // 1. Initial Migration Check (only once)
        const checkMigration = async () => {
            const dbProducts = await getAllItems('products');
            const dbCategories = await getAllItems('categories');

            if ((!dbProducts || dbProducts.length === 0) && (!dbCategories || dbCategories.length === 0)) {
                const localProductsRaw = localStorage.getItem('lulu_products');
                const localCategoriesRaw = localStorage.getItem('lulu_categories');

                if (localProductsRaw || localCategoriesRaw) {
                    console.log('Migrating legacy localStorage data...');
                    if (localCategoriesRaw) {
                        const parsedCats = JSON.parse(localCategoriesRaw);
                        await saveAllItems('categories', parsedCats);
                    }
                    if (localProductsRaw) {
                        const parsedProds = JSON.parse(localProductsRaw);
                        await saveAllItems('products', parsedProds);
                    }
                    localStorage.removeItem('lulu_categories');
                    localStorage.removeItem('lulu_products');
                }
            }

            // Initial load for drafts (non-real-time usually fine for drafts)
            try {
                const dbDrafts = await getAllItems('drafts');
                if (dbDrafts && dbDrafts.length > 0) {
                    setStagedImages(dbDrafts);
                }
            } catch (draftErr) {
                console.warn('Drafts not available yet:', draftErr);
            }
        };

        checkMigration();

        // 2. Setup Real-time Listeners
        const unsubProducts = subscribeToItems('products', (items) => {
            if (items) {
                setProducts(items);
            }
            setIsLoading(false);
        });

        const unsubCategories = subscribeToItems('categories', (items) => {
            if (items && items.length > 0) {
                setCategories(items);
                localStorage.setItem('cached_categories', JSON.stringify(items));
            } else if (!items || items.length === 0) {
                const cached = localStorage.getItem('cached_categories');
                if (cached) {
                    setCategories(JSON.parse(cached));
                } else if (items) { // If items is explicitly empty array from DB
                    setCategories([]);
                }
            }
        });

        const unsubSettings = subscribeToItems('settings', (items) => {
            const tiktokSettings = items.find(item => item.id === 'tiktok_featured');
            if (tiktokSettings && tiktokSettings.urls) {
                setTiktokUrls(tiktokSettings.urls);
            }
        });

        return () => {
            unsubProducts();
            unsubCategories();
            unsubSettings();
        };
    }, []);

    // AUTO-SAVE DRAFTS: Keep staged images safe even if page refreshes
    useEffect(() => {
        const saveDrafts = async () => {
            try {
                if (stagedImages.length > 0) {
                    await saveAllItems('drafts', stagedImages);
                } else {
                    await saveAllItems('drafts', []);
                }
            } catch (err) {
                console.warn('Auto-save drafts failed:', err);
            }
        };
        saveDrafts();
    }, [stagedImages]);

    // SCREEN WAKE LOCK (v5.0.9): Prevent device sleep during progress
    useEffect(() => {
        const handleWakeLock = async () => {
            if ('wakeLock' in navigator && importing) {
                try {
                    wakeLockRef.current = await navigator.wakeLock.request('screen');
                    console.log("🕯️ Wake Lock Active: Screen will stay awake.");
                } catch (err) {
                    console.warn("Wake Lock request failed:", err);
                }
            } else if (wakeLockRef.current && !importing) {
                try {
                    await wakeLockRef.current.release();
                    wakeLockRef.current = null;
                    console.log("🌙 Wake Lock Released: Device can sleep now.");
                } catch (err) {
                    console.error("Wake Lock release failed:", err);
                }
            }
        };

        handleWakeLock();

        // Cleanup on unmount
        return () => {
            if (wakeLockRef.current) {
                wakeLockRef.current.release().catch(() => { });
            }
        };
    }, [importing]);



    const compressImage = (base64Str, maxWidth = 1600, maxHeight = 1600) => {
        return new Promise((resolve) => {
            const img = new Image();
            img.src = base64Str;
            img.onload = () => {
                const canvas = document.createElement('canvas');
                let width = img.width;
                let height = img.height;

                if (width > height) {
                    if (width > maxWidth) {
                        height *= maxWidth / width;
                        width = maxWidth;
                    }
                } else {
                    if (height > maxHeight) {
                        width *= maxHeight / height;
                        height = maxHeight;
                    }
                }

                canvas.width = width;
                canvas.height = height;
                const ctx = canvas.getContext('2d');
                ctx.drawImage(img, 0, 0, width, height);
                resolve(canvas.toDataURL('image/jpeg', 0.9));
            };
        });
    };

    const isImageDuplicate = (imageData) => {
        return false; // Decommissioned: Pure Upload
    };

    const handleImageUpload = (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setUploadStatus({ total: files.length, processed: 0, added: 0 });

        files.forEach(async (file) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const imageData = reader.result;

                // Add to staged list IMMEDIATELY
                const newImg = {
                    id: `img_${Date.now()}_${Math.random()}`,
                    data: imageData
                };

                setStagedImages(prev => [...prev, newImg]);
                setUploadStatus(prev => ({ ...prev, processed: prev.processed + 1, added: prev.added + 1 }));

                // Compress in background and update
                const compressed = await compressImage(imageData);
                setStagedImages(prev => prev.map(img =>
                    img.id === newImg.id ? { ...img, data: compressed } : img
                ));
            };
            reader.readAsDataURL(file);
        });
    };

    const handlePaste = (e) => {
        const items = e.clipboardData?.items;
        if (!items) return;

        const images = [];
        for (let i = 0; i < items.length; i++) {
            if (items[i].type.indexOf('image') !== -1) {
                images.push(items[i].getAsFile());
            }
        }

        if (images.length === 0) return;
        e.preventDefault();

        setUploadStatus({ total: images.length, processed: 0, added: 0 });

        images.forEach(async (file) => {
            const reader = new FileReader();
            reader.onloadend = async () => {
                const imageData = reader.result;

                // Add to staged list IMMEDIATELY
                const newImg = {
                    id: `img_paste_${Date.now()}_${Math.random()}`,
                    data: imageData
                };

                setStagedImages(prev => [...prev, newImg]);
                setUploadStatus(prev => ({ ...prev, processed: prev.processed + 1, added: prev.added + 1 }));

                // Compress and update
                const compressed = await compressImage(imageData);
                setStagedImages(prev => prev.map(img =>
                    img.id === newImg.id ? { ...img, data: compressed } : img
                ));
            };
            reader.readAsDataURL(file);
        });
    };

    const removeStagedImage = (id) => {
        setStagedImages(prev => prev.filter(img => img.id !== id));
    };

    // Helper to process and upload a list of image data (Base64 or URL)
    const processImagesForUpload = async (imageList) => {
        // Fallback to Base64 for Free Tier stability
        // We only upload if explicitly enabled and working, otherwise Base64 is fine
        // provided we save sequentially.
        if (!isStorageEnabled) return imageList;

        const processed = [];
        for (const imgData of imageList) {
            if (imgData.startsWith('http')) {
                processed.push(imgData);
            } else if (imgData.startsWith('data:image')) {
                try {
                    const blob = await base64ToBlob(imgData);
                    const file = new File([blob], "image.jpg", { type: "image/jpeg" });
                    const url = await uploadImage(file);
                    processed.push(url);
                } catch (e) {
                    console.warn("Storage upload failed (likely payment required). Using Base64 fallback.", e);
                    processed.push(imgData); // Fallback to Base64
                }
            } else {
                processed.push(imgData);
            }
        }
        return processed;
    };

    const handleSubmit = async (e, forceBulkMode = false) => {
        if (e) e.preventDefault();

        // Tag validation prompt (v4.5.0)
        if (formData.tags.length === 0) {
            const confirmNoTags = window.confirm("Bạn chưa gắn tag cho sản phẩm này. Bạn có muốn tiếp tục đăng không?");
            if (!confirmNoTags) return;
        }

        setUploadingImages(true); // Show spinner

        if (forceBulkMode) {
            try {
                // Bulk Mode: Create one product per image
                const baseName = formData.name || getCategoryName(formData.categoryId) || 'Bánh';

                // Initialize Import Stats for the Overlay UI
                setProgressLabel('Đang bày bánh lên kệ...');
                setImportStats({ current: 0, total: stagedImages.length, startTime: Date.now() });

                for (let i = 0; i < stagedImages.length; i++) {
                    const img = stagedImages[i];

                    // Upload image FIRST
                    const [finalUrl] = await processImagesForUpload([img.data]);

                    const productData = {
                        ...formData,
                        id: `prod_${Date.now()}_${i}`,
                        name: stagedImages.length > 1 ? `${baseName} ${i + 1}` : baseName,
                        images: [finalUrl],
                        createdAt: Date.now()
                    };
                    await saveItem('products', productData);

                    // Update UI stats for the progress overlay
                    setImportStats(prev => ({
                        ...prev,
                        current: i + 1
                    }));

                    // STRICT STREAM SYNC: Prevents "Write stream exhausted"
                    await waitForSync();
                    // GENTLE THROTTLE (v5.0.4)
                    await new Promise(r => setTimeout(r, 500));

                    // CHUNKED SYNC (v5.0.5): Pause every 10 images to clear SDK buffer
                    if ((i + 1) % 10 === 0 && i + 1 < stagedImages.length) {
                        setBatchResting(true);
                        await new Promise(r => setTimeout(r, 3000));
                        setBatchResting(false);
                    }
                }

                alert(`Đã thêm ${stagedImages.length} sản phẩm thành công!`);
                const dbProducts = await getAllItems('products');
                setProducts(dbProducts);

                // Reset form
                setFormData({
                    name: '',
                    categoryId: '',
                    subCategoryId: '',
                    price: '',
                    description: '',
                    images: [],
                    tags: []
                });
                setStagedImages([]);
            } catch (error) {
                console.error('Bulk Save error:', error);
                alert('❌ Lỗi lưu dữ liệu hàng loạt!');
            } finally {
                setUploadingImages(false);
            }
            return;
        }

        const productImages = stagedImages.map(img => img.data);
        if (productImages.length === 0) {
            alert('Vui lòng chọn hoặc paste ít nhất 1 ảnh!');
            setUploadingImages(false);
            return;
        }

        try {
            // Upload all images
            const finalImages = await processImagesForUpload(productImages);

            const finalName = formData.name.trim() || `Bánh ${products.length + 1}`;

            const productData = {
                ...formData,
                name: finalName,
                id: editingId || `prod_${Date.now()}`,
                price: formData.price,
                images: finalImages,
                createdAt: editingId ? (products.find(p => p.id === editingId)?.createdAt || Date.now()) : Date.now()
            };

            await saveItem('products', productData);

            // Refresh local state
            const dbProducts = await getAllItems('products');
            setProducts(dbProducts);

            alert(editingId ? 'Đã cập nhật sản phẩm!' : 'Đã thêm sản phẩm mới!');

            // Reset and also clear drafts
            setEditingId(null);
            setFormData({
                name: '',
                categoryId: '',
                subCategoryId: '',
                price: '',
                description: '',
                images: [],
                tags: []
            });
            setStagedImages([]);
            setImagePreview('');
        } catch (error) {
            console.error('Save error:', error);
            alert('❌ Lỗi lưu dữ liệu!');
        } finally {
            setUploadingImages(false);
        }
    };

    const handleEdit = (product) => {
        setFormData({
            ...product,
            tags: product.tags || []
        });
        const images = product.images || [product.image] || [];
        setStagedImages(images.map((img, idx) => ({
            id: `orig_${idx}_${Date.now()}`,
            data: img
        })));
        setEditingId(product.id);
        window.scrollTo({ top: 0, behavior: 'smooth' });
    };

    const handleDelete = async (id) => {
        if (confirm('Xóa sản phẩm này?')) {
            await deleteItem('products', id);
            const dbProducts = await getAllItems('products');
            setProducts(dbProducts);
        }
    };

    const handleInlinePriceSave = async (product, newPrice) => {
        if (product.price === newPrice) {
            setInlineEditingId(null);
            return;
        }

        try {
            const updatedProduct = { ...product, price: newPrice };
            await saveItem('products', updatedProduct);
            // Local state is updated via the real-time listener (subscribeToItems)
            setInlineEditingId(null);
        } catch (err) {
            console.error("Inline price save failed:", err);
            alert("❌ Lỗi lưu giá!");
        }
    };

    const getSubCategories = () => {
        const cat = categories.find(c => c.id === formData.categoryId);
        return cat ? cat.subCategories : [];
    };

    const getSubCategoryName = (catId, subId) => {
        const cat = categories.find(c => c.id === catId);
        if (!cat) return '';
        const sub = cat.subCategories.find(s => s.id === subId);
        return sub ? sub.name : '';
    };

    const getUniqueDescriptions = () => {
        const descriptions = products
            .map(p => p.description)
            .filter(d => d && d.trim() !== '');
        return [...new Set(descriptions)];
    };

    // DYNAMIC CATEGORY RECOVERY: Ensures categories never appear empty if products exist
    const allFilterableCategories = useMemo(() => {
        const nameMap = new Map(); // Key: name.toLowerCase(), Value: { id, name }

        // 1. Add known categories from state (Primary source for IDs)
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
            // Treat every tag as a filterable category
            (p.tags || []).forEach(tag => {
                if (tag && tag.trim()) {
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

            // If product has a categoryID not yet in our name map (via the ID's name)
            if (p.categoryId) {
                const existing = categories.find(c => c.id === p.categoryId);
                if (existing) {
                    const key = existing.name.toLowerCase().trim();
                    if (!nameMap.has(key)) {
                        nameMap.set(key, { id: existing.id, name: existing.name.trim(), subCategories: [] });
                    }
                } else {
                    // Orphaned ID: guess a name or use ID
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

    const handleAddSmartTag = async (tagName) => {
        if (!tagName || !tagName.trim()) return;
        const cleanName = tagName.trim();

        let category = allFilterableCategories.find(c => c.name.toLowerCase() === cleanName.toLowerCase());

        if (!category) {
            // Create new category on the fly
            category = {
                id: `cat_${Date.now()}_${Math.random()}`,
                name: cleanName,
                subCategories: []
            };
            // Optimistic update: Update local state IMMEDIATELY
            setCategories(prev => [...prev, category]);

            try {
                await saveItem('categories', category);
            } catch (err) {
                console.error('Error saving category to DB (but verified locally):', err);
            }
        }

        // Add tag to product if not already present
        if (!formData.tags.includes(category.name)) {
            const nextTags = [...formData.tags, category.name];
            setFormData(prev => ({
                ...prev,
                tags: nextTags
            }));
        }
        setTagInputText('');
        setShowTagSuggestions(false);
    };

    const handleTagInputKeyDown = (e) => {
        const filtered = allFilterableCategories.filter(cat =>
            cat.name.toLowerCase().includes(tagInputText.toLowerCase())
        );

        if (e.key === 'Enter') {
            e.preventDefault();
            if (showTagSuggestions && filtered[selectedIndex]) {
                handleAddSmartTag(filtered[selectedIndex].name);
            } else {
                handleAddSmartTag(tagInputText);
            }
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex(prev => (prev + 1) % (filtered.length || 1));
            setShowTagSuggestions(true);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex(prev => (prev - 1 + filtered.length) % (filtered.length || 1));
            setShowTagSuggestions(true);
        } else if (e.key === 'Escape') {
            setShowTagSuggestions(false);
        }
    };

    useEffect(() => {
        const handlePasteEvent = (e) => handlePaste(e);
        window.addEventListener('paste', handlePasteEvent);
        return () => window.removeEventListener('paste', handlePasteEvent);
    }, [formData, products]);

    const handleFolderImport = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setImporting(true);
        setProgressLabel('Đang bày bánh từ thư mục...');
        setImportStats({ current: 0, total: files.length, startTime: Date.now() });
        setUploadStatus({ total: files.length, processed: 0, added: 0 });

        const newCategories = [...categories];
        const newProducts = [...products];

        // Group files by subfolder
        const folderGroups = {};
        files.forEach(file => {
            const pathParts = file.webkitRelativePath.split(/[/\\]/);
            if (pathParts.length < 3) return;

            const catName = pathParts[1];
            if (!catName) return;
            if (!folderGroups[catName]) folderGroups[catName] = [];
            folderGroups[catName].push(file);
        });

        const categoryNames = Object.keys(folderGroups);
        let globalProcessedCount = 0;

        for (const catName of categoryNames) {
            // 1. Find or create category (Stream Mode: Check & Save immediately if new)
            let cat = allFilterableCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
            if (!cat) {
                // Check if we just added it in this session's newCategories
                cat = newCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
            }

            if (!cat) {
                cat = { id: `cat_${Date.now()}_${Math.random()}`, name: catName, subCategories: [] };
                newCategories.push(cat);
                // Save Category IMMEDIATELY
                try {
                    await saveItem('categories', cat);
                } catch (err) {
                    console.warn(`Failed to save category ${cat.name}`, err);
                }
            }

            const catFiles = folderGroups[catName];
            for (const file of catFiles) {
                try {
                    const reader = new FileReader();
                    const imageData = await new Promise((resolve) => {
                        reader.onload = (re) => resolve(re.target.result);
                        reader.readAsDataURL(file);
                    });

                    const compressed = await compressImage(imageData);

                    let finalUrl = compressed;
                    if (isStorageEnabled) {
                        try {
                            const blob = await base64ToBlob(compressed);
                            const uploadFile = new File([blob], file.name || "image.jpg", { type: "image/jpeg" });
                            finalUrl = await uploadImage(uploadFile);
                        } catch (uErr) {
                            console.warn("Storage upload failed, using Base64 fallback.", uErr);
                        }
                    }

                    const newProd = {
                        id: `prod_${Date.now()}_${Math.random()}`,
                        name: `Bánh ${newProducts.length + 1}`,
                        categoryId: cat.id,
                        price: 'Liên hệ',
                        description: '',
                        images: [finalUrl],
                        createdAt: Date.now(),
                        tags: [catName]
                    };

                    // STREAM SAVE: Save Product IMMEDIATELY
                    await saveItem('products', newProd);

                    // Update Local State appropriately
                    newProducts.push(newProd);

                } catch (err) {
                    console.error(`Lỗi xử lý file ${file.name}:`, err);
                }

                globalProcessedCount++;

                // UPDATE PROGRESS (Real-time based on SAVED items)
                setImportStats(prev => ({
                    ...prev,
                    current: globalProcessedCount
                }));
                // Update ETA in UploadStatus for optional specialized display
                setUploadStatus(prev => ({ ...prev, processed: globalProcessedCount }));

                // STRICT STREAM SYNC (v4.6.4)
                // Sync after EVERY image to prevent "Write stream exhausted"
                // This relies on network latency as the natural throttle.
                await waitForSync();
                // GENTLE THROTTLE (v5.0.4): Prevent SDK buffer overflow
                await new Promise(r => setTimeout(r, 500));

                // CHUNKED SYNC (v5.0.5): Pause every 10 images
                if (globalProcessedCount % 10 === 0 && globalProcessedCount < files.length) {
                    setBatchResting(true);
                    await new Promise(r => setTimeout(r, 3000));
                    setBatchResting(false);
                }
            }
        }

        setCategories(newCategories);
        localStorage.setItem('cached_categories', JSON.stringify(newCategories));
        setProducts(newProducts);
        setImporting(false);
        alert(`🎉 Thành công! Đã thêm ${globalProcessedCount} món mới.`);
    };

    const [adminFilter, setAdminFilter] = useState('All');

    const handleDeleteAll = async () => {
        const isFiltered = adminFilter !== 'All';
        const targetCount = filteredAdminProducts.length;

        if (targetCount === 0) {
            alert('Không có sản phẩm nào để xóa!');
            return;
        }

        const confirmMessage = isFiltered
            ? `⚠️ Bạn có chắc muốn xóa ${targetCount} sản phẩm đang hiển thị (Lọc: ${getCategoryName(adminFilter)})?`
            : `⚠️ CẢNH BÁO: Bạn có chắc chắn muốn XÓA TOÀN BỘ ${targetCount} sản phẩm trong shop không?`;

        if (!confirm(confirmMessage)) return;

        const finalConfirm = prompt(isFiltered
            ? `Nhập "XOA" để xóa ${targetCount} sản phẩm này:`
            : 'QUAN TRỌNG: Nhập "XOA" để xóa SẠCH TOÀN BỘ SHOP:');

        if (finalConfirm !== 'XOA') {
            alert('Hủy lệnh xóa.');
            return;
        }

        try {
            setImporting(true); // Reuse progress UI
            setProgressLabel(isFiltered ? `Đang dọn dẹp ${getCategoryName(adminFilter)}...` : 'Đang dọn dẹp kệ hàng...');
            setImportStats({ current: 0, total: targetCount, startTime: Date.now() });

            // TURBO BATCH DELETE (v5.0.9): Super fast bulk delete
            const targetIds = filteredAdminProducts.map(p => p.id);
            await deleteItemsBulk('products', targetIds);

            const dbProducts = await getAllItems('products');
            setProducts(dbProducts);
            alert(`💥 Đã xóa thành công ${targetCount} sản phẩm!`);
        } catch (error) {
            console.error('Delete error:', error);
            alert('❌ Lỗi khi xóa dữ liệu!');
        } finally {
            setImporting(false);
        }
    };

    const handleBulkTagUpdate = async () => {
        if (!targetTagId) {
            alert('Vui lòng chọn Tag để gán!');
            return;
        }
        if (bulkSelectedIds.length === 0) {
            alert('Vui lòng chọn ít nhất 1 sản phẩm!');
            return;
        }

        try {
            const tagObj = allFilterableCategories.find(c => c.id === targetTagId);
            const tagName = tagObj ? tagObj.name : targetTagId;

            const modifiedProducts = [];
            const newAllProducts = products.map(p => {
                if (bulkSelectedIds.includes(p.id)) {
                    const currentTags = p.tags || [];
                    const tagNameLower = tagName.toLowerCase();

                    // 1. CLEANUP: Remove any cryptic IDs that resolve to this tagName
                    // and also just generally deduplicate by name.
                    const filteredTags = currentTags.filter(t => {
                        const tName = t.startsWith('cat_') ? getCategoryName(t) : t;
                        return tName.toLowerCase() !== tagNameLower;
                    });

                    // 2. Add the unique Tag Name
                    const updatedTags = [...filteredTags, tagName];

                    // 3. Compare to see if we actually changed anything
                    // (either by cleanup or by adding the name)
                    const isChanged = JSON.stringify(currentTags.sort()) !== JSON.stringify(updatedTags.sort());

                    if (isChanged) {
                        const updated = { ...p, tags: updatedTags };
                        modifiedProducts.push(updated);
                        return updated;
                    }
                }
                return p;
            });

            if (modifiedProducts.length > 0) {
                // Save ONLY modified products
                await addItemsBulk('products', modifiedProducts);
                setProducts(newAllProducts);
            }

            setBulkSelectedIds([]);
            alert(`🎉 Đã gắn Tag cho ${bulkSelectedIds.length} sản phẩm!`);
        } catch (error) {
            console.error('Bulk tag error:', error);
            alert('❌ Lỗi khi cập nhật hàng loạt!');
        }
    };

    const toggleBulkSelection = (id) => {
        setBulkSelectedIds(prev =>
            prev.includes(id) ? prev.filter(i => i !== id) : [...prev, id]
        );
    };

    const filteredAdminProducts = products.filter(p => {
        // Search Filter (v5.2.0)
        const searchNorm = adminSearch.toLowerCase().trim();
        if (searchNorm && !p.name.toLowerCase().includes(searchNorm) && !(p.description || '').toLowerCase().includes(searchNorm)) {
            return false;
        }

        if (adminFilter === 'All') return true;
        if (adminFilter === 'newest') {
            const oneDayAgo = Date.now() - (24 * 60 * 60 * 1000);
            return p.createdAt && p.createdAt > oneDayAgo;
        }

        const filterName = getCategoryName(adminFilter).toLowerCase();
        return p.categoryId === adminFilter ||
            (p.tags || []).some(t => t.toLowerCase() === filterName);
    }).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)); // Always show newest first in admin

    // Products that DON'T have the target tag yet
    const productsForBulkTagging = products.filter(p => {
        if (!targetTagId) return false;
        const targetName = getCategoryName(targetTagId).toLowerCase();

        // Already matched by primary category ID
        if (p.categoryId === targetTagId) return false;

        // Check if normalized tag names contain the target name
        return !(p.tags || []).some(t => {
            const tName = t.startsWith('cat_') ? getCategoryName(t) : t;
            return (tName || '').toLowerCase() === targetName;
        });
    });

    if (isLoading) return <LoadingScreen />;

    return (
        <div className="product-manager">
            <h2>Quản Lý Sản Phẩm (LuLuCake - Thông minh & Tốc độ)</h2>

            {/* Admin Tabs */}
            <div className="admin-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '2rem', borderBottom: '2px solid var(--pink)', paddingBottom: '10px', overflowX: 'auto' }}>
                <button
                    onClick={() => setActiveAdminTab('add')}
                    className={`tab-btn ${activeAdminTab === 'add' ? 'active' : ''}`}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeAdminTab === 'add' ? 'var(--pink)' : 'var(--white)',
                        color: activeAdminTab === 'add' ? 'white' : 'var(--brown)',
                        borderRadius: '15px 15px 0 0',
                        cursor: 'pointer',
                        fontWeight: '600',
                        whiteSpace: 'nowrap'
                    }}
                >
                    ➕ Thêm & Sửa Bánh
                </button>
                <button
                    onClick={() => setActiveAdminTab('bulk-tag')}
                    className={`tab-btn ${activeAdminTab === 'bulk-tag' ? 'active' : ''}`}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeAdminTab === 'bulk-tag' ? 'var(--pink)' : 'var(--white)',
                        color: activeAdminTab === 'bulk-tag' ? 'white' : 'var(--brown)',
                        borderRadius: '15px 15px 0 0',
                        cursor: 'pointer',
                        fontWeight: '600',
                        whiteSpace: 'nowrap'
                    }}
                >
                    🏷️ Gán Tag Hàng Loạt
                </button>
                <button
                    onClick={() => setActiveAdminTab('tiktok')}
                    className={`tab-btn ${activeAdminTab === 'tiktok' ? 'active' : ''}`}
                    style={{
                        padding: '10px 20px',
                        border: 'none',
                        background: activeAdminTab === 'tiktok' ? 'var(--pink)' : 'var(--white)',
                        color: activeAdminTab === 'tiktok' ? 'white' : 'var(--brown)',
                        borderRadius: '15px 15px 0 0',
                        cursor: 'pointer',
                        fontWeight: '600',
                        whiteSpace: 'nowrap'
                    }}
                >
                    🎥 Quản Lý TikTok
                </button>
            </div>

            {activeAdminTab === 'add' ? (
                <div className="manager-section modern-admin-form" style={{ background: '#fff', borderRadius: '30px', boxShadow: '0 10px 40px rgba(0,0,0,0.03)', padding: '0', overflow: 'hidden' }}>
                    <div className="form-header" style={{ background: 'linear-gradient(135deg, #fff5f7 0%, #fff 100%)', padding: '2rem', borderBottom: '1px solid #f0f0f0' }}>
                        <h3 style={{ margin: 0, color: 'var(--brown)', fontSize: '1.5rem', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            {editingId ? '✏️ Cập nhật sản phẩm' : '✨ Thêm bánh mới'}
                            <span style={{ fontSize: '0.8rem', background: 'var(--pink)', color: 'white', padding: '4px 12px', borderRadius: '20px', fontWeight: 'bold' }}>VERSION 4.4.0</span>
                        </h3>
                        <p style={{ margin: '5px 0 0 0', color: '#888', fontSize: '0.9rem' }}>Điền thông tin và hình ảnh để hiển thị lên tiệm bánh Lulu</p>
                    </div>

                    <form className="product-form" style={{ padding: '2rem', display: 'flex', flexDirection: 'column', gap: '2rem', boxSizing: 'border-box', maxWidth: '100%' }} onSubmit={(e) => handleSubmit(e, false)}>
                        <div className="form-sections-container" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>

                            {/* Section 1: Thông tin cơ bản */}
                            <div className="form-group-section">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>📝</span>
                                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--brown)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Thông tin cơ bản</h4>
                                </div>
                                <div className="responsive-row">
                                    <div className="input-field">
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#666', marginBottom: '8px', paddingLeft: '5px' }}>TÊN BÁNH</label>
                                        <input
                                            type="text"
                                            placeholder="Ví dụ: Bánh kem dâu tây mọng nước..."
                                            value={formData.name}
                                            onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                            className="form-input"
                                            style={{ width: '100%', padding: '14px 20px', borderRadius: '15px', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                    <div className="input-field">
                                        <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#666', marginBottom: '8px', paddingLeft: '5px' }}>GIÁ NIÊM YẾT</label>
                                        <input
                                            type="text"
                                            placeholder="Để trống nếu muốn hiện 'Liên hệ'..."
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                            className="form-input"
                                            style={{ width: '100%', padding: '14px 20px', borderRadius: '15px', boxSizing: 'border-box' }}
                                        />
                                    </div>
                                </div>
                            </div>

                            {/* Section 2: Phân loại & Giao diện */}
                            <div className="form-group-section">
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🏷️</span>
                                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--brown)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Phân loại & Chủ đề</h4>
                                </div>
                                <div className="smart-tag-container">
                                    <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#666', marginBottom: '8px', paddingLeft: '5px' }}>THÊM TAG CHỦ ĐỀ</label>
                                    <div className="tags-input-wrapper" style={{ position: 'relative' }}>
                                        <input
                                            type="text"
                                            placeholder="Gõ để tìm hoặc thêm mới: Bé trai, Công chúa, Tiệc..."
                                            value={tagInputText}
                                            onChange={(e) => {
                                                setTagInputText(e.target.value);
                                                setShowTagSuggestions(true);
                                                setSelectedIndex(0);
                                            }}
                                            onFocus={() => setShowTagSuggestions(true)}
                                            onBlur={() => setTimeout(() => setShowTagSuggestions(false), 200)}
                                            onKeyDown={handleTagInputKeyDown}
                                            className="form-input"
                                            style={{ width: '100%', padding: '14px 20px', borderRadius: '15px', boxSizing: 'border-box' }}
                                        />
                                        {showTagSuggestions && tagInputText && (
                                            <div className="custom-suggestions" style={{ position: 'absolute', top: '103%', left: 0, right: 0, background: 'white', border: '2px solid var(--pink)', borderRadius: '15px', zIndex: 1000, maxHeight: '200px', overflowY: 'auto', boxShadow: '0 10px 30px rgba(0,0,0,0.1)' }}>
                                                {allFilterableCategories.filter(cat => cat.name.toLowerCase().includes(tagInputText.toLowerCase())).map((cat, idx) => (
                                                    <div key={cat.id} onClick={() => handleAddSmartTag(cat.name)} className={`suggestion-item ${idx === selectedIndex ? 'active' : ''}`} style={{ padding: '12px 20px', cursor: 'pointer', background: idx === selectedIndex ? '#fff0f5' : 'transparent', fontWeight: '600', color: 'var(--brown)' }}>✨ {cat.name}</div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <div className="tags-display" style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '1rem' }}>
                                        {formData.tags?.length === 0 && <span style={{ color: '#bbb', fontSize: '0.85rem', italic: 'true' }}>Chưa có tag nào được chọn</span>}
                                        {formData.tags?.map(tagId => (
                                            <div key={tagId} className="tag-chip active" style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '6px 15px', background: 'var(--pink)', color: 'white', borderRadius: '25px', fontSize: '0.9rem', fontWeight: '700', boxShadow: '0 4px 10px rgba(255, 133, 162, 0.2)' }}>
                                                #{getCategoryName(tagId) || tagId}
                                                <span onClick={() => setFormData({ ...formData, tags: formData.tags.filter(id => id !== tagId) })} style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.3)', width: '20px', height: '20px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px' }}>✕</span>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            </div>

                            {/* Section 3: Hình ảnh & Mô tả */}
                            <div className="form-group-section" style={{ background: '#fbfbfb', padding: '1.5rem', borderRadius: '25px', border: '1px solid #f3f3f3' }}>
                                <div style={{ display: 'flex', alignItems: 'center', gap: '10px', marginBottom: '1.2rem' }}>
                                    <span style={{ fontSize: '1.2rem' }}>🖼️</span>
                                    <h4 style={{ margin: 0, fontSize: '1rem', color: 'var(--brown)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Hình ảnh & Mô tả</h4>
                                </div>

                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#666', marginBottom: '8px', paddingLeft: '5px' }}>MÔ TẢ NGẮN (HIỆN TRÊN LIGHTBOX)</label>
                                <textarea
                                    placeholder="Điền vài dòng cảm nhận về chiếc bánh này nhé..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="form-textarea"
                                    style={{ width: '100%', borderRadius: '15px', padding: '15px', minHeight: '100px', marginBottom: '1.5rem' }}
                                />

                                <div className="media-upload-zone" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
                                    <label className="image-upload-label" style={{ flex: '1 1 120px', margin: 0, background: '#fff', color: 'var(--pink)', border: '2px dashed var(--pink)', borderRadius: '12px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', padding: '8px', cursor: 'pointer', transition: 'all 0.3s' }}>
                                        <span style={{ fontSize: '0.9rem' }}>📸</span>
                                        <div style={{ textAlign: 'center' }}>
                                            <p style={{ fontWeight: '800', margin: 0, fontSize: '0.75rem' }}>Chọn/Dán ảnh</p>
                                        </div>
                                        <input type="file" accept="image/*" multiple onChange={handleImageUpload} style={{ display: 'none' }} />
                                    </label>

                                    <label className="bulk-folder-btn" style={{ flex: '0 0 auto', background: '#ecfdf5', border: '2px solid #10b981', color: '#059669', padding: '6px 12px', borderRadius: '12px', cursor: 'pointer', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
                                        <span style={{ fontSize: '0.8rem' }}>📁</span>
                                        <p style={{ fontWeight: '800', margin: 0, fontSize: '0.65rem' }}>Up Folder</p>
                                        <input type="file" webkitdirectory="true" directory="true" onChange={handleFolderImport} style={{ display: 'none' }} />
                                    </label>
                                </div>

                                {stagedImages.length > 0 && (
                                    <div className="staged-preview-list" style={{ marginTop: '2rem' }}>
                                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '10px', padding: '0 5px' }}>
                                            <span style={{ fontWeight: '800', fontSize: '0.9rem', color: 'var(--brown)' }}>📦 ĐANG CHỜ LƯU: {stagedImages.length} ẢNH</span>
                                            <button type="button" onClick={() => setStagedImages([])} style={{ background: 'none', border: 'none', color: '#e11d48', fontSize: '0.8rem', fontWeight: 'bold', cursor: 'pointer' }}>🗑️ XÓA HẾT</button>
                                        </div>
                                        <div className="mini-staged-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(70px, 1fr))', gap: '10px' }}>
                                            {stagedImages.map(img => (
                                                <div key={img.id} style={{ position: 'relative', aspectRatio: '1/1', borderRadius: '12px', overflow: 'hidden', border: '2px solid #fff', boxShadow: '0 4px 10px rgba(0,0,0,0.05)' }}>
                                                    <img src={img.data} style={{ width: '100%', height: '100%', objectFit: 'cover' }} alt="staged-mini" />
                                                    <button type="button" onClick={() => removeStagedImage(img.id)} style={{ position: 'absolute', top: '2px', right: '2px', background: 'rgba(0,0,0,0.5)', color: 'white', border: 'none', width: '20px', height: '20px', borderRadius: '50%', fontSize: '10px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>✕</button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        {/* Footer Actions / Progress Section */}
                        <div className="form-footer-sticky" style={{ borderTop: '1px solid #f0f0f0', paddingTop: '2rem', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '15px' }}>
                            {importing || (uploadingImages && stagedImages.length > 1) ? (
                                /* INLINE PROGRESS UI (v5.0.3) */
                                <div style={{
                                    width: '100%',
                                    maxWidth: '500px',
                                    padding: '2rem',
                                    background: 'white',
                                    borderRadius: '20px',
                                    display: 'flex',
                                    flexDirection: 'column',
                                    alignItems: 'center',
                                    textAlign: 'center'
                                }}>
                                    <div className="loading-spinner" style={{ width: '50px', height: '50px', border: '5px solid #f3f3f3', borderTop: '5px solid var(--pink)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>

                                    <h2 style={{ fontSize: '2.5rem', margin: '20px 0 10px 0', color: 'var(--brown)', fontWeight: '800' }}>
                                        {batchResting ? '🧘 Đang nghỉ xả hơi 3s...' : `${progressLabel} ${Math.round((importStats.current / (importStats.total || 1)) * 100)}%`}
                                    </h2>

                                    <div style={{ width: '100%', height: '12px', background: '#f0f0f0', borderRadius: '6px', margin: '15px 0', overflow: 'hidden' }}>
                                        <div style={{
                                            height: '100%',
                                            background: batchResting ? '#94a3b8' : 'var(--pink)',
                                            width: `${(importStats.current / (importStats.total || 1)) * 100}%`,
                                            transition: 'width 0.3s ease'
                                        }}></div>
                                    </div>

                                    <p style={{ margin: '5px 0', color: '#666', fontWeight: 'bold' }}>
                                        {batchResting ? 'Hệ thống đang giải phóng bộ nhớ để tránh nghẽn...' : `${importStats.current} / ${importStats.total} ${progressLabel.includes('dọn dẹp') ? 'sản phẩm' : 'ảnh'}`}
                                    </p>

                                    <p style={{ margin: '10px 0 0 0', color: '#e11d48', fontSize: '0.9rem', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                                        {batchResting ? '⚡ KHÔNG ĐƯỢC TẮT TRÌNH DUYỆT' : '⚠️ Vui lòng không tắt trình duyệt...'}
                                    </p>

                                    {importStats.startTime > 0 && importStats.current > 1 && (
                                        <p style={{ marginTop: '5px', color: '#999', fontSize: '0.8rem' }}>
                                            ⏱️ Ước tính còn: {Math.ceil(((Date.now() - importStats.startTime) / importStats.current) * (importStats.total - importStats.current) / 1000)} giây
                                        </p>
                                    )}
                                </div>
                            ) : stagedImages.length > 1 && !editingId ? (
                                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '15px', width: '100%', maxWidth: '600px' }}>
                                    <button type="button" className="submit-btn secondary-btn" onClick={() => handleSubmit(null, false)} disabled={uploadingImages} style={{ background: 'var(--brown)', color: 'white', height: '50px', borderRadius: '15px', fontSize: '0.9rem', fontWeight: 'bold', cursor: 'pointer' }}>
                                        📦 LƯU 1 ALBUM CHUNG
                                    </button>
                                    <button type="button" className="submit-btn primary-btn" onClick={() => handleSubmit(null, true)} disabled={uploadingImages} style={{ background: 'var(--pink)', color: 'white', height: '50px', borderRadius: '15px', fontSize: '0.9rem', fontWeight: 'bold', border: 'none', cursor: 'pointer' }}>
                                        🚀 LƯU RIÊNG TỪNG CHIẾC
                                    </button>
                                </div>
                            ) : (
                                <button type="button" className="submit-btn primary-btn" onClick={(e) => handleSubmit(e, false)} disabled={uploadingImages} style={{ width: '100%', maxWidth: '400px', background: 'var(--pink)', color: 'white', height: '55px', borderRadius: '15px', fontSize: '1rem', fontWeight: 'bold', border: 'none', cursor: 'pointer', boxShadow: '0 6px 20px rgba(255, 133, 162, 0.2)', transition: 'transform 0.2s' }}>
                                    {uploadingImages ? '⏳ ĐANG XỬ LÝ...' : (editingId ? '💾 LƯU THAY ĐỔI' : '✨ HOÀN TẤT & THÊM BÁNH')}
                                </button>
                            )}

                            {editingId && (
                                <button type="button" onClick={() => { setEditingId(null); setFormData({ name: '', categoryId: '', price: '', description: '', images: [], tags: [] }); setStagedImages([]); }} style={{ background: 'none', border: 'none', color: '#999', padding: '10px', cursor: 'pointer', fontWeight: '600' }}>
                                    ✕ HUỶ BỎ CHỈNH SỬA
                                </button>
                            )}
                        </div>
                    </form>
                </div>
            ) : activeAdminTab === 'tiktok' ? (
                <div className="manager-section tiktok-manager-ui" style={{ background: '#fff', borderRadius: '30px', boxShadow: '0 10px 40px rgba(0,0,0,0.03)', padding: '2rem' }}>
                    <div className="form-header" style={{ marginBottom: '2rem' }}>
                        <h3 style={{ color: 'var(--brown)', display: 'flex', alignItems: 'center', gap: '12px' }}>
                            🎥 Quản Lý TikTok Featured
                        </h3>
                        <p style={{ color: '#888', fontSize: '0.9rem' }}>Dán link 3 video TikTok bạn muốn khoe lên trang chủ nhé!</p>
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxWidth: '600px' }}>
                        {tiktokUrls.map((url, index) => (
                            <div key={index} className="input-field">
                                <label style={{ display: 'block', fontSize: '0.8rem', fontWeight: '700', color: '#666', marginBottom: '8px' }}>
                                    VIDEO TIKTOK THỨ {index + 1}
                                </label>
                                <input
                                    type="text"
                                    placeholder="https://www.tiktok.com/@username/video/12345..."
                                    value={url}
                                    onChange={(e) => {
                                        const newUrls = [...tiktokUrls];
                                        newUrls[index] = e.target.value;
                                        setTiktokUrls(newUrls);
                                    }}
                                    className="form-input"
                                    style={{ width: '100%', padding: '14px 20px', borderRadius: '15px', border: '2px solid #f0f0f0' }}
                                />
                            </div>
                        ))}

                        <button
                            onClick={async () => {
                                setIsSavingSettings(true);
                                try {
                                    await saveItem('settings', {
                                        id: 'tiktok_featured',
                                        urls: tiktokUrls,
                                        updatedAt: Date.now()
                                    });
                                    alert('✅ Đã lưu cài đặt TikTok!');
                                } catch (err) {
                                    alert('❌ Lỗi khi lưu cài đặt TikTok!');
                                } finally {
                                    setIsSavingSettings(false);
                                }
                            }}
                            disabled={isSavingSettings}
                            style={{
                                marginTop: '1rem',
                                background: 'var(--pink)',
                                color: 'white',
                                padding: '15px',
                                borderRadius: '15px',
                                border: 'none',
                                fontWeight: 'bold',
                                cursor: 'pointer',
                                opacity: isSavingSettings ? 0.7 : 1
                            }}
                        >
                            {isSavingSettings ? '⌛ ĐANG LƯU...' : '💾 LƯU CÀI ĐẶT TIKTOK'}
                        </button>
                    </div>

                    <div style={{ marginTop: '2rem', padding: '1.5rem', background: '#fff5f7', borderRadius: '20px', border: '1px dashed var(--pink)' }}>
                        <h4 style={{ margin: '0 0 10px 0', color: 'var(--pink)', fontSize: '0.9rem' }}>💡 Mẹo nhỏ:</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', color: '#777', lineHeight: '1.6' }}>
                            Bạn có thể lấy link video bằng cách nhấn nút "Chia sẻ" trên TikTok và chọn "Sao chép liên kết". Video sẽ tự động được hiển thị dưới dạng trình phát mini trên trang chủ!
                        </p>
                    </div>
                </div>
            ) : (
                <div className="manager-section" style={{ background: 'var(--white)', padding: '2rem', borderRadius: '25px', boxShadow: '0 10px 30px rgba(0,0,0,0.05)' }}>
                    <div className="bulk-tagging-header">
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
                            <div>
                                <h3>🏷️ Gán Nhãn Tag Nhanh</h3>
                                <p style={{ color: '#666', margin: 0, fontSize: '0.9rem' }}>
                                    Chọn Tag và tick chọn sản phẩm để cập nhật tức thì.
                                </p>
                            </div>
                            <div className="bulk-tag-controls">
                                <select
                                    className="form-select"
                                    style={{ margin: 0, minWidth: '220px', height: '50px' }}
                                    value={targetTagId}
                                    onChange={(e) => {
                                        setTargetTagId(e.target.value);
                                        setBulkSelectedIds([]);
                                    }}
                                >
                                    <option value="">-- Chọn Tag muốn gán --</option>
                                    {allFilterableCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>🏷️ {cat.name}</option>
                                    ))}
                                </select>

                                <button
                                    onClick={() => {
                                        if (bulkSelectedIds.length === productsForBulkTagging.length) {
                                            setBulkSelectedIds([]);
                                        } else {
                                            setBulkSelectedIds(productsForBulkTagging.map(p => p.id));
                                        }
                                    }}
                                    className="secondary-btn"
                                    style={{ padding: '0.6rem 1.2rem', background: 'var(--beige)', border: '2px solid var(--pink)', borderRadius: '15px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.85rem' }}
                                    disabled={!targetTagId || productsForBulkTagging.length === 0}
                                >
                                    {bulkSelectedIds.length === productsForBulkTagging.length && productsForBulkTagging.length > 0 ? '🚫 Bỏ chọn hết' : '✅ Chọn hết'}
                                </button>

                                <button
                                    onClick={handleBulkTagUpdate}
                                    className="primary-btn"
                                    style={{ padding: '0.7rem 1.5rem', borderRadius: '15px', border: 'none', cursor: 'pointer', fontWeight: 'bold', minWidth: '180px' }}
                                    disabled={bulkSelectedIds.length === 0}
                                >
                                    🚀 Cập nhật ({bulkSelectedIds.length})
                                </button>
                            </div>
                        </div>
                    </div>


                    {targetTagId ? (
                        <>
                            <h4 style={{ marginBottom: '1rem', color: 'var(--pink)' }}>
                                📌 Sản phẩm CHƯA có nhãn "{getCategoryName(targetTagId)}":
                            </h4>
                            <div className="bulk-tag-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: '1rem' }}>
                                {productsForBulkTagging.length === 0 ? (
                                    <p style={{ gridColumn: '1/-1', textAlign: 'center', padding: '2rem', color: '#888' }}>
                                        Mọi sản phẩm đều đã có nhãn này! ✨
                                    </p>
                                ) : (
                                    productsForBulkTagging.map(product => (
                                        <div
                                            key={product.id}
                                            className={`bulk-item ${bulkSelectedIds.includes(product.id) ? 'selected' : ''}`}
                                            onClick={() => toggleBulkSelection(product.id)}
                                            style={{
                                                position: 'relative',
                                                borderRadius: '15px',
                                                overflow: 'hidden',
                                                cursor: 'pointer',
                                                border: bulkSelectedIds.includes(product.id) ? '4px solid var(--pink)' : '2px solid #eee',
                                                transition: 'all 0.2s'
                                            }}
                                        >
                                            <img
                                                src={product.images?.[0] || product.image}
                                                style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover' }}
                                                alt="Bulk Select"
                                            />
                                            <div style={{
                                                position: 'absolute',
                                                top: '5px',
                                                right: '5px',
                                                width: '24px',
                                                height: '24px',
                                                background: bulkSelectedIds.includes(product.id) ? 'var(--pink)' : 'white',
                                                borderRadius: '50%',
                                                border: '2px solid white',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                color: 'white',
                                                fontSize: '14px'
                                            }}>
                                                {bulkSelectedIds.includes(product.id) ? '✓' : ''}
                                            </div>
                                        </div>
                                    ))
                                )}
                            </div>
                        </>
                    ) : (
                        <div style={{ textAlign: 'center', padding: '3rem', color: '#888', background: '#f9f9f9', borderRadius: '15px' }}>
                            ☝️ Vui lòng chọn một Nhãn ở trên để bắt đầu!
                        </div>
                    )}
                </div>
            )
            }


            <div className="manager-section">
                <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div className="list-title-area">
                        <h3>Danh Sách Sản Phẩm ({filteredAdminProducts.length})</h3>
                    </div>

                    <div className="list-controls" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="filter-group" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center' }}>
                            <div className="search-box-admin" style={{ position: 'relative' }}>
                                <input
                                    type="text"
                                    className="form-input"
                                    placeholder="🔍 Tìm tên bánh..."
                                    style={{ margin: 0, paddingLeft: '35px', minWidth: '200px' }}
                                    value={adminSearch}
                                    onChange={(e) => setAdminSearch(e.target.value)}
                                />
                                {adminSearch && (
                                    <span
                                        onClick={() => setAdminSearch('')}
                                        style={{ position: 'absolute', right: '10px', top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', opacity: 0.5 }}
                                    >✕</span>
                                )}
                            </div>
                            <select
                                className="form-select"
                                value={adminFilter}
                                onChange={(e) => setAdminFilter(e.target.value)}
                                style={{ margin: 0 }}
                            >
                                <option value="All">🌈 Tất cả sản phẩm</option>
                                <option value="newest" style={{ fontWeight: 'bold', color: 'var(--pink)' }}>🔥 Mới nhất (24h)</option>
                                <optgroup label="🏷️ Lọc theo Tags">
                                    {allFilterableCategories.map(cat => (
                                        <option key={cat.id} value={cat.id}>{cat.name}</option>
                                    ))}
                                </optgroup>
                            </select>
                        </div>
                        <button
                            className="btn-delete-all"
                            onClick={handleDeleteAll}
                            style={{
                                padding: '8px 18px',
                                background: adminFilter === 'All' ? '#e74c3c' : '#f39c12',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                cursor: 'pointer',
                                fontWeight: 'bold',
                                fontSize: '0.85rem'
                            }}
                        >
                            {adminFilter === 'All' ? '💥 XÓA TẤT CẢ' : `🗑️ XÓA ${filteredAdminProducts.length} MỤC ĐANG LỌC`}
                        </button>

                    </div>
                </div>

                <div className="product-grid">
                    {filteredAdminProducts.length === 0 ? (
                        <p className="empty-message">Dọn dẹp sạch sẽ rồi! Thêm bánh mới thôi nào! 🧁</p>
                    ) : (
                        filteredAdminProducts.map(product => (
                            <div key={product.id} className="product-item">
                                <div className="product-item-image">
                                    <img src={product.images?.[0] || product.image} alt={product.name} />
                                    {product.images?.length > 1 && (
                                        <span className="image-count">+{product.images.length - 1} ảnh</span>
                                    )}
                                </div>
                                <div className="product-item-info">
                                    <h4 style={{ display: 'none' }}>{product.name}</h4>
                                    <p className="product-category" style={{ display: 'none' }}>
                                        📁 {getCategoryName(product.categoryId)}
                                    </p>
                                    {product.tags && product.tags.length > 0 && (
                                        <div className="product-tags-list" style={{ display: 'flex', flexWrap: 'wrap', gap: '4px', marginTop: '4px' }}>
                                            {product.tags.map(tagId => {
                                                const displayName = getCategoryName(tagId);
                                                // Hide cryptic IDs that couldn't be resolved
                                                if (!displayName || displayName.startsWith('cat_')) return null;

                                                return (
                                                    <span key={tagId} style={{
                                                        fontSize: '0.7rem',
                                                        background: '#fff0f5',
                                                        color: 'var(--pink)',
                                                        padding: '2px 8px',
                                                        borderRadius: '10px',
                                                        border: '1px solid var(--pink)',
                                                        opacity: 0.8
                                                    }}>
                                                        #{displayName}
                                                    </span>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {inlineEditingId === product.id ? (
                                        <div className="inline-price-editor">
                                            <input
                                                autoFocus
                                                className="inline-price-input"
                                                type="text"
                                                value={inlinePriceValue}
                                                onChange={(e) => setInlinePriceValue(e.target.value)}
                                                onKeyDown={(e) => {
                                                    if (e.key === 'Enter') handleInlinePriceSave(product, inlinePriceValue);
                                                    if (e.key === 'Escape') setInlineEditingId(null);
                                                }}
                                                onBlur={() => handleInlinePriceSave(product, inlinePriceValue)}
                                                placeholder="0"
                                            />
                                            <span style={{ fontSize: '0.8rem', fontWeight: '800', color: 'var(--pink)' }}>cành</span>
                                        </div>
                                    ) : (
                                        <div
                                            className="product-price"
                                            onClick={() => {
                                                setInlineEditingId(product.id);
                                                setInlinePriceValue(product.price === 'Liên hệ' ? '' : product.price);
                                            }}
                                            title="Click để sửa giá nhanh"
                                        >
                                            {isNaN(product.price) ? product.price : `${product.price} cành`}
                                        </div>
                                    )}
                                    <p className="product-desc">{product.description}</p>
                                </div>
                                <div className="product-item-actions">
                                    <button className="btn-edit" onClick={() => handleEdit(product)}>✏️ Sửa</button>
                                    <button className="btn-delete" onClick={() => handleDelete(product.id)}>🗑️ Xóa</button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div >
    );
}
