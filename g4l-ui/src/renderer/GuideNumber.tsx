import React, { useState, useRef, useEffect } from 'react';

interface GuideNumberProps {
    number: number;
    blurb: string;
    isTransformButton?: boolean;  // Add this prop
    isBottomButton?: boolean;
}

const GuideNumber: React.FC<GuideNumberProps> = ({ number, blurb, isTransformButton, isBottomButton }) => {
    const [showTooltip, setShowTooltip] = useState(false);
    const tooltipRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (showTooltip && tooltipRef.current) {
            const tooltip = tooltipRef.current;
            tooltip.style.visibility = 'hidden';
            tooltip.style.display = 'block';

            setTimeout(() => {
                const tooltipRect = tooltip.getBoundingClientRect();
                const guideNumberRect = tooltip.parentElement?.getBoundingClientRect();

                // Reset styles
                tooltip.style.left = 'auto';
                tooltip.style.right = 'auto';
                tooltip.style.transform = 'none';
                tooltip.style.top = '';
                tooltip.style.maxHeight = '';
                tooltip.style.overflowY = '';

                // Special handling for transform buttons
                if (isTransformButton) {
                  // Position the guide number to the left of the button
                  tooltip.style.right = 'calc(100% + 10px)';  // Position left with spacing
                  tooltip.style.left = 'auto';
                  tooltip.style.transform = 'none';  // Remove any previous transforms
                  
                  // Vertical centering
                  if (guideNumberRect) {
                      const buttonHeight = guideNumberRect.height;
                      const tooltipHeight = tooltipRect.height;
                      tooltip.style.top = `${(buttonHeight - tooltipHeight) / 2}px`;
                  }
                  
                  // Ensure tooltip doesn't go off screen to the left
                  const leftEdge = tooltipRect.left;
                  if (leftEdge < 0) {
                      tooltip.style.right = 'auto';
                      tooltip.style.left = '-10px';  // Small negative offset to avoid button overlap
                  }
              
                  } else if (isBottomButton) {
                    // Force tooltip to appear above the guide number
                    tooltip.style.bottom = '100%';
                    tooltip.style.top = 'auto';
                    tooltip.style.left = '50%';
                    tooltip.style.transform = 'translateX(-50%)';
                    
                    // Check if tooltip would go off left/right edges
                    const updatedTooltipRect = tooltip.getBoundingClientRect();
                    if (updatedTooltipRect.right > window.innerWidth) {
                        tooltip.style.left = 'auto';
                        tooltip.style.right = '0';
                        tooltip.style.transform = 'none';
                    }
                    if (updatedTooltipRect.left < 0) {
                        tooltip.style.left = '0';
                        tooltip.style.right = 'auto';
                        tooltip.style.transform = 'none';
                    }
                
                } else {
                    // Original positioning logic for other guide numbers
                    tooltip.style.left = '50%';
                    tooltip.style.transform = 'translateX(-50%)';

                    const spaceAbove = guideNumberRect ? guideNumberRect.top : 0;
                    const spaceBelow = guideNumberRect
                        ? window.innerHeight - guideNumberRect.bottom
                        : 0;

                    if (spaceBelow >= tooltipRect.height) {
                        tooltip.style.top = '100%';
                    } else if (spaceAbove >= tooltipRect.height) {
                        tooltip.style.top = `-${tooltipRect.height}px`;
                    } else {
                        if (spaceBelow >= spaceAbove) {
                            tooltip.style.top = '100%';
                            tooltip.style.maxHeight = `${spaceBelow}px`;
                            tooltip.style.overflowY = 'auto';
                        } else {
                            tooltip.style.top = `-${spaceAbove}px`;
                            tooltip.style.maxHeight = `${spaceAbove}px`;
                            tooltip.style.overflowY = 'auto';
                        }
                    }

                    // Edge detection for non-transform buttons
                    const updatedTooltipRect = tooltip.getBoundingClientRect();
                    if (updatedTooltipRect.right > window.innerWidth) {
                        tooltip.style.left = 'auto';
                        tooltip.style.right = '0';
                        tooltip.style.transform = 'none';
                    }
                    if (updatedTooltipRect.left < 0) {
                        tooltip.style.left = '0';
                        tooltip.style.right = 'auto';
                        tooltip.style.transform = 'none';
                    }
                }

                tooltip.style.visibility = 'visible';
            }, 10);
        }
    }, [showTooltip, isTransformButton]);

    return (
        <div
            className="guide-number"
            onMouseEnter={() => setShowTooltip(true)}
            onMouseLeave={() => setShowTooltip(false)}
        >
            {number}
            {showTooltip && (
                <div 
                    className="tooltip" 
                    ref={tooltipRef}
                    style={{ zIndex: isTransformButton ? 2025 : undefined }}
                >
                    {blurb}
                </div>
            )}
        </div>
    );
};

export default GuideNumber;