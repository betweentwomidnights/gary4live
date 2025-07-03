import React from 'react';
import { Loader2 } from 'lucide-react';

interface LoadingIndicatorProps {
    action: string | null;
}

const LoadingIndicator: React.FC<LoadingIndicatorProps> = ({ action }) => {
    if (!action) return null;

    // Map actions to user-friendly messages
    const actionMessages: { [key: string]: string } = {
        bang: 'generating initial audio...',
        continue: 'generating continuation...',
        retry: 'regenerating audio...',
        load_output: 'loading output...',
        crop: 'cropping audio...',
        transform: 'transforming audio...',
        reset_transform: 'clearing session state... you\'ll now go back to transforming the top waveform'
    };

    const message = actionMessages[action] || 'processing...';

    return (
        <div style={{
            position: 'fixed',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            backgroundColor: '#DC2626',
            color: 'white',
            borderColor: "white",
            borderStyle: "solid",    // Add this
            borderWidth: "2px",      // Add this
            padding: '8px 16px',
            borderRadius: '6px',
            boxShadow: '0 2px 4px rgba(0, 0, 0, 0.1)',
            zIndex: 1000,
            display: 'flex',
            alignItems: 'center',
            gap: '8px'
        }}>
            <Loader2 style={{
                width: '16px',
                height: '16px',
                animation: 'spin 1s linear infinite'
            }} />
            <span style={{ fontSize: '14px' }}>{message}</span>
        </div>
    );
};

// Add the keyframes for the spin animation
const styleSheet = document.createElement('style');
styleSheet.textContent = `
@keyframes spin {
    from {
        transform: rotate(0deg);
    }
    to {
        transform: rotate(360deg);
    }
}`;
document.head.appendChild(styleSheet);

export default LoadingIndicator;