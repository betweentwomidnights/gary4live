import React, { useState, useEffect } from 'react';
import { X } from 'lucide-react';

interface NotificationOverlayProps {
    maxConnection: boolean;
    backendConnection: boolean;
    errorMessage?: {
        type: string;
        message: string;
    } | null;
}

const NotificationOverlay: React.FC<NotificationOverlayProps> = ({
    maxConnection,
    backendConnection,
    errorMessage
}) => {
    const [isVisible, setIsVisible] = useState(false);
    const [message, setMessage] = useState('');
    const [isError, setIsError] = useState(false);
    const [showBackendWarning, setShowBackendWarning] = useState(false);
    const [isPersistent, setIsPersistent] = useState(false);

    useEffect(() => {
        // Handle initial connection attempts
        if (maxConnection) {
            // Give backend some time to connect before showing warning
            const backendTimeout = setTimeout(() => {
                if (!backendConnection) {
                    setMessage("still not connected to backend. is your wifi on homie? try pressing '3' in m4l again.");
                    setIsError(true);
                    setIsVisible(true);
                    setShowBackendWarning(true);
                    setIsPersistent(false);
                }
            }, 5000);

            // Show initial max connection message
            if (!showBackendWarning) {
                setMessage(backendConnection
                    ? 'connected to max for live & backend 🎵'
                    : 'connected to max for live 🎵'
                );
                setIsError(false);
                setIsVisible(true);
                setIsPersistent(false);
            }

            return () => clearTimeout(backendTimeout);
        }
    }, [maxConnection, backendConnection]);

    // Handle error messages
    useEffect(() => {
        if (errorMessage) {
            // Check if this is an error that should show Discord link
            const shouldShowDiscord = (
                (errorMessage.type === 'transform' && errorMessage.message.includes('discord.gg')) ||
                (errorMessage.type === 'ffmpeg' && errorMessage.message.includes('discord'))
            );
            
            setMessage(errorMessage.message);
            setIsError(true);
            setIsVisible(true);
            setIsPersistent(shouldShowDiscord);
        }
    }, [errorMessage]);

    // Auto-hide for non-persistent notifications
    useEffect(() => {
        if (isVisible && !isPersistent) {
            const hideTimer = setTimeout(() => {
                setIsVisible(false);
                if (isError) {
                    setShowBackendWarning(false);
                }
            }, 3000);
            return () => clearTimeout(hideTimer);
        }
    }, [isVisible, isError, isPersistent]);

    if (!isVisible) return null;

    // Function to parse message and create elements with clickable link
    const renderMessage = (text: string) => {
        if (text.includes('discord.gg')) {
            const parts = text.split('https://discord.gg/');
            const discordLink = `https://discord.gg/${parts[1]}`;
            
            return (
                <>
                    {parts[0]}
                    <a
                        href={discordLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-white underline hover:text-gray-200"
                    >
                        join discord
                    </a>
                </>
            );
        }
        return text;
    };

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: isError ? '#EF4444' : '#DF0000',
            color: 'white',
            padding: '8px 16px',
            borderRadius: '20px',
            borderColor: "white",
            borderStyle: "solid",    // Add this
            borderWidth: "2px",      // Add this
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            maxWidth: '300px',
            textAlign: 'center',
            wordWrap: 'break-word',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.4',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px'
        }}>
            {isPersistent && (
                <button
                    onClick={() => setIsVisible(false)}
                    style={{
                        position: 'absolute',
                        top: '4px',
                        right: '4px',
                        background: 'none',
                        border: 'none',
                        color: 'white',
                        cursor: 'pointer',
                        padding: '4px'
                    }}
                >
                    <X size={16} />
                </button>
            )}
            <div style={{ marginTop: isPersistent ? '12px' : '0' }}>
                {renderMessage(message)}
            </div>
        </div>
    );
};

export default NotificationOverlay;