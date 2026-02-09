import React, { useState, useRef, useEffect } from 'react';

const BackgroundRemover = () => {
    const [image, setImage] = useState(null);
    const [processedImage, setProcessedImage] = useState(null);
    const [tolerance, setTolerance] = useState(30); // 0-100
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
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        }
    };

    const processImage = () => {
        if (!image || !canvasRef.current) return;

        const canvas = canvasRef.current;
        const ctx = canvas.getContext('2d');

        // Set canvas size to image size
        canvas.width = image.width;
        canvas.height = image.height;

        // Draw original image
        ctx.drawImage(image, 0, 0);

        // Get image data
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = imageData.data;

        // Process pixels
        const threshold = tolerance * 2.55 * 3; // Approx max distance for RGB

        for (let i = 0; i < data.length; i += 4) {
            const r = data[i];
            const g = data[i + 1];
            const b = data[i + 2];

            // Simple distance from white (255, 255, 255)
            // Or just check if all channels are high
            // Let's use Euclidean distance from white
            // const dist = Math.sqrt(
            //     Math.pow(255 - r, 2) + 
            //     Math.pow(255 - g, 2) + 
            //     Math.pow(255 - b, 2)
            // );

            // Simpler check: if it's "close enough" to white
            // 255 - r < tol && ...

            // Using average brightness approach + difference
            const isWhite = (r > 255 - tolerance * 2.55) &&
                (g > 255 - tolerance * 2.55) &&
                (b > 255 - tolerance * 2.55);

            if (isWhite) {
                data[i + 3] = 0; // Set alpha to 0
            }
        }

        ctx.putImageData(imageData, 0, 0);
        setProcessedImage(canvas.toDataURL('image/png'));
    };

    useEffect(() => {
        if (image) {
            processImage();
        }
    }, [image, tolerance]);

    const handleDownload = () => {
        if (processedImage) {
            const link = document.createElement('a');
            link.download = 'processed-image.png';
            link.href = processedImage;
            link.click();
        }
    };

    return (
        <div className="bg-remover-container" style={{ padding: '20px', maxWidth: '800px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
            <h2 style={{ textAlign: 'center', color: '#333' }}>Công Cụ Tách Nền Trắng (Beta)</h2>

            <div className="controls" style={{ marginBottom: '20px', display: 'flex', gap: '10px', flexDirection: 'column', alignItems: 'center' }}>
                <input
                    type="file"
                    ref={fileInputRef}
                    onChange={handleImageUpload}
                    accept="image/*"
                    style={{ display: 'none' }}
                />
                <button
                    onClick={() => fileInputRef.current.click()}
                    style={{
                        padding: '10px 20px',
                        background: '#ff99cc',
                        color: 'white',
                        border: 'none',
                        borderRadius: '5px',
                        cursor: 'pointer',
                        fontSize: '16px'
                    }}
                >
                    📤 Chọn Ảnh
                </button>

                {image && (
                    <div style={{ width: '100%', maxWidth: '300px', marginTop: '10px' }}>
                        <label style={{ display: 'block', marginBottom: '5px' }}>Độ nhạy (Tolerance): {tolerance}</label>
                        <input
                            type="range"
                            min="1"
                            max="100"
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
                display: 'flex',
                justifyContent: 'center',
                alignItems: 'center',
                backgroundColor: '#eee',
                backgroundImage: 'linear-gradient(45deg, #ccc 25%, transparent 25%), linear-gradient(-45deg, #ccc 25%, transparent 25%), linear-gradient(45deg, transparent 75%, #ccc 75%), linear-gradient(-45deg, transparent 75%, #ccc 75%)',
                backgroundSize: '20px 20px',
                backgroundPosition: '0 0, 0 10px, 10px -10px, -10px 0px',
                position: 'relative',
                overflow: 'hidden'
            }}>
                <canvas ref={canvasRef} style={{ maxWidth: '100%', maxHeight: '600px', display: image ? 'block' : 'none' }} />
                {!image && <p style={{ color: '#888' }}>Chưa có ảnh nào được chọn</p>}
            </div>

            {processedImage && (
                <div style={{ textAlign: 'center', marginTop: '20px' }}>
                    <button
                        onClick={handleDownload}
                        style={{
                            padding: '15px 30px',
                            background: '#4CAF50',
                            color: 'white',
                            border: 'none',
                            borderRadius: '5px',
                            cursor: 'pointer',
                            fontSize: '18px',
                            fontWeight: 'bold'
                        }}
                    >
                        ⬇️ Tải Ảnh PNG
                    </button>
                    <p style={{ marginTop: '5px', fontSize: '12px', color: '#666' }}>*Ảnh tải về sẽ có nền trong suốt</p>
                </div>
            )}
        </div>
    );
};

export default BackgroundRemover;
