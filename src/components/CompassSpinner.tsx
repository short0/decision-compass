export default function CompassSpinner({ size = 64 }: { size?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-label="Loading"
    >
      <circle cx="50" cy="50" r="46" stroke="#7a9ab0" strokeWidth="2.5" />
      <g style={{ transformOrigin: "50px 50px", animation: "compass-seek 2.8s linear infinite" }}>
        <polygon points="50,7 43,50 50,47" fill="#4a6a82" />
        <polygon points="50,7 57,50 50,47" fill="#253545" />
        <polygon points="50,88 43,50 50,53" fill="#b5cad6" />
        <polygon points="50,88 57,50 50,53" fill="#8faabb" />
      </g>
    </svg>
  );
}
