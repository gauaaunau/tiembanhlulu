import React, { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import './ProductManager.css';
import { subscribeToItems, saveItem, deleteItem, openDB, addItemsBulk, deleteAllItems, getAllItems, saveAllItems } from '../utils/db';
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
    const [isStorageEnabled] = useState(false); // Disabled: Free tier doesn't support Storage
    const [syncingCloud, setSyncingCloud] = useState(false);
    const [uploadingImages, setUploadingImages] = useState(false);
    const [targetTagId, setTargetTagId] = useState('');
    const [bulkSelectedIds, setBulkSelectedIds] = useState([]);
    const [tagInputText, setTagInputText] = useState('');
    const [showTagSuggestions, setShowTagSuggestions] = useState(false);
    const [typedTag, setTypedTag] = useState('');
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(true);
    const [uploadStatus, setUploadStatus] = useState({ total: 0, processed: 0, added: 0 });
    const statusTimeoutRef = useRef(null);

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

        return () => {
            unsubProducts();
            unsubCategories();
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
        if (!imageData) return false;
        // Check current staged batch (Literal check only)
        return stagedImages.some(img => img.data === imageData);
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

        // New requirement (v4.2.1): Tag validation prompt
        if (formData.tags.length === 0) {
            const confirmNoTags = window.confirm("Bạn chưa gắn tag ảnh, bạn có muốn tiếp tục đăng không?");
            if (!confirmNoTags) return;
        }

        setUploadingImages(true); // Show spinner

        if (forceBulkMode) {
            try {
                // Bulk Mode: Create one product per image
                const baseName = formData.name || getCategoryName(formData.categoryId) || 'Bánh';

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

            const productData = {
                ...formData,
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

    const handleCloudMigration = async () => {
        if (!confirm('Bạn có muốn đẩy toàn bộ dữ liệu từ máy tính này lên Đám mây (Firebase) không? \nLưu ý: Bạn chỉ cần làm việc này 1 lần duy nhất khi bắt đầu sử dụng tên miền mới.')) return;

        setSyncingCloud(true);
        try {
            // Push Categories first
            await saveAllItems('categories', categories);
            // Push Products
            await saveAllItems('products', products);
            alert('🎉 Chúc mừng! Toàn bộ bánh trái đã được đưa lên Đám mây thành công!');
        } catch (err) {
            console.error('Migration error:', err);
            alert('❌ Lỗi khi chuyển đổi dữ liệu!');
        } finally {
            setSyncingCloud(false);
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
                tags: nextTags,
                categoryId: prev.categoryId || category.id
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

    const [importing, setImporting] = useState(false);
    const [importStats, setImportStats] = useState({ current: 0, total: 0 });

    const handleFolderImport = async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;

        setImporting(true);
        setImportStats({ current: 0, total: files.length });
        setUploadStatus({ total: files.length, processed: 0, added: 0 });

        const newCategories = [...categories];
        const newProducts = [...products];

        // Group files by subfolder
        const folderGroups = {};
        files.forEach(file => {
            const pathParts = file.webkitRelativePath.split(/[/\\]/);
            if (pathParts.length < 3) return; // Skip files in root or empty folders

            const catName = pathParts[1]; // Subfolder name
            if (!catName) return;
            if (!folderGroups[catName]) folderGroups[catName] = [];
            folderGroups[catName].push(file);
        });

        const categoryNames = Object.keys(folderGroups);
        let processedCount = 0;

        // Track items to save (Deltas)
        const categoriesToSave = [];
        const productsToSave = [];

        for (const catName of categoryNames) {
            // Find or create category
            let cat = allFilterableCategories.find(c => c.name.toLowerCase() === catName.toLowerCase());
            if (!cat) {
                cat = { id: `cat_${Date.now()}_${Math.random()}`, name: catName, subCategories: [] };
                newCategories.push(cat);
                categoriesToSave.push(cat);
            }

            const catFiles = folderGroups[catName];
            for (const file of catFiles) {
                try {

                    const originalHash = await calculateDataHash(file);

                    // Cross-device Check
                    if (products.some(p => p.imageHash === originalHash)) {
                        console.log(`Bỏ qua ảnh đã có trong tiệm: ${file.name}`);
                        processedCount++;
                        setUploadStatus(prev => ({ ...prev, processed: processedCount }));
                        continue;
                    }

                    const reader = new FileReader();
                    const imageData = await new Promise((resolve) => {
                        reader.onload = (re) => resolve(re.target.result);
                        reader.readAsDataURL(file);
                    });

                    const vHash = await calculatePHash(imageData);

                    // Cross-device Visual Check (FUZZY)
                    const dupProduct = findVisualDuplicate(vHash?.bits, products);
                    if (dupProduct) {
                        const dist = getHammingDistance(vHash?.bits, dupProduct.visualBits || dupProduct.visualHash);
                        const similarity = Math.round((1 - dist / 64) * 100);

                        setUploadStatus(prev => ({
                            ...prev,
                            duplicates: prev.duplicates + 1,
                            processed: prev.processed + 1,
                            lastMatch: similarity
                        }));

                        console.log(`Bỏ qua ảnh trùng visual (giống bánh ${dupProduct.name}): ${file.name}`);
                        processedCount++;
                        continue;
                    }

                    // Intra-batch Check (FUZZY)
                    if (findVisualDuplicate(vHash?.bits, productsToSave)) {
                        console.log(`Bỏ qua ảnh trùng trong đợt import này: ${file.name}`);
                        processedCount++;
                        continue;
                    }

                    const compressed = await compressImage(imageData);

                    // Duplicate Check (Centralized & Robust)
                    if (isImageDuplicate(compressed)) { // Keep as fallback
                        console.log(`Bỏ qua ảnh trùng: ${file.name}`);
                        processedCount++;
                        continue;
                    }

                    // UPLOAD TO STORAGE IMMEDIATELY
                    let finalUrl = compressed;
                    if (isStorageEnabled) {
                        try {
                            const blob = await base64ToBlob(compressed);
                            const uploadFile = new File([blob], file.name || "image.jpg", { type: "image/jpeg" });
                            finalUrl = await uploadImage(uploadFile);
                        } catch (uErr) {
                            console.warn("Storage upload failed (payment required?), using Base64 fallback.", uErr);
                            // Fallback to base64 if upload fails
                        }
                    }

                    const newProd = {
                        id: `prod_${Date.now()}_${Math.random()}`,
                        name: '', // Don't use messy filenames as names
                        categoryId: cat.id,
                        price: 'Liên hệ',
                        description: '',
                        images: [finalUrl],
                        createdAt: Date.now(),
                        tags: [catName], // Only folder name, no ID
                        imageHash: originalHash,
                        visualHash: vHash?.hex,
                        visualBits: vHash?.bits,
                        visualVersion: 2
                    };

                    newProducts.push(newProd);
                    productsToSave.push(newProd);
                } catch (err) {
                    console.error(`Lỗi xử lý file ${file.name}:`, err);
                }

                processedCount++;
                setImportStats(prev => ({ ...prev, current: processedCount }));
                setUploadStatus(prev => ({ ...prev, processed: processedCount }));
            }
        }

        // SEQUENTIAL SAVE (Crucial for Free Tier Base64)
        // We do NOT use addItemsBulk here because it's too fast for Base64 payload.

        if (categoriesToSave.length > 0) {
            console.log(`Saving ${categoriesToSave.length} categories separately...`);
            // Save categories sequentially to ensure they exist for filtering
            for (const cat of categoriesToSave) {
                try {
                    await saveItem('categories', cat);
                } catch (err) {
                    console.warn(`Failed to save category ${cat.name}, but continuing locally.`, err);
                }
            }
        }

        if (productsToSave.length > 0) {
            console.log(`Saving ${productsToSave.length} products sequentially to avoid overload...`);
            for (let i = 0; i < productsToSave.length; i++) {
                await saveItem('products', productsToSave[i]);
                // Update progress to show actual save count
                setImportStats(prev => ({
                    ...prev,
                    current: processedCount + i + 1,
                    status: `Đã lưu ${i + 1}/${productsToSave.length}`
                }));
                // 300ms delay after EVERY save to prevent stream exhaustion
                await new Promise(r => setTimeout(r, 300));
            }
        }

        setCategories(newCategories);
        localStorage.setItem('cached_categories', JSON.stringify(newCategories));
        setProducts(newProducts);
        setImporting(false);
        alert(`🎉 Thành công! Đã thêm ${productsToSave.length} món mới.`);
    };

    const [adminFilter, setAdminFilter] = useState('All');

    const handleDeleteAll = async () => {
        const confirm1 = confirm('⚠️ QUAN TRỌNG: Bạn có chắc chắn muốn XÓA TẤT CẢ sản phẩm không?');
        if (!confirm1) return;

        const confirm2 = confirm('🔥 HÀNH ĐỘNG NÀY KHÔNG THỂ KHỔI PHỤC! Bạn vẫn muốn tiếp tục chứ?');
        if (!confirm2) return;

        const confirmText = prompt('Vui lòng nhập chữ "XOA" (viết hoa, không dấu) để xác nhận xóa sạch shop:');
        if (confirmText !== 'XOA') {
            alert('Xác nhận không đúng. Đã hủy lệnh xóa.');
            return;
        }

        try {
            await deleteAllItems('products');
            setProducts([]);
            alert('💥 Đã xóa sạch toàn bộ sản phẩm!');
        } catch (error) {
            console.error('Delete all error:', error);
            alert('❌ Lỗi khi xóa dữ liệu!');
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
            <div className="admin-tabs" style={{ display: 'flex', gap: '10px', marginBottom: '2rem', borderBottom: '2px solid var(--pink)', paddingBottom: '10px' }}>
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
                        fontWeight: '600'
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
                        fontWeight: '600'
                    }}
                >
                    🏷️ Gán Tag Hàng Loạt
                </button>
            </div>

            {isCloudEnabled && (
                <div className="manager-section cloud-sync-bar" style={{
                    background: 'linear-gradient(135deg, #FF69B4 0%, #FFB6C1 100%)',
                    padding: '1rem 1.5rem',
                    borderRadius: '15px',
                    marginBottom: '1.5rem',
                    color: 'white',
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    boxShadow: '0 4px 15px rgba(255,105,180,0.3)'
                }}>
                    <div>
                        <h4 style={{ margin: 0 }}>🌐 Đã kết nối Đám mây (Firebase)</h4>
                        <p style={{ margin: 0, fontSize: '0.85rem', opacity: 0.9 }}>Dữ liệu của bạn sẽ được đồng bộ trực tiếp lên <strong>tiembanhlulu.com</strong></p>
                    </div>
                    <button
                        onClick={handleCloudMigration}
                        disabled={syncingCloud}
                        style={{
                            padding: '10px 20px',
                            background: 'white',
                            color: 'var(--pink)',
                            border: 'none',
                            borderRadius: '25px',
                            fontWeight: '700',
                            cursor: 'pointer',
                            fontSize: '0.9rem'
                        }}
                    >
                        {syncingCloud ? '🚀 Đang đẩy dữ liệu...' : '🚀 Chuyển dữ liệu lên Mây'}
                    </button>
                </div>
            )}

            {activeAdminTab === 'add' ? (
                <div className="manager-section">
                    <h3>{editingId ? '✏️ Sửa Sản Phẩm' : '➕ Thêm Sản Phẩm Mới'}</h3>
                    <form className="product-form" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }} onSubmit={(e) => handleSubmit(e, false)}>
                        {/* Section 1: Thông tin cơ bản */}
                        <div className="form-card" style={{ background: '#fdfdfd', padding: '1.2rem', borderRadius: '15px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                            <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--brown)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>📝 Thông tin cơ bản</h4>
                            <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                                <input
                                    type="text"
                                    placeholder="Tên bánh (Tùy chọn)"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="form-input"
                                />
                                <input
                                    type="text"
                                    placeholder="Giá (VD: 250k, 500k...)"
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                    className="form-input"
                                />
                            </div>
                        </div>

                        {/* Section 2: Phân loại & Tags */}
                        <div className="form-card" style={{ background: '#fdfdfd', padding: '1.2rem', borderRadius: '15px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                            <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--brown)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>🏷️ Phân loại & Tags</h4>
                            <div className="smart-tag-container">
                                <div className="tags-input-wrapper" style={{ position: 'relative' }}>
                                    <input
                                        type="text"
                                        placeholder="Gán Tag Thể loại (Ví dụ: Bánh Rồng, Baby...)"
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
                                    />

                                    {showTagSuggestions && tagInputText && (
                                        <div className="custom-suggestions" style={{
                                            position: 'absolute',
                                            top: '100%',
                                            left: 0,
                                            right: 0,
                                            background: 'white',
                                            border: '2px solid var(--pink)',
                                            borderRadius: '12px',
                                            zIndex: 1000,
                                            maxHeight: '200px',
                                            overflowY: 'auto',
                                            boxShadow: '0 10px 25px rgba(0,0,0,0.1)',
                                            marginTop: '-5px'
                                        }}>
                                            {allFilterableCategories
                                                .filter(cat => cat.name.toLowerCase().includes(tagInputText.toLowerCase()))
                                                .map((cat, idx) => (
                                                    <div
                                                        key={cat.id}
                                                        onClick={() => handleAddSmartTag(cat.name)}
                                                        className={`suggestion-item ${idx === selectedIndex ? 'active' : ''}`}
                                                        style={{
                                                            padding: '10px 15px',
                                                            cursor: 'pointer',
                                                            background: idx === selectedIndex ? '#fff0f5' : 'transparent',
                                                            color: 'var(--brown)',
                                                            fontWeight: '600',
                                                            borderBottom: '1px solid #eee'
                                                        }}
                                                    >
                                                        🏷️ {cat.name}
                                                    </div>
                                                ))}
                                        </div>
                                    )}
                                </div>

                                <div className="tags-display" style={{ display: 'flex', flexWrap: 'wrap', gap: '8px', marginTop: '1rem' }}>
                                    {formData.tags?.map(tagId => (
                                        <div key={tagId} className="tag-chip active" style={{
                                            display: 'flex',
                                            alignItems: 'center',
                                            gap: '5px',
                                            padding: '5px 12px',
                                            background: 'var(--pink)',
                                            color: 'white',
                                            borderRadius: '20px',
                                            fontSize: '0.9rem',
                                            fontWeight: '600'
                                        }}>
                                            #{getCategoryName(tagId) || tagId}
                                            <span
                                                onClick={() => {
                                                    const nextTags = formData.tags.filter(id => id !== tagId);
                                                    setFormData({
                                                        ...formData,
                                                        tags: nextTags
                                                    });
                                                }}
                                                style={{ cursor: 'pointer', background: 'rgba(255,255,255,0.3)', width: '18px', height: '18px', borderRadius: '50%', textAlign: 'center', lineHeight: '16px' }}
                                            >
                                                ×
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* Section 3: Ghi chú & Hình ảnh */}
                        <div className="form-card" style={{ background: '#fdfdfd', padding: '1.2rem', borderRadius: '15px', boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.02)' }}>
                            <h4 style={{ marginTop: 0, marginBottom: '1rem', color: 'var(--brown)', fontSize: '0.9rem', textTransform: 'uppercase', letterSpacing: '1px' }}>🖼️ Ghi chú & Hình ảnh</h4>
                            <div className="description-wrapper" style={{ marginBottom: '1.5rem' }}>
                                <textarea
                                    placeholder="Mô tả sản phẩm (Tùy chọn)..."
                                    value={formData.description}
                                    onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    className="form-textarea"
                                    rows="2"
                                />
                            </div>

                            <div className="image-upload-section">
                                {/* Simple Status Bar */}
                                {(uploadStatus.total > 0) && (
                                    <div style={{
                                        background: '#fff',
                                        border: `2px solid #0ea5e9`,
                                        padding: '12px 20px',
                                        borderRadius: '15px',
                                        marginBottom: '1rem',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'space-between',
                                        animation: 'fadeIn 0.3s ease',
                                        fontSize: '0.9rem',
                                        boxShadow: '0 8px 15px rgba(0,0,0,0.05)'
                                    }}>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '15px' }}>
                                            <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                                                <span style={{ fontSize: '1.2rem' }}>✅</span>
                                                <span style={{ fontWeight: '800', color: '#059669' }}>Nhận: {uploadStatus.added}</span>
                                            </div>
                                        </div>
                                        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                                            <div style={{ fontSize: '0.7rem', color: '#888', fontWeight: 'bold' }}>
                                                {(uploadStatus.processed / uploadStatus.total * 100).toFixed(0)}%
                                            </div>
                                            <div style={{ width: '40px', height: '40px', position: 'relative' }}>
                                                <svg viewBox="0 0 36 36" style={{ transform: 'rotate(-90deg)' }}>
                                                    <circle cx="18" cy="18" r="16" fill="none" stroke="#eee" strokeWidth="3" />
                                                    <circle
                                                        cx="18" cy="18" r="16" fill="none" stroke={uploadStatus.processed === uploadStatus.total ? '#059669' : '#0ea5e9'}
                                                        strokeWidth="3"
                                                        strokeDasharray={`${(uploadStatus.processed / uploadStatus.total) * 100}, 100`}
                                                        transition="all 0.4s"
                                                    />
                                                </svg>
                                                {uploadStatus.processed === uploadStatus.total && (
                                                    <span style={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', fontSize: '0.8rem' }}>🎉</span>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div style={{ display: 'flex', gap: '10px', marginBottom: '1.5rem' }}>
                                    <label className="image-upload-label" style={{
                                        flex: 1,
                                        margin: 0,
                                        background: 'white',
                                        color: 'var(--pink)',
                                        border: '2px solid var(--pink)',
                                        display: 'flex',
                                        alignItems: 'center',
                                        justifyContent: 'center',
                                        gap: '10px',
                                        padding: '12px'
                                    }}>
                                        📷 Chọn ảnh hoặc Paste (Ctrl+V)
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleImageUpload}
                                            style={{ display: 'none' }}
                                        />
                                    </label>

                                    <label className="bulk-import-btn" style={{
                                        display: 'flex',
                                        alignItems: 'center',
                                        gap: '8px',
                                        padding: '10px 25px',
                                        background: importing ? '#eee' : '#ecfdf5',
                                        color: '#059669',
                                        border: `2px solid ${importing ? '#ddd' : '#10b981'}`,
                                        borderRadius: '15px',
                                        cursor: importing ? 'not-allowed' : 'pointer',
                                        fontWeight: '800',
                                        fontSize: '0.9rem',
                                        transition: 'all 0.2s',
                                        whiteSpace: 'nowrap'
                                    }}>
                                        {importing ? `⚙️ Xử lý...` : '📁 Up Thư Mục'}
                                        <input
                                            type="file"
                                            webkitdirectory="true"
                                            directory="true"
                                            onChange={handleFolderImport}
                                            style={{ display: 'none' }}
                                            disabled={importing}
                                        />
                                    </label>
                                </div>

                                {importing && (
                                    <div className="import-progress-mini" style={{ marginBottom: '1.5rem' }}>
                                        <div style={{ height: '6px', background: '#eee', borderRadius: '3px', overflow: 'hidden' }}>
                                            <div style={{
                                                height: '100%',
                                                background: '#10b981',
                                                width: `${(importStats.current / (importStats.total || 1)) * 100}%`,
                                                transition: 'width 0.3s'
                                            }} />
                                        </div>
                                        <div style={{ fontSize: '0.8rem', color: '#059669', marginTop: '6px', fontWeight: 'bold', textAlign: 'right' }}>
                                            Đang nhập thư mục: {importStats.current} / {importStats.total}
                                        </div>
                                    </div>
                                )}

                                <p className="paste-hint" style={{ margin: 0, fontSize: '0.8rem', color: '#999' }}>💡 Gợi ý: Hệ thống hỗ trợ ảnh Siêu Nét 1600px - Tự động tạo Thể loại khi Up Thư Mục!</p>

                                {stagedImages.length > 0 && (
                                    <div className="staged-images-container" style={{ marginTop: '1.5rem' }}>
                                        <div className="staged-header">
                                            <span>📦 {stagedImages.length} ảnh trong danh sách</span>
                                            <button
                                                type="button"
                                                className="clear-staged-btn"
                                                onClick={() => setStagedImages([])}
                                            >
                                                🗑️ Xóa hết
                                            </button>
                                        </div>
                                        <div className="staged-images-grid">
                                            {stagedImages.map(img => (
                                                <div key={img.id} className="staged-image-item">
                                                    <img src={img.data} alt="Staged" />
                                                    <button
                                                        type="button"
                                                        className="remove-staged-btn"
                                                        onClick={() => removeStagedImage(img.id)}
                                                    >
                                                        ✕
                                                    </button>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        </div>

                        <div className="form-actions" style={{ gridColumn: 'span 2', display: 'flex', gap: '15px', marginTop: '2rem' }}>
                            {stagedImages.length > 1 && !editingId ? (
                                <>
                                    <button
                                        type="button"
                                        className="submit-btn secondary-btn"
                                        onClick={() => handleSubmit(null, false)}
                                        style={{ flex: 1, background: 'var(--brown)', color: 'white', padding: '15px' }}
                                    >
                                        📦 Lưu thành 1 Album ({stagedImages.length} ảnh)
                                    </button>
                                    <button
                                        type="button"
                                        className="submit-btn primary-btn"
                                        onClick={() => handleSubmit(null, true)}
                                        style={{ flex: 1, padding: '15px' }}
                                    >
                                        🚀 Lưu thành nhiều sản phẩm (Mỗi ảnh 1 bánh)
                                    </button>
                                </>
                            ) : (
                                <button
                                    type="button"
                                    className="submit-btn primary-btn"
                                    onClick={(e) => handleSubmit(e, false)}
                                    style={{ width: '100%' }}
                                >
                                    {editingId ? '💾 Cập Nhật' : '✨ Thêm Sản Phẩm'}
                                </button>
                            )}
                            {editingId && (
                                <button
                                    type="button"
                                    className="cancel-btn"
                                    onClick={() => {
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
                                    }}
                                >
                                    ✕ Hủy
                                </button>
                            )}
                        </div>
                    </form>
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
            )}

            <div className="manager-section">
                <div className="list-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '1rem' }}>
                    <div className="list-title-area">
                        <h3>Danh Sách Sản Phẩm ({filteredAdminProducts.length})</h3>
                    </div>

                    <div className="list-controls" style={{ display: 'flex', gap: '0.8rem', alignItems: 'center', flexWrap: 'wrap' }}>
                        <div className="filter-group">
                            <select
                                className="form-select"
                                value={adminFilter}
                                onChange={(e) => setAdminFilter(e.target.value)}
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
                                background: '#e74c3c',
                                color: 'white',
                                border: 'none',
                                borderRadius: '10px',
                                fontWeight: '600',
                                cursor: 'pointer',
                                transition: 'all 0.3s ease'
                            }}
                        >
                            🗑️ Xóa Tất Cả
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
                                    <p className="product-price">{product.price}</p>
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
        </div>
    );
}
