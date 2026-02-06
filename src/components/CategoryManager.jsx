import { useState, useEffect } from 'react';
import './CategoryManager.css';
import { getAllItems, saveAllItems } from '../utils/db';

export default function CategoryManager() {
    const [categories, setCategories] = useState([]);
    const [newCategory, setNewCategory] = useState('');
    const [newSubCategory, setNewSubCategory] = useState({ parentId: '', name: '' });

    useEffect(() => {
        const loadCategories = async () => {
            const dbCategories = await getAllItems('categories');
            if (dbCategories) {
                setCategories(dbCategories);
            }
        };
        loadCategories();
    }, []);

    const saveToDB = async (items) => {
        setCategories(items);
        await saveAllItems('categories', items);
    };

    const addCategory = () => {
        if (!newCategory.trim()) return;
        const updated = [...categories, {
            id: `cat_${Date.now()}`,
            name: newCategory.trim(),
            subCategories: []
        }];
        saveToDB(updated);
        setNewCategory('');
    };

    const addSubCategory = () => {
        if (!newSubCategory.name.trim() || !newSubCategory.parentId) return;

        const updated = categories.map(cat => {
            if (cat.id === newSubCategory.parentId) {
                return {
                    ...cat,
                    subCategories: [...cat.subCategories, {
                        id: `sub_${Date.now()}`,
                        name: newSubCategory.name.trim()
                    }]
                };
            }
            return cat;
        });

        saveToDB(updated);
        setNewSubCategory({ parentId: '', name: '' });
    };

    const deleteCategory = (id) => {
        if (confirm('Xóa thể loại này?')) {
            saveToDB(categories.filter(c => c.id !== id));
        }
    };

    const deleteSubCategory = (parentId, subId) => {
        const updated = categories.map(cat => {
            if (cat.id === parentId) {
                return {
                    ...cat,
                    subCategories: cat.subCategories.filter(s => s.id !== subId)
                };
            }
            return cat;
        });
        saveToDB(updated);
    };

    return (
        <div className="category-manager">
            <h2>🏷️ Quản Lý Thể Loại</h2>

            <div className="category-form-section">
                <div className="form-group">
                    <h3>➕ Thêm Thể Loại Chính</h3>
                    <div className="input-group">
                        <input
                            type="text"
                            placeholder="Tên thể loại (VD: Bánh Kem)"
                            value={newCategory}
                            onChange={(e) => setNewCategory(e.target.value)}
                        />
                        <button onClick={addCategory}>Thêm</button>
                    </div>
                </div>

                <div className="form-group">
                    <h3>➕ Thêm Thể Loại Con</h3>
                    <div className="input-group">
                        <select
                            value={newSubCategory.parentId}
                            onChange={(e) => setNewSubCategory({ ...newSubCategory, parentId: e.target.value })}
                        >
                            <option value="">-- Chọn thể loại cha --</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                        <input
                            type="text"
                            placeholder="Tên thể loại con"
                            value={newSubCategory.name}
                            onChange={(e) => setNewSubCategory({ ...newSubCategory, name: e.target.value })}
                        />
                        <button onClick={addSubCategory}>Thêm</button>
                    </div>
                </div>
            </div>

            <div className="category-list">
                <h3>Danh Sách Thể Loại</h3>
                <div className="category-grid">
                    {categories.map(cat => (
                        <div key={cat.id} className="category-item-card">
                            <div className="category-header">
                                <strong>{cat.name}</strong>
                                <button className="btn-del" onClick={() => deleteCategory(cat.id)}>✕</button>
                            </div>
                            <div className="sub-category-list">
                                {cat.subCategories.map(sub => (
                                    <div key={sub.id} className="sub-category-item">
                                        <span>{sub.name}</span>
                                        <button onClick={() => deleteSubCategory(cat.id, sub.id)}>✕</button>
                                    </div>
                                ))}
                            </div>
                        </div>
                    ))}
                </div>
            </div>
        </div>
    );
}
