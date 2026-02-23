export const RRLogo = ({
  size = 32,
  fill = "#00805E",
  className,
}: {
  size?: number;
  fill?: string;
  className?: string;
}) => (
  <svg
    width={size}
    height={size}
    viewBox="0 0 32 33"
    fill="none"
    className={className}
  >
    <path
      d="M16.2075 15.7591C16.2075 15.7591 27.6423 16.0658 28.0006 3.99988H16.2075V15.7591Z"
      fill={fill}
    />
    <path
      d="M4 15.7592C4 15.7592 15.4992 16.0659 15.8006 4H4V15.7592Z"
      fill={fill}
    />
    <path
      d="M4 27.9997C4 27.9997 15.4626 28.2417 15.8006 16.2405H4V27.9997Z"
      fill={fill}
    />
    <path
      d="M16.207 27.9997C16.207 27.9997 27.8285 28.1249 28.0001 16.2405H16.207V27.9997Z"
      fill={fill}
    />
  </svg>
);
