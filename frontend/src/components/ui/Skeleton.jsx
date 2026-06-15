const keyframesStyle = (
  <style>{`
@keyframes skeleton-shimmer {
  0% { background-position: -200% 0; }
  100% { background-position: 200% 0; }
}
.skeleton {
  background: linear-gradient(90deg, rgba(255,255,255,0.04) 25%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 75%);
  background-size: 200% 100%;
  animation: skeleton-shimmer 1.5s ease-in-out infinite;
  border-radius: 6px;
}
`}</style>
);

function SkeletonLine({ width = '100%', height = '16px', style = {} }) {
  return (
    <>
      {keyframesStyle}
      <div className="skeleton" style={{ width, height, ...style }} />
    </>
  );
}

function SkeletonCard({ lines = 3, style = {} }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '12px', padding: '24px', border: '1px solid var(--border-color)', ...style }}>
      <SkeletonLine width="40%" height="20px" style={{ marginBottom: '16px' }} />
      {Array.from({ length: lines }).map((_, i) => (
        <SkeletonLine key={i} width={`${60 + Math.random() * 40}%`} height="14px" style={{ marginBottom: '10px' }} />
      ))}
    </div>
  );
}

function SkeletonTable({ rows = 5, cols = 6 }) {
  return (
    <div style={{ background: 'var(--bg-card)', borderRadius: '16px', border: '1px solid var(--border-color)', overflow: 'hidden' }}>
      <div style={{ padding: '16px 24px', borderBottom: '1px solid var(--border-color)', display: 'flex', gap: '24px' }}>
        {Array.from({ length: cols }).map((_, i) => (
          <SkeletonLine key={i} width={`${80 / cols}%`} height="14px" />
        ))}
      </div>
      {Array.from({ length: rows }).map((_, r) => (
        <div key={r} style={{ padding: '16px 24px', borderBottom: r < rows - 1 ? '1px solid rgba(255,255,255,0.03)' : 'none', display: 'flex', gap: '24px' }}>
          {Array.from({ length: cols }).map((_, c) => (
            <SkeletonLine key={c} width={`${80 / cols}%`} height="14px" />
          ))}
        </div>
      ))}
    </div>
  );
}

export { SkeletonLine, SkeletonCard, SkeletonTable };
export default SkeletonTable;