const LoadingScreen: React.FC = () => {
    return (
        <div style={{
            width: '100%',
            height: "100dvh",
            display: 'flex',
            justifyContent: 'center',
            flexDirection: 'column',
            alignItems: 'center',
            position: 'fixed',
            top: 0,
            left: 0,
            backgroundColor: 'rgba(240, 224, 224, 0.59)',
            backdropFilter: 'blur(10px)',
            zIndex: 1000,
        }}>
                <svg
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 200 200"
                    width="150"
                    height="150"
                    role="img"
                    aria-label="Loading spinner with dollar sign"
                >
                    <defs>
                        <linearGradient
                            id="bgGrad"
                            x1="0"
                            x2="0"
                            y1="0"
                            y2="1"
                        >
                            <stop
                                offset="0"
                                stopColor="#042733"
                            />
                            <stop
                                offset="1"
                                stopColor="#03202a"
                            />
                        </linearGradient>

                        <filter
                            id="softDrop"
                            x="-50%"
                            y="-50%"
                            width="200%"
                            height="200%"
                        >
                            <feGaussianBlur
                                in="SourceAlpha"
                                stdDeviation="6"
                                result="blur"
                            />
                            <feOffset
                                in="blur"
                                dx="0"
                                dy="4"
                                result="off"
                            />
                            <feMerge>
                                <feMergeNode in="off" />
                                <feMergeNode in="SourceGraphic" />
                            </feMerge>
                        </filter>
                    </defs>

                    <rect
                        x="6"
                        y="6"
                        width="188"
                        height="188"
                        rx="30"
                        ry="30"
                        fill="url(#bgGrad)"
                    />

                    <g transform="translate(100,100)">
                        <circle
                            r="70"
                            fill="none"
                            stroke="#0fb6bb"
                            strokeOpacity="0.05"
                            strokeWidth="12"
                        />
                        <circle
                            r="70"
                            fill="none"
                            stroke="#07c2c6"
                            strokeWidth="6"
                            strokeLinecap="round"
                            strokeDasharray="14 430"
                            transform="rotate(-90)"
                        >
                            <animateTransform
                                attributeName="transform"
                                attributeType="XML"
                                type="rotate"
                                from="0"
                                to="360"
                                dur="1.6s"
                                repeatCount="indefinite"
                            />
                            <animate
                                attributeName="stroke-opacity"
                                values="1;0.4;1"
                                dur="1.6s"
                                repeatCount="indefinite"
                            />
                        </circle>
                    </g>

                    <g
                        id="dollar"
                        transform="translate(100,100)"
                    >
                        <text
                            x="95"
                            y="105"
                            textAnchor="middle"
                            dominantBaseline="middle"
                            fontFamily="Segoe UI, Roboto, Arial, sans-serif"
                            fontWeight="800"
                            fontSize="90"
                            fill="#08c7cc"
                        >
                            $
                        </text>
                        <animateTransform
                            attributeName="transform"
                            type="scale"
                            values="1;1.06;1;0.98;1"
                            dur="1.4s"
                            repeatCount="indefinite"
                        />
                        <animate
                            attributeName="opacity"
                            values="1;0.92;1"
                            dur="1.4s"
                            repeatCount="indefinite"
                        />
                    </g>
                </svg>
                <h3 style={{ color: 'var(--primary-color)', marginTop: '20px' }}>Cargando...</h3>
        </div>
    );
};

export default LoadingScreen;
