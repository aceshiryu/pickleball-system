// The built-in logo mark, shown wherever the facility hasn't uploaded its own
// `logoUrl`. A white pickleball whose holes are punched in the brand colour, so
// it sits on the brand gradient tile the call sites already render. Kept in one
// place so the placeholder can't drift between the header, onboarding and
// settings — same reasoning as SlotCalendar.
//
// `size` is the pickleball diameter in px. The holes and their layout scale
// with it, so it stays legible from the 14px header mark to the 26px settings
// preview. Matches apps/web/src/app/icon.svg (the favicon).
export default function BrandMark({ size = 22 }: { size?: number }) {
  const holes = [
    [50, 32], [32, 39], [68, 39],
    [26, 50], [50, 50], [74, 50],
    [39, 68], [61, 68], [50, 74],
  ];
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      <circle cx="50" cy="50" r="50" fill="#fff" />
      <g fill="var(--brand-primary)">
        {holes.map(([cx, cy], i) => (
          <circle key={i} cx={cx} cy={cy} r="6" />
        ))}
      </g>
    </svg>
  );
}
