const tooltipStyles = (
  <style>{`
.tooltip-wrap {
  position: relative;
  display: inline-flex;
}
.tooltip-wrap .tooltip-text {
  visibility: hidden;
  opacity: 0;
  position: absolute;
  bottom: calc(100% + 6px);
  left: 50%;
  transform: translateX(-50%);
  background: rgba(30,58,95,0.85);
  color: white;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 0.75rem;
  font-weight: 600;
  white-space: nowrap;
  pointer-events: none;
  transition: opacity 0.15s, transform 0.15s;
  z-index: 999;
}
.tooltip-wrap:hover .tooltip-text {
  visibility: visible;
  opacity: 1;
}
`}</style>
);

export default function Tooltip({ children, text, position = 'top', block }) {
  return (
    <>
      {tooltipStyles}
      <div className="tooltip-wrap" style={block ? { display: 'flex' } : undefined}>
        {children}
        <span className="tooltip-text" style={{
          bottom: position === 'top' ? 'calc(100% + 6px)' : undefined,
          top: position === 'bottom' ? 'calc(100% + 6px)' : undefined,
        }}>
          {text}
        </span>
      </div>
    </>
  );
}