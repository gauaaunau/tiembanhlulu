import './Features.css';

export default function Features() {
    const features = [
        {
            icon: '🍰',
            title: 'Bánh Ít Ngọt',
            description: 'Phù hợp cho bé và cả gia đình'
        },
        {
            icon: '✨',
            title: 'Đặt Mới Làm',
            description: 'Bánh mới mỗi ngày, không tồn kho'
        },
        {
            icon: '🎨',
            title: 'Bánh Theo Chủ Đề',
            description: 'Nhận đặt theo yêu cầu (trước 2-3 ngày)'
        },
        {
            icon: '🚚',
            title: 'Ship Tận Nơi',
            description: 'Bán kính 10km (khuyến khích đến lấy)'
        }
    ];

    return (
        <section className="features">
            <div className="features-container">
                <h2 className="features-title">🌟 Tại Sao Chọn LuLu?</h2>

                <div className="features-grid">
                    {features.map((feature, index) => (
                        <div
                            key={index}
                            className="feature-card cute-card"
                            style={{ animationDelay: `${index * 0.1}s` }}
                        >
                            <div className="feature-icon">{feature.icon}</div>
                            <h3 className="feature-title">{feature.title}</h3>
                            <p className="feature-description">{feature.description}</p>
                        </div>
                    ))}
                </div>
            </div>
        </section>
    );
}
