import React, { useState, useRef, useEffect } from 'react';

const BackgroundRemover = () => {
    const [image, setImage] = useState(null);
    const [processedImage, setProcessedImage] = useState(null);
    const [tolerance, setTolerance] = useState(50); // 0-255 range for distance
    const [targetColor, setTargetColor] = useState({ r: 255, g: 255, b: 255 }); // Default white
    const [pickerMode, setPickerMode] = useState(false);

    const canvasRef = useRef(null);
    const fileInputRef = useRef(null);

    const handleImageUpload = (e) => {
        const file = e.target.files[0];
        if (file) {
            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    setImage(img);
                    setTargetColor({ r: 255, g: 255, b: 255 }); // Reset to white
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const handleCanvasClick = (e) => {
        if (!image || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        const x = (e.clientX - rect.left) * scaleX;
        const y = (e.clientY - rect.top) * scaleY;

        const ctx = canvas.getContext('2d');
        const pixel = ctx.getImageData(x, y, 1, 1).data;

        setTargetColor({ r: pixel[0], g: pixel[1], b: pixel[2] });
        setPickerMode(false); // Auto-process after pick
    };

    const processImage = () => {
        if (!image || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        canvas.width = image.width;
        canvas.height = image.height;

        ctx.drawImage(image, 0, 0);

        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        const { r: tr, g: tg, b: tb } = targetColor;
        const tolSquared = tolerance * tolerance;

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Euclidean distance squared is faster (no sqrt)
            const distSquared = (r - tr) ** 2 + (g - tg) ** 2 + (b - tb) ** 2;

            if (distSquared < tolSquared) {
                data[i + 3] = 0;
            }
        }

        ctx.putImageData(imageData, 0, 0);
        setProcessedImage(canvas.toDataURL('image/png'));
    };

    useEffect(() => {
        if (image) {
            processImage();
        }
    }, [image, tolerance, targetColor]);

    const handleDownload = () => {
        if (processedImage) {
            const link = document.createElement('a');
            link.download = 'removed-bg-lulu.png';
            link.href = processedImage;
            link.click();
        }
    };

    return (
        <div className="bg-remover-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
            <h2 style={{ textAlign: 'center', color: '#333' }}>Công Cụ Tách Nền (Magic Wand)</h2>

            <div className="controls" style={{ marginBottom: '20px', display: 'flex', gap: '15px', flexDirection: 'column', alignItems: 'center' }}>
                <div style={{ display: 'flex', gap: '10px' }}>
                    <button
                        onClick={() => fileInputRef.current.click()}
                        style={{ padding: '10px 20px', background: '#ff99cc', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer' }}
                    >
                        📤 Chọn Ảnh Mới
                    </button>
                    <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" style={{ display: 'none' }} />
                </div>

                {image && (
                    <div style={{ width: '100%', maxWidth: '500px', background: '#f5f5f5', padding: '15px', borderRadius: '8px' }}>
                        <div style={{ marginBottom: '10px', display: 'flex', alignItems: 'center', gap: '10px' }}>
                            <div
                                style={{
                                    width: '30px', height: '30px',
                                    backgroundColor: `rgb(${targetColor.r},${targetColor.g},${targetColor.b})`,
                                    border: '2px solid #ccc', borderRadius: '50%'
                                }}
                                title="Màu nền đang chọn"
                            />
                            <span>Màu cần xóa (Click vào ảnh để chọn lại)</span>
                        </div>

                        <label style={{ display: 'block', marginBottom: '5px' }}>Độ nhạy (Tolerance): {tolerance}</label>
                        <input
                            type="range"
                            min="1"
                            max="200"
                            value={tolerance}
                            onChange={(e) => setTolerance(parseInt(e.target.value))}
                            style={{ width: '100%' }}
                        />
                    </div>
                )}
            </div>

            <div className="preview-area" style={{
                border: '2px dashed #ccc',
                minHeight: '300px',
                backgroundColor: '#eee',
                backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                position: 'relative',
                textAlign: 'center',
                cursor: 'crosshair'
            }}>
                <canvas
                    ref={canvasRef}
                    onClick={handleCanvasClick}
                    style={{ maxWidth: '100%', maxHeight: '600px', display: image ? 'inline-block' : 'none' }}
                />
                {!image && <p style={{ padding: '50px', color: '#888' }}>Chưa có ảnh nào được chọn</p>}
            </div>

            {processedImage && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                        onClick={handleDownload}
                        style={{ padding: '15px 30px', background: '#4CAF50', color: 'white', border: 'none', borderRadius: '5px', cursor: 'pointer', fontSize: '18px', fontWeight: 'bold' }}
                    >
                        ⬇️ Tải Ảnh PNG
                    </button>
                </div>
            )}
        </div>
    );
};

export default BackgroundRemover;
