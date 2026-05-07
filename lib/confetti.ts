const CONFETTI_COLORS = ["#de7c35", "#0f766e", "#73adc9", "#f7c948", "#ef6f6c", "#fffdf8"];

export const CONFETTI_PIECES = Array.from({ length: 42 }, (_, index) => ({
  color: CONFETTI_COLORS[index % CONFETTI_COLORS.length],
  delay: `${(index % 14) * 0.16}s`,
  duration: `${3.8 + (index % 5) * 0.35}s`,
  left: `${(index * 23) % 100}%`,
  rotate: `${(index * 37) % 180}deg`,
  size: `${7 + (index % 4) * 2}px`,
  sway: `${index % 2 === 0 ? "" : "-"}${18 + (index % 5) * 7}px`
}));
