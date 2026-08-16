import React from 'react';

interface FormattedTextProps {
  content: string;
  className?: string;
}

export const FormattedText: React.FC<FormattedTextProps> = ({ content, className }) => {
  if (!content) return null;

  const renderInline = (text: string) => {
    // Match inline `code` and **bold**
    const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*)/g);
    return parts.map((part, idx) => {
      if (part.startsWith('`') && part.endsWith('`')) {
        return (
          <code key={idx} className="inline-code-pill">
            {part.slice(1, -1)}
          </code>
        );
      }
      if (part.startsWith('**') && part.endsWith('**')) {
        return <strong key={idx}>{part.slice(2, -2)}</strong>;
      }
      return part;
    });
  };

  // Split by newlines
  const lines = content.split(/\n+/);

  return (
    <div className={`formatted-text-block ${className || ''}`}>
      {lines.map((line, lineIdx) => {
        // If line contains numbered list like "1. ...; 2. ...; 3. ..."
        if (/(?:^|\s)[1-9]\.\s/.test(line) && line.includes(';')) {
          const steps = line.split(/;\s*(?=[1-9]\.\s*)/);
          return (
            <div key={lineIdx} className="formatted-step-list">
              {steps.map((step, sIdx) => {
                const cleanedStep = step.trim().replace(/;$/, '');
                return (
                  <div key={sIdx} className="formatted-step-item">
                    <span className="step-num-badge">{sIdx + 1}</span>
                    <span className="step-text">{renderInline(cleanedStep.replace(/^[1-9]\.\s*/, ''))}</span>
                  </div>
                );
              })}
            </div>
          );
        }
        return (
          <p key={lineIdx} className="formatted-paragraph">
            {renderInline(line)}
          </p>
        );
      })}
    </div>
  );
};
