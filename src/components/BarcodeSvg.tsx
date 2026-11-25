// Padrões Code 128 (0..106): sequência de 6 larguras (barra, espaço, barra, espaço, barra, espaço)
// Índice 106 (STOP) possui 7 larguras (inclui barra final de 2 módulos).
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213',
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132',
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211',
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313',
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331',
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111',
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214',
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111',
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141',
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141',
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112',
];

function encodeCode128B(raw: string): number[] {
  const sanitized = raw
    .split('')
    .map((ch) => {
      const code = ch.charCodeAt(0);
      return code >= 32 && code <= 126 ? code - 32 : 16; // fallback '0'
    });

  const startCode = 104; // Start B
  let checksum = startCode;
  sanitized.forEach((val, idx) => {
    checksum += val * (idx + 1);
  });
  const checkDigit = checksum % 103;
  return [startCode, ...sanitized, checkDigit, 106];
}

export interface BarcodeLayout {
  cleanValue: string;
  bars: { x: number; w: number }[];
  totalWidth: number;
}

export function getCode128Bars(value: string): BarcodeLayout {
  const cleanValue = (value || '000000').trim();
  const codes = encodeCode128B(cleanValue);

  const bars: { x: number; w: number }[] = [];
  let cursor = 10; // quiet zone esquerda

  for (const code of codes) {
    const pattern = CODE128_PATTERNS[code] ?? CODE128_PATTERNS[0];
    for (let i = 0; i < pattern.length; i++) {
      const width = Number(pattern[i]);
      if (i % 2 === 0) {
        bars.push({ x: cursor, w: width });
      }
      cursor += width;
    }
  }

  return {
    cleanValue,
    bars,
    totalWidth: cursor + 10, // quiet zone direita
  };
}

interface BarcodeSvgProps {
  value: string;
  height?: number;
  showText?: boolean;
}

export function BarcodeSvg({ value, height = 38, showText = true }: BarcodeSvgProps) {
  const { cleanValue, bars, totalWidth } = getCode128Bars(value);
  const svgHeight = showText ? height + 14 : height;

  return (
    <div className="flex flex-col items-center w-full">
      <svg
        viewBox={`0 0 ${totalWidth} ${svgHeight}`}
        className="w-full max-w-full h-auto"
        role="img"
        aria-label={`Código de barras ${cleanValue}`}
      >
        <rect x={0} y={0} width={totalWidth} height={svgHeight} fill="#ffffff" />
        {bars.map((bar, idx) => (
          <rect key={idx} x={bar.x} y={2} width={bar.w} height={height} fill="#000000" />
        ))}
        {showText && (
          <text
            x={totalWidth / 2}
            y={height + 12}
            textAnchor="middle"
            fontSize="10"
            fontFamily="monospace"
            fontWeight="700"
            fill="#000000"
          >
            {cleanValue}
          </text>
        )}
      </svg>
    </div>
  );
}
