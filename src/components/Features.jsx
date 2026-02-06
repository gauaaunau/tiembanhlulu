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
            <div className="wave-top">
                <svg viewBox="0 0 1440 120" preserveAspectRatio="none" style={{ display: 'block', width: '100%', height: '60px' }}>
                    <path
                        fill="var(--white)"
                        d="M0,32L48,42.7C96,53,192,75,288,80C384,85,480,75,576,58.7C672,43,768,21,864,16C960,11,1056,21,1152,37.3C1248,53,1344,75,1392,85.3L1440,96L1440,0L1392,0C1344,0,1248,0,1152,0C1056,0,960,0,864,0C768,0,672,0,576,0C480,0,384,0,288,0C192,0,96,0,48,0L0,0Z"
                    ></path>
                </svg>
            </div>
            <div className="features-container" style={{ position: 'relative', zIndex: 1 }}>
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
