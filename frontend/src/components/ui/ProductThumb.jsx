function nameToColor(name = '') {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  const hue = Math.abs(h) % 360;
  return { bg: `hsl(${hue}, 38%, 28%)`, text: `hsl(${hue}, 60%, 78%)` };
}

export default function ProductThumb({ name = '', size = 40 }) {
  const { bg, text } = nameToColor(name);
  const initial = name.trim().charAt(0).toUpperCase() || '·';
  return (
    <div style={{
      width: size, height: size, minWidth: size, flexShrink: 0,
      background: bg, borderRadius: '10px',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      color: text, fontWeight: 700, fontSize: Math.round(size * 0.42),
      userSelect: 'none', letterSpacing: '-0.01em',
    }}>
      {initial}
    </div>
  );
}
