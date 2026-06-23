import { avatarColor, cx, initialsOf } from "@/lib/format";

export function Avatar({
  name,
  src,
  size = 40,
  className,
}: {
  name: string;
  src?: string;
  size?: number;
  className?: string;
}) {
  const dimension = { width: size, height: size };
  if (src) {
    return (
      <img
        src={src}
        alt={name}
        style={dimension}
        className={cx("rounded-full object-cover", className)}
      />
    );
  }
  return (
    <span
      style={{ ...dimension, backgroundColor: avatarColor(name) }}
      className={cx(
        "inline-flex items-center justify-center rounded-full font-semibold text-white",
        className
      )}
      aria-hidden="true"
    >
      <span style={{ fontSize: size * 0.38 }}>{initialsOf(name)}</span>
    </span>
  );
}
