export default function DogEasterEgg({ isExploding }) {
  if (!isExploding) return null;
  return (
    <div style={{
      position: 'fixed',
      bottom: '120px',
      left: '50%',
      width: 0,
      height: 0,
      zIndex: 999999,
      pointerEvents: 'none',
    }}>
      <svg style={{
        position: 'absolute',
        width: '300vmax',
        height: '300vmax',
        left: '-150vmax',
        top: '-150vmax',
        animation: 'dogHeartPulse 3.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards',
        transformOrigin: 'center center'
      }} viewBox="0 0 24 24" fill="rgba(244, 63, 94, 0.85)">
        <path d="M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z" />
      </svg>
    </div>
  );
}
